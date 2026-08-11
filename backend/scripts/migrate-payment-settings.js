const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5433),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'password',
    database: process.env.PGDATABASE || process.env.DB_NAME || 'glambaddies_db',
  });
  await c.connect();
  const sql = fs.readFileSync(
    path.join(__dirname, '../../database/payment-settings.sql'),
    'utf8'
  );
  await c.query(sql);
  const { rows } = await c.query(
    `SELECT payment_mode,
            length(paystack_test_secret_key) AS test_secret_len,
            length(paystack_live_secret_key) AS live_secret_len
     FROM store_settings WHERE id = 1`
  );
  console.log(rows[0]);
  await c.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
