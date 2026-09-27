import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runOpportunityIntelligenceTests() {
  console.log('================================================================');
  console.log('📡 OPPORTUNITY INTELLIGENCE — AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    total++;
    passed++;
    console.log(`   ✔ [PASS] ${testName}`);
  }

  // 1. Verify Directory List & Pick a Seed Opportunity
  console.log('1️⃣ [OPPORTUNITY API & DOSSIER RETRIEVAL]');
  const listRes = await fetch(`${BASE_URL}/api/opportunities`);
  const listData = await listRes.json();
  assert.strictEqual(listData.success, true, 'Directory API must succeed');
  assert.ok(listData.opportunities.length > 0, 'Directory must have seeded opportunities');
  
  const targetOpp = listData.opportunities[0];
  console.log(`   Inspecting Opportunity: "${targetOpp.title}" (${targetOpp.slug})`);
  recordPass('Fetched active opportunities list');

  // 2. Fetch Single Opportunity Intelligence API
  const detailRes = await fetch(`${BASE_URL}/api/opportunities/${targetOpp.slug}`);
  assert.strictEqual(detailRes.status, 200, 'GET /api/opportunities/:slug must return 200 OK');
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.success, true);
  
  const opp = detailData.opportunity;
  assert.ok(opp.id, 'Opportunity must have an ID');
  assert.ok(opp.title, 'Opportunity must have a title');
  assert.ok(opp.description, 'Opportunity must have a description');
  assert.ok(opp.howItWorks, 'Opportunity must have howItWorks');
  assert.ok(opp.healthStatus, 'Opportunity must have healthStatus');
  assert.ok(Array.isArray(opp.steps), 'Opportunity must include steps array');
  assert.ok(Array.isArray(opp.verificationLogs), 'Opportunity must include verificationLogs array');
  assert.ok(Array.isArray(opp.experiences), 'Opportunity must include experiences array');
  assert.ok(opp._count, 'Opportunity must include _count relational stats');
  assert.strictEqual(typeof opp._count.savedBy, 'number', '_count.savedBy must be a number');
  assert.strictEqual(typeof opp._count.memberships, 'number', '_count.memberships must be a number');
  recordPass('GET /api/opportunities/:slug returns complete relational Intelligence schema');

  // 3. Verify HTML Page Delivery & Structure
  console.log('\n2️⃣ [OPPORTUNITY INTELLIGENCE HTML PAGE]');
  const htmlRes = await fetch(`${BASE_URL}/opportunities/${targetOpp.slug}`);
  assert.strictEqual(htmlRes.status, 200, 'HTML page must return 200 OK');
  const htmlText = await htmlRes.text();
  assert.ok(htmlText.includes('Opportunity Intelligence'), 'HTML must contain Opportunity Intelligence title');
  assert.ok(htmlText.includes('What You Need to Start'), 'HTML must contain Prerequisites section');
  assert.ok(htmlText.includes('Money Details'), 'HTML must contain Financial Transparency section');
  assert.ok(htmlText.includes('Honest Assessment &amp; Red Flags') || htmlText.includes('Honest Assessment'), 'HTML must contain Reality Check section');
  assert.ok(htmlText.includes('How This Opportunity Works'), 'HTML must contain Step-by-Step section');
  assert.ok(htmlText.includes('Source &amp; Verification Trail'), 'HTML must contain Source & Verification section');
  assert.ok(htmlText.includes('Stay Safe Checklist'), 'HTML must contain Stay Safe checklist');
  recordPass('Opportunity Intelligence page structure & sections confirmed');

  // 4. Verify Non-Guaranteed Disclaimer Compliance
  console.log('\n3️⃣ [COMPLIANCE & NO FALSE PROMISES VERIFICATION]');
  assert.ok(!htmlText.includes('Guaranteed Income'), 'Must not contain Guaranteed Income promise');
  assert.ok(!htmlText.includes('Easy Money'), 'Must not contain Easy Money slogan');
  assert.ok(!htmlText.includes('Best Opportunity'), 'Must not contain arbitrary Best Opportunity label');
  assert.ok(htmlText.includes('EarnRadar does not guarantee income'), 'Must contain explicit non-guaranteed income disclaimer');
  recordPass('Strict compliance: Zero false promises, explicit non-guaranteed income disclaimers verified');

  // 5. User Interaction Flow: Save Opportunity & Discussion
  console.log('\n4️⃣ [COMMUNITY INTERACTIONS & SIGNALS]');
  const testUserEmail = `intel_user_${Date.now()}@earnradar.io`;
  const otpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, purpose: 'SIGNUP' })
  });
  const otpData = await otpRes.json();
  assert.strictEqual(otpData.success, true);
  const otpCode = otpData.debugOtp;

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Intelligence Tester',
      email: testUserEmail,
      password: 'SecurePassword2026!',
      otp: otpCode,
      termsAccepted: true
    })
  });
  const regData = await regRes.json();
  assert.strictEqual(regData.success, true, 'User registration must succeed');
  const authCookie = regRes.headers.get('set-cookie');

  // Save opportunity
  const saveRes = await fetch(`${BASE_URL}/api/opportunities/${opp.id}/save`, {
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });
  const saveData = await saveRes.json();
  assert.strictEqual(saveData.success, true, 'Save opportunity must succeed');
  recordPass('User can save/toggle opportunity in Watchlist');

  // Join opportunity
  const joinRes = await fetch(`${BASE_URL}/api/opportunities/${opp.id}/join`, {
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });
  const joinData = await joinRes.json();
  assert.strictEqual(joinData.success, true, 'Join opportunity must succeed');
  recordPass('User can track & join opportunity');

  // Post comment
  const commentRes = await fetch(`${BASE_URL}/api/discussions/opportunity/${opp.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({ content: 'Intelligence dossier verified. Payout rails and steps are clear.' })
  });
  const commentData = await commentRes.json();
  assert.strictEqual(commentData.success, true, 'Comment posting must succeed');
  recordPass('User can contribute to discussion timeline');

  // Submit community experience report
  const expRes = await fetch(`${BASE_URL}/api/opportunities/${opp.id}/experience`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie
    },
    body: JSON.stringify({
      rating: 4,
      difficulty: 2,
      earnedAmount: 3500,
      timeSpentWeekly: '5 hrs/week',
      pros: 'Clear guidelines and prompt support',
      cons: 'Competitive entry requirements',
      tips: 'Read the rules thoroughly before joining'
    })
  });
  const expData = await expRes.json();
  assert.strictEqual(expData.success, true, 'Community experience submission must succeed');
  recordPass('User can submit factual Community Experience feedback & earnings report');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} OPPORTUNITY INTELLIGENCE TESTS PASSED PERFECTLY!`);
  console.log('================================================================\n');
}

runOpportunityIntelligenceTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
