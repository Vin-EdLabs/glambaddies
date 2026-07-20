const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');
const { ApiError } = require('../middleware/error');

const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

function paystackClient(secretKey) {
  if (!secretKey) {
    throw new ApiError(
      500,
      'Payment provider is not configured. Add Paystack keys in Admin → Settings → Payments.'
    );
  }
  return axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: { Authorization: `Bearer ${secretKey}` },
    timeout: 15000,
  });
}

async function initializePaystackCharge(client, {
  email,
  amount,
  currency,
  reference,
  callback_url,
  metadata,
  channels,
}) {
  const payload = {
    email,
    amount: Math.round(Number(amount)),
    currency,
    reference,
    // Card first by default so the popup opens on the Card tab.
    channels: Array.isArray(channels) && channels.length
      ? channels
      : ['card', 'mobile_money', 'bank_transfer'],
    metadata,
  };
  if (callback_url) payload.callback_url = callback_url;

  const response = await client.post('/transaction/initialize', payload);
  const data = response.data?.data;
  if (!response.data?.status || !data?.authorization_url) {
    const message = response.data?.message || 'Failed to initialize payment';
    throw new ApiError(502, message);
  }
  return data;
}

const ALLOWED_PAYSTACK_CHANNELS = new Set([
  'card',
  'mobile_money',
  'bank_transfer',
  'apple_pay',
  'bank',
  'ussd',
  'qr',
  'eft',
]);

function resolvePaystackChannels(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',').map((item) => item.trim())
      : [];
  const channels = list
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => ALLOWED_PAYSTACK_CHANNELS.has(item));
  return channels.length ? [...new Set(channels)] : ['card', 'mobile_money', 'bank_transfer'];
}

function paystackErrorMessage(err, fallback = 'Payment provider request failed') {
  if (err instanceof ApiError) return err.message;
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message || fallback;
  }
  return err?.message || fallback;
}

function getFrontendOrigin() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:5173'
  ).replace(/\/$/, '');
}

// POST /api/payment/initialize { order_id, channels? }
// Store catalogue is USD. Merchant charges GHS via admin USD→GHS rate.
// Apple Pay and Paystack buttons share this exact flow; only `channels` differs.
exports.initialize = async (req, res, next) => {
  try {
    const {
      assertPurchasesEnabled,
      getPaymentConfig,
      keyLooksLike,
      getUsdToGhsRate,
    } = require('./store.controller');
    await assertPurchasesEnabled();
    const paymentConfig = await getPaymentConfig();
    if (!paymentConfig.secret_key) {
      throw new ApiError(
        500,
        'Payment provider is not configured. Add Paystack keys in Admin → Settings → Payments.'
      );
    }
    const keyCheck = keyLooksLike(
      paymentConfig.payment_mode,
      paymentConfig.public_key,
      paymentConfig.secret_key
    );
    if (!keyCheck.secretOk || (paymentConfig.public_key && !keyCheck.publicOk)) {
      throw new ApiError(
        500,
        paymentConfig.payment_mode === 'live'
          ? 'Store is set to LIVE but Paystack live keys are missing or invalid. Fix keys in Admin → Settings → Payments.'
          : 'Store is set to TEST but Paystack test keys are missing or invalid. Fix keys in Admin → Settings → Payments.'
      );
    }

    const orderId = Number(req.body?.order_id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      throw new ApiError(400, 'order_id is required');
    }

    let order;
    if (req.checkout) {
      if (req.checkout.orderId !== orderId) {
        throw new ApiError(403, 'Checkout token does not match this order');
      }
      const { rows } = await db.query(
        `SELECT o.id, o.status, o.total_cents, o.currency, o.user_id, o.shipping_address
         FROM orders o
         WHERE o.id = $1`,
        [orderId]
      );
      order = rows[0];
    } else {
      const { rows } = await db.query(
        `SELECT o.id, o.status, o.total_cents, o.currency, o.user_id, o.shipping_address,
                u.email AS user_email
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.id = $1 AND o.user_id = $2`,
        [orderId, req.user.id]
      );
      order = rows[0];
    }

    if (!order) throw new ApiError(404, 'Order not found');
    if (order.status !== 'pending') {
      throw new ApiError(400, `Order is already ${order.status}`);
    }
    if (order.total_cents <= 0) {
      throw new ApiError(400, 'Order total must be greater than zero');
    }

    const address =
      typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address || {};
    const email = String(
      req.checkout?.email || address.email || order.user_email || ''
    )
      .trim()
      .toLowerCase();
    if (!email) throw new ApiError(400, 'Order is missing a contact email');

    const amountUsdCents = Math.round(Number(order.total_cents));
    if (amountUsdCents < 100) {
      throw new ApiError(400, 'Order total is too low for payment');
    }

    const rate = await getUsdToGhsRate();
    // Same conversion for every channel (card / mobile money / Apple Pay).
    // e.g. $1.00 (100 cents) × 15.5 → 1550 pesewas (GHS 15.50)
    const amountGhsPesewas = Math.max(100, Math.round(amountUsdCents * rate));
    const channels = resolvePaystackChannels(req.body?.channels);
    const reference = `VUB-${order.id}-${crypto.randomBytes(8).toString('hex')}`;
    const callback_url = `${getFrontendOrigin()}/order-confirmation`;
    const client = paystackClient(paymentConfig.secret_key);

    let data;
    try {
      data = await initializePaystackCharge(client, {
        email,
        amount: amountGhsPesewas,
        currency: 'GHS',
        reference,
        callback_url,
        channels,
        metadata: {
          order_id: order.id,
          user_id: order.user_id || null,
          guest: !order.user_id,
          payment_mode: paymentConfig.payment_mode,
          charged_currency: 'GHS',
          charged_amount_cents: amountGhsPesewas,
          display_currency: 'USD',
          display_amount_cents: amountUsdCents,
          usd_to_ghs_rate: rate,
          channels,
        },
      });
    } catch (initErr) {
      throw new ApiError(
        502,
        paystackErrorMessage(initErr, 'Could not start payment with Paystack.')
      );
    }

    await db.query(
      `UPDATE orders
       SET payment_reference = $1,
           shipping_address = COALESCE(shipping_address, '{}'::jsonb)
             || jsonb_build_object(
                  'paystack_currency', 'GHS',
                  'paystack_amount_minor', $2::int,
                  'usd_to_ghs_rate', $3::numeric,
                  'display_currency', 'USD',
                  'display_amount_cents', $4::int
                ),
           updated_at = NOW()
       WHERE id = $5`,
      [reference, amountGhsPesewas, rate, amountUsdCents, order.id]
    );

    res.json({
      authorization_url: data.authorization_url,
      access_code: data.access_code,
      reference,
      payment_mode: paymentConfig.payment_mode,
      paystack_public_key: paymentConfig.public_key || null,
      display_currency: 'USD',
      display_amount: Number((amountUsdCents / 100).toFixed(2)),
      charged_currency: 'GHS',
      charged_amount: Number((amountGhsPesewas / 100).toFixed(2)),
      exchange_rate: rate,
      channels,
    });
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    if (axios.isAxiosError(err)) {
      const message =
        err.response?.data?.message || 'Payment provider request failed';
      return next(new ApiError(502, message));
    }
    next(err);
  }
};

// GET /api/payment/verify/:reference
exports.verify = async (req, res, next) => {
  const { reference } = req.params;
  try {
    if (!reference || !/^[\w-]{1,100}$/.test(reference)) {
      throw new ApiError(400, 'Invalid payment reference');
    }

    const { rows } = await db.query(
      `SELECT id, user_id, status, total_cents, currency, shipping_address
       FROM orders WHERE payment_reference = $1`,
      [reference]
    );
    const order = rows[0];
    if (!order) {
      throw new ApiError(404, 'Order not found for this reference');
    }

    const allowed =
      (req.checkout && req.checkout.orderId === order.id) ||
      (req.user && order.user_id === req.user.id);
    if (!allowed) {
      throw new ApiError(404, 'Order not found for this reference');
    }

    const existing = await db.query(
      'SELECT id, status, amount_cents, currency FROM payments WHERE reference = $1',
      [reference]
    );
    if (existing.rows.length > 0) {
      return res.json({
        verified: true,
        already_processed: true,
        order_id: order.id,
        order_status: order.status,
      });
    }

    const { getPaymentConfig, getUsdToGhsRate } = require('./store.controller');
    const paymentConfig = await getPaymentConfig();
    const response = await paystackClient(paymentConfig.secret_key).get(
      `/transaction/verify/${encodeURIComponent(reference)}`
    );
    const tx = response.data?.data;
    if (!response.data?.status || !tx) {
      throw new ApiError(502, 'Could not verify transaction with Paystack');
    }

    if (tx.status !== 'success') {
      return res.status(402).json({
        verified: false,
        gateway_status: tx.status,
        error: 'Payment was not successful',
      });
    }

    const address =
      typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address || {};

    // Accept historical GHS charges that still use the stored minor amount,
    // but all new payments are USD cents matching the order total.
    const expectedCurrency = String(
      address.paystack_currency || 'USD'
    ).toUpperCase();
    const expectedAmount = Number(
      address.paystack_amount_minor || order.total_cents
    );

    if (String(tx.currency).toUpperCase() !== expectedCurrency) {
      throw new ApiError(
        400,
        `Payment currency does not match expected ${expectedCurrency} charge`
      );
    }
    if (Number(tx.amount) !== expectedAmount) {
      throw new ApiError(400, 'Payment amount does not match order total');
    }

    const rate = Number(address.usd_to_ghs_rate) || (await getUsdToGhsRate());
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO payments (order_id, reference, provider, transaction_id,
                               amount_cents, currency, status, channel, raw_response)
         VALUES ($1, $2, 'paystack', $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          reference,
          tx.id,
          tx.amount,
          expectedCurrency,
          tx.status,
          tx.channel || null,
          JSON.stringify({
            id: tx.id,
            status: tx.status,
            amount: tx.amount,
            currency: tx.currency,
            channel: tx.channel,
            paid_at: tx.paid_at,
            display_currency: 'USD',
            display_amount_cents: order.total_cents,
            usd_to_ghs_rate: rate,
          }),
        ]
      );

      await client.query(
        `UPDATE orders
         SET status = 'paid', paystack_transaction_id = $1,
             paid_at = COALESCE($2::timestamptz, NOW()), updated_at = NOW()
         WHERE id = $3 AND status = 'pending'`,
        [tx.id, tx.paid_at || null, order.id]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      if (txErr.code === '23505') {
        return res.json({
          verified: true,
          already_processed: true,
          order_id: order.id,
          order_status: 'paid',
        });
      }
      throw txErr;
    } finally {
      client.release();
    }

    res.json({
      verified: true,
      already_processed: false,
      order_id: order.id,
      order_status: 'paid',
      charged_currency: expectedCurrency,
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message =
        err.response?.data?.message || 'Payment provider request failed';
      return next(new ApiError(502, message));
    }
    next(err);
  }
};
