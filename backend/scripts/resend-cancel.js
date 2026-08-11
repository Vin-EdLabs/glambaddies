require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../src/config/db');
const { sendStatusUpdateEmail } = require('../src/services/orderEmails');

(async () => {
  const orderId = Number(process.argv[2] || 7);
  if (orderId === 7) {
    await db.query(
      `UPDATE orders
       SET shipping_address = COALESCE(shipping_address, '{}'::jsonb)
         || jsonb_build_object(
              'cancel_reason', COALESCE(shipping_address->>'cancel_reason', 'Order cancelled by GlamBaddies'),
              'cancelled_at', COALESCE(shipping_address->>'cancelled_at', $2::text)
            ),
           status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, new Date().toISOString()]
    );
  }
  console.log(await sendStatusUpdateEmail(orderId));
  await db.pool.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
