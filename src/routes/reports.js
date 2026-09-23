import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * File a Report (Scam, Fake Proof, Harassment, Misleading Earnings)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { targetType, targetId, reason, details } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ success: false, error: 'Target type, target ID, and reason are required.' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        targetType, // OPPORTUNITY, COMMENT, USER, SUBMISSION
        targetId: String(targetId),
        reason,
        details: details?.trim() || null,
        status: 'OPEN'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for reporting. Our moderation team will investigate and take appropriate action.',
      reportId: report.id,
      report
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
