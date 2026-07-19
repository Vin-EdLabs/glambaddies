-- Add Games category and sample products if missing
INSERT INTO categories (name, slug, description)
SELECT 'Games', 'games', 'Consoles, controllers and play essentials'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'games');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Wireless Pro Controller', 'wireless-pro-controller',
  'Responsive wireless controller with adaptive triggers, haptic feedback and 40-hour battery life.',
  6999, 40, TRUE
FROM categories c
WHERE c.slug = 'games'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'wireless-pro-controller');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active)
SELECT c.id, 'Compact Gaming Headset', 'compact-gaming-headset',
  'Lightweight over-ear headset with spatial audio, detachable mic and USB-C charging.',
  8999, 28, TRUE
FROM categories c
WHERE c.slug = 'games'
  AND NOT EXISTS (SELECT 1 FROM products WHERE slug = 'compact-gaming-headset');

INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, 'https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=1200&q=85', TRUE
FROM products p
WHERE p.slug = 'wireless-pro-controller'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, 'https://images.unsplash.com/photo-1612287230202-1ff1d867d123?auto=format&fit=crop&w=1200&q=85', TRUE
FROM products p
WHERE p.slug = 'compact-gaming-headset'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);
