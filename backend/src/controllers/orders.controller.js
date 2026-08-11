const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { ApiError } = require('../middleware/error');
const { parsePagination } = require('../utils/helpers');

const ORDER_ITEMS_JSON = `
  COALESCE(
    (SELECT json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'unit_price_cents', oi.unit_price_cents,
        'quantity', oi.quantity,
        'line_total_cents', oi.unit_price_cents * oi.quantity
      ) ORDER BY oi.id)
     FROM order_items oi WHERE oi.order_id = o.id),
    '[]'::json
  ) AS items
`;

function issueCheckoutToken(orderId, email) {
  return jwt.sign(
    { order_id: orderId, email, role: 'checkout' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function normalizeShipping(shippingAddress) {
  if (
    !shippingAddress ||
    typeof shippingAddress !== 'object' ||
    Array.isArray(shippingAddress)
  ) {
    throw new ApiError(400, 'shipping_address object is required');
  }
  const rawEmail = String(shippingAddress.email || '').trim().toLowerCase();
  if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    throw new ApiError(400, 'Enter a valid email address');
  }
  const fullName = String(
    shippingAddress.full_name ||
      shippingAddress.name ||
      `${shippingAddress.first_name || ''} ${shippingAddress.last_name || ''}`
  ).trim();
  const phone = String(shippingAddress.phone || '').trim();
  const fulfillment = String(
    shippingAddress.fulfillment_method || shippingAddress.delivery_method || 'delivery'
  )
    .trim()
    .toLowerCase();
  if (!['pickup', 'delivery'].includes(fulfillment)) {
    throw new ApiError(400, 'Choose pickup or delivery');
  }
  if (!fullName || !phone) {
    throw new ApiError(400, 'Full name and phone number are required');
  }
  if (!rawEmail) {
    throw new ApiError(400, 'Email is required for order updates and receipts');
  }
  const location = String(
    shippingAddress.location || shippingAddress.street || ''
  ).trim();
  if (!location) {
    throw new ApiError(400, 'Location is required');
  }
  const additionalNote = String(
    shippingAddress.additional_note ||
      shippingAddress.note ||
      shippingAddress.location_note ||
      ''
  ).trim();
  const email = rawEmail;
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || firstName;
  return {
    ...shippingAddress,
    email,
    customer_email: rawEmail,
    email_provided: true,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    phone,
    fulfillment_method: fulfillment,
    location,
    additional_note: additionalNote || null,
    location_note: additionalNote || null,
    street: location,
    city: String(shippingAddress.city || (fulfillment === 'pickup' ? 'Pickup' : 'Accra')).trim(),
    country: String(shippingAddress.country || 'Ghana').trim(),
    guest_name: fullName,
  };
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, 'items are required');
  }
  const merged = new Map();
  for (const raw of rawItems) {
    const productId = Number(raw?.product_id ?? raw?.id);
    const quantity = Number(raw?.quantity ?? 1);
    if (!Number.isInteger(productId) || productId < 1) {
      throw new ApiError(400, 'Each item needs a valid product_id');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, 'Each item quantity must be a positive integer');
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  return [...merged.entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
}

async function createOrderFromItems(client, { userId, items, shippingAddress }) {
  const productIds = items.map((item) => item.product_id);
  const { rows: products } = await client.query(
    `SELECT id, name, price_cents, stock, is_active
     FROM products
     WHERE id = ANY($1::int[])
     ORDER BY id
     FOR UPDATE`,
    [productIds]
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  const lockedRows = [];
  for (const item of items) {
    const product = byId.get(item.product_id);
    if (!product || !product.is_active) {
      throw new ApiError(400, `Product #${item.product_id} is no longer available`);
    }
    if (product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for "${product.name}" (available: ${product.stock})`
      );
    }
    lockedRows.push({
      product_id: product.id,
      name: product.name,
      price_cents: product.price_cents,
      quantity: item.quantity,
    });
  }

  const totalCents = lockedRows.reduce(
    (sum, item) => sum + item.price_cents * item.quantity,
    0
  );

  const {
    rows: [order],
  } = await client.query(
    `INSERT INTO orders (user_id, status, currency, total_cents, shipping_address)
     VALUES ($1, 'pending', 'GHS', $2, $3)
     RETURNING id, status, currency, total_cents, shipping_address, created_at, user_id`,
    [userId, totalCents, JSON.stringify(shippingAddress)]
  );

  for (const item of lockedRows) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.id, item.product_id, item.name, item.price_cents, item.quantity]
    );
    await client.query(
      'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
      [item.quantity, item.product_id]
    );
  }

  return order;
}

// POST /api/orders/guest  { items: [...], shipping_address: {...} }
// Public guest (or signed-in) checkout from the browser bag — no cart sync required.
exports.createGuest = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { assertPurchasesEnabled } = require('./store.controller');
    await assertPurchasesEnabled();

    const shippingAddress = normalizeShipping(req.body?.shipping_address);
    const items = normalizeItems(req.body?.items);

    // Optional customer JWT — attach order to account when present.
    let userId = null;
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role === 'customer') userId = payload.sub;
      } catch {
        // Guest checkout continues without an account.
      }
    }

    await client.query('BEGIN');
    const order = await createOrderFromItems(client, {
      userId,
      items,
      shippingAddress,
    });
    if (userId) {
      await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    }
    await client.query('COMMIT');

    const checkout_token = issueCheckoutToken(order.id, shippingAddress.email);
    res.status(201).json({ order, checkout_token });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

// POST /api/orders  { shipping_address: {...} }
// Creates an order from the user's cart inside a single transaction:
// product rows are locked, stock is validated and decremented, order and
// order_items are written, and the cart is cleared -- all atomically.
exports.create = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { assertPurchasesEnabled } = require('./store.controller');
    await assertPurchasesEnabled();

    const shippingAddress = normalizeShipping(req.body?.shipping_address);

    await client.query('BEGIN');

    // Lock the referenced product rows to prevent concurrent oversell.
    const { rows: cartRows } = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price_cents, p.stock, p.is_active
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1
       ORDER BY ci.product_id
       FOR UPDATE OF p`,
      [req.user.id]
    );

    if (cartRows.length === 0) throw new ApiError(400, 'Cart is empty');

    for (const item of cartRows) {
      if (!item.is_active) {
        throw new ApiError(400, `Product "${item.name}" is no longer available`);
      }
      if (item.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for "${item.name}" (available: ${item.stock})`
        );
      }
    }

    const items = cartRows.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    const order = await createOrderFromItems(client, {
      userId: req.user.id,
      items,
      shippingAddress,
    });

    await client.query('DELETE FROM cart_items WHERE user_id = $1', [
      req.user.id,
    ]);

    await client.query('COMMIT');
    const checkout_token = issueCheckoutToken(order.id, shippingAddress.email);
    res.status(201).json({ order, checkout_token });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/orders
exports.listMine = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 10,
    });
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1',
      [req.user.id]
    );
    const { rows } = await db.query(
      `SELECT o.id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.payment_reference, o.paid_at, o.created_at,
              o.shipping_address, ${ORDER_ITEMS_JSON}
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({
      orders: rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        total_pages: Math.max(1, Math.ceil(countResult.rows[0].total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id -- owner only
exports.getOne = async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) throw new ApiError(404, 'Order not found');

    const { rows } = await db.query(
      `SELECT o.id, o.user_id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.shipping_address, o.payment_reference, o.paid_at, o.created_at,
              ${ORDER_ITEMS_JSON}
       FROM orders o
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, req.user.id]
    );
    if (rows.length === 0) throw new ApiError(404, 'Order not found');
    res.json({ order: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/track?phone=... -- public; phone number only
exports.trackByPhone = async (req, res, next) => {
  try {
    const raw = String(req.query.phone || req.params.phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) {
      throw new ApiError(400, 'Enter a valid phone number');
    }
    const matchDigits = digits.slice(-9);

    const { rows } = await db.query(
      `SELECT o.id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.payment_reference, o.paid_at, o.created_at, o.updated_at,
              o.shipping_address,
              ${ORDER_ITEMS_JSON}
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE right(regexp_replace(COALESCE(o.shipping_address->>'phone', ''), '\\D', '', 'g'), 9) = $1
          OR right(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 9) = $1
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [matchDigits]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'No orders found for that phone number');
    }

    const orders = rows.map((order) => {
      const address =
        typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address)
          : order.shipping_address || {};
      const bagItems = Array.isArray(address.bag_items) ? address.bag_items : [];
      return {
        id: order.id,
        status: order.status,
        currency: order.currency,
        total: order.total,
        total_cents: order.total_cents,
        paid_at: order.paid_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        fulfillment_method: address.fulfillment_method || 'delivery',
        full_name: address.full_name || address.guest_name || null,
        phone: address.phone || null,
        location: address.location || address.street || null,
        additional_note: address.additional_note || address.location_note || null,
        cancel_reason: address.cancel_reason || null,
        cancelled_at: address.cancelled_at || null,
        items: (order.items || []).map((item) => {
          const snap =
            bagItems.find(
              (bag) => Number(bag.product_id) === Number(item.product_id)
            ) || {};
          return {
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            color: snap.color || null,
            size: snap.size || null,
          };
        }),
      };
    });

    res.json({
      phone: orders[0]?.phone || raw,
      orders,
      order: orders[0],
    });
  } catch (err) {
    next(err);
  }
};
