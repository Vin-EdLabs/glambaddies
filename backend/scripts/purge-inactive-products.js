// Remove deleted (inactive) products from the catalogue.
// Hard-deletes inactive products not referenced by any order; keeps ordered ones
// inactive (hidden from storefront) to preserve order history.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const inactive = await client.query(
    `SELECT p.id, p.name,
            EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS in_orders
     FROM products p WHERE p.is_active = FALSE ORDER BY p.id`
  );
  console.log(`Inactive products found: ${inactive.rows.length}`);
  console.table(inactive.rows);

  const deletable = inactive.rows.filter((r) => !r.in_orders).map((r) => r.id);
  if (deletable.length) {
    await client.query('DELETE FROM cart_items WHERE product_id = ANY($1::int[])', [deletable]);
    await client.query('DELETE FROM product_images WHERE product_id = ANY($1::int[])', [deletable]);
    const del = await client.query(
      'DELETE FROM products WHERE id = ANY($1::int[]) RETURNING id, name',
      [deletable]
    );
    console.log('Hard-deleted:');
    console.table(del.rows);
  } else {
    console.log('Nothing to hard-delete.');
  }

  await client.query(
    `UPDATE store_settings
     SET catalogue_revision = catalogue_revision + 1, updated_at = NOW()
     WHERE id = 1`
  );
  console.log('Catalogue revision bumped — storefront caches invalidated.');
  await client.end();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
