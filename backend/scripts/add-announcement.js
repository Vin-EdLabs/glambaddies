const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'password',
    database: 'glambaddies_db',
  });
  await c.connect();
  await c.query(`
    ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS announcement_text VARCHAR(120) NOT NULL DEFAULT 'Shop · Slay · Shine'
  `);
  const { rows } = await c.query(
    'SELECT announcement_text FROM store_settings WHERE id = 1'
  );
  console.log(rows[0]);
  await c.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
