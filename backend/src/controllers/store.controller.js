const db = require('../config/db');
const axios = require('axios');
const { ApiError } = require('../middleware/error');

const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

function keyLooksLike(mode, publicKey, secretKey) {
  const pub = String(publicKey || '').trim();
  const sec = String(secretKey || '').trim();
  if (mode === 'live') {
    return {
      publicOk: pub.startsWith('pk_live_'),
      secretOk: sec.startsWith('sk_live_'),
      publicKey: pub,
      secretKey: sec,
    };
  }
  return {
    publicOk: pub.startsWith('pk_test_'),
    secretOk: sec.startsWith('sk_test_'),
    publicKey: pub,
    secretKey: sec,
  };
}

/**
 * Confirms keys match the requested mode and that Paystack accepts the secret key.
 * For live mode this must succeed before we flip the store to live.
 */
async function verifyPaystackMode(mode, publicKey, secretKey) {
  const check = keyLooksLike(mode, publicKey, secretKey);

  if (!check.publicKey || !check.secretKey) {
    throw new ApiError(
      400,
      mode === 'live'
        ? 'Add both Paystack LIVE public (pk_live_…) and secret (sk_live_…) keys before enabling live mode.'
        : 'Add both Paystack TEST public (pk_test_…) and secret (sk_test_…) keys.'
    );
  }

  if (mode === 'live') {
    if (!check.publicOk) {
      throw new ApiError(
        400,
        'Live mode requires a Paystack LIVE public key starting with pk_live_. Test keys cannot be used.'
      );
    }
    if (!check.secretOk) {
      throw new ApiError(
        400,
        'Live mode requires a Paystack LIVE secret key starting with sk_live_. Test keys cannot be used.'
      );
    }
  } else {
    if (!check.publicOk) {
      throw new ApiError(
        400,
        'Test mode requires a Paystack TEST public key starting with pk_test_.'
      );
    }
    if (!check.secretOk) {
      throw new ApiError(
        400,
        'Test mode requires a Paystack TEST secret key starting with sk_test_.'
      );
    }
  }

  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/balance`, {
      headers: { Authorization: `Bearer ${check.secretKey}` },
      timeout: 12000,
    });
    if (!response.data?.status) {
      throw new ApiError(400, 'Paystack did not confirm these keys. Check your keys and try again.');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const status = err.response?.status;
    const message = err.response?.data?.message;
    if (status === 401 || status === 403) {
      throw new ApiError(
        400,
        mode === 'live'
          ? 'Paystack rejected these LIVE keys. Live mode was not enabled.'
          : 'Paystack rejected these TEST keys. Settings were not saved.'
      );
    }
    throw new ApiError(
      502,
      message || 'Could not verify Paystack keys right now. Please try again.'
    );
  }

  return {
    verified: true,
    payment_mode: mode,
    message:
      mode === 'live'
        ? 'LIVE MODE confirmed — Paystack live keys verified. Accepting real payments.'
        : 'TEST MODE confirmed — Paystack test keys verified. No real payments are processed.',
  };
}

async function ensureSettings() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      purchases_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      payment_mode TEXT NOT NULL DEFAULT 'test'
        CHECK (payment_mode IN ('test', 'live')),
      paystack_test_public_key TEXT NOT NULL DEFAULT '',
      paystack_test_secret_key TEXT NOT NULL DEFAULT '',
      paystack_live_public_key TEXT NOT NULL DEFAULT '',
      paystack_live_secret_key TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Older DBs may already have the table without payment columns.
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'test'
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS paystack_test_public_key TEXT NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS paystack_test_secret_key TEXT NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS paystack_live_public_key TEXT NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS paystack_live_secret_key TEXT NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS usd_to_ghs_rate NUMERIC(12,4) NOT NULL DEFAULT 15.5
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS catalogue_revision BIGINT NOT NULL DEFAULT 1
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS announcement_text VARCHAR(120) NOT NULL DEFAULT 'Shop · Slay · Shine'
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS homepage_features JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS default_rider_name VARCHAR(120) NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS default_rider_phone VARCHAR(40) NOT NULL DEFAULT ''
  `);
  await db.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS default_rider_photo_url VARCHAR(500) NOT NULL DEFAULT ''
  `);

  await db.query(`
    INSERT INTO store_settings (id, purchases_enabled)
    VALUES (1, TRUE)
    ON CONFLICT (id) DO NOTHING
  `);

  // Bootstrap rate from env once if still at default and env is set.
  const envRate = Number(process.env.USD_TO_GHS_RATE);
  if (Number.isFinite(envRate) && envRate > 0) {
    await db.query(
      `UPDATE store_settings
       SET usd_to_ghs_rate = $1
       WHERE id = 1 AND usd_to_ghs_rate = 15.5`,
      [envRate]
    );
  }

  // Bootstrap empty DB keys from .env once (local/prod first deploy).
  const envPublic = process.env.PAYSTACK_PUBLIC_KEY || '';
  const envSecret = process.env.PAYSTACK_SECRET_KEY || '';
  if (envPublic || envSecret) {
    const isLive = String(envSecret).startsWith('sk_live') || String(envPublic).startsWith('pk_live');
    if (isLive) {
      await db.query(
        `UPDATE store_settings
         SET paystack_live_public_key = CASE WHEN paystack_live_public_key = '' THEN $1 ELSE paystack_live_public_key END,
             paystack_live_secret_key = CASE WHEN paystack_live_secret_key = '' THEN $2 ELSE paystack_live_secret_key END,
             payment_mode = CASE WHEN paystack_live_secret_key = '' AND paystack_test_secret_key = '' THEN 'live' ELSE payment_mode END
         WHERE id = 1`,
        [envPublic, envSecret]
      );
    } else {
      await db.query(
        `UPDATE store_settings
         SET paystack_test_public_key = CASE WHEN paystack_test_public_key = '' THEN $1 ELSE paystack_test_public_key END,
             paystack_test_secret_key = CASE WHEN paystack_test_secret_key = '' THEN $2 ELSE paystack_test_secret_key END
         WHERE id = 1`,
        [envPublic, envSecret]
      );
    }
  }
}

async function getSettingsRow() {
  await ensureSettings();
  const { rows } = await db.query('SELECT * FROM store_settings WHERE id = 1');
  return rows[0];
}

async function getPurchasesEnabled() {
  const row = await getSettingsRow();
  return row?.purchases_enabled !== false;
}

async function getPaymentConfig() {
  const row = await getSettingsRow();
  const mode = row?.payment_mode === 'live' ? 'live' : 'test';
  const publicKey =
    mode === 'live'
      ? row.paystack_live_public_key
      : row.paystack_test_public_key;
  const secretKey =
    mode === 'live'
      ? row.paystack_live_secret_key
      : row.paystack_test_secret_key;

  // Last-resort env fallback if admin has not saved keys yet.
  const resolvedPublic =
    publicKey ||
    process.env.PAYSTACK_PUBLIC_KEY ||
    '';
  const resolvedSecret =
    secretKey ||
    process.env.PAYSTACK_SECRET_KEY ||
    '';

  return {
    payment_mode: mode,
    public_key: resolvedPublic,
    secret_key: resolvedSecret,
  };
}

function maskKey(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= 10) return '••••••••';
  return `${raw.slice(0, 7)}${'•'.repeat(Math.min(24, raw.length - 11))}${raw.slice(-4)}`;
}

const DEFAULT_HOMEPAGE_FEATURES = [
  {
    id: 'slot-1',
    category_slug: 'casual-dresses',
    eyebrow: 'Casual',
    title: 'Everyday dresses',
    image_url: '/edit-casual.jpg',
  },
  {
    id: 'slot-2',
    category_slug: 'party-dresses',
    eyebrow: 'Party',
    title: 'Celebration looks',
    image_url: '/edit-party.jpg',
  },
  {
    id: 'slot-3',
    category_slug: 'school-dresses',
    eyebrow: 'School',
    title: 'Smart day dresses',
    image_url: '/edit-school.jpg',
  },
];

function normalizeHomepageFeatures(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_HOMEPAGE_FEATURES.map((item) => ({ ...item }));
  }

  const normalized = [0, 1, 2].map((index) => {
    const fallback = DEFAULT_HOMEPAGE_FEATURES[index];
    const item = list[index] && typeof list[index] === 'object' ? list[index] : {};
    const categorySlug = String(item.category_slug || fallback.category_slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return {
      id: String(item.id || fallback.id),
      category_slug: categorySlug || fallback.category_slug,
      eyebrow: String(item.eyebrow || fallback.eyebrow).trim().slice(0, 40) || fallback.eyebrow,
      title: String(item.title || fallback.title).trim().slice(0, 80) || fallback.title,
      image_url:
        String(item.image_url || fallback.image_url).trim().slice(0, 500) ||
        fallback.image_url,
    };
  });

  return normalized;
}

function publicSettingsPayload(row) {
  const rate = Number(row.usd_to_ghs_rate);
  return {
    purchases_enabled: row.purchases_enabled !== false,
    payment_mode: row.payment_mode === 'live' ? 'live' : 'test',
    paystack_test_public_key: row.paystack_test_public_key || '',
    paystack_test_secret_key: row.paystack_test_secret_key || '',
    paystack_live_public_key: row.paystack_live_public_key || '',
    paystack_live_secret_key: row.paystack_live_secret_key || '',
    usd_to_ghs_rate: Number.isFinite(rate) && rate > 0 ? rate : 15.5,
    announcement_text: String(row.announcement_text || 'Shop · Slay · Shine').slice(0, 120),
    homepage_features: normalizeHomepageFeatures(row.homepage_features),
    default_rider_name: String(row.default_rider_name || '').trim(),
    default_rider_phone: String(row.default_rider_phone || '').trim(),
    default_rider_photo_url: String(row.default_rider_photo_url || '').trim(),
    updated_at: row.updated_at,
  };
}

async function publicSettingsPayloadAsync(row) {
  const payload = publicSettingsPayload(row);
  try {
    const { listHomepageFeatures } = require('../services/categoriesHome');
    payload.homepage_features = await listHomepageFeatures();
  } catch {
    // keep legacy normalize fallback
  }
  return payload;
}

async function getUsdToGhsRate() {
  const row = await getSettingsRow();
  const rate = Number(row?.usd_to_ghs_rate);
  if (Number.isFinite(rate) && rate > 0) return rate;
  const envRate = Number(process.env.USD_TO_GHS_RATE);
  return Number.isFinite(envRate) && envRate > 0 ? envRate : 15.5;
}

async function bumpCatalogueRevision() {
  await ensureSettings();
  const { rows } = await db.query(
    `UPDATE store_settings
     SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
     WHERE id = 1
     RETURNING catalogue_revision`
  );
  return Number(rows[0]?.catalogue_revision) || Date.now();
}

async function getCatalogueRevision() {
  const row = await getSettingsRow();
  const rev = Number(row?.catalogue_revision);
  if (Number.isFinite(rev) && rev > 0) return rev;
  // Fallback when column is brand new / empty DBs.
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(EXTRACT(EPOCH FROM updated_at))::bigint, 0) AS stamp
     FROM products`
  );
  return Number(rows[0]?.stamp) || 1;
}

// GET /api/store/status
exports.getStatus = async (req, res, next) => {
  try {
    const purchases_enabled = await getPurchasesEnabled();
    const payment = await getPaymentConfig();
    const catalogue_revision = await getCatalogueRevision();
    const settings = await getSettingsRow();
    const { listHomepageFeatures } = require('../services/categoriesHome');
    const homepage_features = await listHomepageFeatures();
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.json({
      purchases_enabled,
      payment_mode: payment.payment_mode,
      paystack_public_key: payment.public_key || null,
      catalogue_revision,
      announcement_text: String(settings?.announcement_text || 'Shop · Slay · Shine').slice(0, 120),
      homepage_features,
      message: purchases_enabled
        ? 'Store is open for purchases'
        : 'Item unavailable. Please try again later.',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/store/newsletter { email }
exports.subscribeNewsletter = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'Enter a valid email address');
    }

    const inserted = await db.query(
      `INSERT INTO newsletter_subscribers (email, source)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, created_at`,
      [email, 'footer']
    );

    if (inserted.rows.length > 0) {
      return res.status(201).json({
        message: 'You’re on the private list. Welcome.',
        subscriber: inserted.rows[0],
      });
    }

    const existing = await db.query(
      `SELECT id, email, created_at FROM newsletter_subscribers WHERE email = $1`,
      [email]
    );
    res.json({
      message: 'You’re already on the private list.',
      subscriber: existing.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

exports.getPurchasesEnabled = getPurchasesEnabled;
exports.getPaymentConfig = getPaymentConfig;
exports.getUsdToGhsRate = getUsdToGhsRate;
exports.bumpCatalogueRevision = bumpCatalogueRevision;
exports.getCatalogueRevision = getCatalogueRevision;
exports.ensureSettings = ensureSettings;
exports.getSettingsRow = getSettingsRow;
exports.publicSettingsPayload = publicSettingsPayload;
exports.publicSettingsPayloadAsync = publicSettingsPayloadAsync;
exports.normalizeHomepageFeatures = normalizeHomepageFeatures;
exports.DEFAULT_HOMEPAGE_FEATURES = DEFAULT_HOMEPAGE_FEATURES;
exports.maskKey = maskKey;
exports.verifyPaystackMode = verifyPaystackMode;
exports.keyLooksLike = keyLooksLike;

async function assertPurchasesEnabled() {
  const enabled = await getPurchasesEnabled();
  if (!enabled) {
    throw new ApiError(
      503,
      'Item unavailable. Please try again later.'
    );
  }
}

exports.assertPurchasesEnabled = assertPurchasesEnabled;
