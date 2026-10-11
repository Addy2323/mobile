import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_KEY || 'lumo_ops_jwt_secure_secret_key_2026';
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'lumo_admin_secure_salt_2026_v1';

/**
 * Timing-safe string equality helper that avoids buffer length mismatch exceptions
 */
function isSafeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a).trim());
  const bb = Buffer.from(String(b).trim());
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * High-Security Salted PBKDF2 Password Hashing (100,000 iterations, SHA-512)
 */
export function hashPassword(password) {
  return crypto.pbkdf2Sync(password, PASSWORD_SALT, 100000, 64, 'sha512').toString('hex');
}

/**
 * Audit Log Helper for sensitive administrative actions
 */
export async function logAdminAuditAction(pool, {
  adminUserId = null,
  adminEmail = 'system',
  action,
  resourceType,
  resourceId = null,
  beforeState = null,
  afterState = null,
  ipAddress = '127.0.0.1',
  userAgent = 'LUMO-Admin-Portal'
}) {
  try {
    const query = `
      INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, resource_type, resource_id, before_state, after_state, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await pool.query(query, [
      adminUserId,
      adminEmail,
      action,
      resourceType,
      resourceId,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      ipAddress,
      userAgent
    ]);
  } catch (err) {
    console.error('⚠️ Failed recording admin audit log:', err.message);
  }
}

/**
 * Helper to fetch permissions assigned to an admin user
 */
export async function getAdminPermissions(pool, adminUserId) {
  try {
    const query = `
      SELECT DISTINCT p.key
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN admin_user_roles aur ON rp.role_id = aur.role_id
      WHERE aur.admin_user_id = $1
    `;
    const { rows } = await pool.query(query, [adminUserId]);
    return rows.map((r) => r.key);
  } catch (err) {
    console.warn('⚠️ [AdminAuth] Failed fetching permissions:', err.message);
    return [];
  }
}

/**
 * Express Middleware: Require valid Admin Token or Master Admin Key
 */
export function createAdminAuthMiddleware(pool) {
  return async (req, res, next) => {
    try {
      const masterKey = process.env.ADMIN_KEY;

      // 1. Check Master Key header override
      const providedKey = req.get('x-admin-key');
      if (masterKey && providedKey && isSafeEqual(masterKey, providedKey)) {
        req.adminUser = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'master@lumo.co.tz',
          fullName: 'Master System Admin',
          role: 'SUPER_ADMIN',
          permissions: ['*'] // Full access
        };
        return next();
      }

      // 2. Check Authorization Bearer Token
      const authHeader = req.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Admin authorization header required' });
      }

      const token = authHeader.split(' ')[1];

      // 3. Check if Master Key was provided in Bearer token
      if (masterKey && isSafeEqual(masterKey, token)) {
        req.adminUser = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'master@lumo.co.tz',
          fullName: 'Master System Admin',
          role: 'SUPER_ADMIN',
          permissions: ['*']
        };
        return next();
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ error: 'Invalid or expired admin session token', details: jwtErr.message });
      }

      // Verify active admin user in DB
      let dbUser = null;
      let permissions = [];

      try {
        const userRes = await pool.query(
          `SELECT a.*, r.name AS role_name
           FROM admin_users a
           LEFT JOIN admin_user_roles aur ON a.id = aur.admin_user_id
           LEFT JOIN roles r ON aur.role_id = r.id
           WHERE a.id = $1 AND a.status = 'ACTIVE'`,
          [decoded.id]
        );

        if (userRes.rows.length > 0) {
          dbUser = userRes.rows[0];
          permissions = await getAdminPermissions(pool, dbUser.id);
        }
      } catch (dbErr) {
        console.warn('⚠️ [AdminAuth] DB lookup error:', dbErr.message);
      }

      if (!dbUser && decoded.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Admin account inactive or not found' });
      }

      const role = dbUser?.role_name || decoded.role || 'ANALYST';
      if (role === 'SUPER_ADMIN' && !permissions.includes('*')) {
        permissions.push('*');
      }

      req.adminUser = {
        id: dbUser?.id || decoded.id,
        email: dbUser?.email || decoded.email,
        fullName: dbUser?.full_name || decoded.fullName || 'Admin User',
        role,
        permissions
      };

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired admin session token', details: err.message });
    }
  };
}

/**
 * Express Middleware Generator: Enforce specific granular RBAC permission
 */
export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { permissions = [], role = '' } = req.adminUser;

    // Super Admin or wildcard access
    if (role === 'SUPER_ADMIN' || permissions.includes('*') || permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({
      error: 'Permission denied',
      requiredPermission: permissionKey,
      userRole: role
    });
  };
}
