import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runRealityCheckAndHealthTests() {
  console.log('================================================================');
  console.log('🛡️ STEP 3: REALITY CHECK + OPPORTUNITY HEALTH — AUTOMATED SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    total++;
    passed++;
    console.log(`   ✔ [PASS] ${testName}`);
  }

  // 1. Fetch live opportunities
  console.log('1️⃣ [OPPORTUNITY DATA & HEALTH STATUS RETRIEVAL]');
  const listRes = await fetch(`${BASE_URL}/api/opportunities`);
  const listData = await listRes.json();
  assert.strictEqual(listData.success, true);
  assert.ok(listData.opportunities.length > 0);
  const targetOpp = listData.opportunities[0];
  recordPass('Retrieved live opportunities for health verification');

  // 2. Test GET opportunity details contains health & reality check fields
  const detailRes = await fetch(`${BASE_URL}/api/opportunities/${targetOpp.slug}`);
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.success, true);
  const opp = detailData.opportunity;

  assert.ok(opp.healthStatus, 'Opportunity must have healthStatus');
  assert.ok(opp.sourceStatus, 'Opportunity must have sourceStatus');
  assert.ok(opp.communityReportSummary, 'Opportunity must have communityReportSummary');
  recordPass('GET opportunity includes healthStatus, sourceStatus, and communityReportSummary');

  // 3. Test HTML page contains Reality Check 8 facets & Health Banner
  console.log('\n2️⃣ [HTML TEMPLATE & REALITY CHECK RENDERING]');
  const htmlRes = await fetch(`${BASE_URL}/opportunities/${targetOpp.slug}`);
  assert.strictEqual(htmlRes.status, 200);
  const htmlText = await htmlRes.text();

  assert.ok(htmlText.includes('Reality Check'), 'HTML must contain Reality Check section');
  assert.ok(htmlText.includes('1. Starting Cost'), 'HTML must contain Starting Cost facet');
  assert.ok(htmlText.includes('2. Time Commitment'), 'HTML must contain Time Commitment facet');
  assert.ok(htmlText.includes('3. Learning Curve'), 'HTML must contain Learning Curve facet');
  assert.ok(htmlText.includes('4. Competition'), 'HTML must contain Competition facet');
  assert.ok(htmlText.includes('5. Income Consistency'), 'HTML must contain Income Consistency facet');
  assert.ok(htmlText.includes('6. Platform Dependence'), 'HTML must contain Platform Dependence facet');
  assert.ok(htmlText.includes('7. Main Risks'), 'HTML must contain Main Risks facet');
  assert.ok(htmlText.includes('Important: What This Does Not Tell You'), 'HTML must contain transparency disclosure');
  recordPass('Reality Check 8-facet matrix and transparency box verified in HTML');

  // 4. Test Zero False Promises & Non-Guaranteed Disclaimers
  console.log('\n3️⃣ [PUBLIC TRUST & ZERO GUARANTEE COMPLIANCE]');
  assert.ok(!htmlText.includes('Guaranteed earnings'), 'Must not contain Guaranteed earnings promise');
  assert.ok(!htmlText.includes('Easy money score'), 'Must not contain Easy money score');
  assert.ok(!htmlText.includes('Success probability'), 'Must not contain fake Success probability');
  assert.ok(htmlText.includes('EarnRadar information does not guarantee income'), 'Must contain non-guaranteed income disclosure');
  recordPass('Public trust compliance: zero fake scores, explicit transparency warnings');

  // 5. Normal User vs Admin Security Tests for Health Modification
  console.log('\n4️⃣ [SECURITY & RBAC AUTHORIZATION AUDIT]');
  // Register regular user
  const regularEmail = `user_reality_${Date.now()}@earnradar.io`;
  const otpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regularEmail, purpose: 'SIGNUP' })
  });
  const otpData = await otpRes.json();
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Regular User',
      email: regularEmail,
      password: 'SecurePassword2026!',
      otp: otpData.debugOtp,
      termsAccepted: true
    })
  });
  const userCookie = regRes.headers.get('set-cookie');

  // Regular user attempts to modify health status -> must be blocked with 403
  const unauthorizedHealthRes = await fetch(`${BASE_URL}/api/admin/opportunities/${opp.id}/health`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userCookie
    },
    body: JSON.stringify({ healthStatus: 'SUSPENDED' })
  });
  assert.strictEqual(unauthorizedHealthRes.status, 403, 'Regular user must be blocked with 403 Forbidden');
  recordPass('Security guard: Regular user blocked from modifying health status (403 Forbidden)');

  // 6. Admin Authentication & Health Management
  console.log('\n5️⃣ [ADMIN OPPORTUNITY HEALTH MANAGEMENT & AUDIT LOGS]');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@earnradar.io',
      password: 'AdminPassword2026!'
    })
  });
  const adminData = await adminLoginRes.json();
  assert.strictEqual(adminData.success, true, 'Admin login must succeed');
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  const adminToken = adminData.token;

  // Admin updates health to NEEDS_REVIEW
  const updateNeedsReviewRes = await fetch(`${BASE_URL}/api/admin/opportunities/${opp.id}/health`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      healthStatus: 'NEEDS_REVIEW',
      sourceStatus: 'SOURCE_NEEDS_REVIEW',
      reviewReason: 'Periodic terms and payout rail audit requested.',
      notes: 'Scheduled semi-annual compliance check'
    })
  });
  const needsReviewData = await updateNeedsReviewRes.json();
  assert.strictEqual(needsReviewData.success, true);
  assert.strictEqual(needsReviewData.opportunity.healthStatus, 'NEEDS_REVIEW');
  assert.strictEqual(needsReviewData.opportunity.sourceStatus, 'SOURCE_NEEDS_REVIEW');
  recordPass('Admin updated health to NEEDS_REVIEW with reviewReason');

  // Admin updates health to SUSPENDED
  const updateSuspendedRes = await fetch(`${BASE_URL}/api/admin/opportunities/${opp.id}/health`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      healthStatus: 'SUSPENDED',
      reviewReason: 'Temporary pause pending verification update.'
    })
  });
  const suspendedData = await updateSuspendedRes.json();
  assert.strictEqual(suspendedData.success, true);
  assert.strictEqual(suspendedData.opportunity.healthStatus, 'SUSPENDED');
  recordPass('Admin updated health to SUSPENDED');

  // Admin updates health back to ACTIVE
  const updateActiveRes = await fetch(`${BASE_URL}/api/admin/opportunities/${opp.id}/health`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      healthStatus: 'ACTIVE',
      sourceStatus: 'SOURCE_CHECKED',
      status: 'VERIFIED',
      reviewReason: null,
      notes: 'Audit completed. All terms verified.'
    })
  });
  const activeData = await updateActiveRes.json();
  assert.strictEqual(activeData.success, true);
  assert.strictEqual(activeData.opportunity.healthStatus, 'ACTIVE');
  recordPass('Admin restored health to ACTIVE and verified status');

  // 7. Verify Audit Log was generated
  const auditLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: {
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    }
  });
  const auditLogsData = await auditLogsRes.json();
  assert.strictEqual(auditLogsData.success, true);
  const healthLogs = auditLogsData.logs.filter(l => l.action === 'OPPORTUNITY_HEALTH_UPDATE');
  assert.ok(healthLogs.length >= 3, 'Must have recorded audit log entries for each health update');
  recordPass('Immutable administrative audit logs generated and verified');

  // 8. Verify Verification Logs timeline on opportunity
  const updatedDetailRes = await fetch(`${BASE_URL}/api/opportunities/${opp.id}`);
  const updatedDetailData = await updatedDetailRes.json();
  assert.ok(updatedDetailData.opportunity.verificationLogs.length > 0, 'Must contain verification history logs');
  recordPass('Opportunity Verification History timeline populated with actual audit events');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} STEP 3 TESTS PASSED PERFECTLY!`);
  console.log('================================================================\n');
}

runRealityCheckAndHealthTests().catch(err => {
  console.error('❌ Step 3 Test Failed:', err);
  process.exit(1);
});
