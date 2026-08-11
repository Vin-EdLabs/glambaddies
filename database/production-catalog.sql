-- DEPRECATED for GlamBaddies � do not run.
-- Use database/seed.sql or database/girls-dresses.sql on glambaddies_db.
-- Production bootstrap: categories, showcase catalogue, food & grocery, newsletter.
-- Safe to re-run.
--
--   node backend/scripts/apply-sql.js database/production-catalog.sql
--   psql "$DATABASE_URL" -f database/production-catalog.sql

BEGIN;

-- Categories
INSERT INTO categories (name, slug, description)
SELECT 'Electronics', 'electronics', 'Phones, audio, computing and accessories'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'electronics');
INSERT INTO categories (name, slug, description)
SELECT 'Fashion', 'fashion', 'Clothing, shoes and accessories for every style'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'fashion');
INSERT INTO categories (name, slug, description)
SELECT 'Home & Living', 'home-living', 'Furniture, decor and kitchen essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'home-living');
INSERT INTO categories (name, slug, description)
SELECT 'Beauty', 'beauty', 'Skincare, fragrance and personal care'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beauty');
INSERT INTO categories (name, slug, description)
SELECT 'Sports', 'sports', 'Fitness gear and outdoor equipment'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sports');
INSERT INTO categories (name, slug, description)
SELECT 'Games', 'games', 'Consoles, controllers and play essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'games');
INSERT INTO categories (name, slug, description)
SELECT 'Food & Grocery', 'food', 'Fresh fruit, pantry staples and everyday essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'food');

COMMIT;

-- Pull in showcase + food product inserts (separate transactions inside those files
-- are not included here — product data is inlined below for one deploy step).
BEGIN;

-- ===================== FASHION =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Structured Wool Blazer', 'structured-wool-blazer', 'Tailored single-breasted blazer in Italian wool. Soft shoulder, notch lapel, fully lined.', 18900, 32),
  ('Silk Slip Midi Dress', 'silk-slip-midi-dress', 'Bias-cut midi slip in washed silk with adjustable straps and a fluid drape.', 14200, 28),
  ('Calfskin Loafers', 'calfskin-loafers', 'Hand-finished calfskin loafers with leather sole and cushioned insole.', 16800, 40),
  ('Cashmere Crew Neck', 'cashmere-crew-neck', 'Soft Mongolian cashmere crew in a relaxed fit. Lightweight year-round knit.', 22000, 24),
  ('Pleated Wide Trousers', 'pleated-wide-trousers', 'High-rise pleated trousers in fluid wool blend. Full length with pressed crease.', 13500, 30),
  ('Structured Crossbody', 'structured-crossbody', 'Compact leather crossbody with brushed hardware and adjustable strap.', 11200, 35),
  ('Merino Oversized Coat', 'merino-oversized-coat', 'Double-faced merino coat with concealed buttons and a clean waterfall collar.', 32000, 18),
  ('Classic Denim Jacket', 'classic-denim-jacket', 'Unisex medium-wash denim jacket with button front and chest pockets. 100% cotton.', 6499, 60),
  ('Leather Crossbody Bag', 'leather-crossbody-bag', 'Handcrafted genuine leather bag with adjustable strap and three interior compartments.', 8999, 25),
  ('Canvas Low-Top Sneakers', 'canvas-low-top-sneakers', 'Everyday sneakers with cushioned insole and vulcanized rubber outsole.', 4599, 90)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'fashion' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== ELECTRONICS =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Wireless Noise-Cancelling Headphones', 'wireless-noise-cancelling-headphones', 'Over-ear Bluetooth headphones with active noise cancellation and 35-hour battery.', 12999, 45),
  ('Smartwatch Series X', 'smartwatch-series-x', 'Fitness smartwatch with heart-rate tracking, GPS and 1.9-inch AMOLED display.', 19999, 30),
  ('Portable Bluetooth Speaker', 'portable-bluetooth-speaker', 'Compact 20W speaker with deep bass, IPX7 waterproofing and 12 hours playtime.', 5999, 80),
  ('Noise-Isolating Earbuds', 'noise-isolating-earbuds', 'True wireless earbuds with adaptive ANC and 28-hour case battery.', 11900, 55),
  ('Ultralight Laptop Sleeve 14"', 'ultralight-laptop-sleeve-14', 'Quilted sleeve with soft microfibre lining for most 14-inch notebooks.', 4900, 70),
  ('MagSafe Power Bank 10K', 'magsafe-power-bank-10k', '10,000mAh magnetic power bank with USB-C PD 20W.', 6900, 85),
  ('4K Action Camera', '4k-action-camera', 'Waterproof 4K action cam with image stabilisation and dual screens.', 17900, 28),
  ('Wireless Charging Pad', 'wireless-charging-pad', '15W fast wireless charger with USB-C input.', 3900, 90),
  ('USB-C Hub 7-in-1', 'usb-c-hub-7in1', 'Aluminium hub: HDMI 4K, USB 3.0, SD/TF and 100W passthrough.', 5900, 60),
  ('Titanium Open-Ear Audio', 'titanium-open-ear-audio', 'Open-ear titanium frame headphones with directional audio.', 19900, 26)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'electronics' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== GAMES =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Wireless Pro Controller', 'wireless-pro-controller', 'Responsive wireless controller with adaptive triggers and haptic feedback.', 6999, 40),
  ('Compact Gaming Headset', 'compact-gaming-headset', 'Lightweight over-ear headset with spatial audio and detachable mic.', 8999, 28),
  ('RGB Mechanical Gamepad', 'rgb-mechanical-gamepad', 'Hall-effect sticks, remappable buttons and per-key RGB lighting.', 7900, 36),
  ('4K Capture Card Mini', '4k-capture-card-mini', 'Plug-and-play HDMI capture up to 4K60 passthrough via USB-C.', 12900, 22),
  ('Ergo Racing Seat Cover', 'ergo-racing-seat-cover', 'Breathable racing-style seat cover with lumbar support.', 5900, 48),
  ('Portable Retro Console', 'portable-retro-console', 'Pocket console with classic titles, HDMI out and rechargeable battery.', 8900, 40),
  ('RGB Desk Mat XL', 'rgb-desk-mat-xl', 'Extended gaming desk mat with soft stitched edges.', 4500, 55)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'games' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== HOME =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Ceramic Pour-Over Coffee Set', 'ceramic-pour-over-coffee-set', 'Matte ceramic dripper with matching carafe and reusable filter.', 4299, 40),
  ('Linen Throw Blanket', 'linen-throw-blanket', 'Stonewashed 100% linen throw, 130x170cm.', 5499, 35),
  ('Minimalist Desk Lamp', 'minimalist-desk-lamp', 'Dimmable LED desk lamp with touch controls and USB port.', 3899, 55),
  ('Stoneware Dinner Set for 4', 'stoneware-dinner-set-for-4', 'Twelve-piece matte stoneware set in warm sand glaze.', 9800, 30),
  ('Oak Entry Console', 'oak-entry-console', 'Solid oak console with open shelf and soft-close drawer.', 24900, 12),
  ('Scented Soy Candle Trio', 'scented-soy-candle-trio', 'Three 180g soy candles — cedar, bergamot and fig leaf.', 5400, 60),
  ('Linen Bedding Set Queen', 'linen-bedding-set-queen', 'Stonewashed linen duvet cover with two pillowcases. Queen.', 18900, 20),
  ('Ceramic Diffuser Set', 'ceramic-diffuser-set', 'Matte ceramic diffuser with three essential oil blends.', 7200, 40)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'home-living' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== BEAUTY =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Vitamin C Brightening Serum', 'vitamin-c-brightening-serum', '15% vitamin C serum with hyaluronic acid. Fragrance-free, 30ml.', 2799, 100),
  ('Shea Butter Body Cream', 'shea-butter-body-cream', 'Rich 48-hour moisture cream with unrefined shea butter. 200ml.', 1899, 150),
  ('Hydrating Ceramide Cream', 'hydrating-ceramide-cream', 'Barrier-repair cream with ceramides and panthenol. 50ml.', 4200, 90),
  ('Soft Matte Lip Tint Set', 'soft-matte-lip-tint-set', 'Three buildable matte lip tints in rosewood, terracotta and berry.', 3600, 75),
  ('Mineral SPF Daily Fluid', 'mineral-spf-daily-fluid', 'Lightweight mineral SPF 50 fluid. Non-whitening, 40ml.', 3800, 80),
  ('Glass Skin Primer Mist', 'glass-skin-primer-mist', 'Dewy primer mist with niacinamide and rice extract.', 2900, 110),
  ('Gentle Clay Mask', 'gentle-clay-mask', 'Kaolin clay mask with aloe for weekly clarifying. 75ml.', 3400, 70),
  ('Rosewater Facial Toner', 'rosewater-facial-toner', 'Alcohol-free rosewater toner. 200ml spray.', 2800, 85)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'beauty' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== FOOD =====================
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Fresh Red Apples (1kg)', 'fresh-red-apples-1kg', 'Crisp sweet red apples, hand-selected. ~1kg bag.', 450, 120),
  ('Organic Banana Bunch', 'organic-banana-bunch', 'Ripe organic bananas. Bunch of 5–7 fruits.', 320, 150),
  ('Sweet Valencia Oranges', 'sweet-valencia-oranges', 'Juicy seedless Valencia oranges. 1kg.', 480, 100),
  ('Ripe Hass Avocados (4)', 'ripe-hass-avocados-4', 'Creamy Hass avocados, ready to eat. Pack of 4.', 690, 80),
  ('Mixed Berry Box', 'mixed-berry-box', 'Strawberries, blueberries and raspberries. 250g.', 890, 60),
  ('Honeycrisp Pear Pack', 'honeycrisp-pear-pack', 'Crisp pears with floral sweetness. Pack of 4.', 520, 90),
  ('Alphonso Mangoes (2)', 'alphonso-mangoes-2', 'Fragrant ripe mangoes. Pack of 2.', 780, 70),
  ('Cherry Tomato Punnet', 'cherry-tomato-punnet', 'Sweet cherry tomatoes. 400g punnet.', 410, 110),
  ('Artisan Sourdough Loaf', 'artisan-sourdough-loaf', 'Naturally leavened sourdough loaf. ~700g.', 650, 45),
  ('Extra Virgin Olive Oil 500ml', 'extra-virgin-olive-oil-500ml', 'Cold-pressed extra virgin olive oil. 500ml.', 1290, 55),
  ('Wildflower Honey 350g', 'wildflower-honey-350g', 'Raw wildflower honey in a glass jar. 350g.', 980, 65),
  ('Free-Range Eggs (12)', 'free-range-eggs-12', 'Farm free-range eggs, dozen pack.', 540, 100)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'food' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

-- ===================== IMAGES =====================
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, img.url, TRUE
FROM (
  VALUES
    ('structured-wool-blazer', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=85'),
    ('silk-slip-midi-dress', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85'),
    ('calfskin-loafers', 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=1200&q=85'),
    ('cashmere-crew-neck', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=85'),
    ('pleated-wide-trousers', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1200&q=85'),
    ('structured-crossbody', 'https://images.unsplash.com/photo-1548036328-c165bc040215?auto=format&fit=crop&w=1200&q=85'),
    ('merino-oversized-coat', 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1200&q=85'),
    ('classic-denim-jacket', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=85'),
    ('leather-crossbody-bag', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=85'),
    ('canvas-low-top-sneakers', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85'),
    ('wireless-noise-cancelling-headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85'),
    ('smartwatch-series-x', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85'),
    ('portable-bluetooth-speaker', 'https://images.unsplash.com/photo-1608043152269-423dbba4b7c1?auto=format&fit=crop&w=1200&q=85'),
    ('noise-isolating-earbuds', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=85'),
    ('ultralight-laptop-sleeve-14', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=85'),
    ('magsafe-power-bank-10k', 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=1200&q=85'),
    ('4k-action-camera', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1200&q=85'),
    ('wireless-charging-pad', 'https://images.unsplash.com/photo-1615526675152-a682bed5994b?auto=format&fit=crop&w=1200&q=85'),
    ('usb-c-hub-7in1', 'https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=1200&q=85'),
    ('titanium-open-ear-audio', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=85'),
    ('wireless-pro-controller', 'https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=1200&q=85'),
    ('compact-gaming-headset', 'https://images.unsplash.com/photo-1612287230202-1ff1d867d123?auto=format&fit=crop&w=1200&q=85'),
    ('rgb-mechanical-gamepad', 'https://images.unsplash.com/photo-1612287230202-1ff1d867d123?auto=format&fit=crop&w=1200&q=85'),
    ('4k-capture-card-mini', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=85'),
    ('ergo-racing-seat-cover', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=85'),
    ('portable-retro-console', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85'),
    ('rgb-desk-mat-xl', 'https://images.unsplash.com/photo-1616587894289-86480e533129?auto=format&fit=crop&w=1200&q=85'),
    ('ceramic-pour-over-coffee-set', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85'),
    ('linen-throw-blanket', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=1200&q=85'),
    ('minimalist-desk-lamp', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85'),
    ('stoneware-dinner-set-for-4', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1200&q=85'),
    ('oak-entry-console', 'https://images.unsplash.com/photo-1594026112284-02bb6f3352cd?auto=format&fit=crop&w=1200&q=85'),
    ('scented-soy-candle-trio', 'https://images.unsplash.com/photo-1602602670720-842e69d53eda?auto=format&fit=crop&w=1200&q=85'),
    ('linen-bedding-set-queen', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85'),
    ('ceramic-diffuser-set', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1200&q=85'),
    ('vitamin-c-brightening-serum', 'https://images.unsplash.com/photo-1620916297397-a4a3372a4c9c?auto=format&fit=crop&w=1200&q=85'),
    ('shea-butter-body-cream', 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=85'),
    ('hydrating-ceramide-cream', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=85'),
    ('soft-matte-lip-tint-set', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1200&q=85'),
    ('mineral-spf-daily-fluid', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=85'),
    ('glass-skin-primer-mist', 'https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=1200&q=85'),
    ('gentle-clay-mask', 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?auto=format&fit=crop&w=1200&q=85'),
    ('rosewater-facial-toner', 'https://images.unsplash.com/photo-1608248543805-ba83bc4f2c3e?auto=format&fit=crop&w=1200&q=85'),
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
    ('free-range-eggs-12', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=1200&q=85')
) AS img(slug, url)
JOIN products p ON p.slug = img.slug
WHERE NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary);

-- Fallback image for any active product still missing one
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id,
  CASE COALESCE(c.slug, '')
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

-- Newsletter table (private list)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    source     VARCHAR(60)  NOT NULL DEFAULT 'footer',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_newsletter_created ON newsletter_subscribers (created_at DESC);

COMMIT;
