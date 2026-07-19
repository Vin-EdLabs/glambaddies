const jwt = require('jsonwebtoken');

// Accepts either a customer JWT or a short-lived checkout JWT.
// Checkout tokens are issued for guest (and signed-in) checkout sessions.
function checkoutAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role === 'customer') {
      req.user = { id: payload.sub, email: payload.email };
      return next();
    }
    if (payload.role === 'checkout') {
      req.checkout = {
        orderId: Number(payload.order_id),
        email: payload.email,
      };
      return next();
    }
    return res.status(401).json({ error: 'Invalid token' });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = checkoutAuth;
