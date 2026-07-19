/*
 * Local development database.
 *
 * Boots an embedded PostgreSQL server (no system installation required),
 * creates the vublishop database on first run, and applies
 * database/schema.sql + database/seed.sql when the schema is missing.
 *
 * Usage: npm run db   (keep this process running while developing)
 */
const fs = require('fs');
const path = require('path');
const embeddedPostgres = require('embedded-postgres');
const EmbeddedPostgres = embeddedPostgres.default || embeddedPostgres;
const { Client } = require('pg');

const DATA_DIR = path.join(__dirname, '..', '.pgdata');
const SCHEMA = path.join(__dirname, '..', '..', 'database', 'schema.sql');
const SEED = path.join(__dirname, '..', '..', 'database', 'seed.sql');

const PORT = 5433;
const USER = 'postgres';
const PASSWORD = 'password';
const DB_NAME = 'vublishop';

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('Initialising embedded PostgreSQL cluster...');
    await pg.initialise();
  }

  console.log('Starting PostgreSQL...');
  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
    console.log(`Created database "${DB_NAME}".`);
  } catch {
    // Database already exists.
  }

  const client = new Client({
    host: 'localhost',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DB_NAME,
  });
  await client.connect();

  const { rows } = await client.query(
    "SELECT to_regclass('public.products') AS t"
  );
  if (!rows[0].t) {
    console.log('Applying schema.sql...');
    await client.query(fs.readFileSync(SCHEMA, 'utf8'));
    console.log('Applying seed.sql...');
    await client.query(fs.readFileSync(SEED, 'utf8'));
    console.log('Database ready with seed data.');
  } else {
    console.log('Database schema already present.');
  }
  await client.end();

  console.log(
    `PostgreSQL running on port ${PORT} (database "${DB_NAME}"). Press Ctrl+C to stop.`
  );

  const shutdown = async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start development database:', err);
  process.exit(1);
});
