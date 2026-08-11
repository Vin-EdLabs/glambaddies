-- DEPRECATED for GlamBaddies — do not run.
-- This file targets multi-category Vublishop catalogues (flowers, jewellery, etc.).
-- GlamBaddies sells dresses only. Use database/seed.sql or database/girls-dresses.sql
-- against glambaddies_db.


BEGIN;

INSERT INTO categories (name, slug, description)
SELECT 'Flowers', 'flowers', 'Fresh hand-tied bouquets for every occasion'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'flowers');

INSERT INTO categories (name, slug, description)
SELECT 'Jewellery', 'jewellery', 'Fine gold and diamond jewellery'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'jewellery');

-- ===================== FLOWERS (5) =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Classic Red Rose Bouquet', 'classic-red-rose-bouquet',
   'Two dozen premium long-stem red roses, hand-tied with eucalyptus and wrapped in signature matte paper. A timeless romantic gesture.', 8900, 40),
  ('Blush Peony Bouquet', 'blush-peony-bouquet',
   'Lush seasonal peonies in soft blush tones, arranged with silver-dollar eucalyptus. Delivered at the perfect opening stage.', 9800, 30),
  ('Sunshine Sunflower Bunch', 'sunshine-sunflower-bunch',
   'A cheerful bunch of tall-stem sunflowers with solidago and greenery. Brings instant warmth to any room.', 5900, 50),
  ('White Lily & Rose Bouquet', 'white-lily-rose-bouquet',
   'Elegant oriental lilies and white avalanche roses with ruscus. A refined choice for celebrations and sympathy alike.', 10900, 25),
  ('Wildflower Meadow Bouquet', 'wildflower-meadow-bouquet',
   'A free-spirited mix of seasonal wildflowers, daisies and limonium — gathered fresh and tied by hand.', 6900, 45)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'flowers'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== JEWELLERY (5) =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Golden Solitaire Diamond Ring', 'golden-solitaire-diamond-ring',
   '18k yellow gold solitaire set with a brilliant-cut 0.5ct diamond. Classic four-claw setting, polished band. Gift box included.', 129900, 12),
  ('Diamond Halo Engagement Ring', 'diamond-halo-engagement-ring',
   'Centre brilliant diamond framed by a sparkling halo of pavé stones on an 18k white gold band. Certificate of authenticity included.', 189900, 8),
  ('Classic 18k Gold Band', 'classic-18k-gold-band',
   'Timeless 4mm comfort-fit wedding band in solid 18k yellow gold with a mirror polish. Unisex sizing.', 49900, 20),
  ('Twisted Gold & Diamond Eternity Ring', 'twisted-gold-diamond-eternity-ring',
   'Delicate twisted-rope band in 18k gold, channel-set with round diamonds halfway around. Stacks beautifully.', 89900, 15),
  ('Rose Gold Diamond Cluster Ring', 'rose-gold-diamond-cluster-ring',
   'Romantic 18k rose gold ring with a flower-shaped cluster of seven brilliant diamonds. Handcrafted finish.', 109900, 10)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'jewellery'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== IMAGES =====================
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, v.url, TRUE
FROM products p
JOIN (VALUES
  ('classic-red-rose-bouquet',            'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=85'),
  ('blush-peony-bouquet',                 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=1200&q=85'),
  ('sunshine-sunflower-bunch',            'https://images.unsplash.com/photo-1470509037663-253afd7f0f51?auto=format&fit=crop&w=1200&q=85'),
  ('white-lily-rose-bouquet',             'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=1200&q=85'),
  ('wildflower-meadow-bouquet',           'https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&w=1200&q=85'),
  ('golden-solitaire-diamond-ring',       'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=85'),
  ('diamond-halo-engagement-ring',        'https://images.unsplash.com/photo-1605101100278-5d1deb2b6498?auto=format&fit=crop&w=1200&q=85'),
  ('classic-18k-gold-band',               'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85'),
  ('twisted-gold-diamond-eternity-ring',  'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1200&q=85'),
  ('rose-gold-diamond-cluster-ring',      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1200&q=85')
) AS v(slug, url) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

-- Bust storefront caches so the new items appear immediately.
UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
