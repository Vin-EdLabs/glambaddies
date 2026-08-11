const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');
const { ApiError } = require('../middleware/error');
const { getFrontendOrigin } = require('../utils/site');

const PAYSTACK_BASE_URL =
  process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

/**
 * GlamBaddies — catalogue, orders, and Paystack charges are all GHS.
 * Prices are stored as pesewas (1 GHS = 100 pesewas). No USD conversion.
 */
const PAYSTACK_CHARGE_CURRENCY = 'GHS';
const APP_NAME = process.env.APP_NAME || 'GlamBaddies';

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

function paystackErrorMessage(err, fallback = 'Payment provider request failed') {
  if (err instanceof ApiError) return err.message;
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message || fallback;
  }
  return err?.message || fallback;
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
  return channels.length
    ? [...new Set(channels)]
    : ['card', 'mobile_money', 'bank_transfer'];
}

async function initializePaystackCharge(client, {
  email,
  amountPesewas,
  reference,
  callback_url,
  metadata,
  channels,
}) {
  const amount = Math.round(Number(amountPesewas));
  const payload = {
    email,
    amount,
    currency: PAYSTACK_CHARGE_CURRENCY,
    reference,
    channels: Array.isArray(channels) && channels.length
      ? channels
      : ['card', 'mobile_money', 'bank_transfer'],
    metadata,
  };
  if (callback_url) payload.callback_url = callback_url;

  console.log('[paystack:initialize:request]', {
    email,
    amount: payload.amount,
    currency: payload.currency,
    reference: payload.reference,
    channels: payload.channels,
    app: APP_NAME,
  });

  const response = await client.post('/transaction/initialize', payload);
  const data = response.data?.data;
  if (!response.data?.status || !data?.authorization_url || !data?.access_code) {
    const message = response.data?.message || 'Failed to initialize payment';
    throw new ApiError(502, message);
  }

  console.log('[paystack:initialize:response]', {
    reference: data.reference || reference,
    access_code: Boolean(data.access_code),
    amount: data.amount,
    currency: data.currency,
  });

  return data;
}

async function loadPayableOrder(req, orderId) {
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
  const phoneDigits = String(address.phone || '')
    .replace(/\D/g, '');
  const resolvedEmail =
    email ||
    (phoneDigits ? `${phoneDigits}@checkout.glambaddies.com` : '');
  if (!resolvedEmail) throw new ApiError(400, 'Order is missing contact details');

  // total_cents is GHS pesewas — charged as-is (no conversion).
  const amountGhsPesewas = Math.round(Number(order.total_cents));
  if (amountGhsPesewas < 100) {
    throw new ApiError(400, 'Order total is too low for payment');
  }

  return { order, address, email: resolvedEmail, amountGhsPesewas };
}

async function lockOrderPayment({ order, email, amountGhsPesewas, reference }) {
  const address =
    typeof order.shipping_address === 'string'
      ? JSON.parse(order.shipping_address)
      : order.shipping_address || {};

  const existingCustomerEmail = String(
    address.customer_email || address.email || ''
  )
    .trim()
    .toLowerCase();
  const customerEmail =
    existingCustomerEmail &&
    !existingCustomerEmail.endsWith('@checkout.glambaddies.com')
      ? existingCustomerEmail
      : String(email || '')
          .trim()
          .toLowerCase()
          .endsWith('@checkout.glambaddies.com')
        ? existingCustomerEmail || null
        : String(email || '')
            .trim()
            .toLowerCase() || null;

  await db.query(
    `UPDATE orders
     SET payment_reference = $1,
         currency = 'GHS',
         shipping_address = COALESCE(shipping_address, '{}'::jsonb)
           || jsonb_build_object(
                'paystack_currency', 'GHS',
                'paystack_amount_minor', $2::int,
                'display_currency', 'GHS',
                'display_amount_cents', $2::int,
                'paystack_email', $3::text,
                'store_name', $4::text
              )
           || CASE
                WHEN $5::text IS NOT NULL AND $5::text <> '' THEN
                  jsonb_build_object(
                    'email', $5::text,
                    'customer_email', $5::text,
                    'email_provided', true
                  )
                ELSE '{}'::jsonb
              END,
         updated_at = NOW()
     WHERE id = $6`,
    [reference, amountGhsPesewas, email, APP_NAME, customerEmail, order.id]
  );
}

async function assertPaymentConfigured() {
  const {
    assertPurchasesEnabled,
    getPaymentConfig,
    keyLooksLike,
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
  return paymentConfig;
}

function paymentReferenceFor(orderId) {
  return `GLAM-${orderId}-${crypto.randomBytes(8).toString('hex')}`;
}

// POST /api/payment/prepare { order_id }
// Apple Pay paymentRequest — GHS pesewas (no conversion).
exports.prepare = async (req, res, next) => {
  try {
    const paymentConfig = await assertPaymentConfigured();
    if (!paymentConfig.public_key) {
      throw new ApiError(500, 'Paystack public key is missing.');
    }

    const orderId = Number(req.body?.order_id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      throw new ApiError(400, 'order_id is required');
    }

    const { order, email, amountGhsPesewas } = await loadPayableOrder(req, orderId);
    const reference = paymentReferenceFor(order.id);

    await lockOrderPayment({ order, email, amountGhsPesewas, reference });

    res.json({
      reference,
      email,
      amount: amountGhsPesewas,
      amount_ghs_pesewas: amountGhsPesewas,
      currency: 'GHS',
      paystack_public_key: paymentConfig.public_key,
      payment_mode: paymentConfig.payment_mode,
      order_id: order.id,
      display_currency: 'GHS',
      display_amount: Number((amountGhsPesewas / 100).toFixed(2)),
      charged_currency: 'GHS',
      charged_amount: Number((amountGhsPesewas / 100).toFixed(2)),
      store_name: APP_NAME,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/payment/initialize { order_id, channels? }
// Charge GHS directly — catalogue prices are already GHS.
exports.initialize = async (req, res, next) => {
  try {
    const paymentConfig = await assertPaymentConfigured();

    const orderId = Number(req.body?.order_id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      throw new ApiError(400, 'order_id is required');
    }

    const { order, email, amountGhsPesewas } = await loadPayableOrder(req, orderId);
    const channels = resolvePaystackChannels(req.body?.channels);
    const reference = paymentReferenceFor(order.id);
    const callback_url = `${getFrontendOrigin()}/payment/verify`;
    const client = paystackClient(paymentConfig.secret_key);

    console.log('[payment:initialize]', {
      order_id: order.id,
      email,
      amountGhsPesewas,
      currency: PAYSTACK_CHARGE_CURRENCY,
      reference,
      store_name: APP_NAME,
    });

    let data;
    try {
      data = await initializePaystackCharge(client, {
        email,
        amountPesewas: amountGhsPesewas,
        reference,
        callback_url,
        channels,
        metadata: {
          order_id: order.id,
          user_id: order.user_id || null,
          guest: !order.user_id,
          payment_mode: paymentConfig.payment_mode,
          charged_currency: 'GHS',
          charged_amount_pesewas: amountGhsPesewas,
          display_currency: 'GHS',
          display_amount_cents: amountGhsPesewas,
          store_name: APP_NAME,
          channels,
        },
      });
    } catch (initErr) {
      throw new ApiError(
        502,
        paystackErrorMessage(initErr, 'Could not start payment with Paystack')
      );
    }

    await lockOrderPayment({ order, email, amountGhsPesewas, reference });

    res.json({
      authorization_url: data.authorization_url,
      access_code: data.access_code,
      reference: data.reference || reference,
      email,
      payment_mode: paymentConfig.payment_mode,
      paystack_public_key: paymentConfig.public_key || null,
      amount: amountGhsPesewas,
      amount_ghs_pesewas: amountGhsPesewas,
      currency: 'GHS',
      display_currency: 'GHS',
      display_amount: Number((amountGhsPesewas / 100).toFixed(2)),
      charged_currency: 'GHS',
      charged_amount: Number((amountGhsPesewas / 100).toFixed(2)),
      store_name: APP_NAME,
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
      // Retry receipt if the first verify succeeded before SMTP was ready
      try {
        const { sendPaymentReceipt } = require('../services/orderEmails');
        await sendPaymentReceipt(order.id);
      } catch (mailErr) {
        console.error('[mail] payment receipt retry failed:', mailErr.message);
      }
      return res.json({
        verified: true,
        already_processed: true,
        order_id: order.id,
        order_status: order.status,
      });
    }

    const { getPaymentConfig } = require('./store.controller');
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

    const expectedCurrency = String(
      address.paystack_currency || 'GHS'
    ).toUpperCase();
    const expectedAmount = Number(address.paystack_amount_minor);
    if (!expectedAmount) {
      throw new ApiError(400, 'Order is missing locked Paystack amount');
    }

    if (String(tx.currency).toUpperCase() !== expectedCurrency) {
      throw new ApiError(
        400,
        `Payment currency does not match expected ${expectedCurrency} charge`
      );
    }
    if (Number(tx.amount) !== expectedAmount) {
      throw new ApiError(400, 'Payment amount does not match order total');
    }

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
            display_currency: 'GHS',
            display_amount_cents: order.total_cents,
            store_name: APP_NAME,
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

    // Premium receipt email — never block payment success if mail fails
    try {
      const { sendPaymentReceipt } = require('../services/orderEmails');
      await sendPaymentReceipt(order.id);
    } catch (mailErr) {
      console.error('[mail] payment receipt failed:', mailErr.message);
    }

    res.json({
      verified: true,
      already_processed: false,
      order_id: order.id,
      order_status: 'paid',
      charged_currency: expectedCurrency,
      display_currency: 'GHS',
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
