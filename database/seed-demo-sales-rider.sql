-- Demo sale pricing + sample rider for QA / storefront preview.
-- Safe to re-run.

BEGIN;

-- Remove test category (and any products under it)
DELETE FROM products
WHERE category_id IN (SELECT id FROM categories WHERE LOWER(slug) LIKE 'vincet%' OR LOWER(name) LIKE 'vincet%');

DELETE FROM categories
WHERE LOWER(slug) LIKE 'vincet%' OR LOWER(name) LIKE 'vincet%';

-- Curated homepage images for the six store categories
UPDATE categories SET
  home_eyebrow = 'Casual',
  home_title = 'Everyday dresses',
  home_image_url = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80'
WHERE slug = 'casual-dresses';

UPDATE categories SET
  home_eyebrow = 'Party',
  home_title = 'Celebration looks',
  home_image_url = 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80'
WHERE slug = 'party-dresses';

UPDATE categories SET
  home_eyebrow = 'School',
  home_title = 'Smart day dresses',
  home_image_url = 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=600&q=80'
WHERE slug = 'school-dresses';

UPDATE categories SET
  home_eyebrow = 'Bags',
  home_title = 'Carry the look',
  home_image_url = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80'
WHERE slug = 'bags';

UPDATE categories SET
  home_eyebrow = 'Shoes',
  home_title = 'Step into glam',
  home_image_url = 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80'
WHERE slug = 'shoes';

UPDATE categories SET
  home_eyebrow = 'Beauty',
  home_title = 'Tiny essentials',
  home_image_url = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80'
WHERE slug = 'beauty';

-- Put a few dresses on sale so the storefront/admin UI is visible
UPDATE products
SET compare_at_price_cents = 39900,
    discount_percent = 25,
    price_cents = 29900,
    is_on_sale = TRUE,
    sale_ends_at = NOW() + INTERVAL '2 days',
    updated_at = NOW()
WHERE slug = 'floral-summer-dress'
   OR name = 'Floral Summer Dress';

UPDATE products
SET compare_at_price_cents = 44900,
    discount_percent = 22,
    price_cents = 34900,
    is_on_sale = TRUE,
    sale_ends_at = NOW() + INTERVAL '36 hours',
    updated_at = NOW()
WHERE slug = 'girls-tulle-party-dress'
   OR name ILIKE '%Tulle Party%';

UPDATE products
SET compare_at_price_cents = 32900,
    discount_percent = 30,
    price_cents = 22900,
    is_on_sale = TRUE,
    sale_ends_at = NOW() + INTERVAL '5 days',
    updated_at = NOW()
WHERE slug = 'navy-uniform-day-dress'
   OR name = 'Navy Uniform Day Dress';

-- Assign a sample rider on the latest non-cancelled order and mark shipped
UPDATE orders
SET status = 'shipped',
    rider_name = 'Ama Mensah',
    rider_phone = '0244123456',
    rider_photo_url = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
    rider_assigned_at = NOW(),
    updated_at = NOW()
WHERE id = (
  SELECT id FROM orders
  WHERE status IS DISTINCT FROM 'cancelled'
  ORDER BY created_at DESC
  LIMIT 1
);

UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
