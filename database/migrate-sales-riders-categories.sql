-- GlamBaddies — sales, rider tracking, accessory categories
-- Safe to re-run.
--
-- Apply:
--   node backend/scripts/apply-sql.js database/migrate-sales-riders-categories.sql
--   # or on server:
--   psql -U glambaddies_user -d glambaddies_db -h localhost \
--     -f /var/www/glambaddies/database/migrate-sales-riders-categories.sql

BEGIN;

-- 1) Product sale columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER
    CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= 0);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER
    CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 95));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Order rider columns + optional out_for_delivery status
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_name VARCHAR(120);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_phone VARCHAR(40);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_photo_url VARCHAR(500);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMPTZ;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'));

-- 3) Accessory categories (keep existing dress categories)
INSERT INTO categories (name, slug, description)
SELECT 'Bags', 'bags', 'Handbags, mini bags and glam essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bags');

INSERT INTO categories (name, slug, description)
SELECT 'Shoes', 'shoes', 'Shoes and heels for every glam moment'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'shoes');

INSERT INTO categories (name, slug, description)
SELECT 'Beauty & Accessories', 'beauty', 'Sunglasses, makeup, jewellery and girls tiny essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beauty');

-- Homepage tile defaults for new categories
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'home_eyebrow'
  ) THEN
    UPDATE categories
    SET home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Bags'),
        home_title = COALESCE(NULLIF(home_title, ''), 'Carry the look'),
        home_image_url = COALESCE(
          NULLIF(home_image_url, ''),
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85'
        )
    WHERE slug = 'bags';

    UPDATE categories
    SET home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Shoes'),
        home_title = COALESCE(NULLIF(home_title, ''), 'Step into glam'),
        home_image_url = COALESCE(
          NULLIF(home_image_url, ''),
          'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=85'
        )
    WHERE slug = 'shoes';

    UPDATE categories
    SET home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Beauty'),
        home_title = COALESCE(NULLIF(home_title, ''), 'Makeup & tiny essentials'),
        home_image_url = COALESCE(
          NULLIF(home_image_url, ''),
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85'
        )
    WHERE slug = 'beauty';
  END IF;
END $$;

UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
