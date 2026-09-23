import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding EarnRadar database...');

  // 1. Categories
  const categoriesData = [
    { slug: 'gaming', name: 'Gaming', icon: '🎮', description: 'Tournaments, rewards & competitive skill opportunities' },
    { slug: 'freelancing', name: 'Freelancing', icon: '⌨', description: 'Remote work, gigs, specialized services & micro tasks' },
    { slug: 'creator', name: 'Creator', icon: '▶', description: 'Content creation, video editing & audience monetization' },
    { slug: 'finance', name: 'Finance', icon: '₹', description: 'Market research, investment ideas & trading tools (Capital at risk)' },
    { slug: 'reselling', name: 'Reselling', icon: '🛒', description: 'Marketplaces, arbitrage, refurbished goods & commerce' },
    { slug: 'quick-gigs', name: 'Quick Gigs', icon: '⚡', description: 'Short-term tasks, user testing & verification jobs' },
    { slug: 'affiliate', name: 'Affiliate', icon: '🔗', description: 'Affiliate partner programs with transparent attribution' }
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat
    });
  }
  console.log('✔ Categories seeded');

  // 2. Admin & Sample Users
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('AdminPassword2026!', salt);
  const userPasswordHash = await bcrypt.hash('UserPassword2026!', salt);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@earnradar.io' },
    update: {},
    create: {
      email: 'admin@earnradar.io',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: true,
      profile: {
        create: {
          fullName: 'EarnRadar Admin',
          username: 'earnradar_mod',
          bio: 'EarnRadar Platform Verification & Moderation Lead.',
          country: 'India',
          skills: JSON.stringify(['Moderation', 'Audit', 'Risk Analysis']),
          categories: JSON.stringify(['gaming', 'freelancing', 'creator', 'finance', 'reselling', 'quick-gigs'])
        }
      }
    }
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'priya@earnradar.io' },
    update: {},
    create: {
      email: 'priya@earnradar.io',
      passwordHash: userPasswordHash,
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      profile: {
        create: {
          fullName: 'Priya Sharma',
          username: 'priyacreates',
          bio: 'Motion designer & short-form video editor with 3 years remote client experience.',
          country: 'India',
          skills: JSON.stringify(['Premiere Pro', 'After Effects', 'Thumbnail Design']),
          categories: JSON.stringify(['creator', 'freelancing']),
          totalReportedEarnings: 68000
        }
      }
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'rahul@earnradar.io' },
    update: {},
    create: {
      email: 'rahul@earnradar.io',
      passwordHash: userPasswordHash,
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      profile: {
        create: {
          fullName: 'Rahul Verma',
          username: 'rahulesports',
          bio: 'Competitive mobile esports player participating in verified community tournaments.',
          country: 'India',
          skills: JSON.stringify(['BGMI', 'FreeFire', 'Strategy']),
          categories: JSON.stringify(['gaming', 'quick-gigs']),
          totalReportedEarnings: 24500
        }
      }
    }
  });

  console.log('✔ Users & Admin seeded');

  const gamingCat = await prisma.category.findUnique({ where: { slug: 'gaming' } });
  const freelanceCat = await prisma.category.findUnique({ where: { slug: 'freelancing' } });
  const creatorCat = await prisma.category.findUnique({ where: { slug: 'creator' } });
  const financeCat = await prisma.category.findUnique({ where: { slug: 'finance' } });

  // 3. Opportunities
  const opp1 = await prisma.opportunity.upsert({
    where: { slug: 'community-gaming-tournament-rewards' },
    update: {},
    create: {
      title: 'Community Gaming Tournament Rewards',
      slug: 'community-gaming-tournament-rewards',
      categoryId: gamingCat.id,
      authorId: user2.id,
      status: 'VERIFIED',
      featured: true,
      description: 'Compete in eligible verified esports tournaments and earn published prizes according to the event rules. Entry requirements, schedule and prize pool should be checked before joining.',
      howItWorks: 'Organizers host community tournaments with fixed prize brackets. Players register via official Discord/tournament platforms, compete in brackets, and prize distribution is processed to verified player accounts.',
      whoCanDoIt: 'Eligible players with game accounts meeting tier/rank criteria.',
      skillsRequired: 'Game proficiency, team communication, tactical awareness',
      timeRequired: '2–4 hrs / tournament event',
      startingCost: '₹0 (Free entry tournaments)',
      potentialEarning: '₹500 – ₹10,000+ per event',
      earningModel: 'TOURNAMENT',
      location: 'Online (India & Global)',
      platformWebsite: 'https://discord.gg/esports-community',
      officialSource: 'https://esportsfederation.in/rules',
      termsUrl: 'https://esportsfederation.in/terms',
      risks: 'No prize guarantee if unplaced; variable prize distribution timelines (1-14 days).',
      commonScams: 'Never pay entry fees to unverified personal UPI IDs claiming to host official tourneys.',
      safetyChecklist: JSON.stringify([
        'Verify organizer identity via official Discord or website.',
        'Never share OTP or gaming login credentials.',
        'Ensure tournament rules and prize distribution deadlines are published in writing.'
      ]),
      lastVerifiedDate: new Date(),
      viewsCount: 420,
      joinsCount: 88,
      steps: {
        create: [
          { stepNumber: 1, title: 'Check Tournament Schedule & Rules', description: 'Review eligible rank brackets, team size requirements, and confirmed prize distributions.' },
          { stepNumber: 2, title: 'Register with Verified Game ID', description: 'Submit your player in-game ID and team roster before registration closes.' },
          { stepNumber: 3, title: 'Compete & Submit Match Results', description: 'Play matches on time, record screenshots of final scoreboard, and submit to official referee bot.' },
          { stepNumber: 4, title: 'Claim Prize Distribution', description: 'Once results are audited, claim winnings through the official organizer portal.' }
        ]
      },
      evidence: {
        create: [
          { type: 'SCREENSHOT', fileUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800', caption: 'Tournament leaderboard and payout receipt', verifiedStatus: 'VERIFIED_SOURCE' }
        ]
      }
    }
  });

  const opp2 = await prisma.opportunity.upsert({
    where: { slug: 'short-form-video-editing-gigs' },
    update: {},
    create: {
      title: 'Short-form Video Editing Gigs',
      slug: 'short-form-video-editing-gigs',
      categoryId: freelanceCat.id,
      authorId: user1.id,
      status: 'VERIFIED',
      featured: true,
      description: 'Offer high-retention video editing for Reels, Shorts, and TikTok creators. Earnings depend on portfolio caliber, client retention, and agreed deliverables.',
      howItWorks: 'Creators send raw talking-head footage. Editors add captions, sound design, zooms, B-roll, and animations to maximize viewer retention.',
      whoCanDoIt: 'Anyone with a computer/laptop and editing software proficiency.',
      skillsRequired: 'CapCut / Premiere Pro / After Effects, pacing, motion captions',
      timeRequired: '1–3 hrs per 60s video',
      startingCost: '₹0 (Free tools available)',
      potentialEarning: '₹300 – ₹5,000+ per video',
      earningModel: 'FREELANCE',
      location: 'Remote / Online',
      platformWebsite: 'https://www.upwork.com',
      officialSource: 'https://www.fiverr.com',
      termsUrl: 'https://www.fiverr.com/terms_of_service',
      risks: 'Client scope creep, revisions, delayed client feedback.',
      commonScams: 'Beware of "clients" demanding you pay a security deposit before sending raw files.',
      safetyChecklist: JSON.stringify([
        'Always take a 50% upfront deposit or use escrow platform contracts.',
        'Watermark preliminary review drafts before final payment clearance.',
        'Specify revision rounds in your initial project scope.'
      ]),
      lastVerifiedDate: new Date(),
      viewsCount: 650,
      joinsCount: 142,
      steps: {
        create: [
          { stepNumber: 1, title: 'Build a 3-Video Sample Portfolio', description: 'Create sample vertical edits highlighting pacing, hooks, captions, and audio mixing.' },
          { stepNumber: 2, title: 'Outreach to Niche Creators', description: 'DM or email YouTube/Instagram creators with specific suggestions to improve their engagement.' },
          { stepNumber: 3, title: 'Agree on Deliverables & Terms', description: 'Establish turnaround time, number of revisions, and payment terms upfront.' },
          { stepNumber: 4, title: 'Deliver & Retain Long-Term', description: 'Deliver high-quality files and transition happy clients into monthly retainer packages.' }
        ]
      },
      evidence: {
        create: [
          { type: 'SCREENSHOT', fileUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800', caption: 'Client retainer invoice and delivery timeline', verifiedStatus: 'EVIDENCE_REVIEWED' }
        ]
      }
    }
  });

  const opp3 = await prisma.opportunity.upsert({
    where: { slug: 'affiliate-content-opportunity' },
    update: {},
    create: {
      title: 'Affiliate Content Opportunity',
      slug: 'affiliate-content-opportunity',
      categoryId: creatorCat.id,
      authorId: user1.id,
      status: 'VERIFIED',
      featured: false,
      description: 'Create educational content around tools, hosting, or software products offering verified affiliate programs with transparent tracking.',
      howItWorks: 'Publish in-depth tutorials or comparisons. Readers who register through your tracked link generate an affiliate commission.',
      whoCanDoIt: 'Content creators, bloggers, and tech reviewers.',
      skillsRequired: 'Content writing, basic SEO, software reviews',
      timeRequired: 'Long-term / 5–10 hrs weekly',
      startingCost: '₹0 (Using free blog/YouTube)',
      potentialEarning: 'Variable commission (No fixed guarantee)',
      earningModel: 'AFFILIATE',
      location: 'Online',
      platformWebsite: 'https://affiliate-program.amazon.in',
      officialSource: 'https://affiliate-program.amazon.in/welcome',
      termsUrl: 'https://affiliate-program.amazon.in/help/operating/agreement',
      risks: 'Income is purely performance-based and can take months to build; cookie duration limits.',
      commonScams: 'Avoid affiliate programs requiring you to purchase products in bulk to qualify.',
      safetyChecklist: JSON.stringify([
        'Include proper affiliate disclosure notices on all published content.',
        'Read program terms regarding paid ads and brand trademark restrictions.'
      ]),
      lastVerifiedDate: new Date(),
      viewsCount: 310,
      joinsCount: 64,
      steps: {
        create: [
          { stepNumber: 1, title: 'Select a Focused Product Niche', description: 'Pick products you have hands-on experience using.' },
          { stepNumber: 2, title: 'Apply to Official Partner Program', description: 'Register via official merchant website and obtain unique affiliate tags.' },
          { stepNumber: 3, title: 'Produce In-Depth Review Guides', description: 'Explain pros, cons, pricing, and practical use cases without hype.' },
          { stepNumber: 4, title: 'Track Conversions & Optimize', description: 'Monitor dashboard analytics to see which content resonates best.' }
        ]
      }
    }
  });

  const opp4 = await prisma.opportunity.upsert({
    where: { slug: 'market-investment-research-idea' },
    update: {},
    create: {
      title: 'Market / Investment Research Idea',
      slug: 'market-investment-research-idea',
      categoryId: financeCat.id,
      authorId: admin.id,
      status: 'VERIFIED',
      featured: false,
      description: 'Educational financial market research framework with source analysis, macroeconomic factors, and downside risks shown separately. Not a guaranteed return recommendation.',
      howItWorks: 'Analyze publicly disclosed corporate filings and sector trends to make informed independent allocations.',
      whoCanDoIt: 'Individuals with capital willing to accept financial market risks.',
      skillsRequired: 'Financial statement reading, fundamental analysis, risk management',
      timeRequired: '3–5 hrs research per asset',
      startingCost: 'Variable capital',
      potentialEarning: 'Variable / Not guaranteed (Capital at risk)',
      earningModel: 'OTHER',
      location: 'India / Global Exchanges',
      platformWebsite: 'https://www.nseindia.com',
      officialSource: 'https://www.sebi.gov.in',
      termsUrl: 'https://www.sebi.gov.in/legal/regulations.html',
      risks: 'CAPITAL LOSS RISK: Market fluctuations can result in partial or total loss of invested funds.',
      commonScams: 'Never join Telegram "guaranteed 100% daily profit" stock tip channels or advisory pump-and-dumps.',
      safetyChecklist: JSON.stringify([
        'Verify registered broker status with SEBI / regulatory bodies.',
        'Never borrow money or take personal loans to trade.',
        'Understand that historical performance does not guarantee future results.'
      ]),
      lastVerifiedDate: new Date(),
      viewsCount: 490,
      joinsCount: 52,
      steps: {
        create: [
          { stepNumber: 1, title: 'Study Annual Reports & Filings', description: 'Examine revenue growth, debt-to-equity ratios, and cash flows directly on exchange portals.' },
          { stepNumber: 2, title: 'Assess Sector Tailwinds', description: 'Evaluate industry growth trends, regulatory landscape, and competitive advantages.' },
          { stepNumber: 3, title: 'Define Risk-to-Reward Ratio', description: 'Set disciplined entry, stop-loss, and holding horizons prior to initiating any position.' }
        ]
      }
    }
  });

  console.log('✔ Opportunities seeded');

  // 4. Sample Comments & Discussion
  await prisma.comment.createMany({
    data: [
      {
        opportunityId: opp2.id,
        authorId: user2.id,
        content: 'I followed the 3-video sample method outlined here and landed my first recurring client after 8 outreach emails! Focus heavily on sound design—clients notice it immediately.'
      },
      {
        opportunityId: opp1.id,
        authorId: user1.id,
        content: 'Make sure to confirm Discord referee handles before matches start. Had a smooth payout experience last weekend.'
      }
    ]
  });

  // 5. Reported Earnings
  await prisma.reportedEarning.create({
    data: {
      userId: user1.id,
      opportunityId: opp2.id,
      amount: 45000,
      currency: 'INR',
      period: 'May – June 2026',
      hoursSpent: 35,
      attemptsCount: 3,
      status: 'VERIFIED_SOURCE',
      adminNote: 'Client invoices and transaction records cross-verified.'
    }
  });

  await prisma.reportedEarning.create({
    data: {
      userId: user2.id,
      opportunityId: opp1.id,
      amount: 12000,
      currency: 'INR',
      period: 'June 2026',
      hoursSpent: 16,
      attemptsCount: 4,
      status: 'EVIDENCE_REVIEWED',
      adminNote: 'Tournament bracket screenshot & payout slip verified.'
    }
  });

  // 6. Verification History Logs
  await prisma.opportunityVerificationLog.createMany({
    data: [
      { opportunityId: opp1.id, stage: 'SUBMISSION', status: 'PENDING', note: 'Initial tournament details submitted.', checkedBy: 'System' },
      { opportunityId: opp1.id, stage: 'SOURCE_CHECKED', status: 'VERIFIED', note: 'Official federation rules and discord referee confirmed.', checkedBy: 'EarnRadar Verification Team' },
      { opportunityId: opp1.id, stage: 'ADMIN_AUDIT', status: 'VERIFIED', note: 'Tournament bracket payout proof inspected.', checkedBy: 'Admin Mod' },
      { opportunityId: opp2.id, stage: 'SUBMISSION', status: 'PENDING', note: 'Freelance video editing workflow submitted.', checkedBy: 'System' },
      { opportunityId: opp2.id, stage: 'EVIDENCE_REVIEWED', status: 'VERIFIED', note: 'Client retainer invoice and deliverable timeline verified.', checkedBy: 'EarnRadar Verification Team' },
      { opportunityId: opp2.id, stage: 'ADMIN_AUDIT', status: 'VERIFIED', note: 'Published to live radar.', checkedBy: 'Admin Mod' }
    ]
  });

  // 7. Community Experience
  await prisma.communityExperience.createMany({
    data: [
      {
        opportunityId: opp2.id,
        userId: user2.id,
        status: 'TRIED',
        duration: '1.5 months',
        hoursSpentWeekly: 12,
        amountEarned: 18000,
        problemsFaced: 'Initial client acquisition required sending 8-10 customized sample pitches.',
        reviewText: 'Followed the 3-sample video strategy. Landed a YouTube gaming creator client at ₹1,500/short.',
        wouldContinue: true
      },
      {
        opportunityId: opp1.id,
        userId: user1.id,
        status: 'TRIED',
        duration: '3 weeks',
        hoursSpentWeekly: 6,
        amountEarned: 4500,
        problemsFaced: 'High competition in quarter-final brackets.',
        reviewText: 'Prize was distributed within 48 hours to registered game account.',
        wouldContinue: true
      }
    ]
  });

  console.log('✔ Comments, Verification Logs and Community Experiences seeded');
  console.log('\n========================================================');
  console.log('🎉 Database seeding complete!');
  console.log('Admin Account: admin@earnradar.io | Password: AdminPassword2026!');
  console.log('User Account:  priya@earnradar.io  | Password: UserPassword2026!');
  console.log('========================================================\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
