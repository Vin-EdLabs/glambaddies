require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  // Load after dotenv so the pool sees DATABASE_URL
  const db = require('../src/config/db');
  const { sendPaymentReceipt } = require('../src/services/orderEmails');

  console.log('DATABASE_URL host check:', String(process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@'));

  const { rows } = await db.query(`
    SELECT id, status,
           shipping_address->>'email' AS email,
           shipping_address->>'receipt_emailed_at' AS receipt
    FROM orders
    WHERE id IN (4, 7)
    ORDER BY id DESC
  `);
  console.log('targets', rows);

  for (const row of rows) {
    console.log(`sending #${row.id} → ${row.email}`);
    const result = await sendPaymentReceipt(row.id);
    console.log(result);
  }

  await db.pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
