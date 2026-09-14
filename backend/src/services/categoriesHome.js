const db = require('../config/db');

const DEFAULT_HOME_BY_SLUG = {
  'casual-dresses': {
    home_eyebrow: 'Casual',
    home_title: 'Everyday dresses',
    home_image_url: '/edit-casual.jpg',
  },
  'party-dresses': {
    home_eyebrow: 'Party',
    home_title: 'Celebration looks',
    home_image_url: '/edit-party.jpg',
  },
  'school-dresses': {
    home_eyebrow: 'School',
    home_title: 'Smart day dresses',
    home_image_url: '/edit-school.jpg',
  },
};

function defaultHomeFields(name, slug) {
  const known = DEFAULT_HOME_BY_SLUG[slug];
  if (known) return { ...known };
  const cleanName = String(name || 'Dresses').trim();
  const eyebrow = cleanName.split(/\s+/)[0] || 'Shop';
  return {
    home_eyebrow: eyebrow.slice(0, 40),
    home_title: cleanName.slice(0, 80),
    home_image_url: '/edit-casual.jpg',
  };
}

let homeColumnsEnsured = false;

// Runs the (one-time) schema migration + legacy-data backfill below. This used to
// run on every /api/categories request — several ALTER/SELECT/UPDATE round trips
// per page load — which was the main source of the homepage feeling slow. It only
// needs to happen once per server process; the flag makes every later call a no-op.
async function ensureCategoryHomeColumns() {
  if (homeColumnsEnsured) return;

  await db.query(`
    ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS home_image_url TEXT,
      ADD COLUMN IF NOT EXISTS home_eyebrow VARCHAR(40),
      ADD COLUMN IF NOT EXISTS home_title VARCHAR(80)
  `);

  // Seed known defaults once when columns are empty.
  for (const [slug, defaults] of Object.entries(DEFAULT_HOME_BY_SLUG)) {
    await db.query(
      `UPDATE categories
       SET home_image_url = COALESCE(NULLIF(home_image_url, ''), $2),
           home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), $3),
           home_title = COALESCE(NULLIF(home_title, ''), $4)
       WHERE slug = $1`,
      [slug, defaults.home_image_url, defaults.home_eyebrow, defaults.home_title]
    );
  }

  // Fill any remaining empty category home fields from the category name.
  const { rows } = await db.query(
    `SELECT id, name, slug, home_image_url, home_eyebrow, home_title
     FROM categories
     WHERE home_image_url IS NULL
        OR home_image_url = ''
        OR home_eyebrow IS NULL
        OR home_eyebrow = ''
        OR home_title IS NULL
        OR home_title = ''`
  );

  for (const row of rows) {
    const defaults = defaultHomeFields(row.name, row.slug);
    await db.query(
      `UPDATE categories
       SET home_image_url = COALESCE(NULLIF(home_image_url, ''), $2),
           home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), $3),
           home_title = COALESCE(NULLIF(home_title, ''), $4)
       WHERE id = $1`,
      [
        row.id,
        defaults.home_image_url,
        defaults.home_eyebrow,
        defaults.home_title,
      ]
    );
  }

  // One-time merge from legacy store_settings.homepage_features when present.
  try {
    const { rows: settingsRows } = await db.query(
      `SELECT homepage_features FROM store_settings WHERE id = 1`
    );
    const raw = settingsRows[0]?.homepage_features;
    let list = raw;
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {
        list = [];
      }
    }
    if (Array.isArray(list)) {
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const slug = String(item.category_slug || '')
          .trim()
          .toLowerCase();
        if (!slug) continue;
        await db.query(
          `UPDATE categories
           SET home_image_url = COALESCE(NULLIF(home_image_url, ''), NULLIF($2, ''), home_image_url),
               home_eyebrow = COALESCE(NULLIF(home_eyebrow, ''), NULLIF($3, ''), home_eyebrow),
               home_title = COALESCE(NULLIF(home_title, ''), NULLIF($4, ''), home_title)
           WHERE slug = $1`,
          [
            slug,
            String(item.image_url || '').trim().slice(0, 500),
            String(item.eyebrow || '').trim().slice(0, 40),
            String(item.title || '').trim().slice(0, 80),
          ]
        );
      }
    }
  } catch {
    // store_settings may not exist yet on brand-new installs
  }

  homeColumnsEnsured = true;
}

function mapCategoryHome(row) {
  const defaults = defaultHomeFields(row.name, row.slug);
  return {
    ...row,
    home_image_url: row.home_image_url || defaults.home_image_url,
    home_eyebrow: row.home_eyebrow || defaults.home_eyebrow,
    home_title: row.home_title || defaults.home_title,
  };
}

function categoryToHomepageFeature(row) {
  const mapped = mapCategoryHome(row);
  return {
    id: `category-${mapped.id}`,
    category_id: mapped.id,
    category_slug: mapped.slug,
    eyebrow: mapped.home_eyebrow,
    title: mapped.home_title,
    image_url: mapped.home_image_url,
  };
}

async function listHomepageFeatures() {
  await ensureCategoryHomeColumns();
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.slug, c.home_image_url, c.home_eyebrow, c.home_title
     FROM categories c
     ORDER BY
       CASE c.slug
         WHEN 'casual-dresses' THEN 1
         WHEN 'party-dresses' THEN 2
         WHEN 'school-dresses' THEN 3
         WHEN 'bags' THEN 4
         WHEN 'shoes' THEN 5
         WHEN 'beauty' THEN 6
         ELSE 9
       END,
       c.name ASC`
  );
  return rows.map(categoryToHomepageFeature);
}

module.exports = {
  DEFAULT_HOME_BY_SLUG,
  defaultHomeFields,
  ensureCategoryHomeColumns,
  mapCategoryHome,
  categoryToHomepageFeature,
  listHomepageFeatures,
};
