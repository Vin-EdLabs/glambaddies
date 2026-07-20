const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { Pool } = require('pg')

async function main() {
  const sqlPath = path.join(__dirname, '../../database/catalog-showcase.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(sql)
    const { rows } = await pool.query(`
      SELECT c.name AS category, COUNT(p.id)::int AS products
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active
      WHERE c.slug IN ('fashion','electronics','games','home-living','beauty')
      GROUP BY c.name, c.slug
      ORDER BY c.name
    `)
    console.log('Catalog showcase applied.')
    console.table(rows)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
