const db = require('../config/db');

let ensured = false;

/** Ensure sale + rider columns and accessory categories exist (idempotent). */
async function ensureCatalogueExtras() {
  if (ensured) return;
  await db.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER,
      ADD COLUMN IF NOT EXISTS discount_percent INTEGER,
      ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await db.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS rider_name VARCHAR(120),
      ADD COLUMN IF NOT EXISTS rider_phone VARCHAR(40),
      ADD COLUMN IF NOT EXISTS rider_photo_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMPTZ
  `);
  try {
    await db.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check`);
    await db.query(`
      ALTER TABLE orders
        ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'paid', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'))
    `);
  } catch {
    /* constraint may already match */
  }

  await db.query(`
    INSERT INTO categories (name, slug, description)
    SELECT 'Bags', 'bags', 'Handbags, mini bags and glam essentials'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'bags')
  `);
  await db.query(`
    INSERT INTO categories (name, slug, description)
    SELECT 'Shoes', 'shoes', 'Shoes and heels for every glam moment'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'shoes')
  `);
  await db.query(`
    INSERT INTO categories (name, slug, description)
    SELECT 'Beauty & Accessories', 'beauty', 'Sunglasses, makeup, jewellery and girls tiny essentials'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'beauty')
  `);

  // Homepage tile images for accessory categories (replaceable anytime in admin)
  try {
    await db.query(`
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS home_image_url TEXT,
        ADD COLUMN IF NOT EXISTS home_eyebrow VARCHAR(40),
        ADD COLUMN IF NOT EXISTS home_title VARCHAR(80)
    `);
    await db.query(`
      UPDATE categories SET
        home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Bags'),
        home_title = COALESCE(NULLIF(home_title, ''), 'Carry the look'),
        home_image_url = COALESCE(
          NULLIF(home_image_url, ''),
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85'
        )
      WHERE slug = 'bags'
    `);
    await db.query(`
      UPDATE categories SET
        home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Shoes'),
        home_title = COALESCE(NULLIF(home_title, ''), 'Step into glam'),
        home_image_url = COALESCE(
          NULLIF(home_image_url, ''),
          'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=85'
        )
      WHERE slug = 'shoes'
    `);
    await db.query(`
      UPDATE categories SET
        home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), 'Beauty'),
        home_title = COALESCE(NULLIF(home_title, ''), 'Makeup & tiny essentials'),
        home_image_url = COALESCE(
          NULLIF(home_image_url, ''),
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85'
        )
      WHERE slug = 'beauty'
    `);
  } catch {
    /* older schemas without home_* columns */
  }

  ensured = true;
}

const SALE_SELECT = `
  p.compare_at_price_cents,
  p.discount_percent,
  p.sale_ends_at,
  CASE
    WHEN p.is_on_sale = TRUE
     AND p.compare_at_price_cents IS NOT NULL
     AND p.compare_at_price_cents > p.price_cents
     AND (p.sale_ends_at IS NULL OR p.sale_ends_at > NOW())
    THEN TRUE
    ELSE FALSE
  END AS is_on_sale,
  CASE
    WHEN p.is_on_sale = TRUE
     AND p.compare_at_price_cents IS NOT NULL
     AND p.compare_at_price_cents > p.price_cents
    THEN ROUND(p.compare_at_price_cents / 100.0, 2)
    ELSE NULL
  END AS compare_at_price
`;

module.exports = {
  ensureCatalogueExtras,
  SALE_SELECT,
};
