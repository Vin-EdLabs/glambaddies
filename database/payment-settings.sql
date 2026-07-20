-- Payment mode + Paystack keys (admin-managed; no restart required)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'test'
    CHECK (payment_mode IN ('test', 'live'));

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS paystack_test_public_key TEXT NOT NULL DEFAULT '';

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS paystack_test_secret_key TEXT NOT NULL DEFAULT '';

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS paystack_live_public_key TEXT NOT NULL DEFAULT '';

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS paystack_live_secret_key TEXT NOT NULL DEFAULT '';

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS usd_to_ghs_rate NUMERIC(12,4) NOT NULL DEFAULT 15.5;
