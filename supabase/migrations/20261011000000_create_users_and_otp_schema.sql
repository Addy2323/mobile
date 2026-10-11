-- Migration: 20261011000000_create_users_and_otp_schema.sql
-- Purpose: Real user accounts, passcode authentication, and SMS OTP verification

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'LUMO Member',
  email VARCHAR(255),
  passcode_hash VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  account_type VARCHAR(32) NOT NULL DEFAULT 'USER',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) NOT NULL,
  code VARCHAR(16) NOT NULL,
  purpose VARCHAR(32) NOT NULL, -- REGISTER, FORGOT_PASSCODE, LOGIN
  expires_at TIMESTAMPTZ NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_otp_phone_code ON otp_verifications(phone, code);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);

-- Add foreign key or relation indexes if needed
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
