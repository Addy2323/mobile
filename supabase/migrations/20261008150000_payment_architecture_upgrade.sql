-- Migration: 20261008150000_payment_architecture_upgrade.sql
-- Purpose: Payment State Machine, Webhook Deduplication, Settlement Router & Provider Capabilities

BEGIN;

-- 1. Webhook Ingestion & Deduplication Table
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature_verified BOOLEAN NOT NULL DEFAULT false,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, VERIFIED, PROCESSED, DUPLICATE, FAILED
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_provider_event ON payment_webhook_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_status ON payment_webhook_events (processing_status);

-- 2. Provider Capability Matrix Table
CREATE TABLE IF NOT EXISTS provider_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- COLLECT, PAYOUT, DIRECT_SETTLEMENT
    destination_type VARCHAR(50) NOT NULL, -- PHONE, LIPA_NUMBER, BANK_ACCOUNT, QR, CARD
    country VARCHAR(10) NOT NULL DEFAULT 'TZ',
    currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
    enabled BOOLEAN NOT NULL DEFAULT true,
    requires_verification BOOLEAN NOT NULL DEFAULT false,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider_capability UNIQUE (provider, operation, destination_type, country, currency)
);

-- Seed Default Capabilities for Snippe and FimiPay
INSERT INTO provider_capabilities (provider, operation, destination_type, country, currency, enabled, requires_verification, requires_approval)
VALUES 
  ('SNIPPE', 'COLLECT', 'PHONE', 'TZ', 'TZS', true, false, false),
  ('SNIPPE', 'PAYOUT', 'PHONE', 'TZ', 'TZS', true, false, false),
  ('SNIPPE', 'DIRECT_SETTLEMENT', 'PHONE', 'TZ', 'TZS', true, false, false),
  ('SNIPPE', 'COLLECT', 'BANK_ACCOUNT', 'TZ', 'TZS', true, true, false),
  ('SNIPPE', 'PAYOUT', 'BANK_ACCOUNT', 'TZ', 'TZS', true, true, true),
  ('FIMIPAY', 'COLLECT', 'PHONE', 'TZ', 'TZS', true, false, false),
  ('FIMIPAY', 'COLLECT', 'LIPA_NUMBER', 'TZ', 'TZS', true, false, false),
  ('FIMIPAY', 'PAYOUT', 'PHONE', 'TZ', 'TZS', true, false, false),
  ('FIMIPAY', 'DIRECT_SETTLEMENT', 'PHONE', 'TZ', 'TZS', true, false, false)
ON CONFLICT (provider, operation, destination_type, country, currency) DO NOTHING;

-- 3. Settlement Target Snapshots Table (Immutable target destination at creation time)
CREATE TABLE IF NOT EXISTS payment_settlement_target_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- SPLIT, PAYMENT_LINK, BIRTHDAY_POOL, MICHANGO, HOUSE_CONTRIBUTION
    entity_id VARCHAR(255) NOT NULL,
    owner_user_id VARCHAR(255),
    destination_type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'MOBILE_MONEY',
    display_name VARCHAR(255),
    masked_destination VARCHAR(255),
    destination_reference VARCHAR(255),
    beneficiary_full_name VARCHAR(255),
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_snapshot_entity ON payment_settlement_target_snapshots (entity_type, entity_id);

-- 4. Settlement Records Table (Separate from Payment Status)
CREATE TABLE IF NOT EXISTS settlement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id VARCHAR(255) NOT NULL, -- Link to payment_intents or payment_attempts or split_participants
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    snapshot_id UUID REFERENCES payment_settlement_target_snapshots(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'SNIPPE',
    provider_reference VARCHAR(255),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
    settlement_status VARCHAR(50) NOT NULL DEFAULT 'SETTLEMENT_PENDING', -- SETTLEMENT_PENDING, SETTLEMENT_PROCESSING, SETTLED, SETTLEMENT_FAILED
    attempt_count INT NOT NULL DEFAULT 0,
    failure_code VARCHAR(100),
    failure_reason TEXT,
    initiated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlement_records (settlement_status);
CREATE INDEX IF NOT EXISTS idx_settlement_payment ON settlement_records (payment_id);

-- 5. Settlement Attempts Table (Historical logs of each settlement payout attempt)
CREATE TABLE IF NOT EXISTS settlement_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES settlement_records(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    request_reference VARCHAR(255) NOT NULL,
    provider_reference VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    response_code VARCHAR(50),
    failure_reason TEXT,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_attempt_settlement ON settlement_attempts (settlement_id);

-- 6. Add explicit status columns and references to payment_intents and payment_attempts if not exist
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PROCESSING';
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) DEFAULT 'SETTLEMENT_PENDING';
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PROCESSING';
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) DEFAULT 'SETTLEMENT_PENDING';
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS failure_reason TEXT;

COMMIT;
