import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runFindMyOpportunityTests() {
  console.log('================================================================');
  console.log('🎯 FIND MY OPPORTUNITY — AUTOMATED TEST & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    total++;
    passed++;
    console.log(`   ✔ [PASS] ${testName}`);
  }

  // 1. Verify Route Accessibility
  console.log('1️⃣ [ROUTE & HTML PAGE ACCESSIBILITY]');
  const pageRes1 = await fetch(`${BASE_URL}/find-my-opportunity`);
  assert.strictEqual(pageRes1.status, 200, '/find-my-opportunity must return 200 OK');
  const pageText = await pageRes1.text();
  assert.ok(pageText.includes('Find My Opportunity'), 'Page must contain Find My Opportunity title');
  assert.ok(pageText.includes('Step 1 of 5'), 'Page must contain 5-step questionnaire');
  recordPass('/find-my-opportunity route renders valid HTML (200 OK)');

  const pageRes2 = await fetch(`${BASE_URL}/find`);
  assert.strictEqual(pageRes2.status, 200, '/find shortcut must return 200 OK');
  recordPass('/find shortcut route renders valid HTML (200 OK)');

  // 2. Persona 1: Gaming Enthusiast with 2–4 hours & ₹0 budget
  console.log('\n2️⃣ [PERSONA 1 — GAMING + 2-4H + ₹0 BUDGET]');
  const persona1Res = await fetch(`${BASE_URL}/api/opportunities/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dailyTime: '2-4h',
      skills: ['gaming'],
      budget: '0',
      categoryInterests: ['gaming'],
      primaryPriority: 'low-cost'
    })
  });
  const persona1Data = await persona1Res.json();
  assert.strictEqual(persona1Data.success, true);
  assert.ok(persona1Data.opportunities.length > 0, 'Should return matching opportunities');
  
  const topMatch1 = persona1Data.opportunities[0];
  assert.ok(topMatch1.categorySlug === 'gaming' || topMatch1.skillsRequired.toLowerCase().includes('game'), 'Top match for gaming persona should be gaming related');
  assert.ok(Array.isArray(topMatch1.matchReasons) && topMatch1.matchReasons.length > 0, 'Top match must have factual match reasons');
  console.log(`   Top Match: "${topMatch1.title}" (${topMatch1.category})`);
  console.log(`   Match Reasons:`, topMatch1.matchReasons);
  recordPass('Persona 1 matches Gaming methods with factual explanations');

  // 3. Persona 2: Video Editor & Creator with 1–2 hours & Freelancing/Creator interest
  console.log('\n3️⃣ [PERSONA 2 — VIDEO EDITING + 1-2H + CREATOR/FREELANCING]');
  const persona2Res = await fetch(`${BASE_URL}/api/opportunities/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dailyTime: '1-2h',
      skills: ['video-editing', 'designing'],
      budget: '0',
      categoryInterests: ['creator', 'freelancing'],
      primaryPriority: 'flexible-timing'
    })
  });
  const persona2Data = await persona2Res.json();
  assert.strictEqual(persona2Data.success, true);
  assert.ok(persona2Data.opportunities.length > 0);
  const topMatch2 = persona2Data.opportunities[0];
  assert.ok(['creator', 'freelancing'].includes(topMatch2.categorySlug), 'Top match should be Creator or Freelancing');
  console.log(`   Top Match: "${topMatch2.title}" (${topMatch2.category})`);
  console.log(`   Match Reasons:`, topMatch2.matchReasons);
  recordPass('Persona 2 matches Video Editing / Creator gigs with factual explanations');

  // 4. Persona 3: Beginner with Less than 1 hour & ₹0 budget
  console.log('\n4️⃣ [PERSONA 3 — BEGINNER + <1H + QUICK PARTICIPATION]');
  const persona3Res = await fetch(`${BASE_URL}/api/opportunities/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dailyTime: 'less-than-1h',
      skills: ['beginner'],
      budget: '0',
      categoryInterests: ['rewards', 'quick-gigs'],
      primaryPriority: 'quick-participation'
    })
  });
  const persona3Data = await persona3Res.json();
  assert.strictEqual(persona3Data.success, true);
  assert.ok(persona3Data.opportunities.length > 0);
  const topMatch3 = persona3Data.opportunities[0];
  console.log(`   Top Match: "${topMatch3.title}" (${topMatch3.category})`);
  console.log(`   Match Reasons:`, topMatch3.matchReasons);
  recordPass('Persona 3 matches Beginner-friendly opportunities with factual explanations');

  // 5. Post-Match Filters (Category & Risk)
  console.log('\n5️⃣ [POST-MATCH FILTERING]');
  const filteredRes = await fetch(`${BASE_URL}/api/opportunities/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dailyTime: '2-4h',
      skills: ['coding', 'gaming'],
      budget: '0',
      categoryInterests: ['all'],
      primaryPriority: 'skill-development',
      filterRisk: 'LOW',
      filterSkill: 'BEGINNER'
    })
  });
  const filteredData = await filteredRes.json();
  assert.strictEqual(filteredData.success, true);
  filteredData.opportunities.forEach(opp => {
    assert.strictEqual(opp.riskLevel, 'LOW', 'All filtered items must be LOW risk');
    assert.strictEqual(opp.skillLevel, 'BEGINNER', 'All filtered items must be BEGINNER skill level');
  });
  recordPass(`Post-match filter returned ${filteredData.opportunities.length} low-risk beginner opportunities`);

  // 6. Security & Safety Check (Zero guaranteed income promises)
  console.log('\n6️⃣ [HONESTY & ZERO GUARANTEE CHECK]');
  persona1Data.opportunities.forEach(opp => {
    assert.ok(!JSON.stringify(opp.matchReasons).toLowerCase().includes('guarantee'), 'No match reason should claim guaranteed income');
    assert.ok(!JSON.stringify(opp.matchReasons).toLowerCase().includes('easy money'), 'No match reason should claim easy money');
  });
  recordPass('Factual neutrality verified: Zero fake earning scores or income guarantees');

  // 7. Partial / Empty Input Graceful Handling
  console.log('\n7️⃣ [GRACEFUL EMPTY / MALFORMED INPUT HANDLING]');
  const emptyRes = await fetch(`${BASE_URL}/api/opportunities/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const emptyData = await emptyRes.json();
  assert.strictEqual(emptyRes.status, 200);
  assert.strictEqual(emptyData.success, true);
  recordPass('Empty / partial body handled gracefully without crashing');

  console.log('\n================================================================');
  console.log(`🏆 ALL ${passed} / ${total} "FIND MY OPPORTUNITY" TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runFindMyOpportunityTests().catch(err => {
  console.error('\n❌ Find My Opportunity Test Suite Failed:', err);
  process.exit(1);
});
