import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * List all Conversations for the authenticated user
 */
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id }
        ]
      },
      include: {
        user1: { select: { id: true, profile: { select: { fullName: true, username: true, avatarUrl: true } } } },
        user2: { select: { id: true, profile: { select: { fullName: true, username: true, avatarUrl: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formatted = conversations.map(c => {
      const partner = c.user1Id === req.user.id ? c.user2 : c.user1;
      const lastMsg = c.messages[0] || null;
      return {
        id: c.id,
        partner: {
          id: partner.id,
          name: partner.profile?.fullName,
          username: partner.profile?.username,
          avatarUrl: partner.profile?.avatarUrl
        },
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          senderId: lastMsg.senderId,
          createdAt: lastMsg.createdAt,
          isRead: lastMsg.isRead
        } : null,
        updatedAt: c.updatedAt
      };
    });

    return res.json({ success: true, conversations: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Messages in a Conversation
 */
router.get('/conversations/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user1: { select: { id: true, profile: { select: { fullName: true, username: true, avatarUrl: true } } } },
        user2: { select: { id: true, profile: { select: { fullName: true, username: true, avatarUrl: true } } } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    if (conversation.user1Id !== req.user.id && conversation.user2Id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this conversation.' });
    }

    const partner = conversation.user1Id === req.user.id ? conversation.user2 : conversation.user1;

    // Check if blocked
    const u1 = req.user.id < partner.id ? req.user.id : partner.id;
    const u2 = req.user.id < partner.id ? partner.id : req.user.id;
    const connection = await prisma.connection.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
    });
    const isBlocked = connection?.status === 'BLOCKED';

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        conversationId,
        recipientId: req.user.id,
        isRead: false
      },
      data: { isRead: true }
    });

    return res.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.profile?.fullName,
        username: partner.profile?.username,
        avatarUrl: partner.profile?.avatarUrl
      },
      isBlocked,
      messages: conversation.messages
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send a Message in Conversation (with safety warnings & anti-abuse)
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    let convId = conversationId;

    if (!convId) {
      if (!recipientId) {
        return res.status(400).json({ success: false, error: 'Recipient is required.' });
      }

      const u1 = req.user.id < recipientId ? req.user.id : recipientId;
      const u2 = req.user.id < recipientId ? recipientId : req.user.id;

      const conversation = await prisma.conversation.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: {},
        create: { user1Id: u1, user2Id: u2 }
      });
      convId = conversation.id;
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    const targetRecipientId = recipientId || (conversation.user1Id === req.user.id ? conversation.user2Id : conversation.user1Id);

    // Check block status
    const u1 = req.user.id < targetRecipientId ? req.user.id : targetRecipientId;
    const u2 = req.user.id < targetRecipientId ? targetRecipientId : req.user.id;
    const connection = await prisma.connection.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
    });
    if (connection?.status === 'BLOCKED') {
      return res.status(403).json({ success: false, error: 'Cannot send messages to this user because of blocking restrictions.' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: req.user.id,
        recipientId: targetRecipientId,
        content: content.trim()
      }
    });

    await prisma.conversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() }
    });

    // Create Notification for recipient
    await prisma.notification.create({
      data: {
        userId: targetRecipientId,
        type: 'NEW_MESSAGE',
        title: 'New message from ' + (req.user.profile?.fullName || 'a member'),
        message: content.slice(0, 80),
        link: '/messages'
      }
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message,
      safetyDisclaimer: 'Reminder: EarnRadar does not hold or guarantee payments between users. Never send money or share bank passwords.'
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Block / Unblock User
 */
router.post('/block', requireAuth, async (req, res) => {
  try {
    const { targetUserId, action } = req.body; // BLOCK, UNBLOCK

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Target user ID is required.' });
    }

    const u1 = req.user.id < targetUserId ? req.user.id : targetUserId;
    const u2 = req.user.id < targetUserId ? targetUserId : req.user.id;

    const newStatus = action === 'UNBLOCK' ? 'ACTIVE' : 'BLOCKED';

    await prisma.connection.upsert({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      update: { status: newStatus },
      create: { user1Id: u1, user2Id: u2, status: newStatus }
    });

    return res.json({
      success: true,
      message: action === 'UNBLOCK' ? 'User unblocked.' : 'User blocked successfully.'
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
