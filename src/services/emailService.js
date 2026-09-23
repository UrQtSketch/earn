import { NODE_ENV } from '../config/constants.js';

// In-memory debug storage for latest development OTPs to simplify dev verification
export const devEmailOutbox = [];

export async function sendOTPEmail({ to, otp, purpose }) {
  const subjectMap = {
    SIGNUP: 'EarnRadar — Your Account Verification Code',
    LOGIN: 'EarnRadar — Your Login Verification Code',
    RESET_PASSWORD: 'EarnRadar — Your Password Reset Code'
  };

  const subject = subjectMap[purpose] || 'EarnRadar — Verification Code';

  const emailPayload = {
    to,
    subject,
    otp,
    purpose,
    timestamp: new Date().toISOString(),
    html: `
      <div style="background-color: #05070b; color: #f5f7fb; font-family: 'DM Sans', sans-serif; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #0b1018; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
            <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #7dffb2, #67e8ff); color: #06100e; font-weight: bold; text-align: center; line-height: 28px;">↗</div>
            <span style="font-size: 18px; font-weight: 700; color: #fff;">Earn<span style="color: #67e8ff;">Radar</span></span>
          </div>
          <h2 style="font-size: 22px; color: #f5f7fb; margin-bottom: 12px;">Verify your identity</h2>
          <p style="color: #8b96a8; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Use the 6-digit code below to complete your ${purpose.toLowerCase().replace('_', ' ')}. Never share this code with anyone. EarnRadar will never ask for your code.
          </p>
          <div style="background: rgba(103,232,255,0.06); border: 1px solid rgba(103,232,255,0.25); border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #7dffb2;">${otp}</span>
          </div>
          <p style="color: #8b96a8; font-size: 12px; line-height: 1.5;">
            This code expires in 10 minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      </div>
    `
  };

  // Keep in outbox for quick inspection/testing
  devEmailOutbox.unshift(emailPayload);
  if (devEmailOutbox.length > 50) devEmailOutbox.pop();

  console.log(`\n================== [EMAIL DISPATCH] ==================`);
  console.log(`To: ${to}`);
  console.log(`Purpose: ${purpose}`);
  console.log(`OTP Code: >>> [ ${otp} ] <<<`);
  console.log(`Time: ${emailPayload.timestamp}`);
  console.log(`======================================================\n`);

  return { success: true, messageId: `msg_${Date.now()}` };
}
