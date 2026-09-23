import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AUTH_SECRET, SESSION_EXPIRES_IN } from '../config/constants.js';

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    AUTH_SECRET,
    { expiresIn: SESSION_EXPIRES_IN }
  );
}

export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch (err) {
    return null;
  }
}

export function sanitizeUser(user, profile = null) {
  if (!user) return null;
  const { passwordHash, ...cleanUser } = user;
  
  let cleanProfile = profile || user.profile;
  if (cleanProfile) {
    // Parse JSON fields safely if stringified
    let parsedSkills = [];
    let parsedCategories = [];
    try {
      if (typeof cleanProfile.skills === 'string') parsedSkills = JSON.parse(cleanProfile.skills);
      else if (Array.isArray(cleanProfile.skills)) parsedSkills = cleanProfile.skills;
    } catch (_) {}
    
    try {
      if (typeof cleanProfile.categories === 'string') parsedCategories = JSON.parse(cleanProfile.categories);
      else if (Array.isArray(cleanProfile.categories)) parsedCategories = cleanProfile.categories;
    } catch (_) {}

    cleanUser.profile = {
      ...cleanProfile,
      skills: parsedSkills,
      categories: parsedCategories
    };
  }

  return cleanUser;
}
