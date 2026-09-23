import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * List User's Notifications
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });

    return res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Mark notification as read
 */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true }
    });

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Mark all notifications as read
 */
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
