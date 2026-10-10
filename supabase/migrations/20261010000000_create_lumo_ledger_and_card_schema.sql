-- LUMO Double-Entry Ledger & Member Card Schema Migration

CREATE TABLE IF NOT EXISTS user_balances (
  user_id VARCHAR(128) PRIMARY KEY,
  available_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_credits NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_debits NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tier VARCHAR(32) NOT NULL DEFAULT 'STARTER',
  qualifying_tx_count INT NOT NULL DEFAULT 0,
  account_ref VARCHAR(32) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL REFERENCES user_balances(user_id) ON DELETE CASCADE,
  transaction_type VARCHAR(64) NOT NULL, -- DEPOSIT, SPLIT_COLLECTION, PAYMENT_LINK, GIFT, BILL_PAYMENT, WITHDRAWAL_RESERVE, WITHDRAWAL_PAYOUT, WITHDRAWAL_RELEASE, ADJUSTMENT
  direction VARCHAR(16) NOT NULL, -- CREDIT, DEBIT
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'TZS',
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED', -- PENDING, COMPLETED, FAILED, CANCELLED, REVERSED
  reference_type VARCHAR(64),
  reference_id VARCHAR(128),
  provider_tx_ref VARCHAR(128),
  idempotency_key VARCHAR(128) UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL REFERENCES user_balances(user_id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  fee NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'TZS',
  destination_type VARCHAR(32) NOT NULL, -- MOBILE_MONEY, BANK
  destination_details JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, APPROVED, PROCESSING, COMPLETED, REJECTED, FAILED
  reference_code VARCHAR(32) UNIQUE NOT NULL,
  admin_reviewer_id VARCHAR(128),
  rejection_reason TEXT,
  provider_tx_ref VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL REFERENCES user_balances(user_id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL, -- TANESCO, DAWASCO, TTCL, ZUKU
  account_meter_number VARCHAR(128) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  fee NUMERIC(15, 2) DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, RESERVED, COMPLETED, FAILED
  token_code VARCHAR(128),
  units_purchased VARCHAR(64),
  receipt_ref VARCHAR(64) UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_user ON ledger_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user ON bill_payments(user_id, created_at DESC);
