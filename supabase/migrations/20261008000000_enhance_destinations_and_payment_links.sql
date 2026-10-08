-- LUMO Split Migration: Reusable Payment Destinations, Payment Links & Data Isolation

-- 1. Enhance Payment Destinations
CREATE TABLE IF NOT EXISTS payment_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text,
  type text NOT NULL DEFAULT 'PHONE', -- PHONE, LIPA_NUMBER, BANK_ACCOUNT, QR, CARD, VERIFIED_MERCHANT
  provider text NOT NULL DEFAULT 'MOBILE_MONEY', -- NMB, CRDB, FIMIPAY, SNIPPE, M-PESA, TIGO_PESA, etc.
  display_name text NOT NULL,
  phone_number text,
  lipa_number text,
  bank_name text,
  account_number text,
  beneficiary_full_name text,
  qr_reference text,
  card_reference text,
  is_verified boolean DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure missing columns exist if table was previously created
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS lipa_number text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS beneficiary_full_name text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS qr_reference text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS card_reference text;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE';
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE payment_destinations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE payment_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_destinations" ON payment_destinations;
CREATE POLICY "anon_select_destinations" ON payment_destinations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_destinations" ON payment_destinations;
CREATE POLICY "anon_insert_destinations" ON payment_destinations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_destinations" ON payment_destinations;
CREATE POLICY "anon_update_destinations" ON payment_destinations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Create Payment Links Table
CREATE TABLE IF NOT EXISTS payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text UNIQUE NOT NULL,
  owner_user_id text,
  title text NOT NULL,
  amount bigint NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  expiration_mode text NOT NULL DEFAULT '7_DAYS', -- AFTER_PAYMENT, 24_HOURS, 7_DAYS, 30_DAYS, NEVER
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAID, EXPIRED, REVOKED
  destination_id uuid REFERENCES payment_destinations(id) ON DELETE SET NULL,
  destination_snapshot jsonb,
  paid_at timestamptz,
  payment_ref text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_links" ON payment_links;
CREATE POLICY "anon_select_payment_links" ON payment_links FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payment_links" ON payment_links;
CREATE POLICY "anon_insert_payment_links" ON payment_links FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payment_links" ON payment_links;
CREATE POLICY "anon_update_payment_links" ON payment_links FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Enhance Splits with Destination Fields
ALTER TABLE splits ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE splits ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES payment_destinations(id) ON DELETE SET NULL;
ALTER TABLE splits ADD COLUMN IF NOT EXISTS destination_snapshot jsonb;

-- 4. Birthday Pools Table
CREATE TABLE IF NOT EXISTS birthday_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text,
  birthday_person text NOT NULL,
  message text,
  target_amount bigint NOT NULL,
  collected_amount bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'ACTIVE',
  destination_id uuid REFERENCES payment_destinations(id) ON DELETE SET NULL,
  destination_snapshot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE birthday_pools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_bday" ON birthday_pools;
CREATE POLICY "anon_select_bday" ON birthday_pools FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bday" ON birthday_pools;
CREATE POLICY "anon_insert_bday" ON birthday_pools FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 5. Michango / Community Events Table
CREATE TABLE IF NOT EXISTS michango_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'WEDDING', -- WEDDING, FUNERAL, MEDICAL, COMMUNITY, OTHER
  description text,
  target_amount bigint NOT NULL,
  collected_amount bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'ACTIVE',
  destination_id uuid REFERENCES payment_destinations(id) ON DELETE SET NULL,
  destination_snapshot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE michango_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_michango" ON michango_events;
CREATE POLICY "anon_select_michango" ON michango_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_michango" ON michango_events;
CREATE POLICY "anon_insert_michango" ON michango_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 6. Pay Bills / House Contributions Table
CREATE TABLE IF NOT EXISTS house_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text,
  purpose text NOT NULL, -- House Rent, LUKU Electricity, DAWASA Water, Azam TV, Internet, etc.
  bill_provider text NOT NULL DEFAULT 'TANESCO', -- TANESCO, DAWASA, AZAM_TV, GOVERNMENT, OTHER
  biller_control_number text,
  amount_per_member bigint NOT NULL,
  target_members integer NOT NULL DEFAULT 1,
  total_target_amount bigint NOT NULL,
  collected_amount bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  contribution_status text NOT NULL DEFAULT 'OPEN', -- DRAFT, OPEN, PARTIALLY_FUNDED, FUNDED, EXPIRED, CANCELLED
  bill_payment_status text NOT NULL DEFAULT 'UNPAID', -- UNPAID, PENDING_PROVIDER, PAID, FAILED
  provider_tx_ref text,
  destination_id uuid REFERENCES payment_destinations(id) ON DELETE SET NULL,
  destination_snapshot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE house_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_house" ON house_contributions;
CREATE POLICY "anon_select_house" ON house_contributions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_house" ON house_contributions;
CREATE POLICY "anon_insert_house" ON house_contributions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_destinations_owner ON payment_destinations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON payment_links(public_token);
CREATE INDEX IF NOT EXISTS idx_payment_links_owner ON payment_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_splits_owner ON splits(owner_user_id);
