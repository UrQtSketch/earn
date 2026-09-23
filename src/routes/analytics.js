import { Router } from 'express';
import prisma from '../config/db.js';

const router = Router();

/**
 * Public & Admin Platform Analytics Overview
 */
router.get('/overview', async (req, res) => {
  try {
    const [
      totalOpps,
      totalUsers,
      totalCollabs,
      categoryStats,
      topJoined,
      reportedEarningsStats
    ] = await Promise.all([
      prisma.opportunity.count({ where: { status: 'VERIFIED' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.collaborationRequest.count({ where: { status: 'ACCEPTED' } }),
      prisma.category.findMany({
        select: {
          name: true,
          slug: true,
          icon: true,
          _count: { select: { opportunities: { where: { status: 'VERIFIED' } } } }
        }
      }),
      prisma.opportunity.findMany({
        where: { status: 'VERIFIED' },
        orderBy: { joinsCount: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          joinsCount: true,
          potentialEarning: true,
          category: { select: { name: true } }
        }
      }),
      prisma.reportedEarning.aggregate({
        where: { status: { in: ['VERIFIED_SOURCE', 'EVIDENCE_REVIEWED', 'USER_REPORTED'] } },
        _sum: { amount: true },
        _avg: { amount: true },
        _count: { id: true }
      })
    ]);

    return res.json({
      success: true,
      analytics: {
        totalOpportunities: totalOpps,
        activeMembers: totalUsers,
        successfulCollaborations: totalCollabs,
        totalReportedEarnings: reportedEarningsStats._sum.amount || 0,
        averageReportedAmount: Math.round(reportedEarningsStats._avg.amount || 0),
        reportedClaimsCount: reportedEarningsStats._count.id || 0,
        disclaimer: 'All earnings listed represent user-reported figures subject to community verification standards, not platform-guaranteed payouts.',
        topCategories: categoryStats.map(c => ({
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          count: c._count.opportunities
        })),
        topOpportunities: topJoined
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
