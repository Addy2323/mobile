-- Migration: 20261008120000_create_admin_rbac_schema.sql
-- Purpose: Admin & Operations Centre RBAC, Support, Audit Logs, and System Health Schema

-- 1. ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(32) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE, -- References auth/app user if tied to main accounts
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  status VARCHAR(32) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, PENDING
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ADMIN USER ROLES MAPPING
CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (admin_user_id, role_id)
);

-- 5. ROLE PERMISSIONS MAPPING
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 6. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(255),
  before_state JSONB,
  after_state JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(32) UNIQUE NOT NULL,
  user_id UUID,
  user_name VARCHAR(255) NOT NULL,
  user_phone VARCHAR(64),
  user_email VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) DEFAULT 'Payment', -- Payment, Payment Link, Split, Destination, Account, Technical, Other
  priority VARCHAR(32) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
  status VARCHAR(32) DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED
  assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SUPPORT NOTES TABLE
CREATE TABLE IF NOT EXISTS support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_name VARCHAR(255) NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SYSTEM ALERTS TABLE
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(32) DEFAULT 'WARNING', -- INFO, WARNING, ERROR, CRITICAL
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR FAST OPERATIONAL SEARCH
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity, is_resolved);

-- SEED CORE ROLES
INSERT INTO roles (name, description) VALUES
  ('SUPER_ADMIN', 'Full administrative access across system configuration, user management, and security'),
  ('OPERATIONS_ADMIN', 'Operational monitoring, user management, and support handling'),
  ('FINANCE_ADMIN', 'Financial reconciliation, settlements monitoring, and reports access'),
  ('SUPPORT_ADMIN', 'Customer support, ticket management, and user inquiry investigation'),
  ('ANALYST', 'Read-only access to operational dashboards, aggregated reports, and metrics')
ON CONFLICT (name) DO NOTHING;

-- SEED GRANULAR PERMISSIONS
INSERT INTO permissions (key, description, category) VALUES
  ('users.view', 'View user profiles and history', 'users'),
  ('users.edit', 'Modify user details', 'users'),
  ('users.suspend', 'Suspend or restrict user accounts', 'users'),
  ('users.restore', 'Restore suspended user accounts', 'users'),
  ('splits.view', 'View splits and allocation details', 'splits'),
  ('splits.manage', 'Cancel or update split parameters', 'splits'),
  ('payments.view', 'View transaction histories and payment intents', 'payments'),
  ('payments.refund', 'Initiate provider-controlled refunds', 'payments'),
  ('payments.retry', 'Retry failed payment notifications', 'payments'),
  ('settlements.view', 'View settlement statuses and payout records', 'settlements'),
  ('settlements.retry', 'Trigger idempotent settlement retries', 'settlements'),
  ('destinations.view', 'View payment destination details', 'destinations'),
  ('destinations.verify', 'Trigger provider destination verification', 'destinations'),
  ('payment_links.view', 'View payment links and public status', 'payment_links'),
  ('payment_links.revoke', 'Revoke active payment links', 'payment_links'),
  ('pools.view', 'View birthday gift pool contributions', 'pools'),
  ('michango.view', 'View Michango and community event campaigns', 'michango'),
  ('bills.view', 'View house contributions and bill payments', 'bills'),
  ('rewards.view', 'View user points and reward achievements', 'rewards'),
  ('rewards.manage', 'Manage reward campaigns and sources', 'rewards'),
  ('support.view', 'View customer support tickets', 'support'),
  ('support.manage', 'Update tickets, assign admins, add notes', 'support'),
  ('reports.view', 'View financial and operational reports', 'reports'),
  ('reports.export', 'Export masked CSV/Excel reports', 'reports'),
  ('providers.view', 'View payment provider statuses and metrics', 'providers'),
  ('providers.manage', 'Manage provider connection settings', 'providers'),
  ('admins.view', 'View admin accounts and assigned roles', 'admins'),
  ('admins.manage', 'Create/modify admin accounts and roles', 'admins'),
  ('audit_logs.view', 'View system administrative audit trail', 'audit_logs'),
  ('system.settings', 'Manage application global configuration', 'system')
ON CONFLICT (key) DO NOTHING;

-- MAP ALL PERMISSIONS TO SUPER_ADMIN ROLE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- MAP OPERATIONS_ADMIN PERMISSIONS
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'users.view', 'users.suspend', 'users.restore',
  'splits.view', 'splits.manage',
  'payments.view', 'settlements.view', 'settlements.retry',
  'destinations.view', 'destinations.verify',
  'payment_links.view', 'payment_links.revoke',
  'pools.view', 'michango.view', 'bills.view',
  'support.view', 'support.manage', 'reports.view',
  'providers.view', 'audit_logs.view'
)
WHERE r.name = 'OPERATIONS_ADMIN'
ON CONFLICT DO NOTHING;

-- MAP FINANCE_ADMIN PERMISSIONS
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'payments.view', 'payments.refund',
  'settlements.view', 'settlements.retry',
  'destinations.view', 'payment_links.view',
  'reports.view', 'reports.export',
  'providers.view', 'audit_logs.view'
)
WHERE r.name = 'FINANCE_ADMIN'
ON CONFLICT DO NOTHING;

-- MAP SUPPORT_ADMIN PERMISSIONS
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'users.view', 'splits.view', 'payments.view',
  'payment_links.view', 'destinations.view',
  'support.view', 'support.manage'
)
WHERE r.name = 'SUPPORT_ADMIN'
ON CONFLICT DO NOTHING;

-- MAP ANALYST PERMISSIONS (READ ONLY)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'users.view', 'splits.view', 'payments.view',
  'settlements.view', 'pools.view', 'michango.view',
  'bills.view', 'rewards.view', 'reports.view',
  'providers.view'
)
WHERE r.name = 'ANALYST'
ON CONFLICT DO NOTHING;
