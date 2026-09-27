import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runAuthTests() {
  console.log('🧪 Starting EarnRadar Auth Flow Comprehensive Verification...\n');

  const testEmail = `auth_tester_${Date.now()}@example.com`;
  const initialPassword = 'Password123!';
  const updatedPassword = 'NewSecurePassword456!';
  const fullName = 'Alpha Tester';

  // 1. Request OTP for signup
  console.log('1️⃣  Requesting Signup OTP for:', testEmail);
  const otpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, purpose: 'SIGNUP' })
  });
  const otpData = await otpRes.json();
  assert.strictEqual(otpData.success, true, 'OTP request should succeed');
  assert.ok(otpData.debugOtp, 'Debug OTP should be returned in development');
  const otp = otpData.debugOtp;
  console.log('   ✓ OTP received successfully:', otp);

  // 2. Register user
  console.log('2️⃣  Registering user with OTP...');
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName,
      email: testEmail,
      password: initialPassword,
      otp,
      termsAccepted: true
    })
  });
  const regData = await regRes.json();
  assert.strictEqual(regData.success, true, 'Registration should succeed');
  assert.ok(regData.token, 'Registration should return auth token');
  assert.strictEqual(regData.user.email, testEmail);
  const cookieHeader = regRes.headers.get('set-cookie');
  assert.ok(cookieHeader, 'Registration should set auth cookie');
  console.log('   ✓ User registered with ID:', regData.user.id);

  // 3. Test Session via Cookie
  console.log('3️⃣  Verifying session via Cookie...');
  const sessionResCookie = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Cookie': cookieHeader }
  });
  const sessionDataCookie = await sessionResCookie.json();
  assert.strictEqual(sessionDataCookie.authenticated, true);
  assert.strictEqual(sessionDataCookie.user.email, testEmail);
  console.log('   ✓ Cookie authentication verified');

  // 4. Test Session via Authorization Bearer Header
  console.log('4️⃣  Verifying session via Bearer Token header...');
  const sessionResHeader = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${regData.token}` }
  });
  const sessionDataHeader = await sessionResHeader.json();
  assert.strictEqual(sessionDataHeader.authenticated, true);
  assert.strictEqual(sessionDataHeader.user.email, testEmail);
  console.log('   ✓ Bearer Token header authentication verified');

  // 5. Test Login with credentials
  console.log('5️⃣  Testing Login with valid credentials...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: initialPassword })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true, 'Login should succeed');
  assert.ok(loginData.token, 'Login should return token');
  console.log('   ✓ Login successful');

  // 6. Test Login with invalid password
  console.log('6️⃣  Testing Login with incorrect password...');
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'WrongPassword123' })
  });
  const badLoginData = await badLoginRes.json();
  assert.strictEqual(badLoginData.success, false, 'Bad login should fail');
  console.log('   ✓ Incorrect password rejected properly');

  // 7. Request OTP for Password Reset
  console.log('7️⃣  Testing Password Reset flow...');
  const resetOtpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, purpose: 'RESET_PASSWORD' })
  });
  const resetOtpData = await resetOtpRes.json();
  assert.strictEqual(resetOtpData.success, true);
  const resetOtp = resetOtpData.debugOtp;
  console.log('   ✓ Password reset OTP received:', resetOtp);

  // 8. Execute Password Reset
  const resetExecRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      otp: resetOtp,
      newPassword: updatedPassword
    })
  });
  const resetExecData = await resetExecRes.json();
  assert.strictEqual(resetExecData.success, true, 'Password reset should succeed');
  console.log('   ✓ Password updated');

  // 9. Login with new password
  console.log('8️⃣  Logging in with new password...');
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: updatedPassword })
  });
  const newLoginData = await newLoginRes.json();
  assert.strictEqual(newLoginData.success, true, 'Login with new password should succeed');
  console.log('   ✓ Login with updated password confirmed');

  // 10. Duplicate Signup Prevention
  console.log('9️⃣  Testing Duplicate Signup Prevention...');
  const dupOtpRes = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, purpose: 'SIGNUP' })
  });
  const dupOtpData = await dupOtpRes.json();
  assert.strictEqual(dupOtpData.success, false, 'Duplicate signup OTP should be rejected');
  console.log('   ✓ Duplicate signup blocked properly');

  console.log('\n🎉 ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runAuthTests().catch(err => {
  console.error('❌ Auth test failed:', err);
  process.exit(1);
});
