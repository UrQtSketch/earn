import { Router } from 'express';
import prisma from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * List Categories with opportunity counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            opportunities: { where: { status: 'VERIFIED' } }
          }
        }
      }
    });

    const formatted = categories.map(cat => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      icon: cat.icon,
      description: cat.description,
      opportunityCount: cat._count.opportunities
    }));

    return res.json({ success: true, categories: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List & Filter Opportunities (The Feed)
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'latest', featured, status } = req.query;

    const where = {
      status: status || 'VERIFIED'
    };

    if (category && category !== 'all') {
      where.category = { slug: String(category).toLowerCase() };
    }

    if (featured === 'true') {
      where.featured = true;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { skillsRequired: { contains: q } }
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { joinsCount: 'desc' };
    } else if (sort === 'verified') {
      orderBy = { lastVerifiedDate: 'desc' };
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      orderBy,
      include: {
        category: true,
        author: {
          select: {
            id: true,
            profile: {
              select: { fullName: true, username: true, avatarUrl: true }
            }
          }
        },
        _count: {
          select: { memberships: true, comments: true, evidence: true }
        }
      }
    });

    const formatted = opportunities.map(opp => ({
      id: opp.id,
      title: opp.title,
      slug: opp.slug,
      category: opp.category.name,
      categorySlug: opp.category.slug,
      categoryIcon: opp.category.icon,
      status: opp.status,
      featured: opp.featured,
      description: opp.description,
      skillsRequired: opp.skillsRequired,
      timeRequired: opp.timeRequired,
      startingCost: opp.startingCost,
      potentialEarning: opp.potentialEarning,
      earningModel: opp.earningModel,
      location: opp.location,
      lastVerifiedDate: opp.lastVerifiedDate,
      joinsCount: opp.joinsCount,
      viewsCount: opp.viewsCount,
      author: opp.author ? {
        id: opp.author.id,
        name: opp.author.profile?.fullName,
        username: opp.author.profile?.username
      } : null,
      commentsCount: opp._count.comments,
      evidenceCount: opp._count.evidence,
      createdAt: opp.createdAt
    }));

    return res.json({ success: true, opportunities: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Opportunity by ID or Slug with Complete Dossier
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug }
        ]
      },
      include: {
        category: true,
        steps: { orderBy: { stepNumber: 'asc' } },
        evidence: { orderBy: { createdAt: 'desc' } },
        author: {
          select: {
            id: true,
            createdAt: true,
            profile: {
              select: {
                fullName: true,
                username: true,
                avatarUrl: true,
                bio: true,
                country: true,
                totalReportedEarnings: true
              }
            }
          }
        },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                profile: { select: { fullName: true, username: true, avatarUrl: true } }
              }
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: {
                    id: true,
                    profile: { select: { fullName: true, username: true, avatarUrl: true } }
                  }
                }
              }
            }
          }
        },
        reportedEarnings: {
          where: { status: { in: ['VERIFIED_SOURCE', 'EVIDENCE_REVIEWED', 'USER_REPORTED'] } },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { profile: { select: { username: true, fullName: true } } } }
          }
        }
      }
    });

    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found.' });
    }

    // Increment views count asynchronously
    prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { viewsCount: { increment: 1 } }
    }).catch(() => {});

    // Check if current user joined or saved
    let userMembership = null;
    let isSaved = false;

    if (req.user) {
      userMembership = await prisma.opportunityMembership.findUnique({
        where: {
          opportunityId_userId: {
            opportunityId: opportunity.id,
            userId: req.user.id
          }
        }
      });

      const saved = await prisma.savedOpportunity.findUnique({
        where: {
          userId_opportunityId: {
            userId: req.user.id,
            opportunityId: opportunity.id
          }
        }
      });
      isSaved = Boolean(saved);
    }

    // Parse safety checklist safely
    let parsedSafetyChecklist = [];
    try {
      if (opportunity.safetyChecklist) {
        parsedSafetyChecklist = JSON.parse(opportunity.safetyChecklist);
      }
    } catch (_) {}

    return res.json({
      success: true,
      opportunity: {
        ...opportunity,
        safetyChecklist: parsedSafetyChecklist,
        userMembership,
        isSaved
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Join Opportunity (Creates Membership record)
 */
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await prisma.opportunity.findUnique({ where: { id } });
    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found.' });
    }

    const existing = await prisma.opportunityMembership.findUnique({
      where: {
        opportunityId_userId: {
          opportunityId: id,
          userId: req.user.id
        }
      }
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'You are already participating in this opportunity.',
        membership: existing
      });
    }

    const membership = await prisma.opportunityMembership.create({
      data: {
        opportunityId: id,
        userId: req.user.id,
        status: 'ACTIVE'
      }
    });

    await prisma.opportunity.update({
      where: { id },
      data: { joinsCount: { increment: 1 } }
    });

    return res.status(201).json({
      success: true,
      message: 'You have joined this opportunity. Track your steps and connect with participants!',
      membership
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Leave / Drop Opportunity
 */
router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.opportunityMembership.deleteMany({
      where: {
        opportunityId: id,
        userId: req.user.id
      }
    });

    await prisma.opportunity.update({
      where: { id },
      data: { joinsCount: { decrement: 1 } }
    }).catch(() => {});

    return res.json({ success: true, message: 'You have left this opportunity.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Save / Bookmark Opportunity
 */
router.post('/:id/save', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.savedOpportunity.findUnique({
      where: {
        userId_opportunityId: {
          userId: req.user.id,
          opportunityId: id
        }
      }
    });

    if (existing) {
      await prisma.savedOpportunity.delete({ where: { id: existing.id } });
      return res.json({ success: true, saved: false, message: 'Removed from saved opportunities.' });
    }

    await prisma.savedOpportunity.create({
      data: {
        userId: req.user.id,
        opportunityId: id
      }
    });

    return res.json({ success: true, saved: true, message: 'Opportunity saved to your watchlist.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
