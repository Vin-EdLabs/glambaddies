-- More catalogue items + Food & Grocery (fruits and pantry).
-- Safe to re-run. Ensures every product here gets a primary image.
--
--   node backend/scripts/apply-sql.js database/catalog-food-and-more.sql
--   psql "$DATABASE_URL" -f database/catalog-food-and-more.sql

BEGIN;

INSERT INTO categories (name, slug, description)
SELECT 'Food & Grocery', 'food', 'Fresh fruit, pantry staples and everyday essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'food');

-- ---------------------------------------------------------------------------
-- FOOD & GROCERY — fruit + staples (12)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW() - (v.ord || ' hours')::interval
FROM categories c
CROSS JOIN (VALUES
  (1,  'Fresh Red Apples (1kg)', 'fresh-red-apples-1kg',
   'Crisp sweet red apples, hand-selected. Ideal for snacking or baking. ~1kg bag.', 450, 120),
  (2,  'Organic Banana Bunch', 'organic-banana-bunch',
   'Ripe organic bananas, naturally sweet. Sold by the bunch (5–7 fruits).', 320, 150),
  (3,  'Sweet Valencia Oranges', 'sweet-valencia-oranges',
   'Juicy seedless Valencia oranges. Perfect for fresh juice or dessert. 1kg.', 480, 100),
  (4,  'Ripe Hass Avocados (4)', 'ripe-hass-avocados-4',
   'Creamy Hass avocados, ready to eat. Pack of 4.', 690, 80),
  (5,  'Mixed Berry Box', 'mixed-berry-box',
   'Seasonal mix of strawberries, blueberries and raspberries. 250g chilled box.', 890, 60),
  (6,  'Honeycrisp Pear Pack', 'honeycrisp-pear-pack',
   'Crisp Honeycrisp-style pears with floral sweetness. Pack of 4.', 520, 90),
  (7,  'Alphonso Mangoes (2)', 'alphonso-mangoes-2',
   'Fragrant ripe mangoes with buttery flesh. Pack of 2.', 780, 70),
  (8,  'Cherry Tomato Punnet', 'cherry-tomato-punnet',
   'Sweet cherry tomatoes on the vine. 400g punnet.', 410, 110),
  (9,  'Artisan Sourdough Loaf', 'artisan-sourdough-loaf',
   'Naturally leavened sourdough with a crackling crust. Baked daily. ~700g.', 650, 45),
  (10, 'Extra Virgin Olive Oil 500ml', 'extra-virgin-olive-oil-500ml',
   'Cold-pressed extra virgin olive oil. Peppery finish for dressings and finishing.', 1290, 55),
  (11, 'Wildflower Honey 350g', 'wildflower-honey-350g',
   'Raw wildflower honey in a glass jar. Floral and golden.', 980, 65),
  (12, 'Free-Range Eggs (12)', 'free-range-eggs-12',
   'Farm free-range eggs, dozen pack. Large size.', 540, 100)
) AS v(ord, name, slug, description, price_cents, stock)
WHERE c.slug = 'food'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- MORE FASHION (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Cashmere Crew Neck', 'cashmere-crew-neck',
   'Soft Mongolian cashmere crew in a relaxed fit. Lightweight year-round knit.', 22000, 24),
  ('Pleated Wide Trousers', 'pleated-wide-trousers',
   'High-rise pleated trousers in fluid wool blend. Full length with pressed crease.', 13500, 30),
  ('Structured Crossbody', 'structured-crossbody',
   'Compact leather crossbody with brushed hardware and adjustable strap.', 11200, 35)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'fashion'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- MORE ELECTRONICS (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('4K Action Camera', '4k-action-camera',
   'Waterproof 4K action cam with image stabilisation and dual screens.', 17900, 28),
  ('Wireless Charging Pad', 'wireless-charging-pad',
   '15W fast wireless charger with USB-C input and soft silicone base.', 3900, 90),
  ('USB-C Hub 7-in-1', 'usb-c-hub-7in1',
   'Aluminium hub: HDMI 4K, USB 3.0, SD/TF and 100W passthrough charging.', 5900, 60)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'electronics'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- MORE GAMES (2)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Portable Retro Console', 'portable-retro-console',
   'Pocket console with 500+ classic titles, HDMI out and rechargeable battery.', 8900, 40),
  ('RGB Desk Mat XL', 'rgb-desk-mat-xl',
   'Extended gaming desk mat with soft stitched edges and RGB underglow strip.', 4500, 55)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'games'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- MORE HOME (2)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Linen Bedding Set Queen', 'linen-bedding-set-queen',
   'Stonewashed linen duvet cover with two pillowcases. Queen size, sand tone.', 18900, 20),
  ('Ceramic Diffuser Set', 'ceramic-diffuser-set',
   'Matte ceramic diffuser with three essential oil blends — cedar, citrus, lavender.', 7200, 40)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'home-living'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- MORE BEAUTY (2)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Gentle Clay Mask', 'gentle-clay-mask',
   'Kaolin clay mask with aloe for weekly clarifying. 75ml jar.', 3400, 70),
  ('Rosewater Facial Toner', 'rosewater-facial-toner',
   'Alcohol-free rosewater toner to refresh and balance. 200ml spray.', 2800, 85)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'beauty'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- Primary images (reliable Unsplash CDN URLs)
-- ---------------------------------------------------------------------------
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, img.url, TRUE
FROM (
  VALUES
    -- Food & fruit
    ('fresh-red-apples-1kg', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=1200&q=85'),
    ('organic-banana-bunch', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=1200&q=85'),
    ('sweet-valencia-oranges', 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=1200&q=85'),
    ('ripe-hass-avocados-4', 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=1200&q=85'),
    ('mixed-berry-box', 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=1200&q=85'),
    ('honeycrisp-pear-pack', 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?auto=format&fit=crop&w=1200&q=85'),
    ('alphonso-mangoes-2', 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=1200&q=85'),
    ('cherry-tomato-punnet', 'https://images.unsplash.com/photo-1546470427-e212cd7d6c21?auto=format&fit=crop&w=1200&q=85'),
    ('artisan-sourdough-loaf', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=85'),
    ('extra-virgin-olive-oil-500ml', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=85'),
    ('wildflower-honey-350g', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1200&q=85'),
    ('free-range-eggs-12', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=1200&q=85'),
    -- Fashion
    ('cashmere-crew-neck', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=85'),
    ('pleated-wide-trousers', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1200&q=85'),
    ('structured-crossbody', 'https://images.unsplash.com/photo-1548036328-c165bc040215?auto=format&fit=crop&w=1200&q=85'),
    -- Electronics
    ('4k-action-camera', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1200&q=85'),
    ('wireless-charging-pad', 'https://images.unsplash.com/photo-1615526675152-a682bed5994b?auto=format&fit=crop&w=1200&q=85'),
    ('usb-c-hub-7in1', 'https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=1200&q=85'),
    -- Games
    ('portable-retro-console', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85'),
    ('rgb-desk-mat-xl', 'https://images.unsplash.com/photo-1616587894289-86480e533129?auto=format&fit=crop&w=1200&q=85'),
    -- Home
    ('linen-bedding-set-queen', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85'),
    ('ceramic-diffuser-set', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1200&q=85'),
    -- Beauty
    ('gentle-clay-mask', 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?auto=format&fit=crop&w=1200&q=85'),
    ('rosewater-facial-toner', 'https://images.unsplash.com/photo-1608248543805-ba83bc4f2c3e?auto=format&fit=crop&w=1200&q=85')
) AS img(slug, url)
JOIN products p ON p.slug = img.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE
);

-- Backfill: any active product still missing a primary image gets a category fallback
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id,
  CASE c.slug
    WHEN 'food' THEN 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1200&q=85'
    WHEN 'fashion' THEN 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=85'
    WHEN 'electronics' THEN 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1200&q=85'
    WHEN 'games' THEN 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=85'
    WHEN 'home-living' THEN 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=85'
    WHEN 'beauty' THEN 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=85'
    ELSE 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=85'
  END,
  TRUE
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active
  AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id);

COMMIT;
