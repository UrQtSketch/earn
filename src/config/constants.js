import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
export const AUTH_SECRET = process.env.AUTH_SECRET || 'earnradar_super_secure_jwt_secret_key_2026_x89f!';
export const SESSION_EXPIRES_IN = process.env.SESSION_EXPIRES_IN || '7d';
export const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
export const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10);
export const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './src/uploads';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const USER_ROLES = {
  USER: 'USER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN'
};

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED'
};

export const OPPORTUNITY_STATUS = {
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  COMMUNITY_REPORTED: 'COMMUNITY_REPORTED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED'
};

export const SUBMISSION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  ADMIN_REVIEW: 'ADMIN_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PUBLISHED: 'PUBLISHED'
};

export const CLAIM_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  EVIDENCE_REVIEWED: 'EVIDENCE_REVIEWED',
  VERIFIED_SOURCE: 'VERIFIED_SOURCE',
  USER_REPORTED: 'USER_REPORTED'
};
