import rateLimit from 'express-rate-limit';

const isDevOrTest = () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDevOrTest,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP. Please try again in 15 minutes.'
  }
});

export const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60, // limit OTP requests
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDevOrTest,
  message: {
    success: false,
    error: 'Too many OTP requests. Please wait a few minutes before trying again.'
  }
});

export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDevOrTest,
  message: {
    success: false,
    error: 'Submission rate limit reached. Please try again later.'
  }
});

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDevOrTest
});
