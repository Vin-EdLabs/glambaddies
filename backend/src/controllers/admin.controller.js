const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { ApiError } = require('../middleware/error');
const { UPLOAD_DIR } = require('../middleware/upload');
const { slugify, parsePagination, toCents } = require('../utils/helpers');

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const { ensureCatalogueExtras } = require('../services/catalogueExtras');

// Removes a replaced category/homepage image from disk so uploads don't pile up
// forever. Only ever targets our own /uploads/ files — never the bundled default
// tile images (e.g. /edit-casual.jpg), which live in the frontend build.
async function deleteUploadedFileIfUnused(url) {
  if (!url || !String(url).includes('/uploads/')) return;
  const filename = path.basename(String(url));
  await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
}

async function ensureUserPhoneColumn() {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone VARCHAR(40)
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
      ON users (phone)
      WHERE phone IS NOT NULL AND phone <> ''
  `);
  await db.query(`
    ALTER TABLE users
      ALTER COLUMN email DROP NOT NULL
  `).catch(() => {});
}

// POST /api/glam-baddies/login
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

// GET /api/glam-baddies/dashboard
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

// GET /api/glam-baddies/analytics — chart series for admin analytics page
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

// GET /api/glam-baddies/settings
exports.getSettings = async (req, res, next) => {
  try {
    const { getSettingsRow, publicSettingsPayloadAsync } = require('./store.controller');
    const row = await getSettingsRow();
    res.json(await publicSettingsPayloadAsync(row));
  } catch (err) {
    next(err);
  }
};

// PUT /api/glam-baddies/settings { purchases_enabled?: boolean, payment_mode?, keys..., usd_to_ghs_rate? }
exports.updateSettings = async (req, res, next) => {
  try {
    const {
      ensureSettings,
      getSettingsRow,
      publicSettingsPayloadAsync,
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

    if (body.announcement_text !== undefined) {
      const text = String(body.announcement_text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      if (!text) {
        throw new ApiError(400, 'Announcement text cannot be empty');
      }
      values.push(text);
      updates.push(`announcement_text = $${values.length}`);
    }

    if (
      body.default_rider_name !== undefined
      || body.default_rider_phone !== undefined
      || body.default_rider_photo_url !== undefined
    ) {
      const riderName = String(
        body.default_rider_name !== undefined ? body.default_rider_name : current.default_rider_name || '',
      ).trim().slice(0, 120);
      const riderPhone = String(
        body.default_rider_phone !== undefined ? body.default_rider_phone : current.default_rider_phone || '',
      ).trim().slice(0, 40);
      let riderPhoto = String(
        body.default_rider_photo_url !== undefined
          ? body.default_rider_photo_url
          : current.default_rider_photo_url || '',
      ).trim().slice(0, 500);

      if (riderName && riderName.length < 2) {
        throw new ApiError(400, 'Rider name is required');
      }
      if (riderName && riderPhone.replace(/\D/g, '').length < 9) {
        throw new ApiError(400, 'Enter a valid rider phone number');
      }

      values.push(riderName);
      updates.push(`default_rider_name = $${values.length}`);
      values.push(riderPhone);
      updates.push(`default_rider_phone = $${values.length}`);
      values.push(riderPhoto);
      updates.push(`default_rider_photo_url = $${values.length}`);

      // Apply this default rider to every order so track-order always shows them.
      if (riderName && riderPhone) {
        await db.query(
          `UPDATE orders
           SET rider_name = $1,
               rider_phone = $2,
               rider_photo_url = NULLIF($3, ''),
               rider_assigned_at = COALESCE(rider_assigned_at, NOW()),
               updated_at = NOW()`,
          [riderName, riderPhone, riderPhoto]
        );
      }
    }

    if (body.homepage_features !== undefined) {
      const {
        ensureCategoryHomeColumns,
        defaultHomeFields,
      } = require('../services/categoriesHome');
      await ensureCategoryHomeColumns();
      const features = Array.isArray(body.homepage_features) ? body.homepage_features : [];
      for (const item of features) {
        if (!item || typeof item !== 'object') continue;
        const categoryId = Number(item.category_id);
        const slug = String(item.category_slug || '').trim().toLowerCase();
        if (!Number.isInteger(categoryId) && !slug) continue;
        const { rows: existing } = await db.query(
          Number.isInteger(categoryId) && categoryId > 0
            ? `SELECT id, name, slug FROM categories WHERE id = $1`
            : `SELECT id, name, slug FROM categories WHERE slug = $1`,
          [Number.isInteger(categoryId) && categoryId > 0 ? categoryId : slug]
        );
        if (!existing[0]) continue;
        const defaults = defaultHomeFields(existing[0].name, existing[0].slug);
        await db.query(
          `UPDATE categories
           SET home_eyebrow = $2,
               home_title = $3,
               home_image_url = $4
           WHERE id = $1`,
          [
            existing[0].id,
            String(item.eyebrow || defaults.home_eyebrow).trim().slice(0, 40) || defaults.home_eyebrow,
            String(item.title || defaults.home_title).trim().slice(0, 80) || defaults.home_title,
            String(item.image_url || defaults.home_image_url).trim().slice(0, 500) || defaults.home_image_url,
          ]
        );
      }
      // Keep a mirror in settings for older code paths.
      values.push(JSON.stringify(features));
      updates.push(`homepage_features = $${values.length}::jsonb`);
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

    const payload = await publicSettingsPayloadAsync(rows[0]);
    const rateWasUpdated = rawRate !== undefined && rawRate !== null && rawRate !== '';

    let message = 'Settings saved';
    if (body.homepage_features !== undefined && !touchedPayments) {
      message = 'Homepage category tiles updated';
    } else if (body.announcement_text !== undefined && !touchedPayments) {
      message = 'Announcement bar updated';
    } else if (
      (body.default_rider_name !== undefined
        || body.default_rider_phone !== undefined
        || body.default_rider_photo_url !== undefined)
      && !touchedPayments
    ) {
      message = 'Default rider saved — applied to all orders on Track order';
    } else if (typeof body.purchases_enabled === 'boolean' && !touchedPayments && !rateWasUpdated) {
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

// POST /api/glam-baddies/settings/homepage-feature-image
// Legacy: prefers category_id / category_slug; falls back to slot index.
exports.uploadHomepageFeatureImage = async (req, res, next) => {
  try {
    const {
      ensureSettings,
      publicSettingsPayloadAsync,
    } = require('./store.controller');
    const {
      ensureCategoryHomeColumns,
      listHomepageFeatures,
      mapCategoryHome,
    } = require('../services/categoriesHome');
    await ensureSettings();
    await ensureCategoryHomeColumns();

    if (!req.file) {
      throw new ApiError(400, 'Choose an image to upload');
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const categoryId = Number(req.body?.category_id);
    const categorySlug = String(req.body?.category_slug || '').trim().toLowerCase();
    const slot = Number(req.body?.slot);

    let target = null;
    if (Number.isInteger(categoryId) && categoryId > 0) {
      const { rows } = await db.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
      target = rows[0] || null;
    } else if (categorySlug) {
      const { rows } = await db.query('SELECT * FROM categories WHERE slug = $1', [categorySlug]);
      target = rows[0] || null;
    } else if (Number.isInteger(slot) && slot >= 0) {
      const features = await listHomepageFeatures();
      const feature = features[slot];
      if (feature?.category_id) {
        const { rows } = await db.query('SELECT * FROM categories WHERE id = $1', [feature.category_id]);
        target = rows[0] || null;
      }
    }

    if (!target) {
      throw new ApiError(400, 'Choose a valid category for this homepage image');
    }

    const { rows } = await db.query(
      `UPDATE categories
       SET home_image_url = $1
       WHERE id = $2
       RETURNING *`,
      [imageUrl, target.id]
    );

    await deleteUploadedFileIfUnused(target.home_image_url);

    const settings = await require('./store.controller').getSettingsRow();
    res.json({
      ...(await publicSettingsPayloadAsync(settings)),
      category: mapCategoryHome(rows[0]),
      message: 'Homepage tile image updated',
      uploaded_url: imageUrl,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/glam-baddies/settings/default-rider-photo
exports.uploadDefaultRiderPhoto = async (req, res, next) => {
  try {
    const { ensureSettings, getSettingsRow, publicSettingsPayloadAsync } = require('./store.controller');
    await ensureSettings();
    if (!req.file) throw new ApiError(400, 'Choose a rider photo');
    const imageUrl = `/uploads/${req.file.filename}`;
    const { rows } = await db.query(
      `UPDATE store_settings
       SET default_rider_photo_url = $1, updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [imageUrl]
    );
    const settings = rows[0] || (await getSettingsRow());
    if (settings?.default_rider_name && settings?.default_rider_phone) {
      await db.query(
        `UPDATE orders
         SET rider_photo_url = $1,
             updated_at = NOW()
         WHERE rider_name = $2`,
        [imageUrl, settings.default_rider_name]
      );
    }
    res.json({
      ...(await publicSettingsPayloadAsync(settings)),
      uploaded_url: imageUrl,
      message: 'Rider photo updated',
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/glam-baddies/settings/rate { usd_to_ghs_rate | rate | exchange_rate }
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
  if (body.available_colors !== undefined || body['available_colors[]'] !== undefined) {
    const raw = body.available_colors !== undefined
      ? body.available_colors
      : body['available_colors[]'];
    let parsed = raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) {
        fields.available_colors = null;
        return fields;
      }
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = trimmed.split(',').map((item) => item.trim()).filter(Boolean);
      }
    }

    const stockMap = {};
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (typeof entry === 'string') {
          const name = entry.trim();
          if (name) stockMap[name] = stockMap[name] != null ? stockMap[name] : 1;
          continue;
        }
        if (entry && typeof entry === 'object') {
          const name = String(entry.name || entry.color || '').trim();
          if (!name) continue;
          const qty = Number(entry.qty ?? entry.quantity ?? entry.stock ?? 0);
          stockMap[name] = Number.isFinite(qty) && qty >= 0 ? Math.floor(qty) : 0;
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [name, value] of Object.entries(parsed)) {
        const key = String(name || '').trim();
        if (!key) continue;
        const qty = Number(value);
        stockMap[key] = Number.isFinite(qty) && qty >= 0 ? Math.floor(qty) : 0;
      }
    }
    fields.available_colors = stockMap;
  }
  return fields;
}

async function insertImages(productId, files, { primaryIndex = null } = {}) {
  const urls = [];
  if (!files?.length) return urls;

  const chosen =
    primaryIndex == null || Number.isNaN(Number(primaryIndex))
      ? null
      : Math.max(0, Math.min(files.length - 1, Number(primaryIndex)));

  for (let i = 0; i < files.length; i++) {
    const url = `/uploads/${files[i].filename}`;
    const { rows: countRows } = await db.query(
      'SELECT COUNT(*)::int AS total FROM product_images WHERE product_id = $1',
      [productId]
    );
    const isFirst = countRows[0].total === 0;
    const isPrimary = chosen != null ? i === chosen : isFirst;
    if (isPrimary) {
      await db.query(
        'UPDATE product_images SET is_primary = FALSE WHERE product_id = $1',
        [productId]
      );
    }
    await db.query(
      `INSERT INTO product_images (product_id, url, is_primary)
       VALUES ($1, $2, $3)`,
      [productId, url, isPrimary]
    );
    urls.push(url);
  }
  return urls;
}

// GET /api/glam-baddies/products (active by default; ?include_inactive=1 for drafts)
exports.listProducts = async (req, res, next) => {
  try {
    await ensureCatalogueExtras();
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const includeInactive =
      req.query.include_inactive === '1' || req.query.include_inactive === 'true';
    const where = includeInactive ? '' : 'WHERE p.is_active = TRUE';
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM products p ${where}`
    );
    const { rows } = await db.query(
      `SELECT p.*, ROUND(p.price_cents / 100.0, 2) AS price,
              CASE
                WHEN p.compare_at_price_cents IS NOT NULL
                THEN ROUND(p.compare_at_price_cents / 100.0, 2)
                ELSE NULL
              END AS compare_at_price,
              c.name AS category_name, c.slug AS category_slug,
              COALESCE((SELECT json_agg(json_build_object('id', pi.id, 'url', pi.url, 'is_primary', pi.is_primary) ORDER BY pi.is_primary DESC, pi.id)
                        FROM product_images pi WHERE pi.product_id = p.id), '[]'::json) AS images
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.set({
      'Cache-Control': 'no-store',
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

// POST /api/glam-baddies/products  (multipart/form-data, images[] optional)
exports.createProduct = async (req, res, next) => {
  try {
    const fields = parseProductBody(req.body || {});
    const slug = `${slugify(fields.name)}-${Date.now().toString(36)}`;

    const { rows } = await db.query(
      `INSERT INTO products (name, slug, description, price_cents, stock, category_id, is_active, available_colors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING *, ROUND(price_cents / 100.0, 2) AS price`,
      [
        fields.name,
        slug,
        fields.description || '',
        fields.price_cents,
        fields.stock,
        fields.category_id ?? null,
        fields.is_active ?? true,
        fields.available_colors != null ? JSON.stringify(fields.available_colors) : null,
      ]
    );
    const product = rows[0];
    const primaryIndex =
      req.body?.primary_image_index != null && req.body.primary_image_index !== ''
        ? Number(req.body.primary_image_index)
        : null;
    product.images = await insertImages(product.id, req.files || [], { primaryIndex });
    const { bumpCatalogueRevision } = require('./store.controller');
    await bumpCatalogueRevision();
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
};

// PUT /api/glam-baddies/products/:id  (multipart/form-data, images[] appended)
exports.updateProduct = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const fields = parseProductBody(req.body || {}, { partial: true });

    const sets = [];
    const params = [];
    for (const [column, value] of Object.entries(fields)) {
      if (column === 'available_colors') {
        params.push(value == null ? null : JSON.stringify(value));
        sets.push(`available_colors = $${params.length}::jsonb`);
        continue;
      }
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

    if (req.files?.length) {
      const primaryIndex =
        req.body?.primary_image_index != null && req.body.primary_image_index !== ''
          ? Number(req.body.primary_image_index)
          : null;
      await insertImages(id, req.files, { primaryIndex });
    }

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

async function hardDeleteProductsByIds(ids) {
  const validIds = [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id >= 1),
  )];
  if (!validIds.length) return { deletedIds: [] };

  const { rows: existing } = await db.query(
    'SELECT id FROM products WHERE id = ANY($1::int[])',
    [validIds]
  );
  const deletedIds = existing.map((row) => row.id);
  if (!deletedIds.length) return { deletedIds: [] };

  const { rows: images } = await db.query(
    'SELECT url FROM product_images WHERE product_id = ANY($1::int[])',
    [deletedIds]
  );

  await db.query('DELETE FROM cart_items WHERE product_id = ANY($1::int[])', [deletedIds]);
  await db.query('DELETE FROM product_images WHERE product_id = ANY($1::int[])', [deletedIds]);
  await db.query('DELETE FROM products WHERE id = ANY($1::int[])', [deletedIds]);

  for (const { url } of images) {
    if (!url || !String(url).includes('/uploads/')) continue;
    const filename = path.basename(url);
    await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
  }

  return { deletedIds };
}

// DELETE /api/glam-baddies/products/:id
// Always hard-delete. Order history keeps line items (product_id SET NULL).
exports.deleteProduct = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid product id');
    }

    const { deletedIds } = await hardDeleteProductsByIds([id]);
    if (!deletedIds.length) throw new ApiError(404, 'Product not found');

    let revision = Date.now();
    try {
      const { bumpCatalogueRevision } = require('./store.controller');
      revision = await bumpCatalogueRevision();
    } catch {
      /* revision bump is best-effort */
    }

    return res.json({
      deleted: true,
      deactivated: false,
      id,
      revision,
      message: 'Product deleted',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/glam-baddies/products/bulk-delete  { ids: number[] }
exports.deleteProductsBulk = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) throw new ApiError(400, 'Select at least one product');

    const { deletedIds } = await hardDeleteProductsByIds(ids);
    if (!deletedIds.length) throw new ApiError(404, 'No matching products found');

    let revision = Date.now();
    try {
      const { bumpCatalogueRevision } = require('./store.controller');
      revision = await bumpCatalogueRevision();
    } catch {
      /* revision bump is best-effort */
    }

    return res.json({
      deleted: true,
      count: deletedIds.length,
      ids: deletedIds,
      revision,
      message: deletedIds.length === 1
        ? 'Product deleted'
        : `${deletedIds.length} products deleted`,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/glam-baddies/products/:id/sale
// Body: { compare_at_price_cents | compare_at_price, discount_percent, sale_ends_at }
exports.setProductSale = async (req, res, next) => {
  try {
    await ensureCatalogueExtras();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'Invalid product id');

    const { rows: existing } = await db.query(
      'SELECT id, price_cents FROM products WHERE id = $1',
      [id]
    );
    if (!existing.length) throw new ApiError(404, 'Product not found');

    const body = req.body || {};
    let compareAt = toCents(body.compare_at_price);
    if (compareAt == null && body.compare_at_price_cents != null) {
      compareAt = Number(body.compare_at_price_cents);
    }
    let salePriceCents = toCents(body.sale_price ?? body.new_price ?? body.price);
    if (salePriceCents == null && body.sale_price_cents != null) {
      salePriceCents = Number(body.sale_price_cents);
    }
    let discount = body.discount_percent != null && body.discount_percent !== ''
      ? Number(body.discount_percent)
      : null;
    const saleEndsRaw = body.sale_ends_at;
    const saleEndsAt = saleEndsRaw ? new Date(saleEndsRaw) : null;
    if (saleEndsRaw && Number.isNaN(saleEndsAt?.getTime())) {
      throw new ApiError(400, 'Invalid sale_ends_at');
    }

    let priceCents = existing[0].price_cents;
    if (compareAt == null || !Number.isFinite(compareAt) || compareAt < 1) {
      throw new ApiError(400, 'Original (compare-at) price is required');
    }
    if (salePriceCents != null && Number.isFinite(salePriceCents) && salePriceCents >= 1) {
      priceCents = Math.round(salePriceCents);
      discount = Math.max(1, Math.min(95, Math.round(((compareAt - priceCents) / compareAt) * 100)));
    } else {
      if (discount == null || !Number.isFinite(discount) || discount < 1 || discount > 95) {
        throw new ApiError(400, 'Discount percent must be between 1 and 95');
      }
      discount = Math.round(discount);
      priceCents = Math.max(1, Math.round(compareAt * (1 - discount / 100)));
    }
    if (priceCents >= compareAt) {
      throw new ApiError(400, 'Sale price must be lower than the original price');
    }

    const { rows } = await db.query(
      `UPDATE products
       SET compare_at_price_cents = $1,
           discount_percent = $2,
           sale_ends_at = $3,
           is_on_sale = TRUE,
           price_cents = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *,
         ROUND(price_cents / 100.0, 2) AS price,
         ROUND(compare_at_price_cents / 100.0, 2) AS compare_at_price`,
      [compareAt, discount, saleEndsAt, priceCents, id]
    );

    const { bumpCatalogueRevision } = require('./store.controller');
    const revision = await bumpCatalogueRevision();
    res.json({ product: rows[0], revision, message: 'Sale price set' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/glam-baddies/products/:id/clear-sale
exports.clearProductSale = async (req, res, next) => {
  try {
    await ensureCatalogueExtras();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'Invalid product id');

    const { rows: existing } = await db.query(
      'SELECT id, price_cents, compare_at_price_cents, is_on_sale FROM products WHERE id = $1',
      [id]
    );
    if (!existing.length) throw new ApiError(404, 'Product not found');

    // Restore compare-at as the regular price when clearing a sale.
    const restoreCents =
      existing[0].is_on_sale && existing[0].compare_at_price_cents
        ? existing[0].compare_at_price_cents
        : existing[0].price_cents;

    const { rows } = await db.query(
      `UPDATE products
       SET price_cents = $1,
           compare_at_price_cents = NULL,
           discount_percent = NULL,
           sale_ends_at = NULL,
           is_on_sale = FALSE,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *, ROUND(price_cents / 100.0, 2) AS price`,
      [restoreCents, id]
    );

    const { bumpCatalogueRevision } = require('./store.controller');
    const revision = await bumpCatalogueRevision();
    res.json({ product: rows[0], revision, message: 'Sale cleared' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/glam-baddies/products/:id/images/:imageId/primary
exports.setPrimaryImage = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!Number.isInteger(productId) || productId < 1) {
      throw new ApiError(400, 'Invalid product id');
    }
    if (!Number.isInteger(imageId) || imageId < 1) {
      throw new ApiError(400, 'Invalid image id');
    }

    const existing = await db.query(
      'SELECT id FROM product_images WHERE id = $1 AND product_id = $2',
      [imageId, productId]
    );
    if (existing.rows.length === 0) throw new ApiError(404, 'Image not found');

    await db.query(
      'UPDATE product_images SET is_primary = FALSE WHERE product_id = $1',
      [productId]
    );
    await db.query(
      'UPDATE product_images SET is_primary = TRUE WHERE id = $1 AND product_id = $2',
      [imageId, productId]
    );

    const images = await db.query(
      `SELECT id, url, is_primary
       FROM product_images
       WHERE product_id = $1
       ORDER BY is_primary DESC, id ASC`,
      [productId]
    );
    const { bumpCatalogueRevision } = require('./store.controller');
    await bumpCatalogueRevision();
    res.json({
      message: 'Main thumbnail updated',
      images: images.rows,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/glam-baddies/products/:id/images/:imageId
exports.deleteProductImage = async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const { rows } = await db.query(
      'DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING url, is_primary',
      [imageId, productId]
    );
    if (rows.length === 0) throw new ApiError(404, 'Image not found');
    await fs
      .unlink(path.join(UPLOAD_DIR, path.basename(rows[0].url)))
      .catch(() => {});

    // Keep one primary image so the storefront always has a main thumb.
    if (rows[0].is_primary) {
      await db.query(
        `UPDATE product_images
         SET is_primary = TRUE
         WHERE id = (
           SELECT id FROM product_images
           WHERE product_id = $1
           ORDER BY id ASC
           LIMIT 1
         )`,
        [productId]
      );
    }

    const images = await db.query(
      `SELECT id, url, is_primary
       FROM product_images
       WHERE product_id = $1
       ORDER BY is_primary DESC, id ASC`,
      [productId]
    );
    const { bumpCatalogueRevision } = require('./store.controller');
    await bumpCatalogueRevision();
    res.json({ deleted: true, images: images.rows });
  } catch (err) {
    next(err);
  }
};

/* ----------------------------- categories ----------------------------- */

// GET /api/glam-baddies/categories
exports.listCategories = async (req, res, next) => {
  try {
    const {
      ensureCategoryHomeColumns,
      mapCategoryHome,
    } = require('../services/categoriesHome');
    await ensureCategoryHomeColumns();
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.slug, c.description, c.created_at,
              c.home_image_url, c.home_eyebrow, c.home_title,
              COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
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
    res.json({ categories: rows.map(mapCategoryHome) });
  } catch (err) {
    next(err);
  }
};

// POST /api/glam-baddies/categories
exports.createCategory = async (req, res, next) => {
  try {
    const {
      ensureCategoryHomeColumns,
      defaultHomeFields,
      mapCategoryHome,
    } = require('../services/categoriesHome');
    await ensureCategoryHomeColumns();

    const { name, description, home_eyebrow, home_title, home_image_url } = req.body || {};
    if (!name || !String(name).trim()) throw new ApiError(400, 'name is required');
    const cleanName = String(name).trim();
    const slug = slugify(cleanName);
    const defaults = defaultHomeFields(cleanName, slug);
    const { rows } = await db.query(
      `INSERT INTO categories (name, slug, description, home_image_url, home_eyebrow, home_title)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        cleanName,
        slug,
        description || null,
        String(home_image_url || defaults.home_image_url).trim().slice(0, 500) || defaults.home_image_url,
        String(home_eyebrow || defaults.home_eyebrow).trim().slice(0, 40) || defaults.home_eyebrow,
        String(home_title || defaults.home_title).trim().slice(0, 80) || defaults.home_title,
      ]
    );
    res.status(201).json({ category: mapCategoryHome(rows[0]) });
  } catch (err) {
    if (err && err.code === '23505') {
      return next(new ApiError(409, 'A category with that name already exists'));
    }
    next(err);
  }
};

// PUT /api/glam-baddies/categories/:id
exports.updateCategory = async (req, res, next) => {
  try {
    const {
      ensureCategoryHomeColumns,
      defaultHomeFields,
      mapCategoryHome,
    } = require('../services/categoriesHome');
    await ensureCategoryHomeColumns();

    const body = req.body || {};
    const { name, description } = body;
    if (!name || !String(name).trim()) throw new ApiError(400, 'name is required');
    const cleanName = String(name).trim();
    const slug = slugify(cleanName);
    const defaults = defaultHomeFields(cleanName, slug);

    const homeEyebrow =
      body.home_eyebrow !== undefined
        ? String(body.home_eyebrow || '').trim().slice(0, 40) || defaults.home_eyebrow
        : undefined;
    const homeTitle =
      body.home_title !== undefined
        ? String(body.home_title || '').trim().slice(0, 80) || defaults.home_title
        : undefined;
    const homeImage =
      body.home_image_url !== undefined
        ? String(body.home_image_url || '').trim().slice(0, 500) || defaults.home_image_url
        : undefined;

    const { rows } = await db.query(
      `UPDATE categories
       SET name = $1,
           slug = $2,
           description = $3,
           home_eyebrow = COALESCE($4, home_eyebrow, $5),
           home_title = COALESCE($6, home_title, $7),
           home_image_url = COALESCE($8, home_image_url, $9)
       WHERE id = $10
       RETURNING *`,
      [
        cleanName,
        slug,
        description ?? null,
        homeEyebrow ?? null,
        defaults.home_eyebrow,
        homeTitle ?? null,
        defaults.home_title,
        homeImage ?? null,
        defaults.home_image_url,
        Number(req.params.id),
      ]
    );
    if (rows.length === 0) throw new ApiError(404, 'Category not found');
    res.json({ category: mapCategoryHome(rows[0]) });
  } catch (err) {
    if (err && err.code === '23505') {
      return next(new ApiError(409, 'A category with that name already exists'));
    }
    next(err);
  }
};

// POST /api/glam-baddies/categories/:id/home-image
exports.uploadCategoryHomeImage = async (req, res, next) => {
  try {
    const {
      ensureCategoryHomeColumns,
      mapCategoryHome,
    } = require('../services/categoriesHome');
    await ensureCategoryHomeColumns();

    if (!req.file) {
      throw new ApiError(400, 'Choose an image to upload');
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(400, 'Invalid category id');
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const { rows: previous } = await db.query(
      'SELECT home_image_url FROM categories WHERE id = $1',
      [id]
    );
    if (previous.length === 0) throw new ApiError(404, 'Category not found');

    const { rows } = await db.query(
      `UPDATE categories
       SET home_image_url = $1
       WHERE id = $2
       RETURNING *`,
      [imageUrl, id]
    );

    await deleteUploadedFileIfUnused(previous[0].home_image_url);

    res.json({
      category: mapCategoryHome(rows[0]),
      message: 'Homepage tile image updated',
      uploaded_url: imageUrl,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/glam-baddies/categories/:id (products keep existing via ON DELETE SET NULL)
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

// GET /api/glam-baddies/orders?status=
exports.listOrders = async (req, res, next) => {
  try {
    await ensureUserPhoneColumn();
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
              o.shipping_address,
              COALESCE(u.id, 0) AS user_id,
              COALESCE(
                NULLIF(o.shipping_address->>'full_name', ''),
                u.name,
                o.shipping_address->>'guest_name',
                'Guest'
              ) AS user_name,
              COALESCE(
                NULLIF(o.shipping_address->>'phone', ''),
                u.phone,
                u.email,
                o.shipping_address->>'email'
              ) AS user_email
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

// GET /api/glam-baddies/orders/:id
exports.getOrder = async (req, res, next) => {
  try {
    await ensureUserPhoneColumn();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid order id');
    }

    await ensureCatalogueExtras();
    const { rows } = await db.query(
      `SELECT o.id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.shipping_address, o.payment_reference, o.paystack_transaction_id,
              o.paid_at, o.created_at, o.updated_at,
              o.rider_name, o.rider_phone, o.rider_photo_url, o.rider_assigned_at,
              COALESCE(u.id, 0) AS user_id,
              COALESCE(
                NULLIF(o.shipping_address->>'full_name', ''),
                u.name,
                o.shipping_address->>'guest_name',
                'Guest'
              ) AS user_name,
              COALESCE(
                NULLIF(o.shipping_address->>'phone', ''),
                u.phone,
                u.email,
                o.shipping_address->>'email'
              ) AS user_email
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

// PUT /api/glam-baddies/orders/:id/status { status, cancel_reason? }
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, cancel_reason: cancelReasonRaw } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) {
      throw new ApiError(400, `status must be one of: ${ORDER_STATUSES.join(', ')}`);
    }
    const orderId = Number(req.params.id);
    const current = await db.query(
      'SELECT id, status, shipping_address FROM orders WHERE id = $1',
      [orderId]
    );
    if (current.rows.length === 0) throw new ApiError(404, 'Order not found');
    const previousStatus = current.rows[0].status;

    let cancelReason = String(cancelReasonRaw || '').trim();
    if (status === 'cancelled') {
      if (cancelReason.length < 3) {
        throw new ApiError(400, 'A cancellation reason is required');
      }
      if (cancelReason.length > 500) {
        cancelReason = cancelReason.slice(0, 500);
      }
      await db.query(
        `UPDATE orders
         SET shipping_address = COALESCE(shipping_address, '{}'::jsonb)
           || jsonb_build_object(
                'cancel_reason', $2::text,
                'cancelled_at', $3::text
              ),
             updated_at = NOW()
         WHERE id = $1`,
        [orderId, cancelReason, new Date().toISOString()]
      );
    }

    const { rows } = await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, status, updated_at, shipping_address`,
      [status, orderId]
    );
    if (rows.length === 0) throw new ApiError(404, 'Order not found');

    if (previousStatus !== status) {
      let emailResult = { ok: false };
      try {
        const { sendStatusUpdateEmail } = require('../services/orderEmails');
        emailResult = await sendStatusUpdateEmail(orderId);
      } catch (mailErr) {
        console.error('[mail] status update email failed:', mailErr.message);
        emailResult = { ok: false, error: mailErr.message };
      }
      return res.json({
        order: rows[0],
        email_sent: Boolean(emailResult?.ok),
        email_error: emailResult?.ok ? null : emailResult?.error || null,
      });
    }

    res.json({ order: rows[0], email_sent: false });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/glam-baddies/orders/:id/assign-rider
// Body (JSON or multipart): { rider_name, rider_phone, rider_photo_url? } + optional photo file
exports.assignRider = async (req, res, next) => {
  try {
    await ensureCatalogueExtras();
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      throw new ApiError(400, 'Invalid order id');
    }

    const { rows: existing } = await db.query(
      'SELECT id, rider_photo_url FROM orders WHERE id = $1',
      [orderId]
    );
    if (!existing.length) throw new ApiError(404, 'Order not found');

    const riderName = String(req.body?.rider_name || '').trim();
    const riderPhone = String(req.body?.rider_phone || '').trim();
    let riderPhoto = String(req.body?.rider_photo_url || '').trim().slice(0, 500);
    if (req.file?.filename) {
      riderPhoto = `/uploads/${req.file.filename}`;
    } else if (!riderPhoto) {
      riderPhoto = existing[0].rider_photo_url || '';
    }

    if (riderName.length < 2) throw new ApiError(400, 'Rider name is required');
    if (riderPhone.replace(/\D/g, '').length < 9) {
      throw new ApiError(400, 'Enter a valid rider phone number');
    }

    const { rows } = await db.query(
      `UPDATE orders
       SET rider_name = $1,
           rider_phone = $2,
           rider_photo_url = NULLIF($3, ''),
           rider_assigned_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, status, rider_name, rider_phone, rider_photo_url, rider_assigned_at, updated_at`,
      [riderName, riderPhone, riderPhoto, orderId]
    );

    res.json({
      order: rows[0],
      message: 'Rider assigned — customers will see name, phone and photo on track order',
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/glam-baddies/orders/:id  (also POST /api/glam-baddies/orders/:id/delete)
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

// DELETE /api/glam-baddies/orders — remove every order (items/payments cascade)
// also POST /api/glam-baddies/orders/clear
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

// PUT /api/glam-baddies/password { current_password, new_password }
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

/* -------------------------------- admins ------------------------------ */

// GET /api/glam-baddies/admins
exports.listAdmins = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, created_at
       FROM admins
       ORDER BY created_at ASC, id ASC`
    );
    res.json({ admins: rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/glam-baddies/admins { name, email, password }
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    const fullName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!fullName) throw new ApiError(400, 'Full name is required');
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new ApiError(400, 'A valid email is required');
    }
    if (!password || String(password).length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }

    const existing = await db.query('SELECT id FROM admins WHERE email = $1', [
      cleanEmail,
    ]);
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'An admin with this email already exists');
    }

    const password_hash = await bcrypt.hash(String(password), 10);
    const { rows } = await db.query(
      `INSERT INTO admins (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [fullName, cleanEmail, password_hash]
    );

    res.status(201).json({
      message: 'Admin account created',
      admin: rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'An admin with this email already exists'));
    }
    next(err);
  }
};

// DELETE /api/glam-baddies/admins/:id
exports.deleteAdmin = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const currentId = Number(req.admin?.id || req.admin?.sub);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid admin id');
    }
    if (id === currentId) {
      throw new ApiError(400, 'You cannot remove your own admin account');
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM admins');
    if (countResult.rows[0].total <= 1) {
      throw new ApiError(400, 'At least one admin account is required');
    }

    const { rowCount } = await db.query('DELETE FROM admins WHERE id = $1', [id]);
    if (!rowCount) throw new ApiError(404, 'Admin not found');

    res.json({ message: 'Admin removed' });
  } catch (err) {
    next(err);
  }
};

/* -------------------------------- users ------------------------------- */

// GET /api/glam-baddies/users
exports.listUsers = async (req, res, next) => {
  try {
    await ensureUserPhoneColumn();
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM users');
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.phone, u.email, u.created_at,
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

// GET /api/glam-baddies/newsletter
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

// DELETE /api/glam-baddies/newsletter/:id
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
