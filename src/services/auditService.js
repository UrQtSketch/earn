import prisma from '../config/db.js';

export async function createAuditLog({ adminId, action, targetType, targetId, details, req }) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : null;
    return await prisma.auditLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId: String(targetId),
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ipAddress: typeof ipAddress === 'string' ? ipAddress.substring(0, 45) : null
      }
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
