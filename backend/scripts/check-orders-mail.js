require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../src/config/db');

(async () => {
  const { rows } = await db.query(`
    SELECT id, status,
           shipping_address->>'email' AS email,
           shipping_address->>'email_provided' AS provided,
           shipping_address->>'cancel_reason' AS reason,
           shipping_address->>'phone' AS phone
    FROM orders
    ORDER BY id DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(rows, null, 2));
  await db.pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
