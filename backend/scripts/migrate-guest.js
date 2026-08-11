const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'password',
    database: process.env.DB_NAME || 'glambaddies_db',
  });
  await c.connect();
  const sql = fs.readFileSync(path.join(__dirname, '../../database/guest-orders.sql'), 'utf8');
  await c.query(sql);
  const r = await c.query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name = 'user_id'`
  );
  console.log(r.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
