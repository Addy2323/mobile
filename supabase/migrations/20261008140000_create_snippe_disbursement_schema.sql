-- Migration: Snippe Automated Disbursement & Settlements Schema

-- 1. Settlements Table
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  split_participant_id text,
  split_id text,
  destination_snapshot jsonb,
  provider text NOT NULL DEFAULT 'SNIPPE',
  provider_reference text,
  amount bigint NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'PENDING', -- NOT_REQUIRED, PENDING, PROCESSING, SETTLED, FAILED, REVERSED
  attempt_count integer DEFAULT 0,
  failure_code text,
  failure_reason text,
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Settlement Attempts Table
CREATE TABLE IF NOT EXISTS settlement_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid REFERENCES settlements(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'SNIPPE',
  idempotency_key text UNIQUE NOT NULL,
  provider_reference text,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SUCCESS, FAILED, REVERSED
  response_code text,
  failure_reason text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Webhook Events Unique Constraint for Idempotency
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS provider_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event ON webhook_events(provider, event_id);

-- 4. Enable RLS
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settlements" ON settlements;
CREATE POLICY "anon_select_settlements" ON settlements FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settlements" ON settlements;
CREATE POLICY "anon_insert_settlements" ON settlements FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settlements" ON settlements;
CREATE POLICY "anon_update_settlements" ON settlements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlements_split ON settlements(split_id);
CREATE INDEX IF NOT EXISTS idx_settlements_participant ON settlements(split_participant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_provider_ref ON settlements(provider_reference);
