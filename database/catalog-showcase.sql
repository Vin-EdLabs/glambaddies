-- Showcase catalogue: 3 products each for New arrivals, Fashion, Electronics,
-- Games, Home & Living, and Beauty. Safe to re-run (skips existing slugs).
--
-- Usage:
--   psql "$DATABASE_URL" -f database/catalog-showcase.sql
-- Production example:
--   psql -h … -U … -d vublishop -f database/catalog-showcase.sql

BEGIN;

-- Ensure categories exist
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
SELECT 'Games', 'games', 'Consoles, controllers and play essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'games');

-- Helper: insert product + primary image if slug is free
-- ---------------------------------------------------------------------------
-- FASHION (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Structured Wool Blazer', 'structured-wool-blazer',
  'Tailored single-breasted blazer in Italian wool. Soft shoulder, notch lapel, fully lined.',
  18900, 32, TRUE
FROM categories c WHERE c.slug = 'fashion'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'structured-wool-blazer');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Silk Slip Midi Dress', 'silk-slip-midi-dress',
  'Bias-cut midi slip in washed silk with adjustable straps and a fluid drape.',
  14200, 28, TRUE
FROM categories c WHERE c.slug = 'fashion'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'silk-slip-midi-dress');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Calfskin Loafers', 'calfskin-loafers',
  'Hand-finished calfskin loafers with leather sole and cushioned insole. Timeless everyday polish.',
  16800, 40, TRUE
FROM categories c WHERE c.slug = 'fashion'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'calfskin-loafers');

-- ---------------------------------------------------------------------------
-- ELECTRONICS (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Noise-Isolating Earbuds', 'noise-isolating-earbuds',
  'True wireless earbuds with adaptive ANC, multipoint Bluetooth and 28-hour case battery.',
  11900, 55, TRUE
FROM categories c WHERE c.slug = 'electronics'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'noise-isolating-earbuds');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Ultralight Laptop Sleeve 14"', 'ultralight-laptop-sleeve-14',
  'Quilted sleeve with soft microfibre lining and magnetic closure. Fits most 14-inch notebooks.',
  4900, 70, TRUE
FROM categories c WHERE c.slug = 'electronics'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'ultralight-laptop-sleeve-14');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'MagSafe Power Bank 10K', 'magsafe-power-bank-10k',
  '10,000mAh magnetic power bank with USB-C PD 20W and LED charge indicator.',
  6900, 85, TRUE
FROM categories c WHERE c.slug = 'electronics'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'magsafe-power-bank-10k');

-- ---------------------------------------------------------------------------
-- GAMES (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'RGB Mechanical Gamepad', 'rgb-mechanical-gamepad',
  'Hall-effect sticks, remappable buttons and per-key RGB lighting. Wired and 2.4GHz wireless.',
  7900, 36, TRUE
FROM categories c WHERE c.slug = 'games'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'rgb-mechanical-gamepad');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, '4K Capture Card Mini', '4k-capture-card-mini',
  'Plug-and-play HDMI capture up to 4K60 passthrough with USB-C. Stream or record instantly.',
  12900, 22, TRUE
FROM categories c WHERE c.slug = 'games'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = '4k-capture-card-mini');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Ergo Racing Seat Cover', 'ergo-racing-seat-cover',
  'Breathable racing-style seat cover with lumbar support for long sessions.',
  5900, 48, TRUE
FROM categories c WHERE c.slug = 'games'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'ergo-racing-seat-cover');

-- ---------------------------------------------------------------------------
-- HOME & LIVING (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Stoneware Dinner Set for 4', 'stoneware-dinner-set-for-4',
  'Twelve-piece matte stoneware set: plates, bowls and side plates in warm sand glaze.',
  9800, 30, TRUE
FROM categories c WHERE c.slug = 'home-living'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'stoneware-dinner-set-for-4');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Oak Entry Console', 'oak-entry-console',
  'Solid oak console with open shelf and soft-close drawer. 110cm wide.',
  24900, 12, TRUE
FROM categories c WHERE c.slug = 'home-living'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'oak-entry-console');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Scented Soy Candle Trio', 'scented-soy-candle-trio',
  'Three 180g soy candles — cedar, bergamot and fig leaf — in frosted glass vessels.',
  5400, 60, TRUE
FROM categories c WHERE c.slug = 'home-living'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'scented-soy-candle-trio');

-- ---------------------------------------------------------------------------
-- BEAUTY (3)
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Hydrating Ceramide Cream', 'hydrating-ceramide-cream',
  'Barrier-repair cream with ceramides and panthenol. Fragrance-free, 50ml.',
  4200, 90, TRUE
FROM categories c WHERE c.slug = 'beauty'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'hydrating-ceramide-cream');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Soft Matte Lip Tint Set', 'soft-matte-lip-tint-set',
  'Three buildable matte lip tints in rosewood, terracotta and deep berry.',
  3600, 75, TRUE
FROM categories c WHERE c.slug = 'beauty'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'soft-matte-lip-tint-set');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Mineral SPF Daily Fluid', 'mineral-spf-daily-fluid',
  'Lightweight mineral SPF 50 fluid with a sheer finish. Non-whitening, 40ml.',
  3800, 80, TRUE
FROM categories c WHERE c.slug = 'beauty'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'mineral-spf-daily-fluid');

-- ---------------------------------------------------------------------------
-- NEW ARRIVALS (3) — newest timestamps so they lead the homepage / shop sort
-- ---------------------------------------------------------------------------
INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at, updated_at)
SELECT c.id, 'Merino Oversized Coat', 'merino-oversized-coat',
  'Double-faced merino coat with concealed buttons and a clean waterfall collar. New season cut.',
  32000, 18, TRUE, NOW(), NOW()
FROM categories c WHERE c.slug = 'fashion'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'merino-oversized-coat');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at, updated_at)
SELECT c.id, 'Titanium Open-Ear Audio', 'titanium-open-ear-audio',
  'Open-ear titanium frame headphones with directional audio and IPX5 sweat resistance. Just dropped.',
  19900, 26, TRUE, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'
FROM categories c WHERE c.slug = 'electronics'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'titanium-open-ear-audio');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at, updated_at)
SELECT c.id, 'Glass Skin Primer Mist', 'glass-skin-primer-mist',
  'Dewy primer mist with niacinamide and rice extract. Prep and set in one veil. New arrival.',
  2900, 110, TRUE, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
FROM categories c WHERE c.slug = 'beauty'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'glass-skin-primer-mist');

-- Keep new arrivals at the top even if they already existed
UPDATE products SET created_at = NOW(), updated_at = NOW()
WHERE slug = 'merino-oversized-coat';
UPDATE products SET created_at = NOW() - INTERVAL '1 hour', updated_at = NOW() - INTERVAL '1 hour'
WHERE slug = 'titanium-open-ear-audio';
UPDATE products SET created_at = NOW() - INTERVAL '2 hours', updated_at = NOW() - INTERVAL '2 hours'
WHERE slug = 'glass-skin-primer-mist';

-- ---------------------------------------------------------------------------
-- Primary images
-- ---------------------------------------------------------------------------
INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, img.url, TRUE
FROM (
  VALUES
    ('structured-wool-blazer', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=85'),
    ('silk-slip-midi-dress', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85'),
    ('calfskin-loafers', 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=1200&q=85'),
    ('noise-isolating-earbuds', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=85'),
    ('ultralight-laptop-sleeve-14', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=85'),
    ('magsafe-power-bank-10k', 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=1200&q=85'),
    ('rgb-mechanical-gamepad', 'https://images.unsplash.com/photo-1612287230202-1ff1d867d123?auto=format&fit=crop&w=1200&q=85'),
    ('4k-capture-card-mini', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=85'),
    ('ergo-racing-seat-cover', 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=85'),
    ('stoneware-dinner-set-for-4', 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1200&q=85'),
    ('oak-entry-console', 'https://images.unsplash.com/photo-1594026112284-02bb6f3352cd?auto=format&fit=crop&w=1200&q=85'),
    ('scented-soy-candle-trio', 'https://images.unsplash.com/photo-1602602670720-842e69d53eda?auto=format&fit=crop&w=1200&q=85'),
    ('hydrating-ceramide-cream', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=85'),
    ('soft-matte-lip-tint-set', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=1200&q=85'),
    ('mineral-spf-daily-fluid', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=85'),
    ('merino-oversized-coat', 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1200&q=85'),
    ('titanium-open-ear-audio', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=85'),
    ('glass-skin-primer-mist', 'https://images.unsplash.com/photo-1571875257727-256c39da42af?auto=format&fit=crop&w=1200&q=85')
) AS img(slug, url)
JOIN products p ON p.slug = img.slug
WHERE NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary);

COMMIT;
