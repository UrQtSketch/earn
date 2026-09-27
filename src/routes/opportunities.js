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
 * Factual Matching Engine for "Find My Opportunity"
 */
function calculateOpportunityMatch(opp, answers) {
  let score = 0;
  const matchReasons = [];

  const oppCategorySlug = opp.category?.slug?.toLowerCase() || '';
  const oppTime = (opp.timeRequired || '').toLowerCase();
  const oppCost = (opp.startingCost || '').toLowerCase();
  const oppSkills = (opp.skillsRequired || '').toLowerCase();
  const oppWho = (opp.whoCanDoIt || '').toLowerCase();
  const oppTitle = (opp.title || '').toLowerCase();
  const oppDesc = (opp.description || '').toLowerCase();
  const oppEarningModel = (opp.earningModel || '').toLowerCase();
  const oppLocation = (opp.location || '').toLowerCase();
  const isFree = oppCost.includes('₹0') || oppCost.includes('$0') || oppCost.includes('free') || oppCost.includes('0');

  // 1. Daily Time Commitment Match
  const userTime = answers.dailyTime;
  if (userTime) {
    if (userTime === 'less-than-1h') {
      if (oppTime.includes('min') || oppTime.includes('task') || oppTime.includes('flexible') || oppCategorySlug === 'quick-gigs' || oppTime.includes('less than') || oppTime.includes('1 hr') || oppTime.includes('1h')) {
        score += 30;
        matchReasons.push(`Fits your daily time budget (${opp.timeRequired || 'Flexible'})`);
      } else {
        score += 10;
        matchReasons.push(`Can be done flexibly around your schedule`);
      }
    } else if (userTime === '1-2h') {
      if (oppTime.includes('1–2') || oppTime.includes('1-2') || oppTime.includes('flexible') || oppTime.includes('hr')) {
        score += 30;
        matchReasons.push(`Matches your 1–2 hours daily availability (${opp.timeRequired || '1–2 hrs'})`);
      } else {
        score += 15;
        matchReasons.push(`Manageable within your selected daily schedule`);
      }
    } else if (userTime === '2-4h' || userTime === '4h-plus') {
      score += 30;
      matchReasons.push(`Fits your available ${userTime === '2-4h' ? '2–4 hours' : '4+ hours'} daily commitment (${opp.timeRequired || 'Active'})`);
    }
  }

  // 2. Skills Match
  const userSkills = Array.isArray(answers.skills) ? answers.skills.map(s => String(s).toLowerCase().trim()) : [];
  if (userSkills.length > 0) {
    let skillMatched = false;
    if (userSkills.includes('beginner') || userSkills.includes('no-specific-skill') || userSkills.includes('none')) {
      if (opp.skillLevel === 'BEGINNER' || oppWho.includes('anyone') || oppWho.includes('eligible') || isFree) {
        score += 25;
        matchReasons.push('Beginner-friendly with step-by-step instructions');
        skillMatched = true;
      }
    }

    const skillKeywordMap = {
      'gaming': ['game', 'gaming', 'esports', 'bgmi', 'tournament', 'player'],
      'coding': ['code', 'coding', 'tech', 'developer', 'programming', 'software', 'api', 'bounty', 'vulnerability', 'web'],
      'writing': ['write', 'writing', 'copywriting', 'content', 'script', 'article', 'blog'],
      'designing': ['design', 'thumbnail', 'ui', 'figma', 'graphics', 'photoshop', 'canvas'],
      'video-editing': ['video', 'editing', 'premiere', 'capcut', 'reels', 'shorts', 'youtube', 'sound'],
      'social-media': ['social', 'instagram', 'youtube', 'discord', 'telegram', 'creator', 'reels', 'tiktok'],
      'communication': ['communication', 'team', 'chat', 'support', 'client', 'outreach'],
      'selling': ['sell', 'selling', 'reselling', 'commerce', 'arbitrage', 'marketplace', 'deal'],
      'teaching': ['teach', 'teaching', 'guide', 'tutorial', 'mentor', 'instruction']
    };

    for (const skill of userSkills) {
      if (skill === 'beginner' || skill === 'no-specific-skill') continue;
      const keywords = skillKeywordMap[skill] || [skill];
      const matched = keywords.some(k => oppSkills.includes(k) || oppTitle.includes(k) || oppDesc.includes(k) || oppCategorySlug.includes(k));
      if (matched) {
        score += 25;
        const skillName = skill.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        matchReasons.push(`Requires skills you selected: ${skillName}`);
        skillMatched = true;
        break;
      }
    }

    if (!skillMatched && opp.skillLevel === 'BEGINNER') {
      score += 15;
      matchReasons.push('Accessible prerequisite requirements');
    }
  }

  // 3. Starting Cost / Budget Match
  const userBudget = answers.budget;
  if (userBudget) {
    if (userBudget === '0' || userBudget === 'zero') {
      if (isFree) {
        score += 30;
        matchReasons.push(`Requires ₹0 listed starting cost (${opp.startingCost || 'Free entry'})`);
      } else {
        score -= 20; // Budget mismatch for zero budget
      }
    } else if (userBudget === 'under-500') {
      if (isFree || oppCost.includes('500') || !oppCost.includes('2,000')) {
        score += 25;
        matchReasons.push(`Fits within your budget (${opp.startingCost || 'Free / Low cost'})`);
      }
    } else if (userBudget === '500-2000' || userBudget === '2000-plus') {
      score += 20;
      matchReasons.push(`Within your starting budget range (${opp.startingCost || 'Listed'})`);
    }
  }

  // 4. Category / Type Interest Match
  const userCategories = Array.isArray(answers.categoryInterests) 
    ? answers.categoryInterests.map(c => String(c).toLowerCase().trim()) 
    : (answers.categoryInterests ? [String(answers.categoryInterests).toLowerCase().trim()] : []);

  if (userCategories.length > 0) {
    for (const cat of userCategories) {
      if (cat === 'all' || oppCategorySlug === cat || 
         (cat === 'rewards' && (oppCategorySlug === 'quick-gigs' || oppEarningModel.includes('task') || oppCategorySlug === 'gaming')) ||
         (cat === 'creator' && (oppCategorySlug === 'creator' || oppCategorySlug === 'creator-programs')) ||
         (cat === 'creator-programs' && oppCategorySlug === 'creator') ||
         (cat === 'digital-products' && (oppCategorySlug === 'freelancing' || oppCategorySlug === 'creator' || oppCategorySlug === 'reselling')) ||
         (cat === 'finance' && (oppCategorySlug === 'finance' || oppCategorySlug === 'investing')) ||
         (cat === 'finance / investing' && oppCategorySlug === 'finance')) {
        score += 35;
        matchReasons.push(`Matches your selected interest in ${opp.category?.name || 'this category'}`);
        break;
      }
    }
  }

  // 5. Priorities Match
  const priority = answers.primaryPriority;
  if (priority) {
    if ((priority === 'low-cost' || priority === 'low-starting-cost') && isFree) {
      score += 20;
      matchReasons.push('Requires zero listed capital, matching your low-cost preference');
    } else if ((priority === 'flexible-timing' || priority === 'flexible') && (oppTime.includes('flexible') || oppTime.includes('task') || oppTime.includes('anytime'))) {
      score += 20;
      matchReasons.push('Offers flexible timing suited to your schedule');
    } else if ((priority === 'remote-work' || priority === 'remote') && (oppLocation.includes('online') || oppLocation.includes('remote') || oppLocation.includes('global'))) {
      score += 20;
      matchReasons.push('100% online & remote opportunity');
    } else if (priority === 'skill-development' && (opp.steps?.length >= 3 || opp.skillLevel !== 'BEGINNER')) {
      score += 20;
      matchReasons.push('Structured multi-step workflow helps develop practical skills');
    } else if (priority === 'quick-participation' && (opp.skillLevel === 'BEGINNER' || isFree || oppCategorySlug === 'quick-gigs')) {
      score += 20;
      matchReasons.push('Straightforward onboarding for quick participation');
    } else if (priority === 'long-term' && (oppCategorySlug === 'freelancing' || oppCategorySlug === 'creator' || oppCategorySlug === 'reselling')) {
      score += 20;
      matchReasons.push('Established repeatable method suitable for long-term consistency');
    }
  }

  // Deduplicate match reasons and limit to top 4
  const uniqueReasons = [...new Set(matchReasons)].slice(0, 4);

  return {
    score,
    matchReasons: uniqueReasons,
    isCompatible: score >= 25 && (userBudget !== '0' && userBudget !== 'zero' ? true : isFree)
  };
}

/**
 * Find My Opportunity — Interactive Questionnaire Matching Endpoint
 */
router.post('/match', async (req, res) => {
  try {
    const {
      dailyTime,
      skills = [],
      budget,
      categoryInterests = [],
      primaryPriority,
      // Optional post-matching filter overrides
      filterCategory,
      filterRisk,
      filterSkill,
      filterCost
    } = req.body || {};

    const answers = {
      dailyTime: dailyTime ? String(dailyTime).trim() : null,
      skills: Array.isArray(skills) ? skills : (skills ? [skills] : []),
      budget: budget ? String(budget).trim() : null,
      categoryInterests: Array.isArray(categoryInterests) ? categoryInterests : (categoryInterests ? [categoryInterests] : []),
      primaryPriority: primaryPriority ? String(primaryPriority).trim() : null
    };

    // Fetch all active verified opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        status: 'VERIFIED',
        healthStatus: { not: 'SUSPENDED' }
      },
      include: {
        category: true,
        steps: { orderBy: { stepNumber: 'asc' } },
        evidence: { select: { id: true, type: true, verifiedStatus: true } },
        _count: { select: { memberships: true, comments: true, experiences: true } }
      }
    });

    let scoredOpps = opportunities.map(opp => {
      const matchResult = calculateOpportunityMatch(opp, answers);
      return {
        id: opp.id,
        title: opp.title,
        slug: opp.slug,
        category: opp.category.name,
        categorySlug: opp.category.slug,
        categoryIcon: opp.category.icon,
        description: opp.description,
        skillsRequired: opp.skillsRequired,
        timeRequired: opp.timeRequired,
        startingCost: opp.startingCost,
        potentialEarning: opp.potentialEarning,
        earningModel: opp.earningModel,
        location: opp.location,
        riskLevel: opp.riskLevel,
        skillLevel: opp.skillLevel,
        healthStatus: opp.healthStatus,
        status: opp.status,
        officialSource: opp.officialSource,
        platformWebsite: opp.platformWebsite,
        joinsCount: opp.joinsCount,
        stepsCount: opp.steps.length,
        evidenceCount: opp.evidence.length,
        experiencesCount: opp._count.experiences,
        matchReasons: matchResult.matchReasons,
        relevanceScore: matchResult.score,
        isCompatible: matchResult.isCompatible
      };
    });

    // Filter out completely incompatible opportunities (if any) and sort by relevance score
    scoredOpps = scoredOpps
      .filter(opp => opp.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply optional post-result filters
    if (filterCategory && filterCategory !== 'all') {
      scoredOpps = scoredOpps.filter(opp => opp.categorySlug === String(filterCategory).toLowerCase());
    }
    if (filterRisk && filterRisk !== 'all') {
      scoredOpps = scoredOpps.filter(opp => opp.riskLevel === String(filterRisk).toUpperCase());
    }
    if (filterSkill && filterSkill !== 'all') {
      scoredOpps = scoredOpps.filter(opp => opp.skillLevel === String(filterSkill).toUpperCase());
    }
    if (filterCost && filterCost !== 'all') {
      if (filterCost === 'free') {
        scoredOpps = scoredOpps.filter(opp => {
          const c = (opp.startingCost || '').toLowerCase();
          return c.includes('₹0') || c.includes('$0') || c.includes('free') || c.includes('0');
        });
      }
    }

    return res.json({
      success: true,
      totalMatched: scoredOpps.length,
      userAnswers: answers,
      opportunities: scoredOpps
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Compare multiple opportunities side-by-side
 */
router.get('/compare', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ success: false, error: 'Provide opportunity IDs to compare.' });
    }

    const idList = String(ids).split(',').map(s => s.trim()).filter(Boolean);
    if (idList.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid opportunity ID is required.' });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: {
        id: { in: idList },
        status: 'VERIFIED'
      },
      include: {
        category: true,
        steps: { orderBy: { stepNumber: 'asc' } },
        evidence: true,
        verificationLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        experiences: true
      }
    });

    const formatted = opportunities.map(opp => {
      const totalExperiences = opp.experiences.length;

      return {
        id: opp.id,
        title: opp.title,
        slug: opp.slug,
        category: opp.category.name,
        categoryIcon: opp.category.icon,
        description: opp.description,
        skillLevel: opp.skillLevel,
        riskLevel: opp.riskLevel,
        healthStatus: opp.healthStatus,
        timeRequired: opp.timeRequired,
        startingCost: opp.startingCost,
        potentialEarning: opp.potentialEarning,
        earningModel: opp.earningModel,
        location: opp.location,
        lastVerifiedDate: opp.lastVerifiedDate,
        stepsCount: opp.steps.length,
        evidenceCount: opp.evidence.length,
        communityExperienceCount: totalExperiences,
        safetyChecklist: (() => {
          try { return JSON.parse(opp.safetyChecklist || '[]'); } catch (_) { return []; }
        })()
      };
    });

    return res.json({ success: true, opportunities: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * List & Filter Opportunities (The Feed)
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'latest', featured, status, skillLevel, riskLevel, healthStatus } = req.query;

    const where = {
      status: status || 'VERIFIED'
    };

    if (category && category !== 'all') {
      where.category = { slug: String(category).toLowerCase() };
    }

    if (skillLevel && skillLevel !== 'all') {
      where.skillLevel = skillLevel;
    }

    if (riskLevel && riskLevel !== 'all') {
      where.riskLevel = riskLevel;
    }

    if (healthStatus && healthStatus !== 'all') {
      where.healthStatus = healthStatus;
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
              select: { fullName: true, username: true, avatarUrl: true, reputationBadge: true }
            }
          }
        },
        _count: {
          select: { memberships: true, comments: true, evidence: true, experiences: true }
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
      healthStatus: opp.healthStatus,
      riskLevel: opp.riskLevel,
      skillLevel: opp.skillLevel,
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
        username: opp.author.profile?.username,
        badge: opp.author.profile?.reputationBadge
      } : null,
      commentsCount: opp._count.comments,
      evidenceCount: opp._count.evidence,
      experiencesCount: opp._count.experiences,
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
            user: { select: { profile: { select: { username: true, fullName: true, avatarUrl: true, reputationBadge: true } } } }
          }
        },
        verificationLogs: {
          orderBy: { createdAt: 'desc' }
        },
        experiences: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                profile: {
                  select: { fullName: true, username: true, avatarUrl: true, reputationBadge: true }
                }
              }
            }
          }
        },
        _count: {
          select: { savedBy: true, memberships: true, comments: true, experiences: true }
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

    // Calculate report statistics for transparent health status
    const [openReportsCount, resolvedReportsCount] = await Promise.all([
      prisma.report.count({
        where: { targetType: 'OPPORTUNITY', targetId: opportunity.id, status: { in: ['OPEN', 'UNDER_REVIEW'] } }
      }),
      prisma.report.count({
        where: { targetType: 'OPPORTUNITY', targetId: opportunity.id, status: { in: ['ACTION_TAKEN', 'DISMISSED'] } }
      })
    ]);

    let communityReportSummary = 'No recent reports';
    if (openReportsCount > 0) {
      communityReportSummary = `${openReportsCount} report${openReportsCount > 1 ? 's' : ''} currently under review`;
    } else if (resolvedReportsCount > 0) {
      communityReportSummary = `${resolvedReportsCount} report${resolvedReportsCount > 1 ? 's' : ''} resolved`;
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
        sourceStatus: opportunity.sourceStatus || 'SOURCE_CHECKED',
        safetyChecklist: parsedSafetyChecklist,
        openReportsCount,
        resolvedReportsCount,
        communityReportSummary,
        userMembership,
        isSaved
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Submit Community Experience / Review for an Opportunity
 */
router.post('/:id/experience', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      rating,
      difficulty,
      timeSpentWeekly,
      earnedAmount,
      amountEarned,
      pros,
      cons,
      tips,
      reviewText,
      problemsFaced,
      duration,
      wouldContinue
    } = req.body;

    const opportunity = await prisma.opportunity.findUnique({ where: { id } });
    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found.' });
    }

    const reviewContent = reviewText || [pros ? `Pros: ${pros}` : '', tips ? `Tips: ${tips}` : ''].filter(Boolean).join('\n') || 'Community member experience report.';
    const finalAmount = earnedAmount !== undefined ? parseFloat(earnedAmount) : (amountEarned !== undefined ? parseFloat(amountEarned) : 0);

    // Create user's experience for this opportunity
    const experience = await prisma.communityExperience.create({
      data: {
        opportunityId: id,
        userId: req.user.id,
        duration: duration || timeSpentWeekly || 'Active',
        hoursSpentWeekly: difficulty ? parseFloat(difficulty) : null,
        amountEarned: isNaN(finalAmount) ? 0 : finalAmount,
        problemsFaced: problemsFaced || cons || null,
        reviewText: reviewContent,
        wouldContinue: wouldContinue !== undefined ? Boolean(wouldContinue) : (rating ? parseInt(rating, 10) >= 3 : true),
        status: 'TRIED'
      },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { fullName: true, username: true, avatarUrl: true, reputationBadge: true } }
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your experience report has been added to help other members.',
      experience
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
