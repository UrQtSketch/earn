import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * List User's Collaborations & Requests
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const incoming = await prisma.collaborationRequest.findMany({
      where: { receiverId: req.user.id },
      include: {
        sender: {
          select: {
            id: true,
            profile: { select: { fullName: true, username: true, avatarUrl: true, skills: true } }
          }
        },
        opportunity: { select: { id: true, title: true, slug: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const outgoing = await prisma.collaborationRequest.findMany({
      where: { senderId: req.user.id },
      include: {
        receiver: {
          select: {
            id: true,
            profile: { select: { fullName: true, username: true, avatarUrl: true, skills: true } }
          }
        },
        opportunity: { select: { id: true, title: true, slug: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { user1Id: req.user.id },
          { user2Id: req.user.id }
        ],
        status: 'ACTIVE'
      },
      include: {
        user1: { select: { id: true, profile: { select: { fullName: true, username: true, avatarUrl: true, country: true } } } },
        user2: { select: { id: true, profile: { select: { fullName: true, username: true, avatarUrl: true, country: true } } } }
      }
    });

    const formattedConnections = connections.map(c => {
      const partner = c.user1Id === req.user.id ? c.user2 : c.user1;
      return {
        id: c.id,
        partnerId: partner.id,
        name: partner.profile?.fullName,
        username: partner.profile?.username,
        avatarUrl: partner.profile?.avatarUrl,
        country: partner.profile?.country,
        connectedSince: c.createdAt
      };
    });

    return res.json({
      success: true,
      incoming,
      outgoing,
      connections: formattedConnections
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send Collaboration Request
 */
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { receiverId, opportunityId, message } = req.body;

    if (!receiverId || !opportunityId) {
      return res.status(400).json({ success: false, error: 'Recipient and opportunity are required.' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot collaborate with yourself.' });
    }

    // Check if request already pending
    const existing = await prisma.collaborationRequest.findFirst({
      where: {
        senderId: req.user.id,
        receiverId,
        opportunityId,
        status: 'PENDING'
      }
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'A collaboration request is already pending with this user.' });
    }

    const request = await prisma.collaborationRequest.create({
      data: {
        senderId: req.user.id,
        receiverId,
        opportunityId,
        message: message?.trim() || 'Hi! I would like to collaborate with you on this opportunity.'
      },
      include: {
        opportunity: { select: { title: true } }
      }
    });

    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'COLLABORATION_REQUEST',
        title: 'New Collaboration Request',
        message: `${req.user.profile?.fullName || 'A member'} requested to collaborate on "${request.opportunity?.title || 'an opportunity'}".`,
        link: '/collaborations'
      }
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Collaboration request sent successfully!',
      request
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Respond to Request (ACCEPT / DECLINE / CANCEL)
 */
router.post('/respond/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // ACCEPT, DECLINE, CANCEL

    const request = await prisma.collaborationRequest.findUnique({
      where: { id: requestId },
      include: { opportunity: { select: { title: true } } }
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Collaboration request not found.' });
    }

    if (action === 'CANCEL') {
      if (request.senderId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Only the sender can cancel this request.' });
      }
      await prisma.collaborationRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' }
      });
      return res.json({ success: true, message: 'Collaboration request cancelled.' });
    }

    if (request.receiverId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized to respond to this request.' });
    }

    if (action === 'ACCEPT') {
      await prisma.collaborationRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' }
      });

      // Establish Connection if not already connected
      const u1 = request.senderId < request.receiverId ? request.senderId : request.receiverId;
      const u2 = request.senderId < request.receiverId ? request.receiverId : request.senderId;

      await prisma.connection.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: { status: 'ACTIVE' },
        create: { user1Id: u1, user2Id: u2, status: 'ACTIVE' }
      });

      // Upsert Conversation
      const conversation = await prisma.conversation.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: {},
        create: { user1Id: u1, user2Id: u2 }
      });

      // Post initial welcome message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: req.user.id,
          recipientId: request.senderId,
          content: `Collaboration request accepted! Let's connect on this opportunity.`
        }
      });

      await prisma.notification.create({
        data: {
          userId: request.senderId,
          type: 'COLLABORATION_ACCEPTED',
          title: 'Collaboration Request Accepted!',
          message: `${req.user.profile?.fullName || 'Your partner'} accepted your collaboration request on "${request.opportunity?.title || 'opportunity'}".`,
          link: '/messages'
        }
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'Collaboration accepted! You can now message each other safely in Platform Messages.',
        conversationId: conversation.id
      });
    }


    if (action === 'DECLINE') {
      await prisma.collaborationRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' }
      });
      return res.json({ success: true, message: 'Request declined.' });
    }

    return res.status(400).json({ success: false, error: 'Invalid action.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
