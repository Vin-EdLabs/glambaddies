-- GlamBaddies — per-product colour stock (quantities)
-- Safe to re-run.
--
-- Shape of available_colors JSONB:
--   null                  → unrestricted (all catalogue colours open)
--   { "Black": 5, "Pink": 0 } → qty per colour (0 = sold out / prompt shoppers)
-- Legacy arrays like ["Black","Pink"] are still accepted and treated as qty 1 each.
--
-- Apply on server:
--   cd /var/www/glambaddies
--   node backend/scripts/apply-sql.js database/migrate-available-colors.sql

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS available_colors JSONB;

COMMIT;
