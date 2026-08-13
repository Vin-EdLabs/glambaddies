const db = require('../config/db');
const { ApiError } = require('../middleware/error');
const {
  ensureCategoryHomeColumns,
  mapCategoryHome,
  listHomepageFeatures,
} = require('../services/categoriesHome');

// GET /api/categories — all storefront categories (with homepage tile fields)
exports.list = async (req, res, next) => {
  try {
    await ensureCategoryHomeColumns();
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.slug, c.description,
              c.home_image_url, c.home_eyebrow, c.home_title,
              COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
       GROUP BY c.id
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
    res.json({
      categories: rows.map(mapCategoryHome),
      homepage_features: rows.map((row) => {
        const mapped = mapCategoryHome(row);
        return {
          id: `category-${mapped.id}`,
          category_id: mapped.id,
          category_slug: mapped.slug,
          eyebrow: mapped.home_eyebrow,
          title: mapped.home_title,
          image_url: mapped.home_image_url,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/categories/:idOrSlug
exports.getOne = async (req, res, next) => {
  try {
    await ensureCategoryHomeColumns();
    const { idOrSlug } = req.params;
    const byId = /^\d+$/.test(idOrSlug);
    const { rows } = await db.query(
      `SELECT id, name, slug, description, created_at,
              home_image_url, home_eyebrow, home_title
       FROM categories WHERE ${byId ? 'id = $1' : 'slug = $1'}`,
      [byId ? Number(idOrSlug) : idOrSlug]
    );
    if (rows.length === 0) throw new ApiError(404, 'Category not found');
    res.json({ category: mapCategoryHome(rows[0]) });
  } catch (err) {
    next(err);
  }
};

exports.listHomepageFeatures = listHomepageFeatures;
