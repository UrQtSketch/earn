import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { sendOTPEmail } from './emailService.js';
import {
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS
} from '../config/constants.js';

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateNumericOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Request and dispatch an OTP for a given email and purpose
 */
export async function requestOTP(email, purpose = 'SIGNUP') {
  const normalizedEmail = email.trim().toLowerCase();

  // Check existing recent active OTP for cooldown
  const recentOtp = await prisma.oTPVerification.findFirst({
    where: {
      email: normalizedEmail,
      purpose,
      isUsed: false
    },
    orderBy: { createdAt: 'desc' }
  });

  const now = new Date();

  if (recentOtp && recentOtp.resendAvailableAt > now) {
    const waitSec = Math.ceil((recentOtp.resendAvailableAt.getTime() - now.getTime()) / 1000);
    throw new Error(`Please wait ${waitSec} seconds before requesting a new verification code.`);
  }

  // Generate 6-digit code
  const plainOtp = generateNumericOTP();
  const salt = await bcrypt.genSalt(10);
  const otpHash = await bcrypt.hash(plainOtp, salt);

  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000);

  // Invalidate any previous unverified OTPs for this email and purpose
  await prisma.oTPVerification.updateMany({
    where: {
      email: normalizedEmail,
      purpose,
      isUsed: false
    },
    data: { isUsed: true }
  });

  // Create new OTP record
  const otpRecord = await prisma.oTPVerification.create({
    data: {
      email: normalizedEmail,
      otpHash,
      purpose,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      isUsed: false
    }
  });

  // Send the email
  await sendOTPEmail({
    to: normalizedEmail,
    otp: plainOtp,
    purpose
  });

  return {
    success: true,
    expiresAt,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    // In dev mode, return plainOtp for test automation helper
    debugOtp: process.env.NODE_ENV === 'development' ? plainOtp : undefined
  };
}

/**
 * Verify provided OTP against stored hash with attempt limit & expiration
 */
export async function verifyOTP(email, plainOtp, purpose = 'SIGNUP') {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const otpRecord = await prisma.oTPVerification.findFirst({
    where: {
      email: normalizedEmail,
      purpose,
      isUsed: false
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!otpRecord) {
    throw new Error('No active verification code found. Please request a new one.');
  }

  // Check if expired
  if (otpRecord.expiresAt < now) {
    await prisma.oTPVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true }
    });
    throw new Error('Verification code has expired. Please request a new one.');
  }

  // Check attempt limits
  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.oTPVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true }
    });
    throw new Error('Too many invalid attempts. This code is locked. Please request a new code.');
  }

  // Check match
  const isMatch = await bcrypt.compare(plainOtp.trim(), otpRecord.otpHash);

  if (!isMatch) {
    const updatedAttempts = otpRecord.attempts + 1;
    await prisma.oTPVerification.update({
      where: { id: otpRecord.id },
      data: { attempts: updatedAttempts }
    });
    const remaining = OTP_MAX_ATTEMPTS - updatedAttempts;
    if (remaining <= 0) {
      throw new Error('Incorrect verification code. Maximum attempts reached. Please request a new code.');
    }
    throw new Error(`Incorrect verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
  }

  // Mark as used
  await prisma.oTPVerification.update({
    where: { id: otpRecord.id },
    data: { isUsed: true }
  });

  return { success: true };
}
