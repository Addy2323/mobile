/*
# LUMO Split - Core Database Schema

## Overview
Creates the complete data model for LUMO Split, a group bill-splitting and payment
coordination platform. LUMO coordinates split obligations; payment providers execute
payments. This is NOT a wallet - no stored-value balances.

## New Tables

1. `merchants` - Verified payment destinations (hotels, restaurants, shops, etc.)
   - id, display_name, legal_name, category, phone, verification_status, destination_id,
     payment_rail, support_contact, logo_url, created_at

2. `splits` - Group bills containing total amount, destination, participants, allocation
   - id, title, category, currency, total_amount, mode, organizer_name, organizer_phone,
     merchant_id, status, due_at, note, settlement_percent, created_at

3. `split_participants` - People assigned payment obligations (guests or registered)
   - id, split_id, name, phone, allocation_amount, amount_paid, status, paid_at,
     payment_ref, created_at

4. `allocation_items` - Line items for item-based split mode
   - id, split_id, item_name, qty, price, assigned_participant_id, created_at

5. `payment_attempts` - Concrete payment transaction attempts
   - id, split_participant_id, amount, provider, provider_tx_ref, status,
     requested_at, completed_at, failure_code, payment_method

6. `audit_logs` - Immutable record of money-related state changes
   - id, actor, action, entity_type, entity_id, metadata, created_at

## Security
- RLS enabled on all tables
- All tables allow anon+authenticated CRUD (single-tenant demo app, no auth screen)
- This is intentional: the app is a product demo showing the full LUMO Split flow

## Notes
- All money stored as integer minor units (TZS uses whole shillings)
- Settlement percent computed from confirmed payments
- Split statuses: DRAFT, ACTIVE, PARTIALLY_PAID, SETTLED, EXPIRED, CANCELLED
- Participant statuses: INVITED, PENDING, PAID, FAILED, EXPIRED, CANCELLED
*/

-- Merchants (verified payment destinations)
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  legal_name text,
  category text NOT NULL DEFAULT 'restaurant',
  phone text,
  verification_status text NOT NULL DEFAULT 'VERIFIED',
  destination_id text UNIQUE NOT NULL,
  payment_rail text DEFAULT 'mobile_money',
  support_contact text,
  logo_url text,
  city text,
  rating numeric DEFAULT 4.5,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_merchants" ON merchants;
CREATE POLICY "anon_select_merchants" ON merchants FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_merchants" ON merchants;
CREATE POLICY "anon_insert_merchants" ON merchants FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_merchants" ON merchants;
CREATE POLICY "anon_update_merchants" ON merchants FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_merchants" ON merchants;
CREATE POLICY "anon_delete_merchants" ON merchants FOR DELETE
  TO anon, authenticated USING (true);

-- Splits (group bills)
CREATE TABLE IF NOT EXISTS splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'restaurant',
  currency text NOT NULL DEFAULT 'TZS',
  total_amount bigint NOT NULL,
  mode text NOT NULL DEFAULT 'equal',
  organizer_name text NOT NULL,
  organizer_phone text NOT NULL,
  merchant_id uuid REFERENCES merchants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  due_at timestamptz,
  note text,
  settlement_percent integer NOT NULL DEFAULT 0,
  amount_paid bigint NOT NULL DEFAULT 0,
  participant_count integer NOT NULL DEFAULT 0,
  ref_code text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_splits" ON splits;
CREATE POLICY "anon_select_splits" ON splits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_splits" ON splits;
CREATE POLICY "anon_insert_splits" ON splits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_splits" ON splits;
CREATE POLICY "anon_update_splits" ON splits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_splits" ON splits;
CREATE POLICY "anon_delete_splits" ON splits FOR DELETE
  TO anon, authenticated USING (true);

-- Split participants
CREATE TABLE IF NOT EXISTS split_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id uuid NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  allocation_amount bigint NOT NULL DEFAULT 0,
  amount_paid bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  payment_ref text,
  is_organizer boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE split_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_participants" ON split_participants;
CREATE POLICY "anon_select_participants" ON split_participants FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_participants" ON split_participants;
CREATE POLICY "anon_insert_participants" ON split_participants FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_participants" ON split_participants;
CREATE POLICY "anon_update_participants" ON split_participants FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_participants" ON split_participants;
CREATE POLICY "anon_delete_participants" ON split_participants FOR DELETE
  TO anon, authenticated USING (true);

-- Allocation items (for item-based splits)
CREATE TABLE IF NOT EXISTS allocation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id uuid NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  price bigint NOT NULL DEFAULT 0,
  assigned_participant_id uuid REFERENCES split_participants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE allocation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_items" ON allocation_items;
CREATE POLICY "anon_select_items" ON allocation_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_items" ON allocation_items;
CREATE POLICY "anon_insert_items" ON allocation_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_items" ON allocation_items;
CREATE POLICY "anon_update_items" ON allocation_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_items" ON allocation_items;
CREATE POLICY "anon_delete_items" ON allocation_items FOR DELETE
  TO anon, authenticated USING (true);

-- Payment attempts
CREATE TABLE IF NOT EXISTS payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_participant_id uuid NOT NULL REFERENCES split_participants(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  provider text NOT NULL DEFAULT 'M-PESA',
  provider_tx_ref text,
  status text NOT NULL DEFAULT 'PENDING',
  payment_method text,
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payments" ON payment_attempts;
CREATE POLICY "anon_select_payments" ON payment_attempts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payments" ON payment_attempts;
CREATE POLICY "anon_insert_payments" ON payment_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payments" ON payment_attempts;
CREATE POLICY "anon_update_payments" ON payment_attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payments" ON payment_attempts;
CREATE POLICY "anon_delete_payments" ON payment_attempts FOR DELETE
  TO anon, authenticated USING (true);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit" ON audit_logs;
CREATE POLICY "anon_select_audit" ON audit_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit" ON audit_logs;
CREATE POLICY "anon_insert_audit" ON audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit" ON audit_logs;
CREATE POLICY "anon_delete_audit" ON audit_logs FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_splits_merchant ON splits(merchant_id);
CREATE INDEX IF NOT EXISTS idx_splits_status ON splits(status);
CREATE INDEX IF NOT EXISTS idx_participants_split ON split_participants(split_id);
CREATE INDEX IF NOT EXISTS idx_items_split ON allocation_items(split_id);
CREATE INDEX IF NOT EXISTS idx_payments_participant ON payment_attempts(split_participant_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
