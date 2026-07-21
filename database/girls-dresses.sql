-- Girls' & women's dresses for the Fashion category (idempotent).

BEGIN;

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Floral Summer Dress', 'floral-summer-dress',
   'Light floaty dress in a fresh floral print with a smocked bodice and flutter sleeves. Perfect for sunny days.', 7900, 30),
  ('Girls'' Tulle Party Dress', 'girls-tulle-party-dress',
   'A dreamy layered tulle skirt with a satin bodice and bow sash. Sizes for ages 3–12. Made for twirling.', 6900, 35),
  ('Elegant Evening Gown', 'elegant-evening-gown',
   'Floor-length gown in flowing chiffon with a fitted waist and subtle shimmer. A red-carpet moment.', 18900, 12),
  ('Polka Dot Midi Dress', 'polka-dot-midi-dress',
   'Playful polka-dot midi with a wrap front, short sleeves and a flattering tie waist.', 8900, 28),
  ('Girls'' Cotton Sundress', 'girls-cotton-sundress',
   'Soft breathable cotton sundress with adjustable straps and a gathered skirt. Easy everyday wear for ages 2–10.', 4900, 45)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'fashion'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, v.url, TRUE
FROM products p
JOIN (VALUES
  ('floral-summer-dress',      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85'),
  ('girls-tulle-party-dress',  'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=1200&q=85'),
  ('elegant-evening-gown',     'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=85'),
  ('polka-dot-midi-dress',     'https://images.unsplash.com/photo-1612336307429-8a898d10e223?auto=format&fit=crop&w=1200&q=85'),
  ('girls-cotton-sundress',    'https://images.unsplash.com/photo-1476234251651-f353703a034d?auto=format&fit=crop&w=1200&q=85')
) AS v(slug, url) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
