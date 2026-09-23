import { Router } from 'express';
import validator from 'validator';
import prisma from '../config/db.js';
import { hashPassword, comparePassword, generateAuthToken, sanitizeUser } from '../services/authService.js';
import { requestOTP, verifyOTP } from '../services/otpService.js';
import { devEmailOutbox } from '../services/emailService.js';
import { authLimiter, otpRequestLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * Request OTP for Signup, Login, or Password Reset
 */
router.post('/request-otp', otpRequestLimiter, async (req, res) => {
  try {
    const { email, purpose = 'SIGNUP' } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check user existence based on purpose
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (purpose === 'SIGNUP' && existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please login.'
      });
    }

    if ((purpose === 'LOGIN' || purpose === 'RESET_PASSWORD') && !existingUser) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email address.'
      });
    }

    const result = await requestOTP(normalizedEmail, purpose);

    return res.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}.`,
      expiresAt: result.expiresAt,
      resendCooldownSeconds: result.resendCooldownSeconds,
      debugOtp: result.debugOtp
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Register User with Email + OTP Verification
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { fullName, email, password, otp, termsAccepted } = req.body;

    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Please provide your full name (minimum 2 characters).' });
    }

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    if (!termsAccepted) {
      return res.status(400).json({ success: false, error: 'You must accept the terms of service and risk disclaimer.' });
    }

    if (!otp || otp.trim().length !== 6) {
      return res.status(400).json({ success: false, error: 'Please enter the 6-digit verification code.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP
    await verifyOTP(normalizedEmail, otp, 'SIGNUP');

    // Check if user already registered in the meantime
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Account already exists. Please log in.' });
    }

    // Generate unique username
    const baseUsername = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'earner';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = `${baseUsername}_${randomSuffix}`;

    const passwordHash = await hashPassword(password);

    // Create user and profile transactionally
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        isEmailVerified: true,
        profile: {
          create: {
            fullName: fullName.trim(),
            username,
            country: 'India',
            skills: JSON.stringify([]),
            categories: JSON.stringify([])
          }
        }
      },
      include: { profile: true }
    });

    const token = generateAuthToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Login with Email + Password (returns session or prompts OTP)
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ success: false, error: 'This account has been banned due to violations.' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Set token cookie
    const token = generateAuthToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Reset Password with OTP
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    await verifyOTP(normalizedEmail, otp, 'RESET_PASSWORD');

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    return res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Get Current Logged-in User Session
 */
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ success: true, authenticated: false, user: null });
  }
  return res.json({
    success: true,
    authenticated: true,
    user: sanitizeUser(req.user)
  });
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Dev Outbox (Inspection helper for testing only)
 */
router.get('/dev-outbox', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Disabled in production.' });
  }
  return res.json({
    success: true,
    emails: devEmailOutbox
  });
});

export default router;
