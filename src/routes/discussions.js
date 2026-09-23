import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * Post a Comment or Reply on an Opportunity
 */
router.post('/opportunity/:opportunityId', requireAuth, async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { content, parentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Comment cannot be empty.' });
    }

    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found.' });
    }

    // Anti-spam / scam link warning check
    const text = content.trim();
    if (text.match(/t\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/|telegram\.me\//i)) {
      return res.status(400).json({
        success: false,
        error: 'External shorteners and Telegram/WhatsApp invite links are restricted in discussions to protect against scams.'
      });
    }

    const comment = await prisma.comment.create({
      data: {
        opportunityId,
        authorId: req.user.id,
        parentId: parentId || null,
        content: text
      },
      include: {
        author: {
          select: {
            id: true,
            profile: { select: { fullName: true, username: true, avatarUrl: true } }
          }
        }
      }
    });

    if (opportunity.authorId && opportunity.authorId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: opportunity.authorId,
          type: 'NEW_COMMENT',
          title: 'New discussion on ' + opportunity.title,
          message: `${req.user.profile?.fullName || 'A member'}: "${text.slice(0, 60)}..."`,
          link: `/opportunities/${opportunity.slug}`
        }
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Comment posted.',
      comment
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Delete Own Comment (or Admin moderation)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found.' });
    }

    if (comment.authorId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this comment.' });
    }

    await prisma.comment.delete({ where: { id } });

    return res.json({ success: true, message: 'Comment deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
