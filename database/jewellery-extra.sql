-- More fine jewellery (idempotent — safe for local and production).
-- Necklaces, earrings, bracelets and watches in the Jewellery category.

BEGIN;

INSERT INTO categories (name, slug, description)
SELECT 'Jewellery', 'jewellery', 'Fine gold and diamond jewellery'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'jewellery');

INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, created_at)
SELECT c.id, v.name, v.slug, v.description, v.price_cents, v.stock, TRUE, NOW()
FROM categories c
CROSS JOIN (VALUES
  ('Gold Pendant Necklace', 'gold-pendant-necklace',
   'Delicate 18k gold chain with a polished teardrop pendant. Sits beautifully alone or layered. 45cm with extender.', 64900, 18),
  ('Diamond Tennis Bracelet', 'diamond-tennis-bracelet',
   'Classic line bracelet set with brilliant-cut diamonds in 18k white gold. Secure double-clasp closure.', 159900, 6),
  ('Pearl Drop Earrings', 'pearl-drop-earrings',
   'Freshwater pearls suspended from 18k gold huggie hoops. Effortless elegance for day or evening.', 38900, 22),
  ('Gold Cuban Link Chain', 'gold-cuban-link-chain',
   'Solid 18k gold Cuban link chain, 5mm width, 55cm length. A statement staple with a mirror polish.', 219900, 8),
  ('Diamond Stud Earrings', 'diamond-stud-earrings',
   'Timeless round brilliant diamond studs, 0.3ct total, four-claw 18k gold settings with butterfly backs.', 79900, 15),
  ('Emerald & Gold Ring', 'emerald-gold-ring',
   'Vivid emerald centre stone flanked by diamond shoulders on an 18k yellow gold band.', 134900, 7),
  ('Rose Gold Bangle', 'rose-gold-bangle',
   'Slim polished bangle in 18k rose gold with a hidden hinge clasp. Made to stack or shine solo.', 54900, 20),
  ('Sapphire Halo Pendant', 'sapphire-halo-pendant',
   'Deep blue sapphire wrapped in a diamond halo on an 18k white gold chain. Gift box included.', 114900, 9)
) AS v(name, slug, description, price_cents, stock)
WHERE c.slug = 'jewellery'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = v.slug);

INSERT INTO product_images (product_id, url, is_primary)
SELECT p.id, v.url, TRUE
FROM products p
JOIN (VALUES
  ('gold-pendant-necklace',    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=85'),
  ('diamond-tennis-bracelet',  'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=85'),
  ('pearl-drop-earrings',      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=85'),
  ('gold-cuban-link-chain',    'https://images.unsplash.com/photo-1610694955371-d4a3e0ce4b52?auto=format&fit=crop&w=1200&q=85'),
  ('diamond-stud-earrings',    'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=85'),
  ('emerald-gold-ring',        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=85'),
  ('rose-gold-bangle',         'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=85'),
  ('sapphire-halo-pendant',    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85')
) AS v(slug, url) ON v.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);

UPDATE store_settings
SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
WHERE id = 1;

COMMIT;
