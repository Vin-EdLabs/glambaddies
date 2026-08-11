const crypto = require('crypto');
const db = require('../config/db');
const { ApiError } = require('../middleware/error');

/**
 * Paystack webhook receiver.
 * Configure in Paystack Dashboard → Settings → Webhooks:
 *   https://www.glambaddies.com/api/webhook/paystack
 *
 * Signature verification uses PAYSTACK_SECRET_KEY (or admin store_settings key).
 */
exports.paystackWebhook = async (req, res, next) => {
  try {
    const signature = String(req.headers['x-paystack-signature'] || '');
    let secret = process.env.PAYSTACK_SECRET_KEY;
    try {
      const { getPaymentConfig } = require('./store.controller');
      const config = await getPaymentConfig();
      if (config?.secret_key) secret = config.secret_key;
    } catch {
      /* use env secret */
    }

    if (secret && signature) {
      const hash = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (hash !== signature) {
        throw new ApiError(401, 'Invalid Paystack signature');
      }
    }

    const event = req.body?.event;
    const data = req.body?.data || {};
    const reference = data.reference;

    if (event === 'charge.success' && reference) {
      await db.query(
        `UPDATE orders
         SET status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END,
             paid_at = COALESCE(paid_at, NOW()),
             updated_at = NOW()
         WHERE payment_reference = $1`,
        [reference]
      );
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};
