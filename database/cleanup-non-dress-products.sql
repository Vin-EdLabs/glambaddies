-- GlamBaddies — delete leftover non-dress products only.
-- Keeps girls' dress catalogue rows; does not modify categories or other tables.
-- product_images / cart_items cascade from products; order_items.product_id is SET NULL.
--
-- Apply on production:
--   psql -U glambaddies_user -d glambaddies_db -h localhost \
--     -f /var/www/glambaddies/database/cleanup-non-dress-products.sql
--   pm2 restart glambaddies

BEGIN;

DELETE FROM products
WHERE id IN (
  SELECT p.id
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE
    -- No category, or clearly leftover previous-store categories
    c.id IS NULL
    OR LOWER(COALESCE(c.slug, '')) IN (
      'food',
      'fruits',
      'fruit',
      'electronics',
      'beauty',
      'home',
      'home-living',
      'games',
      'sneakers',
      'jackets',
      'bags',
      'trousers',
      'fashion',
      'sports'
    )
    -- Or category is not dress-related
    OR NOT (
      LOWER(c.slug) IN (
        'girls-dresses',
        'party-dresses',
        'casual-dresses',
        'school-dresses',
        'occasion-dresses',
        'dresses'
      )
      OR LOWER(c.slug) LIKE '%dress%'
      OR LOWER(COALESCE(c.name, '')) LIKE '%dress%'
    )
);

COMMIT;
