import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runComprehensiveQA() {
  console.log('========================================================');
  console.log('🧪 EARNRADAR PHASE 2 — FULL QA & SECURITY AUDIT SUITE');
  console.log('========================================================\n');

  // 1. Categories & Public Feed
  console.log('1️⃣ [PUBLIC FEED & CATEGORIES]');
  const catRes = await fetch(`${BASE_URL}/api/opportunities/categories`);
  const catData = await catRes.json();
  assert.strictEqual(catData.success, true);
  assert.ok(catData.categories.length >= 6, 'Should have all standard categories');
  console.log(`   ✔ Retrieved ${catData.categories.length} categories with live opportunity counts`);

  const oppRes = await fetch(`${BASE_URL}/api/opportunities?sort=popular`);
  const oppData = await oppRes.json();
  assert.strictEqual(oppData.success, true);
  assert.ok(oppData.opportunities.length > 0, 'Feed should return live opportunities');
  console.log(`   ✔ Retrieved ${oppData.opportunities.length} live verified opportunities sorted by popularity`);

  // 2. Auth Flow: Request OTP, Expire, Attempt Limits & Register
  console.log('\n2️⃣ [AUTHENTICATION & OTP SECURITY]');
  const userEmailA = `qa_user_a_${Date.now()}@earnradar.io`;
  const userEmailB = `qa_user_b_${Date.now()}@earnradar.io`;

  // Request OTP for User A
  const otpResA = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmailA, purpose: 'SIGNUP' })
  });
  const otpDataA = await otpResA.json();
  assert.strictEqual(otpDataA.success, true);
  const otpCodeA = otpDataA.debugOtp;
  assert.strictEqual(otpCodeA.length, 6, 'OTP must be 6 digits');
  console.log(`   ✔ OTP requested for ${userEmailA}: [${otpCodeA}]`);

  // Test invalid OTP attempt limit
  console.log('   🔒 Testing invalid OTP attempt security...');
  const badOtpRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'QA User A',
      email: userEmailA,
      password: 'SecurePassword2026!',
      otp: '000000',
      termsAccepted: true
    })
  });
  const badOtpData = await badOtpRes.json();
  assert.strictEqual(badOtpRes.status, 400);
  assert.ok(badOtpData.error.includes('attempt'), 'Must show remaining attempts count');
  console.log(`   ✔ Attempt limit guard validated: "${badOtpData.error}"`);

  // Complete User A registration with valid OTP
  const regResA = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'QA Alice',
      email: userEmailA,
      password: 'SecurePassword2026!',
      otp: otpCodeA,
      termsAccepted: true
    })
  });
  const regDataA = await regResA.json();
  assert.strictEqual(regDataA.success, true);
  const tokenA = regDataA.token;
  const userA = regDataA.user;
  console.log(`   ✔ User A registered: @${userA.profile.username}`);

  // Register User B
  const otpResB = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmailB, purpose: 'SIGNUP' })
  });
  const otpCodeB = (await otpResB.json()).debugOtp;
  const regResB = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'QA Bob',
      email: userEmailB,
      password: 'SecurePassword2026!',
      otp: otpCodeB,
      termsAccepted: true
    })
  });
  const regDataB = await regResB.json();
  const tokenB = regDataB.token;
  const userB = regDataB.user;
  console.log(`   ✔ User B registered: @${userB.profile.username}`);

  // 3. User Profiles & Onboarding
  console.log('\n3️⃣ [PROFILE & ONBOARDING]');
  const onbRes = await fetch(`${BASE_URL}/api/users/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      categories: ['freelancing', 'creator'],
      skills: ['Video Editing', 'Content Strategy'],
      country: 'India'
    })
  });
  assert.strictEqual((await onbRes.json()).success, true);
  console.log('   ✔ Onboarding preferences saved');

  // 4. Opportunity Join & Saved List
  console.log('\n4️⃣ [OPPORTUNITY PARTICIPATION]');
  const sampleOpp = oppData.opportunities[0];
  const joinRes = await fetch(`${BASE_URL}/api/opportunities/${sampleOpp.id}/join`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.strictEqual((await joinRes.json()).success, true);
  console.log(`   ✔ User A joined "${sampleOpp.title}"`);

  // 5. 9-Step Share a Method Workflow
  console.log('\n5️⃣ [SHARE METHOD 9-STEP WORKFLOW]');
  const methodPayload = {
    basicInfo: {
      title: 'High-Retention Short Video Sound Design & Mixing',
      categoryId: 'creator',
      shortDescription: 'Specialize in Foley and SFX mixing for viral creator reels and shorts.'
    },
    howItWorks: {
      explanation: 'Receive video cut without audio effects, layer whooshes/impacts, and deliver master.',
      steps: [
        { stepNumber: 1, title: 'Analyze Visual Cue Timing', description: 'Mark keyframe changes and hook timestamps.' },
        { stepNumber: 2, title: 'Layer Sound Design Assets', description: 'Add riser, impact, and ambient track layers.' },
        { stepNumber: 3, title: 'Export & Deliver Master', description: 'Deliver uncompressed WAV/MP4 files to client.' }
      ]
    },
    requirements: {
      requiredSkills: 'Audition / Premiere / Reaper, Sound Library',
      timeRequired: '1–2 hrs / video'
    },
    moneyDetails: {
      earningModel: 'FREELANCE',
      startingCost: '₹0',
      potentialEarning: '₹500 – ₹3,000 / video',
      paymentMethod: 'UPI / Bank Transfer'
    },
    safety: {
      knownRisks: 'Client revisions, subjective sound feedback.',
      possibleScams: 'Never do free test jobs without watermarking preview audio.'
    },
    sources: {
      officialWebsite: 'https://www.soundstripe.com'
    },
    experience: {
      personallyUsed: 'Yes',
      amountEarned: '22000',
      timePeriod: 'May 2026'
    }
  };

  const submitRes = await fetch(`${BASE_URL}/api/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ formData: methodPayload, isDraft: false })
  });
  const submitData = await submitRes.json();
  assert.strictEqual(submitData.success, true);
  const subId = submitData.submission.id;
  console.log(`   ✔ Method submitted with ID: ${subId}`);

  // 6. IDOR Security Test: User B trying to edit User A's submission
  console.log('\n6️⃣ [IDOR SECURITY VERIFICATION]');
  const maliciousEditRes = await fetch(`${BASE_URL}/api/submissions/${subId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ formData: { basicInfo: { title: 'Hacked Title' } } })
  });
  assert.strictEqual(maliciousEditRes.status, 403, 'User B must not be allowed to edit User A submission');
  console.log('   ✔ IDOR Guard Verified: Unauthorized edit blocked with 403 Forbidden');

  // 7. Admin Login & Moderation
  console.log('\n7️⃣ [ADMIN RBAC & METHOD APPROVAL]');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@earnradar.io', password: 'AdminPassword2026!' })
  });
  const adminToken = (await adminLoginRes.json()).token;

  // Request changes first
  const reqChangesRes = await fetch(`${BASE_URL}/api/admin/submissions/${subId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ action: 'REQUEST_CHANGES', adminFeedback: 'Please specify software version in step 2.' })
  });
  assert.strictEqual((await reqChangesRes.json()).success, true);
  console.log('   ✔ Admin requested changes with feedback loop');

  // User A updates submission
  methodPayload.howItWorks.steps[1].description = 'Add riser, impact, and ambient track layers in Audition or CapCut Desktop.';
  const updateSubRes = await fetch(`${BASE_URL}/api/submissions/${subId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ formData: methodPayload, isDraft: false })
  });
  assert.strictEqual((await updateSubRes.json()).success, true);
  console.log('   ✔ User A updated and resubmitted method');

  // Admin approves & publishes
  const approveRes = await fetch(`${BASE_URL}/api/admin/submissions/${subId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ action: 'APPROVE', adminFeedback: 'All guidelines verified and accepted.' })
  });
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.success, true);
  console.log(`   ✔ Admin approved and published opportunity: "${approveData.opportunity.title}"`);

  // 8. Collaboration, Messaging & Blocking Guards
  console.log('\n8️⃣ [COLLABORATION, MESSAGING & BLOCKING]');
  const collabReqRes = await fetch(`${BASE_URL}/api/collaborations/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      receiverId: userB.id,
      opportunityId: sampleOpp.id,
      message: 'Looking for a sound designer to team up on video clients.'
    })
  });
  const collabReqId = (await collabReqRes.json()).request.id;

  // User B accepts
  const collabAcceptRes = await fetch(`${BASE_URL}/api/collaborations/respond/${collabReqId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ action: 'ACCEPT' })
  });
  const convId = (await collabAcceptRes.json()).conversationId;
  assert.ok(convId, 'Conversation must exist');
  console.log(`   ✔ Collaboration accepted. Conversation established: ${convId}`);

  // User A sends message to User B
  const sendMsgRes = await fetch(`${BASE_URL}/api/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      conversationId: convId,
      recipientId: userB.id,
      content: 'Hi Bob! What sample projects have you worked on?'
    })
  });
  assert.strictEqual((await sendMsgRes.json()).success, true);
  console.log('   ✔ Direct message delivered');

  // User B blocks User A
  console.log('   🔒 Testing user blocking...');
  const blockRes = await fetch(`${BASE_URL}/api/messages/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ targetUserId: userA.id, action: 'BLOCK' })
  });
  assert.strictEqual((await blockRes.json()).success, true);

  // User A attempts to message blocked User B
  const blockedSendRes = await fetch(`${BASE_URL}/api/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      conversationId: convId,
      recipientId: userB.id,
      content: 'Hello?'
    })
  });
  assert.strictEqual(blockedSendRes.status, 403, 'Message to blocking user must return 403 Forbidden');
  console.log('   ✔ Block Protection Verified: Blocked message blocked with 403 Forbidden');

  // 9. Notifications Verification
  console.log('\n9️⃣ [NOTIFICATIONS ENGINE]');
  const notifResA = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const notifDataA = await notifResA.json();
  assert.strictEqual(notifDataA.success, true);
  assert.ok(notifDataA.notifications.length > 0, 'User A should have received notifications');
  console.log(`   ✔ User A has ${notifDataA.notifications.length} notifications (latest: "${notifDataA.notifications[0].title}")`);

  // 10. Audit Log & Admin Operations
  console.log('\n🔟 [AUDIT LOGGING & CLAIMS REVIEW]');
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const auditData = await auditRes.json();
  assert.strictEqual(auditData.success, true);
  assert.ok(auditData.logs.length >= 2, 'Audit logs must capture all administrative events');
  console.log(`   ✔ Retrieved ${auditData.logs.length} immutable audit logs from database`);

  // 11. Comparison Endpoint Verification
  console.log('\n1️⃣1️⃣ [OPPORTUNITY COMPARISON ENGINE]');
  const compareOpps = oppData.opportunities.slice(0, 2);
  const compareIds = compareOpps.map(o => o.id).join(',');
  const compareRes = await fetch(`${BASE_URL}/api/opportunities/compare?ids=${compareIds}`);
  const compareData = await compareRes.json();
  if (!compareData.success) {
    console.error('   ❌ compareData failure payload:', compareRes.status, compareData);
  }
  assert.strictEqual(compareData.success, true);
  assert.strictEqual(compareData.opportunities.length, 2, 'Should return both compared opportunities');
  assert.ok(compareData.opportunities[0].earningModel, 'Must include earning model in comparison');
  assert.ok(compareData.opportunities[0].riskLevel, 'Must include risk level in comparison');
  console.log(`   ✔ Successfully compared ${compareData.opportunities.length} opportunities side-by-side with risk & capital data`);

  // 12. Community Experience & Rating Submission
  console.log('\n1️⃣2️⃣ [COMMUNITY EXPERIENCE & RATING SUBMISSION]');
  const expRes = await fetch(`${BASE_URL}/api/opportunities/${sampleOpp.id}/experience`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      rating: 5,
      difficulty: 2,
      timeSpentWeekly: '5-6 hrs',
      earnedAmount: 14500,
      hourlyRate: 600,
      pros: 'Clear guidelines, fast payouts via UPI',
      cons: 'Competitive first few weeks',
      tips: 'Create templates for rapid turnaround.'
    })
  });
  const expData = await expRes.json();
  assert.strictEqual(expData.success, true);
  assert.strictEqual(expData.experience.amountEarned, 14500);
  assert.strictEqual(expData.experience.status, 'TRIED');
  console.log(`   ✔ User A submitted experience report: "${expData.message}"`);

  // 13. Advanced Filtering
  console.log('\n1️⃣3️⃣ [ADVANCED FILTERING]');
  const filterRes = await fetch(`${BASE_URL}/api/opportunities?riskLevel=LOW&skillLevel=BEGINNER`);
  const filterData = await filterRes.json();
  assert.strictEqual(filterData.success, true);
  console.log(`   ✔ Filtered query returned ${filterData.opportunities.length} low-risk beginner opportunities`);

  // 14. Verification Logs & Dossier Enrichment
  console.log('\n1️⃣4️⃣ [VERIFICATION LOGS & COMPLETE DOSSIER]');
  const detailRes = await fetch(`${BASE_URL}/api/opportunities/${sampleOpp.slug}`);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.success, true);
  assert.ok(Array.isArray(detailData.opportunity.verificationLogs), 'Dossier must include verification logs');
  assert.ok(Array.isArray(detailData.opportunity.experiences), 'Dossier must include community experiences');
  console.log(`   ✔ Retrieved dossier with ${detailData.opportunity.verificationLogs.length} verification logs and ${detailData.opportunity.experiences.length} experience reports`);

  console.log('\n========================================================');
  console.log('🎉 ALL 14 COMPREHENSIVE QA & SECURITY AUDIT TESTS PASSED!');
  console.log('========================================================\n');
}

runComprehensiveQA().catch(err => {
  console.error('\n❌ QA Test Suite Failed:', err);
  process.exit(1);
});
