# Vublishop

A premium full-stack commerce platform for fashion, electronics, games, and
lifestyle products. The storefront and admin console are built with React and
Vite; the API uses Express, PostgreSQL, and Paystack.

## Requirements

- Node.js 20 or newer
- PostgreSQL 15 or newer, or Docker Desktop
- A Paystack test account with USD payments enabled

## Quick start

1. Install dependencies:

   ```bash
   npm install
   npm run install:all
   ```

2. Copy the environment templates:

   ```bash
   copy backend\.env.example backend\.env
   copy frontend\.env.example frontend\.env
   ```

3. Start PostgreSQL and initialize the database:

   ```bash
   docker compose up -d postgres
   ```

   The container applies `database/schema.sql` and `database/seed.sql` on its
   first start. When using an existing local PostgreSQL installation, apply
   those files manually with `psql`.

4. Add Paystack test keys to the environment files. Never commit live keys.

5. Start both applications:

   ```bash
   npm run dev
   ```

The storefront runs at `http://localhost:5173` and the API at
`http://localhost:4000`.

Admin panel (hidden URL): `http://localhost:5173/vince-77-00/login`  
Admin API base: `http://localhost:4000/api/vince-77-00`

## Environment

Backend variables are documented in `backend/.env.example`. The frontend uses:

```text
VITE_API_URL=http://localhost:4000/api
VITE_PAYSTACK_PUBLIC_KEY=pk_test_your_key
```

Paystack only processes USD for accounts with international payments enabled.
Amounts are sent in the currency's smallest unit and are always recalculated
and verified by the API.

## Useful commands

```bash
npm run dev          # storefront and API
npm run build        # production frontend build
npm run lint         # lint both applications
npm test             # backend tests
```

## Security notes

- Customer and administrator sessions use separate JWTs and storage keys.
- Product prices, order totals, and payment ownership are validated server-side.
- Successful payment handling is idempotent and stock is reduced in a database
  transaction only after Paystack verification.
- Uploaded images are restricted by MIME type and size.

For production, use managed object storage instead of the local `uploads`
directory, configure a strict production CORS origin, rotate JWT secrets, and
serve both applications over HTTPS.







cd /var/www/vublishop
git pull origin main
cd frontend && npm run build
pm2 restart vublishop-backend
systemctl reload nginx