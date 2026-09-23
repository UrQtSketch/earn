import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sanitizeUser } from '../services/authService.js';

const router = Router();

/**
 * Get own profile and activity summary
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        memberships: {
          include: { opportunity: { include: { category: true } } },
          orderBy: { joinedAt: 'desc' }
        },
        submissions: {
          orderBy: { createdAt: 'desc' }
        },
        reportedEarnings: {
          orderBy: { createdAt: 'desc' }
        },
        savedOpps: {
          include: { opportunity: { include: { category: true } } }
        }
      }
    });

    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update Profile details
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, bio, country, skills, categories, isPrivate, avatarUrl } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (country !== undefined) updateData.country = country.trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl.trim();
    if (skills !== undefined) updateData.skills = JSON.stringify(Array.isArray(skills) ? skills : []);
    if (categories !== undefined) updateData.categories = JSON.stringify(Array.isArray(categories) ? categories : []);
    if (isPrivate !== undefined) updateData.isPrivate = Boolean(isPrivate);

    const updatedProfile = await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: updateData
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true }
    });

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Complete Onboarding (set categories & skills)
 */
router.post('/onboarding', requireAuth, async (req, res) => {
  try {
    const { categories, skills, country } = req.body;

    const updatedProfile = await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: {
        categories: JSON.stringify(Array.isArray(categories) ? categories : []),
        skills: JSON.stringify(Array.isArray(skills) ? skills : []),
        ...(country ? { country: country.trim() } : {})
      }
    });

    return res.json({
      success: true,
      message: 'Onboarding completed!',
      profile: updatedProfile
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Get Public User Profile by Username (with privacy guards)
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const profile = await prisma.userProfile.findUnique({
      where: { username },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            authoredOpps: {
              where: { status: 'VERIFIED' },
              select: { id: true, title: true, slug: true, potentialEarning: true, earningModel: true }
            },
            reportedEarnings: {
              where: { status: { in: ['VERIFIED_SOURCE', 'EVIDENCE_REVIEWED', 'USER_REPORTED'] } },
              select: { id: true, amount: true, currency: true, period: true, status: true }
            }
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    if (profile.isPrivate && (!req.user || req.user.id !== profile.userId)) {
      return res.json({
        success: true,
        profile: {
          username: profile.username,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          country: profile.country,
          joinedDate: profile.user.createdAt,
          isPrivate: true
        }
      });
    }

    return res.json({
      success: true,
      profile: {
        id: profile.userId,
        username: profile.username,
        fullName: profile.fullName,
        bio: profile.bio,
        country: profile.country,
        avatarUrl: profile.avatarUrl,
        skills: JSON.parse(profile.skills || '[]'),
        categories: JSON.parse(profile.categories || '[]'),
        totalReportedEarnings: profile.totalReportedEarnings,
        joinedDate: profile.user.createdAt,
        verifiedOpps: profile.user.authoredOpps,
        earningsList: profile.user.reportedEarnings,
        isPrivate: false
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
