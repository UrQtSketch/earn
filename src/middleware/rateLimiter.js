import rateLimit from 'express-rate-limit';

const isTest = () => process.env.NODE_ENV === 'test';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP. Please try again in 15 minutes.'
  }
});

export const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // limit OTP requests
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: {
    success: false,
    error: 'Too many OTP requests. Please wait a few minutes before trying again.'
  }
});

export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: {
    success: false,
    error: 'Submission rate limit reached. Please try again later.'
  }
});

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest
});
