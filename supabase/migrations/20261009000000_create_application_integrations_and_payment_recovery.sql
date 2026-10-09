-- Supabase Migration: Create Application Integrations & Multi-Website Webhook Recovery Schema
-- File: 20261009000000_create_application_integrations_and_payment_recovery.sql

CREATE TABLE IF NOT EXISTS application_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_key VARCHAR(64) UNIQUE NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  website_domain VARCHAR(128) NOT NULL,
  webhook_url TEXT NOT NULL,
  redirect_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed registered default website integrations
INSERT INTO application_integrations (application_key, display_name, website_domain, webhook_url, redirect_url, is_active)
VALUES 
  ('lumo-split', 'LUMO Split', 'lumo.co.tz', 'https://lumo.co.tz/api/webhooks/snippe', 'https://lumo.co.tz', true),
  ('mhema-logistics', 'MHEMA Logistics', 'mhemalogistics.co.tz', 'https://mhemalogistics.co.tz/api/webhooks/snippe', 'https://mhemalogistics.co.tz', true),
  ('rewamart', 'RewaMart', 'rewamart.co.tz', 'https://rewamart.co.tz/api/webhooks/snippe', 'https://rewamart.co.tz', true),
  ('yifcapital', 'YIF Capital', 'yifcapital.co.tz', 'https://yifcapital.co.tz/api/webhooks/snippe', 'https://yifcapital.co.tz', true)
ON CONFLICT (application_key) DO UPDATE 
  SET display_name = EXCLUDED.display_name,
      website_domain = EXCLUDED.website_domain,
      webhook_url = EXCLUDED.webhook_url;

-- Enhance payment_attempts with integration and reconciliation metadata
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS application_id VARCHAR(64) DEFAULT 'lumo-split';
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS webhook_url_used TEXT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS resource_type VARCHAR(64) DEFAULT 'split';
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS resource_id VARCHAR(128);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

-- Enhance webhook_events with verification audit fields
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT true;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Create index for payment lookup by provider reference & application
CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider_tx_ref ON payment_attempts(provider_tx_ref);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_app_resource ON payment_attempts(application_id, resource_id);

-- Ensure idempotency unique constraint on webhook_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idx_webhook_events_provider_event'
  ) THEN
    ALTER TABLE webhook_events ADD CONSTRAINT idx_webhook_events_provider_event UNIQUE (provider, event_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
