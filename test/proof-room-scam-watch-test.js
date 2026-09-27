import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runProofRoomScamWatchTests() {
  console.log('================================================================');
  console.log('🛡️ STEP 4: PROOF ROOM + SCAM WATCH + REPORT INTELLIGENCE SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    total++;
    passed++;
    console.log(`   ✔ [PASS] ${testName}`);
  }

  // 1. Fetch live opportunity with evidence
  console.log('1️⃣ [PROOF ROOM & EVIDENCE SCHEMAS]');
  const listRes = await fetch(`${BASE_URL}/api/opportunities`);
  const listData = await listRes.json();
  assert.strictEqual(listData.success, true);
  assert.ok(listData.opportunities.length > 0);
  const targetOpp = listData.opportunities[0];

  const detailRes = await fetch(`${BASE_URL}/api/opportunities/${targetOpp.slug}`);
  const detailData = await detailRes.json();
  const opp = detailData.opportunity;

  assert.ok(Array.isArray(opp.evidence), 'Opportunity must have evidence array');
  recordPass('Fetched opportunity evidence structure');

  // 2. HTML Inspection: Proof Room & Scam Watch & Safety Center
  console.log('\n2️⃣ [HTML RENDERING & LABELS VERIFICATION]');
  const htmlRes = await fetch(`${BASE_URL}/opportunities/${targetOpp.slug}`);
  const htmlText = await htmlRes.text();

  assert.ok(htmlText.includes('Proof Room'), 'HTML must contain Proof Room section');
  assert.ok(htmlText.includes('Scam Watch &amp; Warning Signs') || htmlText.includes('Scam Watch'), 'HTML must contain Scam Watch section');
  assert.ok(htmlText.includes('Stay Safe on EarnRadar'), 'HTML must contain Stay Safe on EarnRadar safety center');
  assert.ok(htmlText.includes('Upfront Payment Requests'), 'Scam watch must warn about upfront payment requests');
  assert.ok(htmlText.includes('Guaranteed Income Claims'), 'Scam watch must warn about guaranteed income claims');
  assert.ok(htmlText.includes('OTP &amp; Password Confidentiality'), 'Scam watch must warn about OTP/password sharing');
  assert.ok(htmlText.includes('Displayed earnings are not a guarantee of future results'), 'Proof room must show non-guaranteed earning notice');
  assert.ok(htmlText.includes('Do not include passwords, OTPs, bank details'), 'Report modal must contain privacy reminder');
  recordPass('Proof Room, Scam Watch, Safety Center, and privacy warnings rendered in HTML');

  // 3. User Authentication & Report Submission Flow
  console.log('\n3️⃣ [REPORT INTELLIGENCE SUBMISSION & VALIDATION]');
  const testEmail = `report_user_${Date.now()}@earnradar.io`;
  const otpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, purpose: 'SIGNUP' })
  });
  const otpData = await otpRes.json();
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Report Tester',
      email: testEmail,
      password: 'SecurePassword2026!',
      otp: otpData.debugOtp,
      termsAccepted: true
    })
  });
  const userCookie = regRes.headers.get('set-cookie');
  const userToken = (await regRes.json()).token;

  // Valid report submission
  const reportRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userCookie,
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      targetType: 'OPPORTUNITY',
      targetId: opp.id,
      reason: 'MISLEADING_EARNINGS',
      details: 'Task rewards vary from platform policy update last week.',
      evidenceUrl: 'https://example.com/updated-terms'
    })
  });
  const reportData = await reportRes.json();
  assert.strictEqual(reportRes.status, 201);
  assert.strictEqual(reportData.success, true);
  assert.ok(reportData.message.includes('Report submitted'), 'Must return transparent user feedback');
  assert.ok(reportData.message.includes('does not automatically mean'), 'Must clarify that reports do not automatically imply fraud');
  const reportId = reportData.reportId;
  recordPass('User submitted valid report with transparent feedback message');

  // Invalid report rejection: Malformed reason
  const badReasonRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userCookie,
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      targetType: 'OPPORTUNITY',
      targetId: opp.id,
      reason: 'INVALID_RANDOM_REASON',
      details: 'Test'
    })
  });
  assert.strictEqual(badReasonRes.status, 400);
  recordPass('Invalid report reason rejected with 400 Bad Request');

  // Dangerous javascript: link rejection in report
  const xssLinkRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': userCookie,
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      targetType: 'OPPORTUNITY',
      targetId: opp.id,
      reason: 'SCAM',
      details: 'Malicious link test',
      evidenceUrl: 'javascript:alert(1)'
    })
  });
  assert.strictEqual(xssLinkRes.status, 400);
  recordPass('Dangerous javascript: URL rejected');

  // 4. Verify Single Report Does NOT Automatically Suspend Opportunity
  console.log('\n4️⃣ [HEALTH ISOLATION FROM USER REPORTS]');
  const oppAfterReportRes = await fetch(`${BASE_URL}/api/opportunities/${opp.id}`);
  const oppAfterReportData = await oppAfterReportRes.json();
  assert.strictEqual(oppAfterReportData.opportunity.healthStatus, 'ACTIVE', 'Single report must not auto-suspend opportunity');
  assert.ok(oppAfterReportData.opportunity.communityReportSummary.includes('under review'), 'Community report summary updated');
  recordPass('Report recorded in health summary without auto-suspension');

  // 5. Admin RBAC & Evidence / Report Moderation
  console.log('\n5️⃣ [ADMIN MODERATION & EVIDENCE REVIEW]');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@earnradar.io', password: 'AdminPassword2026!' })
  });
  const adminData = await adminLoginRes.json();
  assert.strictEqual(adminData.success, true);
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  const adminToken = adminData.token;

  // Regular user blocked from admin evidence endpoints (403)
  const unauthEvidenceRes = await fetch(`${BASE_URL}/api/admin/evidence`, {
    headers: {
      'Cookie': userCookie,
      'Authorization': `Bearer ${userToken}`
    }
  });
  assert.strictEqual(unauthEvidenceRes.status, 403);
  recordPass('Regular user blocked from admin evidence moderation (403 Forbidden)');

  // Admin lists evidence
  const adminEvidenceRes = await fetch(`${BASE_URL}/api/admin/evidence`, {
    headers: {
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    }
  });
  const adminEvidenceData = await adminEvidenceRes.json();
  assert.strictEqual(adminEvidenceData.success, true);
  assert.ok(Array.isArray(adminEvidenceData.evidence));
  recordPass('Admin retrieved evidence queue');

  // If evidence exists, test admin review
  if (adminEvidenceData.evidence.length > 0) {
    const targetEv = adminEvidenceData.evidence[0];
    const reviewEvRes = await fetch(`${BASE_URL}/api/admin/evidence/${targetEv.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie,
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        verifiedStatus: 'EVIDENCE_REVIEWED',
        status: 'REVIEWED',
        adminNote: 'Verified tournament rails and payout screenshot'
      })
    });
    const reviewEvData = await reviewEvRes.json();
    assert.strictEqual(reviewEvData.success, true);
    assert.strictEqual(reviewEvData.evidence.verifiedStatus, 'EVIDENCE_REVIEWED');
    recordPass('Admin reviewed evidence document and recorded moderation note');
  }

  // Admin resolves report
  const resolveReportRes = await fetch(`${BASE_URL}/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      status: 'ACTION_TAKEN',
      resolution: 'Opportunity terms verified with platform documentation.'
    })
  });
  const resolveReportData = await resolveReportRes.json();
  assert.strictEqual(resolveReportData.success, true);
  assert.strictEqual(resolveReportData.report.status, 'ACTION_TAKEN');
  recordPass('Admin investigated and resolved community report');

  // 6. Verify Audit Trail for Evidence and Report Moderation
  console.log('\n6️⃣ [AUDIT LOGS AUDIT]');
  const auditLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: {
      'Cookie': adminCookie,
      'Authorization': `Bearer ${adminToken}`
    }
  });
  const auditLogsData = await auditLogsRes.json();
  assert.strictEqual(auditLogsData.success, true);
  const reportLogs = auditLogsData.logs.filter(l => l.action.includes('REPORT_'));
  assert.ok(reportLogs.length > 0, 'Must record audit log for report resolution');
  recordPass('Audit log verified for report moderation actions');

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} STEP 4 TESTS PASSED PERFECTLY!`);
  console.log('================================================================\n');
}

runProofRoomScamWatchTests().catch(err => {
  console.error('❌ Step 4 Test Failed:', err);
  process.exit(1);
});
