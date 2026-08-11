const { Client } = require('pg');

const images = [
  ['floral-summer-dress', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85'],
  ['girls-tulle-party-dress', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=85'],
  ['elegant-evening-gown', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=85'],
  ['polka-dot-midi-dress', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=85'],
  ['girls-cotton-sundress', 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=85'],
  ['smart-plaid-school-dress', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85'],
  ['navy-uniform-day-dress', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85'],
  ['sparkle-birthday-dress', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1200&q=85'],
  ['linen-ruffle-casual-dress', 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85'],
  ['classic-a-line-dress', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85'],
];

(async () => {
  const c = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'password',
    database: 'glambaddies_db',
  });
  await c.connect();
  for (const [slug, url] of images) {
    const r = await c.query(
      `UPDATE product_images pi
       SET url = $1
       FROM products p
       WHERE p.id = pi.product_id AND p.slug = $2 AND pi.is_primary = TRUE`,
      [url, slug]
    );
    console.log(slug, r.rowCount);
  }
  await c.query(
    'UPDATE store_settings SET catalogue_revision = catalogue_revision + 1 WHERE id = 1'
  );
  await c.end();
  console.log('done');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
