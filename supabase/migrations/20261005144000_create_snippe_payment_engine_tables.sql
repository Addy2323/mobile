-- LUMO Split - Snippe Payment Engine Tables Migration

-- Payment Destinations (verified merchants, lipa numbers, external recipients)
CREATE TABLE IF NOT EXISTS payment_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('VERIFIED_MERCHANT', 'EXTERNAL_RECIPIENT', 'LIPA_CONTROL')),
  display_name text NOT NULL,
  provider text NOT NULL DEFAULT 'SNIPPE',
  provider_reference text,
  channel text NOT NULL DEFAULT 'mobile',
  phone text,
  bank_name text,
  bank_account text,
  verification_status text NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_destinations" ON payment_destinations;
CREATE POLICY "anon_select_destinations" ON payment_destinations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_destinations" ON payment_destinations;
CREATE POLICY "anon_insert_destinations" ON payment_destinations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_destinations" ON payment_destinations;
CREATE POLICY "anon_update_destinations" ON payment_destinations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Payment Intents (high-level payment tracking prior to execution)
CREATE TABLE IF NOT EXISTS payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_participant_id uuid NOT NULL REFERENCES split_participants(id) ON DELETE CASCADE,
  split_id uuid NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  expected_amount bigint NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  idempotency_key text UNIQUE NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_intents" ON payment_intents;
CREATE POLICY "anon_select_intents" ON payment_intents FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_intents" ON payment_intents;
CREATE POLICY "anon_insert_intents" ON payment_intents FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_intents" ON payment_intents;
CREATE POLICY "anon_update_intents" ON payment_intents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Webhook Events (strict idempotency log)
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  provider text NOT NULL DEFAULT 'SNIPPE',
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_webhooks" ON webhook_events;
CREATE POLICY "anon_select_webhooks" ON webhook_events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_webhooks" ON webhook_events;
CREATE POLICY "anon_insert_webhooks" ON webhook_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Payout Records (automated settlement disbursements to merchant/recipient)
CREATE TABLE IF NOT EXISTS payout_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id uuid NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES payment_destinations(id),
  amount bigint NOT NULL,
  fee bigint NOT NULL DEFAULT 1500,
  channel text NOT NULL DEFAULT 'mobile',
  recipient_reference text NOT NULL,
  provider_payout_id text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payout_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payouts" ON payout_records;
CREATE POLICY "anon_select_payouts" ON payout_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payouts" ON payout_records;
CREATE POLICY "anon_insert_payouts" ON payout_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payouts" ON payout_records;
CREATE POLICY "anon_update_payouts" ON payout_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes for optimal lookup & concurrency
CREATE INDEX IF NOT EXISTS idx_intents_participant ON payment_intents(split_participant_id);
CREATE INDEX IF NOT EXISTS idx_intents_split ON payment_intents(split_id);
CREATE INDEX IF NOT EXISTS idx_payouts_split ON payout_records(split_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_event ON webhook_events(event_id);
