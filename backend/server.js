require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { notFound, errorHandler } = require('./src/middleware/error');
const { UPLOAD_DIR } = require('./src/middleware/upload');
const { getAllowedOrigins, isProd } = require('./src/utils/site');

const app = express();
const allowedOrigins = getAllowedOrigins();

// Behind Cloudflare / Nginx
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin header) and configured frontends
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  skip: (req) => String(req.originalUrl || '').startsWith('/api/webhook'),
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve locally uploaded product images.
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'glambaddies-api',
    env: process.env.NODE_ENV || 'development',
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/products', require('./src/routes/products.routes'));
app.use('/api/categories', require('./src/routes/categories.routes'));
app.use('/api/cart', require('./src/routes/cart.routes'));
app.use('/api/orders', require('./src/routes/orders.routes'));
app.use('/api/payment', require('./src/routes/payment.routes'));
app.use('/api/store', require('./src/routes/store.routes'));
app.use('/api/webhook', require('./src/routes/webhook.routes'));
const adminRoutes = require('./src/routes/admin.routes');
app.use('/api/glam-baddies', adminRoutes);
// Legacy admin API path
app.use('/api/vince-77-00', adminRoutes);

// Public SEO sitemap (not under /api)
app.use(require('./src/routes/sitemap.routes'));

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3100;

if (require.main === module) {
  const required = ['JWT_SECRET', 'ADMIN_JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  app.listen(PORT, () => {
    const smtpReady = Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );
    console.log(`GlamBaddies API listening on http://localhost:${PORT}`);
    console.log(`Mode: ${isProd ? 'production' : 'development'}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
    console.log(`SMTP receipts: ${smtpReady ? 'configured' : 'NOT configured'}`);
  });
}

module.exports = app;
