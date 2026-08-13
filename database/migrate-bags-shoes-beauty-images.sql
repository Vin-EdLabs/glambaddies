-- GlamBaddies — Bags, Shoes, Beauty categories + homepage tile images only
-- Safe to re-run. Does not touch dress categories or products.
-- Images are remote URLs (easy to replace/delete anytime in Admin → Categories).
--
-- Apply on server:
--   psql -U glambaddies_user -d glambaddies_db -h localhost \
--     -f /var/www/glambaddies/database/migrate-bags-shoes-beauty-images.sql
--
-- Or:
--   node backend/scripts/apply-sql.js database/migrate-bags-shoes-beauty-images.sql

BEGIN;

-- Ensure homepage tile columns exist
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS home_image_url TEXT,
  ADD COLUMN IF NOT EXISTS home_eyebrow VARCHAR(40),
  ADD COLUMN IF NOT EXISTS home_title VARCHAR(80);

-- Create accessory categories if missing
INSERT INTO categories (name, slug, description)
SELECT 'Bags', 'bags', 'Handbags, mini bags and glam essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bags');

INSERT INTO categories (name, slug, description)
SELECT 'Shoes', 'shoes', 'Shoes and heels for every glam moment'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'shoes');

INSERT INTO categories (name, slug, description)
SELECT 'Beauty & Accessories', 'beauty', 'Sunglasses, makeup, jewellery and girls tiny essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beauty');

-- Homepage / shop-by-category tile pictures (Bags, Shoes, Makeup/Beauty only)
UPDATE categories SET
  name = 'Bags',
  description = COALESCE(NULLIF(description, ''), 'Handbags, mini bags and glam essentials'),
  home_eyebrow = 'Bags',
  home_title = 'Carry the look',
  home_image_url = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85'
WHERE slug = 'bags';

UPDATE categories SET
  name = 'Shoes',
  description = COALESCE(NULLIF(description, ''), 'Shoes and heels for every glam moment'),
  home_eyebrow = 'Shoes',
  home_title = 'Step into glam',
  home_image_url = 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=85'
WHERE slug = 'shoes';

UPDATE categories SET
  name = 'Beauty & Accessories',
  description = COALESCE(NULLIF(description, ''), 'Sunglasses, makeup, jewellery and girls tiny essentials'),
  home_eyebrow = 'Beauty',
  home_title = 'Makeup & tiny essentials',
  home_image_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85'
WHERE slug = 'beauty';

COMMIT;
