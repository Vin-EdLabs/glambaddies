const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { ApiError } = require('../middleware/error');
const { UPLOAD_DIR } = require('../middleware/upload');
const { slugify, parsePagination, toCents } = require('../utils/helpers');

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

// POST /api/vince-77-00/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new ApiError(400, 'email and password are required');
    }

    const { rows } = await db.query(
      'SELECT id, name, email, password_hash FROM admins WHERE email = $1',
      [email.toLowerCase()]
    );
    const admin = rows[0];
    const ok = admin && (await bcrypt.compare(password, admin.password_hash));
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: 'admin' },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h' }
    );
    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/vince-77-00/dashboard
exports.dashboard = async (req, res, next) => {
  try {
    const { getPurchasesEnabled } = require('./store.controller');
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users)    AS total_users,
        (SELECT COUNT(*)::int FROM products WHERE is_active) AS active_products,
        (SELECT COUNT(*)::int FROM orders)   AS total_orders,
        (SELECT COUNT(*)::int FROM orders WHERE status = 'pending') AS pending_orders,
        (SELECT COALESCE(SUM(total_cents), 0)::bigint
         FROM orders WHERE status IN ('paid', 'shipped', 'delivered')) AS revenue_cents
    `);
    const purchases_enabled = await getPurchasesEnabled();
    res.json({ stats: { ...rows[0], purchases_enabled } });
  } catch (err) {
    next(err);
  }
};

// GET /api/vince-77-00/analytics — chart series for admin analytics page
exports.analytics = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);

    const [summary, daily, statusRows, topProducts] = await Promise.all([
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM orders) AS total_orders,
          (SELECT COUNT(*)::int FROM orders WHERE status = 'pending') AS pending_orders,
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM products WHERE is_active) AS active_products,
          (SELECT COALESCE(SUM(total_cents), 0)::bigint
           FROM orders WHERE status IN ('paid', 'shipped', 'delivered')) AS revenue_cents,
          (SELECT COALESCE(AVG(total_cents), 0)::bigint
           FROM orders WHERE status IN ('paid', 'shipped', 'delivered')) AS avg_order_cents
      `),
      db.query(
        `
        WITH days AS (
          SELECT generate_series(
            (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')::date,
            CURRENT_DATE,
            '1 day'::interval
          )::date AS day
        )
        SELECT
          d.day,
          COALESCE(SUM(o.total_cents) FILTER (
            WHERE o.status IN ('paid', 'shipped', 'delivered')
          ), 0)::bigint AS revenue_cents,
          COUNT(o.id)::int AS order_count
        FROM days d
        LEFT JOIN orders o ON o.created_at::date = d.day
        GROUP BY d.day
        ORDER BY d.day ASC
        `,
        [days]
      ),
      db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM orders
        GROUP BY status
        ORDER BY count DESC
      `),
      db.query(`
        SELECT
          oi.product_name,
          SUM(oi.quantity)::int AS units,
          COALESCE(SUM(oi.unit_price_cents * oi.quantity), 0)::bigint AS revenue_cents
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status IN ('paid', 'shipped', 'delivered')
        GROUP BY oi.product_name
        ORDER BY revenue_cents DESC
        LIMIT 5
      `),
    ]);

    const statusMap = Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, 0])
    );
    for (const row of statusRows.rows) {
      statusMap[row.status] = row.count;
    }

    res.json({
      stats: summary.rows[0],
      daily: daily.rows.map((row) => ({
        day: row.day,
        revenue_cents: Number(row.revenue_cents),
        order_count: row.order_count,
      })),
      status: statusMap,
      top_products: topProducts.rows.map((row) => ({
        name: row.product_name,
        units: row.units,
        revenue_cents: Number(row.revenue_cents),
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/vince-77-00/settings
exports.getSettings = async (req, res, next) => {
  try {
    const { getSettingsRow, publicSettingsPayload } = require('./store.controller');
    const row = await getSettingsRow();
    res.json(publicSettingsPayload(row));
  } catch (err) {
    next(err);
  }
};

// PUT /api/vince-77-00/settings { purchases_enabled?: boolean, payment_mode?, keys..., usd_to_ghs_rate? }
exports.updateSettings = async (req, res, next) => {
  try {
    const {
      ensureSettings,
      getSettingsRow,
      publicSettingsPayload,
      verifyPaystackMode,
    } = require('./store.controller');
    await ensureSettings();

    const body = req.body || {};
    const current = await getSettingsRow();
    const updates = [];
    const values = [];

    if (typeof body.purchases_enabled === 'boolean') {
      values.push(body.purchases_enabled);
      updates.push(`purchases_enabled = $${values.length}`);
    }

    if (body.payment_mode !== undefined) {
      if (!['test', 'live'].includes(body.payment_mode)) {
        throw new ApiError(400, 'payment_mode must be "test" or "live"');
      }
      values.push(body.payment_mode);
      updates.push(`payment_mode = $${values.length}`);
    }

    // Accept common aliases so the Store rate form always persists.
    const rawRate =
      body.usd_to_ghs_rate ?? body.exchange_rate ?? body.rate;
    if (rawRate !== undefined && rawRate !== null && rawRate !== '') {
      const rate = Number(rawRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new ApiError(400, 'usd_to_ghs_rate must be a positive number');
      }
      values.push(rate);
      updates.push(`usd_to_ghs_rate = $${values.length}`);
    }

    const keyFields = [
      'paystack_test_public_key',
      'paystack_test_secret_key',
      'paystack_live_public_key',
      'paystack_live_secret_key',
    ];
    for (const field of keyFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string') {
          throw new ApiError(400, `${field} must be a string`);
        }
        values.push(body[field].trim());
        updates.push(`${field} = $${values.length}`);
      }
    }

    // Convenience: save the two visible fields into the active mode bucket.
    if (body.paystack_public_key !== undefined || body.paystack_secret_key !== undefined) {
      const mode =
        body.payment_mode ||
        current.payment_mode ||
        'test';
      if (!['test', 'live'].includes(mode)) {
        throw new ApiError(400, 'payment_mode must be "test" or "live"');
      }
      if (body.paystack_public_key !== undefined) {
        if (typeof body.paystack_public_key !== 'string') {
          throw new ApiError(400, 'paystack_public_key must be a string');
        }
        values.push(body.paystack_public_key.trim());
        updates.push(
          mode === 'live'
            ? `paystack_live_public_key = $${values.length}`
            : `paystack_test_public_key = $${values.length}`
        );
      }
      if (body.paystack_secret_key !== undefined) {
        if (typeof body.paystack_secret_key !== 'string') {
          throw new ApiError(400, 'paystack_secret_key must be a string');
        }
        values.push(body.paystack_secret_key.trim());
        updates.push(
          mode === 'live'
            ? `paystack_live_secret_key = $${values.length}`
            : `paystack_test_secret_key = $${values.length}`
        );
      }
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No settings fields to update');
    }

    const nextMode =
      body.payment_mode ||
      current.payment_mode ||
      'test';
    const nextTestPublic =
      body.paystack_test_public_key !== undefined
        ? String(body.paystack_test_public_key).trim()
        : body.payment_mode === 'test' && body.paystack_public_key !== undefined
          ? String(body.paystack_public_key).trim()
          : current.paystack_test_public_key || '';
    const nextTestSecret =
      body.paystack_test_secret_key !== undefined
        ? String(body.paystack_test_secret_key).trim()
        : body.payment_mode === 'test' && body.paystack_secret_key !== undefined
          ? String(body.paystack_secret_key).trim()
          : current.paystack_test_secret_key || '';
    const nextLivePublic =
      body.paystack_live_public_key !== undefined
        ? String(body.paystack_live_public_key).trim()
        : body.payment_mode === 'live' && body.paystack_public_key !== undefined
          ? String(body.paystack_public_key).trim()
          : current.paystack_live_public_key || '';
    const nextLiveSecret =
      body.paystack_live_secret_key !== undefined
        ? String(body.paystack_live_secret_key).trim()
        : body.payment_mode === 'live' && body.paystack_secret_key !== undefined
          ? String(body.paystack_secret_key).trim()
          : current.paystack_live_secret_key || '';

    const touchedPayments =
      body.payment_mode !== undefined ||
      body.paystack_public_key !== undefined ||
      body.paystack_secret_key !== undefined ||
      body.paystack_test_public_key !== undefined ||
      body.paystack_test_secret_key !== undefined ||
      body.paystack_live_public_key !== undefined ||
      body.paystack_live_secret_key !== undefined;

    let verification = null;
    if (touchedPayments) {
      const publicKey = nextMode === 'live' ? nextLivePublic : nextTestPublic;
      const secretKey = nextMode === 'live' ? nextLiveSecret : nextTestSecret;
      // Live mode: must prove keys are real live keys with Paystack before saving.
      // Test mode: same check so we never silently accept the wrong key type.
      verification = await verifyPaystackMode(nextMode, publicKey, secretKey);
    }

    updates.push('updated_at = NOW()');
    const { rows } = await db.query(
      `UPDATE store_settings
       SET ${updates.join(', ')}
       WHERE id = 1
       RETURNING *`,
      values
    );

    const payload = publicSettingsPayload(rows[0]);
    const rateWasUpdated = rawRate !== undefined && rawRate !== null && rawRate !== '';

    let message = 'Settings saved';
    if (typeof body.purchases_enabled === 'boolean' && !touchedPayments && !rateWasUpdated) {
      message = payload.purchases_enabled
        ? 'Purchases are now enabled'
        : 'Purchases are now paused. Customers cannot check out.';
    } else if (verification) {
      message = verification.message;
    } else if (rateWasUpdated && !touchedPayments) {
      message = `USD → GHS rate updated to ${payload.usd_to_ghs_rate}`;
    }

    res.json({
      ...payload,
      message,
      payment_verified: Boolean(verification?.verified),
      live_confirmed: payload.payment_mode === 'live' && Boolean(verification?.verified),
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/vince-77-00/settings/rate { usd_to_ghs_rate | rate | exchange_rate }
exports.updateExchangeRate = async (req, res, next) => {
  try {
    const {
      ensureSettings,
      publicSettingsPayload,
    } = require('./store.controller');
    await ensureSettings();

    const body = req.body || {};
    const rawRate = body.usd_to_ghs_rate ?? body.exchange_rate ?? body.rate;
    const rate = Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ApiError(400, 'Enter a valid USD → GHS rate greater than 0');
    }

    const { rows } = await db.query(
      `UPDATE store_settings
       SET usd_to_ghs_rate = $1, updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [rate]
    );

    if (rows.length === 0) {
      // Row missing — ensure + retry once.
      await ensureSettings();
      const retry = await db.query(
        `UPDATE store_settings
         SET usd_to_ghs_rate = $1, updated_at = NOW()
         WHERE id = 1
         RETURNING *`,
        [rate]
      );
      if (retry.rows.length === 0) {
        throw new ApiError(500, 'Could not save exchange rate — store settings row missing');
      }
      const payload = publicSettingsPayload(retry.rows[0]);
      return res.json({
        ...payload,
        message: `USD → GHS rate updated to ${payload.usd_to_ghs_rate}`,
      });
    }

    const payload = publicSettingsPayload(rows[0]);
    res.json({
      ...payload,
      message: `USD → GHS rate updated to ${payload.usd_to_ghs_rate}`,
    });
  } catch (err) {
    // Column may be missing on older DBs — add it and retry once.
    if (err && err.code === '42703') {
      try {
        await db.query(`
          ALTER TABLE store_settings
            ADD COLUMN IF NOT EXISTS usd_to_ghs_rate NUMERIC(12,4) NOT NULL DEFAULT 15.5
        `);
        const body = req.body || {};
        const rate = Number(body.usd_to_ghs_rate ?? body.exchange_rate ?? body.rate);
        const { rows } = await db.query(
          `UPDATE store_settings
           SET usd_to_ghs_rate = $1, updated_at = NOW()
           WHERE id = 1
           RETURNING *`,
          [rate]
        );
        const { publicSettingsPayload } = require('./store.controller');
        const payload = publicSettingsPayload(rows[0]);
        return res.json({
          ...payload,
          message: `USD → GHS rate updated to ${payload.usd_to_ghs_rate}`,
        });
      } catch (retryErr) {
        return next(retryErr);
      }
    }
    next(err);
  }
};

/* ------------------------------ products ------------------------------ */

function parseProductBody(body, { partial = false } = {}) {
  const fields = {};
  if (body.name !== undefined || !partial) {
    if (!body.name || !String(body.name).trim()) {
      throw new ApiError(400, 'name is required');
    }
    fields.name = String(body.name).trim();
  }
  if (body.description !== undefined) {
    fields.description = String(body.description);
  }
  if (body.price !== undefined || !partial) {
    const cents = toCents(body.price);
    if (cents === null) throw new ApiError(400, 'price must be a non-negative number');
    fields.price_cents = cents;
  }
  if (body.stock !== undefined || !partial) {
    const stock = Number(body.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ApiError(400, 'stock must be a non-negative integer');
    }
    fields.stock = stock;
  }
  if (body.category_id !== undefined) {
    fields.category_id =
      body.category_id === null || body.category_id === ''
        ? null
        : Number(body.category_id);
    if (fields.category_id !== null && !Number.isInteger(fields.category_id)) {
      throw new ApiError(400, 'category_id must be an integer or null');
    }
  }
  if (body.is_active !== undefined) {
    fields.is_active = body.is_active === true || body.is_active === 'true';
  }
  return fields;
}

async function insertImages(productId, files) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const url = `/uploads/${files[i].filename}`;
    await db.query(
      `INSERT INTO product_images (product_id, url, is_primary)
       VALUES ($1, $2, (SELECT COUNT(*) = 0 FROM product_images WHERE product_id = $1))`,
      [productId, url]
    );
    urls.push(url);
  }
  return urls;
}

// GET /api/vince-77-00/products (active by default; ?include_inactive=1 for drafts)
exports.listProducts = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const includeInactive =
      req.query.include_inactive === '1' || req.query.include_inactive === 'true';
    const where = includeInactive ? '' : 'WHERE p.is_active IS TRUE';
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM products p ${where}`
    );
    const { rows } = await db.query(
      `SELECT p.*, ROUND(p.price_cents / 100.0, 2) AS price, c.name AS category_name,
              COALESCE((SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url))
                        FROM product_images pi WHERE pi.product_id = p.id), '[]'::json) AS images
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.json({
      products: rows,
      pagination: { page, limit, total: countResult.rows[0].total },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/vince-77-00/products  (multipart/form-data, images[] optional)
exports.createProduct = async (req, res, next) => {
  try {
    const fields = parseProductBody(req.body || {});
    const slug = `${slugify(fields.name)}-${Date.now().toString(36)}`;

    const { rows } = await db.query(
      `INSERT INTO products (name, slug, description, price_cents, stock, category_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *, ROUND(price_cents / 100.0, 2) AS price`,
      [
        fields.name,
        slug,
        fields.description || '',
        fields.price_cents,
        fields.stock,
        fields.category_id ?? null,
        fields.is_active ?? true,
      ]
    );
    const product = rows[0];
    product.images = await insertImages(product.id, req.files || []);
    const { bumpCatalogueRevision } = require('./store.controller');
    await bumpCatalogueRevision();
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
};

// PUT /api/vince-77-00/products/:id  (multipart/form-data, images[] appended)
exports.updateProduct = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const fields = parseProductBody(req.body || {}, { partial: true });

    const sets = [];
    const params = [];
    for (const [column, value] of Object.entries(fields)) {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }

    if (sets.length === 0 && (!req.files || req.files.length === 0)) {
      throw new ApiError(400, 'No fields to update');
    }

    let product;
    if (sets.length > 0) {
      params.push(id);
      const { rows } = await db.query(
        `UPDATE products SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length}
         RETURNING *, ROUND(price_cents / 100.0, 2) AS price`,
        params
      );
      if (rows.length === 0) throw new ApiError(404, 'Product not found');
      product = rows[0];
    } else {
      const { rows } = await db.query(
        'SELECT *, ROUND(price_cents / 100.0, 2) AS price FROM products WHERE id = $1',
        [id]
      );
      if (rows.length === 0) throw new ApiError(404, 'Product not found');
      product = rows[0];
    }

    if (req.files?.length) await insertImages(id, req.files);

    const images = await db.query(
      'SELECT id, url, is_primary FROM product_images WHERE product_id = $1 ORDER BY id',
      [id]
    );
    product.images = images.rows;
    const { bumpCatalogueRevision } = require('./store.controller');
    await bumpCatalogueRevision();
    res.json({ product });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vince-77-00/products/:id
// Always deactivate first so the storefront stops showing the product.
// Then hard-delete when the product is not referenced by past orders.
exports.deleteProduct = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid product id');
    }

    const exists = await db.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) throw new ApiError(404, 'Product not found');

    // Hide immediately from public catalogue (IS TRUE filter).
    await db.query(
      `UPDATE products
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    const { bumpCatalogueRevision } = require('./store.controller');
    const revision = await bumpCatalogueRevision();

    const ordered = await db.query(
      'SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1',
      [id]
    );

    if (ordered.rows.length > 0) {
      return res.json({
        deleted: false,
        deactivated: true,
        revision,
        message: 'Product removed from store (kept for order history)',
      });
    }

    const images = await db.query(
      'SELECT url FROM product_images WHERE product_id = $1',
      [id]
    );
    await db.query('DELETE FROM products WHERE id = $1', [id]);

    for (const { url } of images.rows) {
      const filename = path.basename(url);
      await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
    }
    res.json({
      deleted: true,
      deactivated: true,
      revision,
      message: 'Product deleted',
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vince-77-00/products/:id/images/:imageId
exports.deleteProductImage = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING url',
      [Number(req.params.imageId), Number(req.params.id)]
    );
    if (rows.length === 0) throw new ApiError(404, 'Image not found');
    await fs
      .unlink(path.join(UPLOAD_DIR, path.basename(rows[0].url)))
      .catch(() => {});
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------- categories ----------------------------- */

// POST /api/vince-77-00/categories
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !String(name).trim()) throw new ApiError(400, 'name is required');
    const { rows } = await db.query(
      `INSERT INTO categories (name, slug, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [String(name).trim(), slugify(name), description || null]
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/vince-77-00/categories/:id
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !String(name).trim()) throw new ApiError(400, 'name is required');
    const { rows } = await db.query(
      `UPDATE categories SET name = $1, slug = $2, description = $3
       WHERE id = $4 RETURNING *`,
      [String(name).trim(), slugify(name), description ?? null, Number(req.params.id)]
    );
    if (rows.length === 0) throw new ApiError(404, 'Category not found');
    res.json({ category: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vince-77-00/categories/:id (products keep existing via ON DELETE SET NULL)
exports.deleteCategory = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM categories WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) throw new ApiError(404, 'Category not found');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------- orders ------------------------------- */

// GET /api/vince-77-00/orders?status=
exports.listOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const params = [];
    let where = '';
    if (req.query.status) {
      if (!ORDER_STATUSES.includes(req.query.status)) {
        throw new ApiError(400, 'Invalid status filter');
      }
      params.push(req.query.status);
      where = `WHERE o.status = $${params.length}`;
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM orders o ${where}`,
      params
    );
    const { rows } = await db.query(
      `SELECT o.id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.payment_reference, o.paid_at, o.created_at,
              COALESCE(u.id, 0) AS user_id,
              COALESCE(u.name, o.shipping_address->>'guest_name', 'Guest') AS user_name,
              COALESCE(u.email, o.shipping_address->>'email') AS user_email
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      orders: rows,
      pagination: { page, limit, total: countResult.rows[0].total },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/vince-77-00/orders/:id
exports.getOrder = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid order id');
    }

    const { rows } = await db.query(
      `SELECT o.id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.shipping_address, o.payment_reference, o.paystack_transaction_id,
              o.paid_at, o.created_at, o.updated_at,
              COALESCE(u.id, 0) AS user_id,
              COALESCE(u.name, o.shipping_address->>'guest_name', 'Guest') AS user_name,
              COALESCE(u.email, o.shipping_address->>'email') AS user_email
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [id]
    );
    if (rows.length === 0) throw new ApiError(404, 'Order not found');

    const items = await db.query(
      `SELECT oi.id, oi.product_id, oi.product_name, oi.unit_price_cents,
              ROUND(oi.unit_price_cents / 100.0, 2) AS unit_price,
              oi.quantity,
              ROUND((oi.unit_price_cents * oi.quantity) / 100.0, 2) AS line_total,
              (
                SELECT pi.url FROM product_images pi
                WHERE pi.product_id = oi.product_id
                ORDER BY pi.is_primary DESC, pi.id ASC
                LIMIT 1
              ) AS image_url
       FROM order_items oi
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [id]
    );

    const payments = await db.query(
      `SELECT id, reference, amount_cents, currency, status, channel, verified_at
       FROM payments WHERE order_id = $1 ORDER BY verified_at DESC`,
      [id]
    );

    res.json({
      order: {
        ...rows[0],
        items: items.rows,
        payments: payments.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/vince-77-00/orders/:id/status { status }
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) {
      throw new ApiError(400, `status must be one of: ${ORDER_STATUSES.join(', ')}`);
    }
    const { rows } = await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, status, updated_at`,
      [status, Number(req.params.id)]
    );
    if (rows.length === 0) throw new ApiError(404, 'Order not found');
    res.json({ order: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vince-77-00/orders/:id  (also POST /api/vince-77-00/orders/:id/delete)
exports.deleteOrder = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid order id');
    }
    const { rows } = await db.query(
      'DELETE FROM orders WHERE id = $1 RETURNING id',
      [id]
    );
    if (rows.length === 0) throw new ApiError(404, 'Order not found');
    res.json({ message: 'Order deleted', id: rows[0].id });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vince-77-00/orders — remove every order (items/payments cascade)
// also POST /api/vince-77-00/orders/clear
exports.clearOrders = async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM orders');
    res.json({
      message: rowCount
        ? `Deleted ${rowCount} order${rowCount === 1 ? '' : 's'}`
        : 'No orders to delete',
      deleted: rowCount,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/vince-77-00/password { current_password, new_password }
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      throw new ApiError(400, 'current_password and new_password are required');
    }
    if (String(new_password).length < 8) {
      throw new ApiError(400, 'New password must be at least 8 characters');
    }

    const adminId = Number(req.admin?.id || req.admin?.sub);
    if (!Number.isInteger(adminId) || adminId < 1) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { rows } = await db.query(
      'SELECT id, password_hash FROM admins WHERE id = $1',
      [adminId]
    );
    const admin = rows[0];
    if (!admin) throw new ApiError(404, 'Admin not found');

    const ok = await bcrypt.compare(current_password, admin.password_hash);
    if (!ok) throw new ApiError(401, 'Current password is incorrect');

    const password_hash = await bcrypt.hash(String(new_password), 10);
    await db.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [
      password_hash,
      adminId,
    ]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------- users ------------------------------- */

// GET /api/vince-77-00/users
exports.listUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM users');
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.created_at,
              COUNT(o.id)::int AS order_count
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({
      users: rows,
      pagination: { page, limit, total: countResult.rows[0].total },
    });
  } catch (err) {
    next(err);
  }
};

/* --------------------------- private list / newsletter --------------------------- */

// GET /api/vince-77-00/newsletter
exports.listNewsletter = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 30,
    });
    const q = String(req.query.q || '').trim().toLowerCase();
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE email ILIKE $${params.length}`;
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM newsletter_subscribers ${where}`,
      params
    );
    const { rows } = await db.query(
      `SELECT id, email, source, created_at
       FROM newsletter_subscribers
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      subscribers: rows,
      pagination: { page, limit, total: countResult.rows[0].total },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/vince-77-00/newsletter/:id
exports.deleteNewsletter = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid subscriber id');
    }
    const { rows } = await db.query(
      'DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING id, email',
      [id]
    );
    if (rows.length === 0) throw new ApiError(404, 'Subscriber not found');
    res.json({ message: 'Removed from private list', subscriber: rows[0] });
  } catch (err) {
    next(err);
  }
};
