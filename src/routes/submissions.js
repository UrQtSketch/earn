import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { submissionLimiter } from '../middleware/rateLimiter.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

/**
 * Upload Evidence / Proof Media
 */
router.post('/upload-proof', requireAuth, upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded.' });
    }

    const fileUrls = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));

    return res.json({
      success: true,
      message: 'Proof media uploaded successfully.',
      files: fileUrls
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * List User's own Method Submissions
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const submissions = await prisma.methodSubmission.findMany({
      where: { authorId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = submissions.map(sub => {
      let parsedForm = {};
      try {
        parsedForm = JSON.parse(sub.formData);
      } catch (_) {}
      return {
        id: sub.id,
        title: sub.title,
        categoryId: sub.categoryId,
        status: sub.status,
        adminFeedback: sub.adminFeedback,
        submittedAt: sub.submittedAt,
        reviewedAt: sub.reviewedAt,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        summary: parsedForm.basicInfo?.shortDescription || '',
        categoryName: parsedForm.basicInfo?.categoryName || 'General'
      };
    });

    return res.json({ success: true, submissions: parsed });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Single Submission by ID (Owner only or Admin)
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await prisma.methodSubmission.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, username: true } }
          }
        }
      }
    });

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }

    if (submission.authorId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ success: false, error: 'Unauthorized access to submission.' });
    }

    let parsedForm = {};
    try {
      parsedForm = JSON.parse(submission.formData);
    } catch (_) {}

    return res.json({
      success: true,
      submission: {
        ...submission,
        formData: parsedForm
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create or Save Draft / Submit 9-Step Method
 */
router.post('/', requireAuth, submissionLimiter, async (req, res) => {
  try {
    const { formData, isDraft = false } = req.body;

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid submission data.' });
    }

    const title = formData.basicInfo?.title?.trim() || 'Untitled Opportunity Method';
    const categoryId = formData.basicInfo?.categoryId || 'cat_other';

    // If final submission (not draft), perform rigorous validation across all 9 steps
    if (!isDraft) {
      const b = formData.basicInfo || {};
      const w = formData.howItWorks || {};
      const r = formData.requirements || {};
      const m = formData.moneyDetails || {};
      const s = formData.safety || {};
      const src = formData.sources || {};
      const exp = formData.experience || {};

      if (!b.title || b.title.length < 5) {
        return res.status(400).json({ success: false, error: 'Step 1: Title must be at least 5 characters.' });
      }
      if (!b.shortDescription || b.shortDescription.length < 20) {
        return res.status(400).json({ success: false, error: 'Step 1: Please provide a clear description (at least 20 chars).' });
      }
      if (!w.steps || !Array.isArray(w.steps) || w.steps.length === 0) {
        return res.status(400).json({ success: false, error: 'Step 2: Please provide at least one clear step on how it works.' });
      }
      if (!m.earningModel) {
        return res.status(400).json({ success: false, error: 'Step 4: Please specify the earning model.' });
      }
      if (!s.knownRisks) {
        return res.status(400).json({ success: false, error: 'Step 7: Known risks must be disclosed for honesty standards.' });
      }
      if (!src.officialWebsite) {
        return res.status(400).json({ success: false, error: 'Step 8: Official source or platform URL is required.' });
      }

      // Check if user reported personal earnings
      if (exp.personallyUsed === 'Yes' && exp.amountEarned) {
        const earnedNum = parseFloat(exp.amountEarned);
        if (isNaN(earnedNum) || earnedNum < 0) {
          return res.status(400).json({ success: false, error: 'Step 9: Please enter a valid earnings number.' });
        }
      }
    }

    const status = isDraft ? 'DRAFT' : 'SUBMITTED';

    const submission = await prisma.methodSubmission.create({
      data: {
        authorId: req.user.id,
        title,
        categoryId,
        status,
        formData: JSON.stringify(formData),
        submittedAt: new Date()
      }
    });

    // If user provided personal earnings, create a reported earning record tied to submission
    if (!isDraft && formData.experience?.personallyUsed === 'Yes' && formData.experience?.amountEarned) {
      const earnedNum = parseFloat(formData.experience.amountEarned);
      if (!isNaN(earnedNum) && earnedNum > 0) {
        await prisma.reportedEarning.create({
          data: {
            userId: req.user.id,
            submissionId: submission.id,
            amount: earnedNum,
            currency: 'INR',
            period: formData.experience.timePeriod || 'Recent',
            hoursSpent: parseFloat(formData.experience.hoursSpent) || 0,
            attemptsCount: parseInt(formData.experience.attempts, 10) || 1,
            evidenceUrl: formData.proof?.files?.[0]?.url || null,
            status: 'USER_REPORTED'
          }
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Draft saved successfully.' : 'Method submitted for admin verification and review!',
      submission
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Edit / Update Submission (e.g., when Admin requested changes or updating draft)
 */
router.put('/:id', requireAuth, submissionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { formData, isDraft = false } = req.body;

    const existing = await prisma.methodSubmission.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }

    if (existing.authorId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not own this submission.' });
    }

    const title = formData?.basicInfo?.title?.trim() || existing.title;
    const categoryId = formData?.basicInfo?.categoryId || existing.categoryId;

    let newStatus = existing.status;
    if (!isDraft && (existing.status === 'DRAFT' || existing.status === 'CHANGES_REQUESTED')) {
      newStatus = 'SUBMITTED';
    }

    const updated = await prisma.methodSubmission.update({
      where: { id },
      data: {
        title,
        categoryId,
        status: newStatus,
        formData: JSON.stringify(formData),
        submittedAt: newStatus === 'SUBMITTED' ? new Date() : existing.submittedAt
      }
    });

    return res.json({
      success: true,
      message: newStatus === 'SUBMITTED' ? 'Updated and resubmitted for admin review!' : 'Submission draft updated.',
      submission: updated
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
