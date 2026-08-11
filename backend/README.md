# GlamBaddies Backend

Node/Express/PostgreSQL REST API for the GlamBaddies e-commerce app.
Database: **glambaddies_db**. Production: https://www.glambaddies.com

## Setup

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create the database and load schema + seed data:

   ```bash
   createdb glambaddies_db
   psql -d glambaddies_db -f ../database/schema.sql
   psql -d glambaddies_db -f ../database/seed.sql
   ```

   Or run embedded Postgres: `npm run db` (creates `glambaddies_db` on port 5433).

3. Configure environment:

   ```bash
   cp .env.example .env
   # edit .env: DATABASE_URL → …/glambaddies_db, JWT secrets, Paystack keys
   # Default API port: 3100
   # Production URLs: APP_URL / CLIENT_URL / FRONTEND_URL = https://www.glambaddies.com
   ```

4. Run:

   ```bash
   npm run dev   # nodemon
   npm start     # production
   npm test      # node --test
   ```

## Seed credentials

- Customers: `ama.mensah@example.com` / `Customer123!`
- Admin: `admin@glambaddies.com` / `Admin123!`

## Notes

- Currency is **GHS** end-to-end (catalogue + Paystack). No USD conversion.
- Admin API path: `/api/glam-baddies` (legacy `/api/vince-77-00` still works).
- Paystack webhook: `https://www.glambaddies.com/api/webhook/paystack`
