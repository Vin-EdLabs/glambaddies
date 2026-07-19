const db = require('../config/db');
const { ApiError } = require('../middleware/error');

async function fetchCart(userId) {
  const { rows } = await db.query(
    `SELECT ci.id, ci.product_id, ci.quantity,
            p.name, p.slug, p.price_cents,
            ROUND(p.price_cents / 100.0, 2) AS price,
            p.stock, p.is_active,
            (ci.quantity * p.price_cents) AS line_total_cents,
            (SELECT pi.url FROM product_images pi
             WHERE pi.product_id = p.id
             ORDER BY pi.is_primary DESC, pi.id LIMIT 1) AS image_url
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = $1
     ORDER BY ci.created_at ASC`,
    [userId]
  );
  const totalCents = rows.reduce((sum, r) => sum + Number(r.line_total_cents), 0);
  return {
    items: rows,
    total_cents: totalCents,
    total: (totalCents / 100).toFixed(2),
  };
}

// GET /api/cart
exports.get = async (req, res, next) => {
  try {
    res.json({ cart: await fetchCart(req.user.id) });
  } catch (err) {
    next(err);
  }
};

// POST /api/cart/items { product_id, quantity }
exports.addItem = async (req, res, next) => {
  try {
    const productId = Number(req.body?.product_id);
    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(productId) || productId < 1) {
      throw new ApiError(400, 'product_id is required');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, 'quantity must be a positive integer');
    }

    const product = await db.query(
      'SELECT id, stock FROM products WHERE id = $1 AND is_active = TRUE',
      [productId]
    );
    if (product.rows.length === 0) throw new ApiError(404, 'Product not found');
    if (product.rows[0].stock < quantity) {
      throw new ApiError(400, 'Insufficient stock');
    }

    // Upsert: adding an existing product increments its quantity.
    await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity,
                                      (SELECT stock FROM products WHERE id = $2)),
                     updated_at = NOW()`,
      [req.user.id, productId, quantity]
    );

    res.status(201).json({ cart: await fetchCart(req.user.id) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/cart/items/:productId { quantity }
exports.updateItem = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, 'quantity must be a positive integer');
    }

    const product = await db.query(
      'SELECT stock FROM products WHERE id = $1 AND is_active = TRUE',
      [productId]
    );
    if (product.rows.length === 0) throw new ApiError(404, 'Product not found');
    if (product.rows[0].stock < quantity) {
      throw new ApiError(400, 'Insufficient stock');
    }

    const result = await db.query(
      `UPDATE cart_items SET quantity = $1, updated_at = NOW()
       WHERE user_id = $2 AND product_id = $3`,
      [quantity, req.user.id, productId]
    );
    if (result.rowCount === 0) throw new ApiError(404, 'Item not in cart');

    res.json({ cart: await fetchCart(req.user.id) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart/items/:productId
exports.removeItem = async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [req.user.id, Number(req.params.productId)]
    );
    if (result.rowCount === 0) throw new ApiError(404, 'Item not in cart');
    res.json({ cart: await fetchCart(req.user.id) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart
exports.clear = async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.json({ cart: { items: [], total_cents: 0, total: '0.00' } });
  } catch (err) {
    next(err);
  }
};
