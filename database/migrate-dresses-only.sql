-- GlamBaddies — keep ONLY three dress categories.
-- Removes flowers, jewellery, food/fruit, games, electronics, fashion, beauty,
-- generic "dresses" parent category, and any other non-dress catalogue junk.
--
-- Safe to re-run. Apply with:
--   npm run migrate
--   node backend/scripts/apply-sql.js database/migrate-dresses-only.sql

BEGIN;

-- Ensure the three dress categories exist
INSERT INTO categories (name, slug, description)
SELECT 'Casual Dresses', 'casual-dresses', 'Everyday and weekend dresses'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'casual-dresses');

INSERT INTO categories (name, slug, description)
SELECT 'Party Dresses', 'party-dresses', 'Celebration and special-occasion dresses'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'party-dresses');

INSERT INTO categories (name, slug, description)
SELECT 'School Dresses', 'school-dresses', 'Smart uniforms and school-day dresses'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'school-dresses');

-- Move leftover products from the old parent "dresses" bucket into Casual
UPDATE products p
SET category_id = c_new.id,
    updated_at = NOW()
FROM categories c_old
JOIN categories c_new ON c_new.slug = 'casual-dresses'
WHERE p.category_id = c_old.id
  AND c_old.slug = 'dresses';

-- Hard-delete every product that is NOT in the three dress categories
-- (order_items.product_id is ON DELETE SET NULL — history is preserved)
DELETE FROM product_images
WHERE product_id IN (
  SELECT p.id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE c.slug IS NULL
     OR c.slug NOT IN ('casual-dresses', 'party-dresses', 'school-dresses')
);

DELETE FROM cart_items
WHERE product_id IN (
  SELECT p.id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE c.slug IS NULL
     OR c.slug NOT IN ('casual-dresses', 'party-dresses', 'school-dresses')
);

DELETE FROM products
WHERE id IN (
  SELECT p.id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE c.slug IS NULL
     OR c.slug NOT IN ('casual-dresses', 'party-dresses', 'school-dresses')
);

-- Remove every category that is not one of the three dress categories
DELETE FROM categories
WHERE slug NOT IN ('casual-dresses', 'party-dresses', 'school-dresses');

-- Normalise names/descriptions for the three that remain
UPDATE categories SET name = 'Casual Dresses', description = 'Everyday and weekend dresses'
WHERE slug = 'casual-dresses';
UPDATE categories SET name = 'Party Dresses', description = 'Celebration and special-occasion dresses'
WHERE slug = 'party-dresses';
UPDATE categories SET name = 'School Dresses', description = 'Smart uniforms and school-day dresses'
WHERE slug = 'school-dresses';

-- Bust storefront catalogue caches
UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
