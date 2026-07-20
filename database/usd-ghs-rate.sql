-- Admin-configurable USD → GHS reference rate (stored on orders; Paystack charges USD).
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS usd_to_ghs_rate NUMERIC(12,4) NOT NULL DEFAULT 15.5;
