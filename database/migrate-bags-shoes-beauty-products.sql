-- GlamBaddies — sample Bags, Shoes & Beauty products (idempotent)
-- Safe to re-run. Does not touch dress products.
--
-- Apply on server:
--   psql -U glambaddies_user -d glambaddies_db -h localhost \
--     -f /var/www/glambaddies/database/migrate-bags-shoes-beauty-products.sql
--
-- Or:
--   node backend/scripts/apply-sql.js database/migrate-bags-shoes-beauty-products.sql

BEGIN;

-- Ensure categories exist
INSERT INTO categories (name, slug, description)
SELECT 'Bags', 'bags', 'Handbags, mini bags and glam essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bags');

INSERT INTO categories (name, slug, description)
SELECT 'Shoes', 'shoes', 'Shoes and heels for every glam moment'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'shoes');

INSERT INTO categories (name, slug, description)
SELECT 'Beauty & Accessories', 'beauty', 'Sunglasses, makeup, jewellery and girls tiny essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beauty');

-- Bags
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Mini Crossbody Bag', 'mini-crossbody-bag',
   'Compact crossbody with a gold zip and soft strap — perfect for little glam days out.', 18900, 24),
  ('Glitter Party Mini Bag', 'glitter-party-mini-bag',
   'Sparkle mini bag with a chain strap. Made for parties and birthdays.', 21900, 18),
  ('Quilted Pink Shoulder Bag', 'quilted-pink-shoulder-bag',
   'Soft quilted shoulder bag in blush pink with a magnetic clasp.', 24900, 20)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'bags'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- Shoes
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Pearl Ballet Flats', 'pearl-ballet-flats',
   'Soft ballet flats with a pearl bow detail. Easy everyday glam.', 15900, 30),
  ('Sparkle Party Heels', 'sparkle-party-heels',
   'Low party heels with glitter finish — twirl-ready and comfortable.', 27900, 16),
  ('White Mary Jane Shoes', 'white-mary-jane-shoes',
   'Classic Mary Janes with a buckle strap. School-smart and cute.', 16900, 28)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'shoes'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- Beauty & makeup accessories
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Pink Gloss Duo', 'pink-gloss-duo',
   'Two sheer pink glosses for soft shine. Fun, light and glam.', 8900, 40),
  ('Heart Compact Mirror', 'heart-compact-mirror',
   'Cute heart compact with a clear mirror — bag essential.', 6900, 35),
  ('Glam Hair Clips Set', 'glam-hair-clips-set',
   'Set of sparkly clips and pearls for quick hair glam.', 7900, 42),
  ('Kids Sunglasses — Rose', 'kids-sunglasses-rose',
   'Rose-tinted kids sunglasses with UV-friendly frames.', 9900, 26)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'beauty'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- Images
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, v.url, TRUE
FROM products p
JOIN (VALUES
  ('mini-crossbody-bag', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85'),
  ('glitter-party-mini-bag', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1200&q=85'),
  ('quilted-pink-shoulder-bag', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=85'),
  ('pearl-ballet-flats', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=85'),
  ('sparkle-party-heels', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=85'),
  ('white-mary-jane-shoes', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=85'),
  ('pink-gloss-duo', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85'),
  ('heart-compact-mirror', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=85'),
  ('glam-hair-clips-set', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=85'),
  ('kids-sunglasses-rose', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=85')
) AS v(slug, url) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

-- Bump catalogue so storefronts refresh
UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
