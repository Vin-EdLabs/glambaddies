const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { Pool } = require('pg')

async function main() {
  const rel = process.argv[2]
  if (!rel) {
    console.error('Usage: node scripts/apply-sql.js <path-to.sql>')
    process.exit(1)
  }
  const sqlPath = path.isAbsolute(rel) ? rel : path.join(__dirname, '../..', rel)
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(sql)
    const { rows } = await pool.query(`
      SELECT c.name AS category, COUNT(p.id)::int AS products,
             COUNT(pi.id)::int AS with_images
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary
      GROUP BY c.name, c.slug
      ORDER BY c.name
    `)
    console.log('Applied', path.basename(sqlPath))
    console.table(rows)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
