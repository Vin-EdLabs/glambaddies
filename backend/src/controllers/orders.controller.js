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
  const email = String(shippingAddress.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'A valid email is required for checkout');
  }
  const firstName = String(shippingAddress.first_name || '').trim();
  const lastName = String(shippingAddress.last_name || '').trim();
  const street = String(shippingAddress.street || '').trim();
  const city = String(shippingAddress.city || '').trim();
  const country = String(shippingAddress.country || '').trim();
  const phone = String(shippingAddress.phone || '').trim();
  if (!firstName || !lastName || !street || !city || !country || !phone) {
    throw new ApiError(400, 'Please complete all required delivery fields');
  }
  return {
    ...shippingAddress,
    email,
    first_name: firstName,
    last_name: lastName,
    street,
    city,
    country,
    phone,
    guest_name: `${firstName} ${lastName}`.trim(),
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
     VALUES ($1, 'pending', 'USD', $2, $3)
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
              o.payment_reference, o.paid_at, o.created_at, ${ORDER_ITEMS_JSON}
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

// GET /api/orders/track/:reference -- public; payment reference only
exports.trackByReference = async (req, res, next) => {
  try {
    const reference = String(req.params.reference || '').trim();
    if (!reference || !/^[\w-]{6,100}$/.test(reference)) {
      throw new ApiError(400, 'Enter a valid payment reference');
    }

    const { rows } = await db.query(
      `SELECT o.id, o.status, o.currency, o.total_cents,
              ROUND(o.total_cents / 100.0, 2) AS total,
              o.payment_reference, o.paid_at, o.created_at, o.updated_at,
              ${ORDER_ITEMS_JSON}
       FROM orders o
       WHERE o.payment_reference = $1`,
      [reference]
    );
    if (rows.length === 0) {
      throw new ApiError(404, 'No order found for that payment reference');
    }

    const order = rows[0];
    res.json({
      order: {
        id: order.id,
        status: order.status,
        currency: order.currency,
        total: order.total,
        total_cents: order.total_cents,
        payment_reference: order.payment_reference,
        paid_at: order.paid_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.items || []).map((item) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};
