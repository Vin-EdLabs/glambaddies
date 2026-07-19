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
    INSERT INTO store_settings (id, purchases_enabled)
    VALUES (1, TRUE)
    ON CONFLICT (id) DO NOTHING
  `);

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

function publicSettingsPayload(row) {
  return {
    purchases_enabled: row.purchases_enabled !== false,
    payment_mode: row.payment_mode === 'live' ? 'live' : 'test',
    paystack_test_public_key: row.paystack_test_public_key || '',
    paystack_test_secret_key: row.paystack_test_secret_key || '',
    paystack_live_public_key: row.paystack_live_public_key || '',
    paystack_live_secret_key: row.paystack_live_secret_key || '',
    updated_at: row.updated_at,
  };
}

// GET /api/store/status
exports.getStatus = async (req, res, next) => {
  try {
    const purchases_enabled = await getPurchasesEnabled();
    const payment = await getPaymentConfig();
    res.json({
      purchases_enabled,
      payment_mode: payment.payment_mode,
      paystack_public_key: payment.public_key || null,
      message: purchases_enabled
        ? 'Store is open for purchases'
        : 'Item unavailable. Please try again later.',
    });
  } catch (err) {
    next(err);
  }
};

exports.getPurchasesEnabled = getPurchasesEnabled;
exports.getPaymentConfig = getPaymentConfig;
exports.ensureSettings = ensureSettings;
exports.getSettingsRow = getSettingsRow;
exports.publicSettingsPayload = publicSettingsPayload;
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
