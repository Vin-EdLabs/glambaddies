-- More rose bouquets and premium arrangements (idempotent — safe for local and production).

BEGIN;

INSERT INTO categories (name, slug, description)
SELECT 'Flowers', 'flowers', 'Fresh hand-tied bouquets for every occasion'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'flowers');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Grand Rose Bouquet — 50 Red Roses', 'grand-rose-bouquet-50-red',
   'A show-stopping armful of fifty premium long-stem red roses, hand-tied with lush greenery and finished in luxury wrap with satin ribbon.', 18900, 15),
  ('Pink Rose & Baby''s Breath Bouquet', 'pink-rose-babys-breath-bouquet',
   'Soft pink roses clouded with delicate baby''s breath — romantic, airy and effortlessly pretty. Wrapped in blush paper.', 7900, 35),
  ('White Rose Purity Bouquet', 'white-rose-purity-bouquet',
   'A serene dozen of pure white avalanche roses with silver eucalyptus. Elegant for weddings, apologies and quiet gestures.', 9500, 25),
  ('Rainbow Rose Celebration Bouquet', 'rainbow-rose-celebration-bouquet',
   'A joyful mix of red, pink, yellow, orange and lavender roses. A bouquet that celebrates every occasion at once.', 10900, 20),
  ('Yellow Rose Friendship Bunch', 'yellow-rose-friendship-bunch',
   'Bright yellow roses with solidago — the classic flower of friendship and cheer. Hand-tied and ready to gift.', 6900, 40),
  ('Red Rose & Lily Romance Bouquet', 'red-rose-lily-romance-bouquet',
   'Velvet red roses paired with fragrant oriental lilies and ruscus. A dramatic, romantic statement piece.', 12900, 18),
  ('Peach Rose Garden Bouquet', 'peach-rose-garden-bouquet',
   'Garden-style peach and cream roses with seasonal foliage. Warm, soft and beautifully understated.', 8900, 30),
  ('Lavender Rose Dream Bouquet', 'lavender-rose-dream-bouquet',
   'Rare lavender roses with silver-dollar eucalyptus and limonium. An enchanting choice for someone special.', 11900, 16)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'flowers'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, v.url, TRUE
FROM products p
JOIN (VALUES
  ('grand-rose-bouquet-50-red',        'https://images.unsplash.com/photo-1548586196-aa5803b77379?auto=format&fit=crop&w=1200&q=85'),
  ('pink-rose-babys-breath-bouquet',   'https://images.unsplash.com/photo-1487070183336-b863922373d4?auto=format&fit=crop&w=1200&q=85'),
  ('white-rose-purity-bouquet',        'https://images.unsplash.com/photo-1455659817273-f96807779a8a?auto=format&fit=crop&w=1200&q=85'),
  ('rainbow-rose-celebration-bouquet', 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85'),
  ('yellow-rose-friendship-bunch',     'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1200&q=85'),
  ('red-rose-lily-romance-bouquet',    'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=85'),
  ('peach-rose-garden-bouquet',        'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&w=1200&q=85'),
  ('lavender-rose-dream-bouquet',      'https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=1200&q=85')
) AS v(slug, url) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
