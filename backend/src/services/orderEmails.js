const db = require('../config/db');
const { sendMail } = require('./mailer');
const { getPublicSiteUrl, getSupportEmail } = require('../utils/site');

const APP_NAME = process.env.APP_NAME || 'GlamBaddies';
const FRONTEND = getPublicSiteUrl();
const SUPPORT_EMAIL = getSupportEmail();
const LOGO_URL = `${FRONTEND}/logo.png`;

const STATUS_COPY = {
  pending: {
    label: 'Pending payment',
    headline: 'We’re holding your bag',
    body: 'Complete payment to confirm your GlamBaddies order.',
  },
  paid: {
    label: 'Payment confirmed',
    headline: 'Thank you — you’re all set',
    body: 'We’ve received your payment and are preparing your dresses with care.',
  },
  shipped: {
    label: 'On the way',
    headline: 'Your order is on its way',
    body: 'Your GlamBaddies order has been shipped. Keep an eye on your phone for delivery updates.',
  },
  delivered: {
    label: 'Delivered',
    headline: 'Your order has arrived',
    body: 'We hope you love every piece. Shop · Slay · Shine.',
  },
  cancelled: {
    label: 'Cancelled',
    headline: 'Order cancelled',
    body: 'This order was cancelled. If you have questions, reply to this email or contact support@glambaddies.com.',
  },
};

function formatGhs(cents) {
  const amount = Number(cents || 0) / 100;
  return `GH₵${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveRecipient(address = {}, userEmail) {
  const candidates = [
    address.customer_email,
    address.email_provided && address.email,
    address.email,
    userEmail,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  return (
    candidates.find(
      (email) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        !email.endsWith('@checkout.glambaddies.com')
    ) || null
  );
}

async function loadOrderForEmail(orderId) {
  const { rows } = await db.query(
    `SELECT o.id, o.status, o.currency, o.total_cents, o.payment_reference,
            o.paid_at, o.created_at, o.shipping_address,
            u.email AS user_email, u.name AS user_name,
            COALESCE(
              (SELECT json_agg(json_build_object(
                  'product_name', oi.product_name,
                  'quantity', oi.quantity,
                  'unit_price_cents', oi.unit_price_cents,
                  'line_total_cents', oi.unit_price_cents * oi.quantity
                ) ORDER BY oi.id)
               FROM order_items oi WHERE oi.order_id = o.id),
              '[]'::json
            ) AS items
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.id = $1`,
    [Number(orderId)]
  );
  if (!rows[0]) return null;

  const order = rows[0];
  const address =
    typeof order.shipping_address === 'string'
      ? JSON.parse(order.shipping_address)
      : order.shipping_address || {};
  const bagItems = Array.isArray(address.bag_items) ? address.bag_items : [];
  const items = (order.items || []).map((item) => {
    const snap =
      bagItems.find(
        (bag) =>
          String(bag.name || '').toLowerCase() ===
            String(item.product_name || '').toLowerCase() ||
          Number(bag.product_id) === Number(item.product_id)
      ) || {};
    return {
      ...item,
      color: snap.color || null,
      size: snap.size || null,
    };
  });

  return {
    id: order.id,
    status: order.status,
    total_cents: order.total_cents,
    payment_reference: order.payment_reference,
    paid_at: order.paid_at,
    created_at: order.created_at,
    address,
    items,
    to: resolveRecipient(address, order.user_email),
    customerName:
      address.full_name || address.guest_name || order.user_name || 'Glam client',
  };
}

function itemRowsHtml(items) {
  if (!items.length) {
    return `<tr><td colspan="3" style="padding:14px 0;color:#7a6570;">No line items</td></tr>`;
  }
  return items
    .map((item) => {
      const opts = [item.color, item.size ? `Size ${item.size}` : null]
        .filter(Boolean)
        .join(' · ');
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #efd5d0;vertical-align:top;">
            <div style="font-weight:600;color:#1a1216;">${escapeHtml(item.product_name)}</div>
            ${opts ? `<div style="margin-top:4px;font-size:12px;color:#7a6570;">${escapeHtml(opts)}</div>` : ''}
            <div style="margin-top:4px;font-size:12px;color:#7a6570;">Qty ${escapeHtml(item.quantity)}</div>
          </td>
          <td style="padding:14px 8px;border-bottom:1px solid #efd5d0;text-align:right;white-space:nowrap;color:#1a1216;font-weight:600;">
            ${formatGhs(item.line_total_cents)}
          </td>
        </tr>`;
    })
    .join('');
}

function wrapReceipt({ preheader, title, intro, order, statusKey, extraNote }) {
  const status = STATUS_COPY[statusKey] || STATUS_COPY.paid;
  const phone = order.address.phone || '';
  const fulfillment =
    order.address.fulfillment_method === 'pickup' ? 'Pickup' : 'Delivery';
  const trackUrl = phone
    ? `${FRONTEND}/track-order?phone=${encodeURIComponent(phone)}`
    : `${FRONTEND}/track-order`;
  const placed = order.created_at
    ? new Date(order.created_at).toLocaleString('en-GH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8ece8;font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8ece8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff8f6;border:1px solid #efd5d0;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px;background:#e91e8c;color:#ffffff;">
              <img src="${escapeHtml(LOGO_URL)}" alt="${escapeHtml(APP_NAME)}" width="72" height="72" style="display:block;border-radius:12px;background:#ffffff;padding:4px;" />
              <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#ffffff;">Shop · Slay · Shine</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.1;font-weight:500;color:#ffffff;">${escapeHtml(APP_NAME)}</div>
              <div style="margin-top:14px;display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.22);font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">
                ${escapeHtml(status.label)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#c4787a;">Receipt</p>
              <h1 style="margin:10px 0 12px;font-size:28px;line-height:1.15;color:#1a1216;font-weight:500;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5b4a52;">
                Hi ${escapeHtml(order.customerName)}, ${escapeHtml(intro || status.body)}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5b4a52;">
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Order</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;font-weight:600;">#${escapeHtml(order.id)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Placed</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(placed)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Fulfillment</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(fulfillment)}</td>
                </tr>
                ${
                  phone
                    ? `<tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Phone</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(phone)}</td>
                </tr>`
                    : ''
                }
                ${
                  order.address.location
                    ? `<tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Location</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(order.address.location)}</td>
                </tr>`
                    : ''
                }
              </table>

              ${
                statusKey === 'cancelled' && order.address.cancel_reason
                  ? `<div style="margin:8px auto 28px;padding:18px 20px;border-radius:14px;background:#fff1f0;border:1px solid #f0c2bc;font-family:Arial,Helvetica,sans-serif;text-align:center;max-width:420px;">
                <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a85a45;margin-bottom:8px;">Reason for cancellation</div>
                <div style="font-size:16px;line-height:1.5;color:#1a1216;font-weight:600;">${escapeHtml(order.address.cancel_reason)}</div>
              </div>`
                  : ''
              }

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
                <thead>
                  <tr>
                    <th align="left" style="padding:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6570;border-bottom:1px solid #efd5d0;">Items</th>
                    <th align="right" style="padding:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6570;border-bottom:1px solid #efd5d0;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml(order.items)}
                </tbody>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;">
                <tr>
                  <td style="padding:16px 0 0;font-size:13px;color:#7a6570;">Total</td>
                  <td style="padding:16px 0 0;text-align:right;font-size:22px;color:#1a1216;font-weight:600;">${formatGhs(order.total_cents)}</td>
                </tr>
              </table>

              ${
                extraNote
                  ? `<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#5b4a52;">${escapeHtml(extraNote)}</p>`
                  : ''
              }

              <div style="margin:28px 0 8px;text-align:center;">
                <a href="${escapeHtml(FRONTEND)}" style="display:inline-block;padding:14px 22px;background:#e91e8c;color:#fff;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
                  Visit our store
                </a>
              </div>
              <div style="margin:12px 0 8px;text-align:center;">
                <a href="${escapeHtml(trackUrl)}" style="display:inline-block;padding:12px 20px;background:transparent;color:#e91e8c;text-decoration:none;border:1px solid #e91e8c;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
                  Track your order
                </a>
              </div>
              <p style="margin:12px 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6570;">
                Track anytime with your phone number — no sign-in needed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 26px;border-top:1px solid #efd5d0;background:#fff5f2;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#7a6570;text-align:center;">
              ${escapeHtml(APP_NAME)} · Girls’ dresses only · Shop · Slay · Shine<br />
              Questions? <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#e91e8c;text-decoration:none;">${escapeHtml(SUPPORT_EMAIL)}</a><br />
              <a href="${escapeHtml(FRONTEND)}" style="color:#7a6570;">${escapeHtml(FRONTEND.replace(/^https?:\/\//, ''))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendOrderReceiptEmail(orderId, { kind = 'paid' } = {}) {
  const order = await loadOrderForEmail(orderId);
  if (!order?.to) {
    console.warn(`[mail] No customer email for order #${orderId}`);
    return { ok: false, error: 'No customer email' };
  }

  if (kind === 'paid' && order.address.receipt_emailed_at) {
    console.log(`[mail] receipt already sent for order #${orderId}`);
    return { ok: true, already_sent: true };
  }

  const statusKey = kind === 'status' ? order.status : kind;
  const status = STATUS_COPY[statusKey] || STATUS_COPY.paid;
  const subject =
    statusKey === 'paid'
      ? `${APP_NAME} receipt · Order #${order.id}`
      : `${APP_NAME} update · Order #${order.id} is ${status.label.toLowerCase()}`;

  const html = wrapReceipt({
    preheader: `${status.label} — Order #${order.id} · ${formatGhs(order.total_cents)}`,
    title: status.headline,
    intro: status.body,
    order,
    statusKey,
    extraNote:
      statusKey === 'paid'
        ? 'This email is your official payment receipt. Keep it for your records.'
        : undefined,
  });

  const result = await sendMail({
    to: order.to,
    subject,
    html,
  });

  if (result.ok && kind === 'paid') {
    try {
      await db.query(
        `UPDATE orders
         SET shipping_address = COALESCE(shipping_address, '{}'::jsonb)
           || jsonb_build_object('receipt_emailed_at', $2::text),
             updated_at = NOW()
         WHERE id = $1`,
        [order.id, new Date().toISOString()]
      );
    } catch (markErr) {
      console.warn('[mail] could not mark receipt_emailed_at:', markErr.message);
    }
  }

  return result;
}

async function sendPaymentReceipt(orderId) {
  const customerResult = await sendOrderReceiptEmail(orderId, { kind: 'paid' });
  try {
    await sendAdminNewOrderEmail(orderId);
  } catch (adminErr) {
    console.error('[mail] admin order alert failed:', adminErr.message);
  }
  return customerResult;
}

async function sendStatusUpdateEmail(orderId) {
  const order = await loadOrderForEmail(orderId);
  if (!order) return { ok: false, error: 'Order not found' };

  // Dedicated cancel path — always include reason and fail loudly in logs
  if (order.status === 'cancelled') {
    if (!order.to) {
      console.warn(`[mail] Cancel email skipped for order #${orderId}: no customer email`);
      return { ok: false, error: 'No customer email' };
    }
    const status = STATUS_COPY.cancelled;
    const subject = `${APP_NAME} · Order #${order.id} cancelled`;
    const html = wrapReceipt({
      preheader: `Order #${order.id} was cancelled`,
      title: status.headline,
      intro: 'Your GlamBaddies order has been cancelled. Details are below.',
      order,
      statusKey: 'cancelled',
      extraNote: undefined,
    });
    const result = await sendMail({ to: order.to, subject, html });
    console.log(
      `[mail] cancel email order #${orderId} → ${order.to}:`,
      result.ok ? 'sent' : result.error
    );
    return result;
  }

  return sendOrderReceiptEmail(orderId, { kind: 'status' });
}

async function listAdminEmails() {
  const { rows } = await db.query(
    `SELECT email FROM admins
     WHERE email IS NOT NULL AND email <> ''
     ORDER BY id ASC`
  );
  return rows
    .map((row) => String(row.email || '').trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function wrapAdminOrderAlert(order) {
  const phone = order.address.phone || '—';
  const email = order.to || order.address.email || '—';
  const fulfillment =
    order.address.fulfillment_method === 'pickup' ? 'Pickup' : 'Delivery';
  const location = order.address.location || order.address.street || '—';
  const adminUrl = `${FRONTEND}/glam-baddies/orders/${order.id}`;
  const placed = order.created_at
    ? new Date(order.created_at).toLocaleString('en-GH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New order #${escapeHtml(order.id)}</title>
</head>
<body style="margin:0;padding:0;background:#f8ece8;font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">New paid order #${escapeHtml(order.id)} · ${escapeHtml(formatGhs(order.total_cents))}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8ece8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff8f6;border:1px solid #efd5d0;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px;background:#e91e8c;color:#ffffff;">
              <img src="${escapeHtml(LOGO_URL)}" alt="${escapeHtml(APP_NAME)}" width="64" height="64" style="display:block;border-radius:12px;background:#ffffff;padding:4px;" />
              <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#ffffff;">Admin alert</div>
              <div style="margin-top:10px;font-size:28px;line-height:1.1;font-weight:500;color:#ffffff;">New order received</div>
              <div style="margin-top:14px;display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.22);font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">
                Paid · #${escapeHtml(order.id)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#5b4a52;">
                A customer just completed payment on ${escapeHtml(APP_NAME)}. Review and fulfil this order from your admin portal.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;font-size:13px;color:#5b4a52;">
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Customer</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;font-weight:600;">${escapeHtml(order.customerName)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Phone</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(phone)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Email</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(email)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Fulfillment</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(fulfillment)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Location</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(location)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Placed</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;">${escapeHtml(placed)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;">Total</td>
                  <td style="padding:8px 0;border-top:1px solid #efd5d0;text-align:right;color:#1a1216;font-size:18px;font-weight:700;">${formatGhs(order.total_cents)}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;">
                <thead>
                  <tr>
                    <th align="left" style="padding:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6570;border-bottom:1px solid #efd5d0;">Items</th>
                    <th align="right" style="padding:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6570;border-bottom:1px solid #efd5d0;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml(order.items)}
                </tbody>
              </table>

              <div style="margin:28px 0 8px;text-align:center;">
                <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:14px 22px;background:#e91e8c;color:#fff;text-decoration:none;border-radius:4px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
                  Open order in admin
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 26px;border-top:1px solid #efd5d0;background:#fff5f2;font-size:12px;line-height:1.55;color:#7a6570;text-align:center;">
              ${escapeHtml(APP_NAME)} admin notification · Sent to every admin account email<br />
              Support: <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#e91e8c;text-decoration:none;">${escapeHtml(SUPPORT_EMAIL)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendAdminNewOrderEmail(orderId) {
  const order = await loadOrderForEmail(orderId);
  if (!order) {
    return { ok: false, error: 'Order not found' };
  }
  if (order.address.admin_notified_at) {
    console.log(`[mail] admin already notified for order #${orderId}`);
    return { ok: true, already_sent: true };
  }

  const admins = await listAdminEmails();
  if (!admins.length) {
    console.warn('[mail] No admin emails found for new-order alert');
    return { ok: false, error: 'No admin emails' };
  }

  const subject = `${APP_NAME} · New paid order #${order.id} · ${formatGhs(order.total_cents)}`;
  const html = wrapAdminOrderAlert(order);
  const results = [];
  for (const adminEmail of admins) {
    results.push(
      await sendMail({
        to: adminEmail,
        subject,
        html,
      })
    );
  }

  const anyOk = results.some((result) => result.ok);
  if (anyOk) {
    try {
      await db.query(
        `UPDATE orders
         SET shipping_address = COALESCE(shipping_address, '{}'::jsonb)
           || jsonb_build_object('admin_notified_at', $2::text),
             updated_at = NOW()
         WHERE id = $1`,
        [order.id, new Date().toISOString()]
      );
    } catch (markErr) {
      console.warn('[mail] could not mark admin_notified_at:', markErr.message);
    }
  }

  return {
    ok: anyOk,
    sent: results.filter((result) => result.ok).length,
    total: admins.length,
  };
}

module.exports = {
  loadOrderForEmail,
  sendPaymentReceipt,
  sendStatusUpdateEmail,
  sendAdminNewOrderEmail,
  resolveRecipient,
};
