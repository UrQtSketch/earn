import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { createAuditLog } from '../services/auditService.js';
import { sanitizeUser } from '../services/authService.js';

const router = Router();

// Require ADMIN or MODERATOR role for all routes in this router
router.use(requireAuth, requireRole('ADMIN', 'MODERATOR'));

/**
 * Admin Overview / Summary Metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalOpps,
      verifiedOpps,
      pendingSubmissions,
      openReports,
      totalReportedEarnings,
      activeCollabs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.opportunity.count(),
      prisma.opportunity.count({ where: { status: 'VERIFIED' } }),
      prisma.methodSubmission.count({ where: { status: { in: ['SUBMITTED', 'ADMIN_REVIEW'] } } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.reportedEarning.aggregate({ _sum: { amount: true } }),
      prisma.collaborationRequest.count({ where: { status: 'ACCEPTED' } })
    ]);

    const recentSubmissions = await prisma.methodSubmission.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { profile: { select: { fullName: true, username: true } } } } }
    });

    const recentReports = await prisma.report.findMany({
      take: 5,
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { profile: { select: { fullName: true, username: true } } } } }
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalOpps,
        verifiedOpps,
        pendingSubmissions,
        openReports,
        totalReportedEarnings: totalReportedEarnings._sum.amount || 0,
        activeCollabs
      },
      recentSubmissions,
      recentReports
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List Users with Search & Filter
 */
router.get('/users', async (req, res) => {
  try {
    const { search, status, role } = req.query;

    const where = {};
    if (status) where.status = status;
    if (role) where.role = role;

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { email: { contains: q } },
        { profile: { fullName: { contains: q } } },
        { profile: { username: { contains: q } } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        _count: {
          select: { authoredOpps: true, memberships: true, submissions: true, reportedEarnings: true }
        }
      }
    });

    const sanitized = users.map(u => ({
      ...sanitizeUser(u),
      counts: u._count
    }));

    return res.json({ success: true, users: sanitized });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update User Status (ACTIVE, SUSPENDED, BANNED) or Role
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (role && req.user.role === 'ADMIN') updateData.role = role;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { profile: true }
    });

    await createAuditLog({
      adminId: req.user.id,
      action: status ? `USER_${status}` : `USER_ROLE_${role}`,
      targetType: 'USER',
      targetId: id,
      details: { email: user.email, status, role },
      req
    });

    return res.json({
      success: true,
      message: `User updated successfully.`,
      user: sanitizeUser(updated)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * List Submissions for Moderation
 */
router.get('/submissions', async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const submissions = await prisma.methodSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, username: true, avatarUrl: true } }
          }
        }
      }
    });

    const parsed = submissions.map(sub => {
      let formData = {};
      try {
        formData = JSON.parse(sub.formData);
      } catch (_) {}
      return {
        ...sub,
        formData
      };
    });

    return res.json({ success: true, submissions: parsed });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Review Submission: Approve, Request Changes, Reject
 */
router.post('/submissions/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminFeedback, categoryId } = req.body; // APPROVE, REQUEST_CHANGES, REJECT

    const submission = await prisma.methodSubmission.findUnique({
      where: { id },
      include: { author: true }
    });

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found.' });
    }

    let parsedForm = {};
    try {
      parsedForm = JSON.parse(submission.formData);
    } catch (_) {}

    if (action === 'REQUEST_CHANGES') {
      if (!adminFeedback || !adminFeedback.trim()) {
        return res.status(400).json({ success: false, error: 'Please provide feedback explaining what changes are needed.' });
      }

      await prisma.methodSubmission.update({
        where: { id },
        data: {
          status: 'CHANGES_REQUESTED',
          adminFeedback: adminFeedback.trim(),
          reviewedAt: new Date()
        }
      });

      await createAuditLog({
        adminId: req.user.id,
        action: 'SUBMISSION_CHANGES_REQUESTED',
        targetType: 'SUBMISSION',
        targetId: id,
        details: { title: submission.title, feedback: adminFeedback },
        req
      });

      await prisma.notification.create({
        data: {
          userId: submission.authorId,
          type: 'SUBMISSION_STATUS',
          title: 'Changes Requested on: ' + submission.title,
          message: adminFeedback.trim(),
          link: '/my-submissions'
        }
      }).catch(() => {});

      return res.json({ success: true, message: 'Changes requested from the submitter.' });
    }

    if (action === 'REJECT') {
      await prisma.methodSubmission.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminFeedback: adminFeedback || 'Submission does not meet EarnRadar verification guidelines.',
          reviewedAt: new Date()
        }
      });

      await createAuditLog({
        adminId: req.user.id,
        action: 'SUBMISSION_REJECTED',
        targetType: 'SUBMISSION',
        targetId: id,
        details: { title: submission.title, reason: adminFeedback },
        req
      });

      await prisma.notification.create({
        data: {
          userId: submission.authorId,
          type: 'SUBMISSION_STATUS',
          title: 'Submission Status Update: ' + submission.title,
          message: adminFeedback || 'Submission does not meet EarnRadar verification guidelines.',
          link: '/my-submissions'
        }
      }).catch(() => {});

      return res.json({ success: true, message: 'Submission rejected.' });
    }

    if (action === 'APPROVE') {
      // Find or create suitable category
      const targetCategorySlug = parsedForm.basicInfo?.categorySlug || 'freelancing';
      let category = await prisma.category.findFirst({
        where: {
          OR: [
            { id: categoryId || '' },
            { slug: targetCategorySlug }
          ]
        }
      });

      if (!category) {
        category = await prisma.category.findFirst();
      }

      // Generate unique slug for opportunity
      const baseSlug = (parsedForm.basicInfo?.title || submission.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const uniqueSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Format steps
      const steps = Array.isArray(parsedForm.howItWorks?.steps) ? parsedForm.howItWorks.steps : [];
      const safetyChecklist = [
        'Read official platform terms before participating.',
        'Never pay upfront fees to unverified intermediaries.',
        'Redact personal financial details and OTPs.',
        'Verify withdrawal thresholds and eligibility.'
      ];

      // Create live opportunity
      const opportunity = await prisma.opportunity.create({
        data: {
          title: parsedForm.basicInfo?.title || submission.title,
          slug: uniqueSlug,
          categoryId: category.id,
          authorId: submission.authorId,
          status: 'VERIFIED',
          description: parsedForm.basicInfo?.shortDescription || 'Community verified earning opportunity.',
          howItWorks: parsedForm.howItWorks?.explanation || 'Follow the step-by-step breakdown.',
          whoCanDoIt: parsedForm.requirements?.whoCanDoIt || 'Anyone meeting eligibility criteria',
          skillsRequired: parsedForm.requirements?.requiredSkills || 'Basic computer/mobile skills',
          timeRequired: parsedForm.requirements?.timeRequired || 'Flexible',
          startingCost: parsedForm.moneyDetails?.startingCost || '₹0 / Free',
          potentialEarning: parsedForm.moneyDetails?.potentialEarning || 'Variable',
          earningModel: parsedForm.moneyDetails?.earningModel || 'COMMISSION',
          location: parsedForm.requirements?.countryAvailability || 'Online / Remote',
          platformWebsite: parsedForm.sources?.officialWebsite || '',
          officialSource: parsedForm.sources?.officialWebsite || '',
          termsUrl: parsedForm.sources?.termsUrl || '',
          risks: parsedForm.safety?.knownRisks || 'Variable income, platform policy changes',
          commonScams: parsedForm.safety?.possibleScams || 'Beware of unofficial payment requests or fake bots',
          safetyChecklist: JSON.stringify(safetyChecklist),
          videoUrl: parsedForm.video?.videoUrl || '',
          lastVerifiedDate: new Date(),
          steps: {
            create: steps.map((st, idx) => ({
              stepNumber: idx + 1,
              title: st.title || `Step ${idx + 1}`,
              description: st.description || st
            }))
          },
          evidence: {
            create: (parsedForm.proof?.files || []).map(f => ({
              type: 'SCREENSHOT',
              fileUrl: f.url || f,
              caption: 'Verified evidence uploaded by submitter',
              verifiedStatus: 'EVIDENCE_REVIEWED'
            }))
          }
        }
      });

      // Update submission to APPROVED / PUBLISHED
      await prisma.methodSubmission.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          adminFeedback: adminFeedback || 'Approved and published to the live Opportunity radar!',
          reviewedAt: new Date()
        }
      });

      await createAuditLog({
        adminId: req.user.id,
        action: 'SUBMISSION_APPROVED_AND_PUBLISHED',
        targetType: 'OPPORTUNITY',
        targetId: opportunity.id,
        details: { title: opportunity.title, slug: opportunity.slug },
        req
      });

      await prisma.notification.create({
        data: {
          userId: submission.authorId,
          type: 'SUBMISSION_STATUS',
          title: '🎉 Method Approved & Published!',
          message: `Your method "${opportunity.title}" is now live on the EarnRadar feed.`,
          link: `/opportunities/${opportunity.slug}`
        }
      }).catch(() => {});


      return res.json({
        success: true,
        message: 'Submission approved and published to the live radar!',
        opportunity
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid action.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * List & Moderate Reported Earnings Claims
 */
router.get('/claims', async (req, res) => {
  try {
    const claims = await prisma.reportedEarning.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, username: true } }
          }
        },
        opportunity: { select: { id: true, title: true, slug: true } }
      }
    });

    return res.json({ success: true, claims });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Claim Verification Status (UNVERIFIED, EVIDENCE_REVIEWED, VERIFIED_SOURCE, USER_REPORTED)
 */
router.patch('/claims/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const allowed = ['UNVERIFIED', 'EVIDENCE_REVIEWED', 'VERIFIED_SOURCE', 'USER_REPORTED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid claim status.' });
    }

    const claim = await prisma.reportedEarning.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote?.trim() || null
      },
      include: { user: { include: { profile: true } } }
    });

    // Recalculate user's total verified reported earnings
    const sumResult = await prisma.reportedEarning.aggregate({
      where: {
        userId: claim.userId,
        status: { in: ['VERIFIED_SOURCE', 'EVIDENCE_REVIEWED', 'USER_REPORTED'] }
      },
      _sum: { amount: true }
    });

    await prisma.userProfile.update({
      where: { userId: claim.userId },
      data: { totalReportedEarnings: sumResult._sum.amount || 0 }
    });

    await createAuditLog({
      adminId: req.user.id,
      action: `CLAIM_STATUS_${status}`,
      targetType: 'REPORTED_EARNING',
      targetId: id,
      details: { amount: claim.amount, status, adminNote },
      req
    });

    return res.json({
      success: true,
      message: 'Claim status updated successfully.',
      claim
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * List Reports Queue
 */
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, username: true } }
          }
        }
      }
    });

    return res.json({ success: true, reports });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Resolve Report (ACTION_TAKEN, DISMISSED)
 */
router.patch('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const report = await prisma.report.update({
      where: { id },
      data: {
        status,
        resolution: resolution?.trim() || null
      }
    });

    await createAuditLog({
      adminId: req.user.id,
      action: `REPORT_${status}`,
      targetType: 'REPORT',
      targetId: id,
      details: { resolution, targetType: report.targetType, targetId: report.targetId },
      req
    });

    return res.json({ success: true, message: 'Report status updated.', report });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * List Audit Logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, username: true } }
          }
        }
      }
    });

    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
