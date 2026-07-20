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
  const name = path.basename(sqlPath)
  try {
    await pool.query(sql)
    console.log('Applied', name)

    if (/newsletter/i.test(name) && !/production-catalog|food|showcase/i.test(name)) {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS subscribers
        FROM newsletter_subscribers
      `)
      console.log('Private list ready. Subscribers:', rows[0].subscribers)
      console.log('(This file only creates the email list table — it does not add shop products.)')
    } else {
      const { rows } = await pool.query(`
        SELECT c.name AS category, COUNT(p.id)::int AS products,
               COUNT(pi.id)::int AS with_images
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary
        GROUP BY c.name, c.slug
        ORDER BY c.name
      `)
      console.table(rows)
      try {
        const { rows: nl } = await pool.query(
          'SELECT COUNT(*)::int AS subscribers FROM newsletter_subscribers'
        )
        console.log('Private list subscribers:', nl[0].subscribers)
      } catch {
        /* table may not exist yet */
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
