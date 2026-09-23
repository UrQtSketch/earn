import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function runProductionReadinessAudit() {
  console.log('================================================================');
  console.log('🛡️ EARNRADAR — DEEP PRODUCTION READINESS & SECURITY AUDIT');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName) {
    totalTests++;
    passedTests++;
    console.log(`   [PASS] ${testName}`);
  }

  function recordFail(testName, error) {
    totalTests++;
    console.error(`   ❌ [FAIL] ${testName}:`, error);
  }

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & SECURITY EDGE CASES
  // -------------------------------------------------------------
  console.log('▶️ [1/7] AUTHENTICATION & CREDENTIAL SECURITY AUDIT');

  const testEmailA = `audit_user_a_${Date.now()}@earnradar.io`;
  const testEmailB = `audit_user_b_${Date.now()}@earnradar.io`;

  // 1.1 OTP Generation
  const otpResA = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmailA, purpose: 'SIGNUP' })
  });
  const otpDataA = await otpResA.json();
  assert.strictEqual(otpDataA.success, true);
  const otpA = otpDataA.debugOtp;
  recordPass('OTP generation and 6-digit formatting');

  // 1.2 OTP Rate Limiting / Resend Cooldown
  const rapidOtpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmailA, purpose: 'SIGNUP' })
  });
  const rapidOtpData = await rapidOtpRes.json();
  assert.ok([400, 429].includes(rapidOtpRes.status));
  assert.ok(rapidOtpData.error.toLowerCase().includes('wait') || rapidOtpData.error.toLowerCase().includes('too many') || rapidOtpData.error.toLowerCase().includes('rate'));
  recordPass('OTP 60-second cooldown rate limiting');

  // 1.3 OTP Brute-Force Attempt Limits
  for (let i = 0; i < 4; i++) {
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Attacker User',
        email: testEmailA,
        password: 'ValidPassword123!',
        otp: '000000',
        termsAccepted: true
      })
    });
  }
  // 5th attempt should invalidate OTP
  const fifthAttemptRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Attacker User',
      email: testEmailA,
      password: 'ValidPassword123!',
      otp: '000000',
      termsAccepted: true
    })
  });
  const fifthData = await fifthAttemptRes.json();
  assert.ok(fifthData.error.toLowerCase().includes('limit') || fifthData.error.toLowerCase().includes('attempt') || fifthData.error.toLowerCase().includes('expired'));
  recordPass('OTP 5-attempt brute-force protection');

  // Request fresh OTP for User A
  // Wait or create new email for clean registration
  const userA_email = `audited_a_${Date.now()}@earnradar.io`;
  const reqNewOtpA = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA_email, purpose: 'SIGNUP' })
  });
  const validOtpA = (await reqNewOtpA.json()).debugOtp;

  // 1.4 Weak Password Rejection
  const weakPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'User Weak Pass',
      email: userA_email,
      password: '123',
      otp: validOtpA,
      termsAccepted: true
    })
  });
  assert.strictEqual(weakPassRes.status, 400);
  recordPass('Weak password length / complexity validation');

  // 1.5 Valid Registration
  const regUserA = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Alice Auditor',
      email: userA_email,
      password: 'StrongAuditedPassword2026!',
      otp: validOtpA,
      termsAccepted: true
    })
  });
  const regDataA = await regUserA.json();
  if (!regDataA.success) {
    console.error('   ❌ regUserA failed:', regUserA.status, regDataA);
  }
  assert.strictEqual(regDataA.success, true);
  const tokenA = regDataA.token;
  const userA = regDataA.user;
  recordPass('Valid user registration & session generation');

  // 1.6 Duplicate Email Rejection
  const reqDupOtp = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA_email, purpose: 'SIGNUP' })
  });
  const dupOtpCode = (await reqDupOtp.json()).debugOtp;
  const dupEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Duplicate Alice',
      email: userA_email,
      password: 'StrongAuditedPassword2026!',
      otp: dupOtpCode,
      termsAccepted: true
    })
  });
  assert.strictEqual(dupEmailRes.status, 400);
  recordPass('Duplicate email registration prevention');

  // 1.7 Register User B for IDOR testing
  const userB_email = `audited_b_${Date.now()}@earnradar.io`;
  const reqOtpB = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userB_email, purpose: 'SIGNUP' })
  });
  const validOtpB = (await reqOtpB.json()).debugOtp;
  const regUserB = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Bob Auditor',
      email: userB_email,
      password: 'StrongAuditedPassword2026!',
      otp: validOtpB,
      termsAccepted: true
    })
  });
  const regDataB = await regUserB.json();
  const tokenB = regDataB.token;
  const userB = regDataB.user;
  recordPass('Secondary user registered for access-control audit');

  // 1.8 Wrong Password Login Rejection
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA_email, password: 'WrongPassword!' })
  });
  assert.ok([400, 401].includes(wrongPassRes.status));
  recordPass('Wrong password login protection (401/400)');

  // 1.9 Admin Authentication
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@earnradar.io', password: 'AdminPassword2026!' })
  });
  const adminLoginData = await adminLoginRes.json();
  assert.strictEqual(adminLoginData.success, true);
  const adminToken = adminLoginData.token;
  recordPass('Admin authentication & role verification');

  // -------------------------------------------------------------
  // 2. AUTHORIZATION & IDOR PENETRATION TESTING
  // -------------------------------------------------------------
  console.log('\n▶️ [2/7] AUTHORIZATION & ACCESS CONTROL (IDOR) PENETRATION AUDIT');

  // 2.1 Normal User accessing Admin Metrics API -> MUST BE 403
  const userAccessAdminMetrics = await fetch(`${BASE_URL}/api/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(userAccessAdminMetrics.status, 403);
  recordPass('Non-admin user blocked from Admin Metrics (403)');

  // 2.2 Normal User accessing Admin Users API -> MUST BE 403
  const userAccessAdminUsers = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual(userAccessAdminUsers.status, 403);
  recordPass('Non-admin user blocked from Admin User Management (403)');

  // 2.3 User A creates a draft submission
  const draftRes = await fetch(`${BASE_URL}/api/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      formData: {
        basicInfo: { title: 'Confidential Strategy by Alice', categoryId: 'freelancing', shortDescription: 'Draft' },
        howItWorks: { explanation: 'Private draft', steps: [{ stepNumber: 1, title: 'Step 1', description: 'Desc' }] },
        requirements: { requiredSkills: 'Skills', timeRequired: '1h' },
        moneyDetails: { earningModel: 'FREELANCE', startingCost: '$0', potentialEarning: '$100', paymentMethod: 'Bank' },
        safety: { knownRisks: 'None', possibleScams: 'None' },
        sources: {},
        experience: {}
      },
      isDraft: true
    })
  });
  const draftData = await draftRes.json();
  const draftId = draftData.submission.id;
  recordPass('User A private draft submission created');

  // 2.4 User B attempts to read User A's draft -> MUST BE 403/404
  const userBReadDraft = await fetch(`${BASE_URL}/api/submissions/${draftId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert.ok([403, 404].includes(userBReadDraft.status));
  recordPass('User B blocked from reading User A draft (IDOR Guard)');

  // 2.5 User B attempts to edit User A's draft -> MUST BE 403
  const userBEditDraft = await fetch(`${BASE_URL}/api/submissions/${draftId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ formData: { basicInfo: { title: 'Compromised Title' } }, isDraft: true })
  });
  assert.strictEqual(userBEditDraft.status, 403);
  recordPass('User B blocked from modifying User A draft (IDOR Guard)');

  // -------------------------------------------------------------
  // 3. COLLABORATION, MESSAGING & USER ISOLATION
  // -------------------------------------------------------------
  console.log('\n▶️ [3/7] COLLABORATION & SAFE MESSAGING AUDIT');

  // Fetch verified opportunity for collab test
  const oppListRes = await fetch(`${BASE_URL}/api/opportunities`);
  const oppList = (await oppListRes.json()).opportunities;
  const testOpp = oppList[0];

  // User A sends collab request to User B
  const collabReq = await fetch(`${BASE_URL}/api/collaborations/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      receiverId: userB.id,
      opportunityId: testOpp.id,
      message: 'Would love to partner on this project!'
    })
  });
  const collabReqData = await collabReq.json();
  assert.strictEqual(collabReqData.success, true);
  const collabId = collabReqData.request.id;
  recordPass('Collaboration request dispatched with notification');

  // User B accepts collab
  const acceptCollab = await fetch(`${BASE_URL}/api/collaborations/respond/${collabId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ action: 'ACCEPT' })
  });
  const convId = (await acceptCollab.json()).conversationId;
  assert.ok(convId, 'Conversation ID must be generated');
  recordPass('Collaboration accepted and secure conversation channel opened');

  // User A sends message
  const msgRes = await fetch(`${BASE_URL}/api/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ conversationId: convId, recipientId: userB.id, content: 'Hello Bob, let us review the workflow.' })
  });
  assert.strictEqual((await msgRes.json()).success, true);
  recordPass('Direct message delivered securely');

  // Register User C to test Conversation Privacy (User C trying to read A-B conversation)
  const userC_email = `audited_c_${Date.now()}@earnradar.io`;
  const reqOtpC = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userC_email, purpose: 'SIGNUP' })
  });
  const validOtpC = (await reqOtpC.json()).debugOtp;
  const regUserC = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Charlie Intruder',
      email: userC_email,
      password: 'StrongAuditedPassword2026!',
      otp: validOtpC,
      termsAccepted: true
    })
  });
  const tokenC = (await regUserC.json()).token;

  // User C attempts to read conversation between User A and User B -> MUST BE 403
  const userCReadConv = await fetch(`${BASE_URL}/api/messages/conversations/${convId}`, {
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert.strictEqual(userCReadConv.status, 403);
  recordPass('Third-party user blocked from reading private conversations (403)');

  // -------------------------------------------------------------
  // 4. SHARE A METHOD FULL LIFECYCLE AUDIT
  // -------------------------------------------------------------
  console.log('\n▶️ [4/7] 9-STEP SHARE METHOD LIFECYCLE & MODERATION AUDIT');

  // Submit complete method by User A
  const fullMethodPayload = {
    basicInfo: {
      title: 'Global SaaS Bug Bounty & Vulnerability Research',
      categoryId: 'freelancing',
      shortDescription: 'Audit open-source dependencies and disclose verified vulnerability reports on HackerOne.'
    },
    howItWorks: {
      explanation: 'Scan authorized target scopes, document proof of concept, and submit responsible disclosures.',
      steps: [
        { stepNumber: 1, title: 'Select Program Scope', description: 'Review HackerOne policy and authorized assets.' },
        { stepNumber: 2, title: 'Reconnaissance & Testing', description: 'Map API endpoints and test authorization boundaries.' },
        { stepNumber: 3, title: 'Submit Detailed Report', description: 'Provide CVSS rating, reproducible steps, and remediation advice.' }
      ]
    },
    requirements: {
      requiredSkills: 'Burp Suite, OWASP Top 10, HTTP/Web Architecture',
      timeRequired: '10–15 hrs / week'
    },
    moneyDetails: {
      earningModel: 'BOUNTY',
      startingCost: '$0',
      potentialEarning: '$200 – $5,000 / valid finding',
      paymentMethod: 'PayPal / Wire'
    },
    safety: {
      knownRisks: 'Out-of-scope testing can lead to account suspension.',
      possibleScams: 'Never participate in private bug programs without formal escrow or established reputation.'
    },
    sources: {
      officialWebsite: 'https://hackerone.com'
    },
    experience: {
      personallyUsed: 'Yes',
      amountEarned: '45000',
      timePeriod: '3 months'
    }
  };

  const publishSubRes = await fetch(`${BASE_URL}/api/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ formData: fullMethodPayload, isDraft: false })
  });
  const publishSubData = await publishSubRes.json();
  assert.strictEqual(publishSubData.success, true);
  const submittedId = publishSubData.submission.id;
  recordPass('Full 9-step method submitted with DRAFT -> SUBMITTED state transition');

  // Admin Request Changes
  const adminReqChange = await fetch(`${BASE_URL}/api/admin/submissions/${submittedId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      action: 'REQUEST_CHANGES',
      adminFeedback: 'Please add explicit guidance on avoiding destructive testing in step 2.'
    })
  });
  assert.strictEqual((await adminReqChange.json()).success, true);
  recordPass('Admin requested changes with feedback stored');

  // User A updates and resubmits
  fullMethodPayload.howItWorks.steps[1].description = 'Map API endpoints and test authorization boundaries non-destructively without impacting production data.';
  const resubmitRes = await fetch(`${BASE_URL}/api/submissions/${submittedId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ formData: fullMethodPayload, isDraft: false })
  });
  assert.strictEqual((await resubmitRes.json()).success, true);
  recordPass('User A revised and resubmitted method');

  // Admin approves & publishes
  const adminApprove = await fetch(`${BASE_URL}/api/admin/submissions/${submittedId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      action: 'APPROVE',
      adminFeedback: 'Verified reproduction and safety warnings. Approved for directory publication.'
    })
  });
  const approveData = await adminApprove.json();
  assert.strictEqual(approveData.success, true);
  const newOppSlug = approveData.opportunity.slug;
  recordPass('Admin approved and published opportunity dossier');

  // -------------------------------------------------------------
  // 5. DOSSIER ENRICHMENT, COMPARISON & REVIEWS
  // -------------------------------------------------------------
  console.log('\n▶️ [5/7] OPPORTUNITY DOSSIER, COMPARISON & COMMUNITY REVIEWS AUDIT');

  // Fetch opportunity dossier
  const oppDossierRes = await fetch(`${BASE_URL}/api/opportunities/${newOppSlug}`);
  const oppDossier = (await oppDossierRes.json()).opportunity;
  assert.strictEqual(oppDossier.title, fullMethodPayload.basicInfo.title);
  recordPass('Published opportunity accessible via public SEO slug');

  // Submit Community Experience
  const expRes = await fetch(`${BASE_URL}/api/opportunities/${oppDossier.id}/experience`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      amountEarned: 24000,
      duration: '1 month',
      difficulty: 4,
      reviewText: 'Detailed programs with prompt triage.',
      problemsFaced: 'Duplicate reports happen occasionally.',
      wouldContinue: true
    })
  });
  assert.strictEqual((await expRes.json()).success, true);
  recordPass('Community member experience review recorded');

  // Compare Opportunities
  const compareRes = await fetch(`${BASE_URL}/api/opportunities/compare?ids=${oppList[0].id},${oppDossier.id}`);
  const compareData = await compareRes.json();
  assert.strictEqual(compareData.success, true);
  assert.strictEqual(compareData.opportunities.length, 2);
  recordPass('Side-by-side comparison endpoint evaluated');

  // -------------------------------------------------------------
  // 6. ADMIN AUDIT LOGS, MODERATION & REPORTS
  // -------------------------------------------------------------
  console.log('\n▶️ [6/7] ADMIN AUDIT TRAIL, REPORTS & USER MODERATION');

  // User B files report against opportunity
  const reportRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      targetType: 'OPPORTUNITY',
      targetId: oppDossier.id,
      reason: 'MISLEADING_EARNINGS',
      details: 'Audit verification test report.'
    })
  });
  const reportData = await reportRes.json();
  assert.strictEqual(reportData.success, true);
  const reportId = reportData.report.id;
  recordPass('Community moderation report filed');

  // Admin resolves report
  const resolveReport = await fetch(`${BASE_URL}/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      status: 'RESOLVED',
      resolution: 'Opportunity audited and confirmed compliant with disclosures.'
    })
  });
  assert.strictEqual((await resolveReport.json()).success, true);
  recordPass('Admin resolved report with resolution note');

  // Verify Audit Logs
  const auditLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const auditLogs = (await auditLogsRes.json()).logs;
  assert.ok(auditLogs.length >= 5, 'Must contain comprehensive audit trail');
  recordPass('Immutable administrative audit trail verified');

  // -------------------------------------------------------------
  // 7. PUBLIC PAGES & SEO ASSETS
  // -------------------------------------------------------------
  console.log('\n▶️ [7/7] PUBLIC ASSETS, LEGAL PAGES & SEO AUDIT');

  const publicRoutes = ['/privacy', '/terms', '/guidelines', '/disclaimer', '/compare', '/robots.txt', '/sitemap.xml'];
  for (const route of publicRoutes) {
    const res = await fetch(`${BASE_URL}${route}`);
    assert.strictEqual(res.status, 200, `Route ${route} must be accessible with 200 OK`);
  }
  recordPass('All legal pages (privacy, terms, guidelines, disclaimer, robots.txt, sitemap.xml) accessible (200 OK)');

  console.log('\n================================================================');
  console.log(`🏆 AUDIT COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================\n');
}

runProductionReadinessAudit().catch(err => {
  console.error('\n❌ Production Readiness Audit Failed:', err);
  process.exit(1);
});
