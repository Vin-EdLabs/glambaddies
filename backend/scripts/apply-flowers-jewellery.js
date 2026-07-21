// One-shot: apply database/flowers-jewellery.sql and print the inserted rows.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = path.join(__dirname, '..', '..', 'database', 'flowers-jewellery.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT p.id, p.name, ROUND(p.price_cents / 100.0, 2) AS usd, c.slug AS category,
           (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS images
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE c.slug IN ('flowers', 'jewellery') AND p.is_active = TRUE
    ORDER BY c.slug, p.id
  `);
  console.table(rows);
  await client.end();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
