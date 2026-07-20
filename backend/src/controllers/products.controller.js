const db = require('../config/db');
const { ApiError } = require('../middleware/error');
const { parsePagination, toCents } = require('../utils/helpers');

const SORTS = {
  newest: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  price_asc: 'p.price_cents ASC',
  price_desc: 'p.price_cents DESC',
  name_asc: 'LOWER(p.name) ASC',
  name_desc: 'LOWER(p.name) DESC',
};

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.slug, p.description, p.price_cents,
         ROUND(p.price_cents / 100.0, 2) AS price,
         p.stock, p.is_active, p.created_at,
         c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
         COALESCE(
           (SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url, 'is_primary', pi.is_primary)
                            ORDER BY pi.is_primary DESC, pi.id)
            FROM product_images pi WHERE pi.product_id = p.id),
           '[]'::json
         ) AS images
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

// GET /api/products?q=&category=&min_price=&max_price=&sort=&page=&limit=
exports.list = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = ['p.is_active = TRUE'];
    const params = [];

    if (req.query.q) {
      params.push(`%${req.query.q.trim()}%`);
      conditions.push(
        `(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`
      );
    }
    if (req.query.category) {
      params.push(req.query.category);
      conditions.push(
        `(c.slug = $${params.length} OR c.id::text = $${params.length})`
      );
    }
    const minCents = toCents(req.query.min_price);
    if (req.query.min_price !== undefined && minCents !== null) {
      params.push(minCents);
      conditions.push(`p.price_cents >= $${params.length}`);
    }
    const maxCents = toCents(req.query.max_price);
    if (req.query.max_price !== undefined && maxCents !== null) {
      params.push(maxCents);
      conditions.push(`p.price_cents <= $${params.length}`);
    }
    if (req.query.in_stock === 'true') {
      conditions.push('p.stock > 0');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const orderBy = SORTS[req.query.sort] || SORTS.newest;

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${where}`,
      params
    );
    const total = countResult.rows[0].total;

    const { rows } = await db.query(
      `${PRODUCT_SELECT} ${where} ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.json({
      products: rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:idOrSlug
exports.getOne = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const byId = /^\d+$/.test(idOrSlug);
    const { rows } = await db.query(
      `${PRODUCT_SELECT} WHERE p.is_active = TRUE AND ${
        byId ? 'p.id = $1' : 'p.slug = $1'
      }`,
      [byId ? Number(idOrSlug) : idOrSlug]
    );
    if (rows.length === 0) throw new ApiError(404, 'Product not found');
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.json({ product: rows[0] });
  } catch (err) {
    next(err);
  }
};
