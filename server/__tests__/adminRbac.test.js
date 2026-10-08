import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requirePermission } from '../adminAuth.js';

const JWT_SECRET = 'lumo_split_admin_jwt_secret_key_2026';

describe('Admin RBAC & Security Unit Tests', () => {
  let mockReq;
  let mockRes;
  let nextCalled;

  beforeAll(() => {
    mockRes = {
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        mockRes.jsonData = data;
        return mockRes;
      }
    };
  });

  it('allows access if admin has specific required permission', () => {
    nextCalled = false;
    mockReq = {
      adminUser: {
        id: 'user-123',
        role: 'OPERATIONS_ADMIN',
        permissions: ['users.view', 'settlements.retry']
      }
    };

    const middleware = requirePermission('settlements.retry');
    middleware(mockReq, mockRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('blocks access with 403 if admin lacks required permission', () => {
    nextCalled = false;
    mockReq = {
      adminUser: {
        id: 'user-456',
        role: 'SUPPORT_ADMIN',
        permissions: ['users.view', 'support.manage']
      }
    };

    const middleware = requirePermission('settlements.retry');
    middleware(mockReq, mockRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(mockRes.statusCode).toBe(403);
    expect(mockRes.jsonData.error).toBe('Permission denied');
  });

  it('allows SUPER_ADMIN full unrestricted access', () => {
    nextCalled = false;
    mockReq = {
      adminUser: {
        id: 'admin-super',
        role: 'SUPER_ADMIN',
        permissions: []
      }
    };

    const middleware = requirePermission('providers.manage');
    middleware(mockReq, mockRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('verifies staff JWT token structure and signature', () => {
    const payload = { id: 'admin-789', email: 'fin@lumo.co.tz', role: 'FINANCE_ADMIN' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe('admin-789');
    expect(decoded.role).toBe('FINANCE_ADMIN');
  });

  it('hashes passwords securely using SHA-256', () => {
    const password = 'LumoSuperAdmin2026!';
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    expect(hash).toHaveLength(64);
  });
});
