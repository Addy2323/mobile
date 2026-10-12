-- 20261014000000_charity_savings_and_campaign_reporting.sql
-- Upgrades Michango & Contributions to natively support Charity, Savings Goals,
-- Contributor deduplication aggregation, and financial reporting.

-- 1. Extend michango_events for Charity, Savings, and Financial Accounting
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS category_type VARCHAR(32) DEFAULT 'GENERAL';
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS beneficiary_name VARCHAR(128);
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS beneficiary_phone VARCHAR(32);
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS beneficiary_organization VARCHAR(255);
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS retained_savings NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE michango_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Extend public_link_payments for Contributor Attribution and Auditing
ALTER TABLE public_link_payments ADD COLUMN IF NOT EXISTS contributor_user_id VARCHAR(128);
ALTER TABLE public_link_payments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE public_link_payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public_link_payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Extend birthday_pools for Closing Dates and Privacy
ALTER TABLE birthday_pools ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE birthday_pools ADD COLUMN IF NOT EXISTS closing_date TIMESTAMPTZ;
ALTER TABLE birthday_pools ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT true;
ALTER TABLE birthday_pools ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Create Indexes for High Performance Deduplication, Aggregation, and Reporting
CREATE INDEX IF NOT EXISTS idx_michango_events_category ON michango_events(category_type, status);
CREATE INDEX IF NOT EXISTS idx_michango_events_owner ON michango_events(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_public_link_payments_phone ON public_link_payments(payer_phone);
CREATE INDEX IF NOT EXISTS idx_public_link_payments_token ON public_link_payments(link_token);
CREATE INDEX IF NOT EXISTS idx_public_link_payments_created ON public_link_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_link_payments_owner ON public_link_payments(owner_user_id);
