-- GlamBaddies — girls' dresses seed (idempotent). Targets glambaddies_db only.
-- Prices are GHS pesewas. Do not run against the Vublishop database.

BEGIN;

INSERT INTO categories (name, slug, description)
SELECT 'Dresses', 'dresses', 'Girls'' dresses for every occasion'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'dresses');

INSERT INTO categories (name, slug, description)
SELECT 'Casual Dresses', 'casual-dresses', 'Everyday and weekend dresses'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casual-dresses');

INSERT INTO categories (name, slug, description)
SELECT 'Party Dresses', 'party-dresses', 'Celebration and special-occasion dresses'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'party-dresses');

INSERT INTO categories (name, slug, description)
SELECT 'School Dresses', 'school-dresses', 'Smart uniforms and school-day dresses'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'school-dresses');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Floral Summer Dress', 'floral-summer-dress',
   'Light floaty dress in a fresh floral print with a smocked bodice and flutter sleeves.', 29900, 30),
  ('Girls'' Tulle Party Dress', 'girls-tulle-party-dress',
   'A dreamy layered tulle skirt with a satin bodice and bow sash. Ages 3–12.', 34900, 35),
  ('Elegant Evening Gown', 'elegant-evening-gown',
   'Floor-length chiffon gown with a fitted waist and subtle shimmer.', 58900, 12),
  ('Polka Dot Midi Dress', 'polka-dot-midi-dress',
   'Playful polka-dot midi with a wrap front and tie waist.', 27900, 28),
  ('Girls'' Cotton Sundress', 'girls-cotton-sundress',
   'Soft cotton sundress with adjustable straps. Ages 2–10.', 19900, 45),
  ('Smart Plaid School Dress', 'smart-plaid-school-dress',
   'Classic plaid school dress with peter-pan collar.', 24900, 40),
  ('Navy Uniform Day Dress', 'navy-uniform-day-dress',
   'Neat navy day dress with white piping.', 22900, 38),
  ('Sparkle Birthday Dress', 'sparkle-birthday-dress',
   'Shimmer tulle party dress with sequin bodice.', 39900, 22)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = CASE
    WHEN v.slug IN ('girls-tulle-party-dress', 'elegant-evening-gown', 'sparkle-birthday-dress') THEN 'party-dresses'
    WHEN v.slug IN ('smart-plaid-school-dress', 'navy-uniform-day-dress') THEN 'school-dresses'
    ELSE 'casual-dresses'
  END
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, v.url, TRUE
FROM products p
JOIN (VALUES
  ('floral-summer-dress',      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85'),
  ('girls-tulle-party-dress',  'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=1200&q=85'),
  ('elegant-evening-gown',     'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=85'),
  ('polka-dot-midi-dress',     'https://images.unsplash.com/photo-1612336307429-8a898d10e223?auto=format&fit=crop&w=1200&q=85'),
  ('girls-cotton-sundress',    'https://images.unsplash.com/photo-1476234251651-f353703a034d?auto=format&fit=crop&w=1200&q=85'),
  ('smart-plaid-school-dress', 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=85'),
  ('navy-uniform-day-dress',   'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85'),
  ('sparkle-birthday-dress',   'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=85')
) AS v(slug, url) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
