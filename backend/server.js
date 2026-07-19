require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const { notFound, errorHandler } = require('./src/middleware/error');
const { UPLOAD_DIR } = require('./src/middleware/upload');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve locally uploaded product images.
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'vublishop-api' });
});

app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/products', require('./src/routes/products.routes'));
app.use('/api/categories', require('./src/routes/categories.routes'));
app.use('/api/cart', require('./src/routes/cart.routes'));
app.use('/api/orders', require('./src/routes/orders.routes'));
app.use('/api/payment', require('./src/routes/payment.routes'));
app.use('/api/store', require('./src/routes/store.routes'));
app.use('/api/admin', require('./src/routes/admin.routes'));

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

if (require.main === module) {
  const required = ['JWT_SECRET', 'ADMIN_JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Vublishop API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
