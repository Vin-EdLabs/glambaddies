-- Store-wide settings (single row)
CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  purchases_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payment_mode TEXT NOT NULL DEFAULT 'test',
  paystack_test_public_key TEXT NOT NULL DEFAULT '',
  paystack_test_secret_key TEXT NOT NULL DEFAULT '',
  paystack_live_public_key TEXT NOT NULL DEFAULT '',
  paystack_live_secret_key TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (id, purchases_enabled)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;
