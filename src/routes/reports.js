import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

const ALLOWED_REASONS = [
  'INCORRECT_INFO',
  'OUTDATED_INFO',
  'BROKEN_SOURCE',
  'MISLEADING_EARNINGS',
  'SUSPICIOUS_PAYMENT',
  'SCAM',
  'FAKE_PROOF',
  'UNSAFE_BEHAVIOR',
  'PRIVACY_CONCERN',
  'OTHER',
  'PAYMENT_ISSUE',
  'SPAM',
  'HARASSMENT'
];

/**
 * File a Report (Scam, Misleading Claims, Broken Source, Fake Proof, etc.)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { targetType, targetId, reason, details, evidenceUrl } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ success: false, error: 'Target type, target ID, and reason are required.' });
    }

    if (!ALLOWED_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: `Invalid report reason. Allowed reasons include: ${ALLOWED_REASONS.slice(0, 10).join(', ')}`
      });
    }

    // Basic URL validation if evidenceUrl provided
    if (evidenceUrl && typeof evidenceUrl === 'string') {
      if (evidenceUrl.startsWith('javascript:') || evidenceUrl.startsWith('data:')) {
        return res.status(400).json({ success: false, error: 'Invalid evidence URL scheme.' });
      }
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        targetType, // OPPORTUNITY, COMMENT, USER, SUBMISSION
        targetId: String(targetId),
        reason,
        details: details?.trim() || null,
        evidenceUrl: evidenceUrl?.trim() || null,
        status: 'OPEN'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Report submitted. Reports are reviewed by the EarnRadar moderation team. A report does not automatically mean the opportunity is fraudulent.',
      reportId: report.id,
      report
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;

