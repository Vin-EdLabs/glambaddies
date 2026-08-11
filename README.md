# GlamBaddies

Girls' fashion e-commerce — **girls' dresses only**. Prices and Paystack charges are in **GHS** (no USD conversion).

Production: https://www.glambaddies.com

## Setup (local dev)

1. `createdb glambaddies_db`  
   (Or use the embedded Postgres helper via `npm run db` — it creates `glambaddies_db` on port 5433.)
2. Copy `.env.example` → `.env` and fill in values:
   - `backend/.env.example` → `backend/.env`
   - `frontend/.env.example` → `frontend/.env`
3. `npm install`
4. `npm run install:all`
5. Apply schema / seed (if not using Docker or embedded `npm run db`):
   ```bash
   psql -d glambaddies_db -f database/schema.sql
   psql -d glambaddies_db -f database/seed.sql
   ```
   Optional dress top-up: `psql -d glambaddies_db -f database/girls-dresses.sql`
6. `npm run dev`

Storefront: http://localhost:5173  
API: http://localhost:3100  
Admin: http://localhost:5173/glam-baddies/login

### Demo admin (seed)

- Email: `admin@glambaddies.com`
- Password: `Admin123!`

## Environment

```text
APP_NAME=GlamBaddies
APP_URL=https://www.glambaddies.com
CLIENT_URL=https://www.glambaddies.com
FRONTEND_URL=https://www.glambaddies.com
BASE_URL=https://www.glambaddies.com
DB_NAME=glambaddies_db
PORT=3100
NODE_ENV=production
MAIL_FROM_NAME=GlamBaddies
MAIL_FROM_ADDRESS=noreply@glambaddies.com
SUPPORT_EMAIL=support@glambaddies.com
```

Frontend (production build):

```text
VITE_API_URL=https://www.glambaddies.com/api
VITE_APP_URL=https://www.glambaddies.com
VITE_PAYSTACK_PUBLIC_KEY=pk_live_your_key
```

Local frontend: `VITE_API_URL=/api` (Vite proxies to the API in development).

Paystack charges are **GHS** at the catalogue price (pesewas). Webhook URL: `https://www.glambaddies.com/api/webhook/paystack`

## Ports

| Service     | Port   | Notes                     |
|-------------|--------|---------------------------|
| API         | **3100** | Production + local        |
| Vite        | 5173   | Local storefront          |
| Embedded PG | 5433   | DB name: `glambaddies_db` |
| Docker PG   | 5434→5432 | Separate container     |

## Production (PM2)

```bash
pm2 start ecosystem.config.js
# app name: glambaddies
```

Nginx sample: `deploy/nginx-glambaddies.conf` (proxies API to port **3100**, hosts `www.glambaddies.com`).

## Useful commands

```bash
npm run dev          # DB + API + storefront
npm run build        # production frontend build
npm run lint
npm test
```

## Security notes

- Customer and administrator sessions use separate JWTs and storage keys (`glam_*`).
- Product prices, order totals, and payment ownership are validated server-side.
- Successful payment handling is idempotent; stock is reduced only after Paystack verification.
