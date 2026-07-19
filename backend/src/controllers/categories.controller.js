const db = require('../config/db');
const { ApiError } = require('../middleware/error');

// GET /api/categories
exports.list = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.slug, c.description,
              COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/categories/:idOrSlug
exports.getOne = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const byId = /^\d+$/.test(idOrSlug);
    const { rows } = await db.query(
      `SELECT id, name, slug, description, created_at
       FROM categories WHERE ${byId ? 'id = $1' : 'slug = $1'}`,
      [byId ? Number(idOrSlug) : idOrSlug]
    );
    if (rows.length === 0) throw new ApiError(404, 'Category not found');
    res.json({ category: rows[0] });
  } catch (err) {
    next(err);
  }
};
