/*
# Add idempotency_key to payment_attempts

## Purpose
Enables duplicate-payment protection for the public friend payment page (`/s/:token`).
When a friend submits a payment, the client generates a unique idempotency key. If the
same key is submitted twice (double-tap, retry, network glitch), the second insert is
rejected by the unique constraint, preventing double-charges.

## Changes
1. Adds `idempotency_key` column (text, nullable) to `payment_attempts`.
2. Adds a unique index on `idempotency_key` so duplicate keys are rejected.
3. Adds `claim_status` column (text, default 'none') to `split_participants` to support
   the "I already paid" claim flow (values: none, claimed, confirmed, rejected).

## Security
- No RLS policy changes. Existing anon+authenticated CRUD policies remain in place.
- The unique index enforces idempotency at the database level regardless of client behavior.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_attempts' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE payment_attempts ADD COLUMN idempotency_key text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'split_participants' AND column_name = 'claim_status'
  ) THEN
    ALTER TABLE split_participants ADD COLUMN claim_status text NOT NULL DEFAULT 'none';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_idempotency
  ON payment_attempts(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
