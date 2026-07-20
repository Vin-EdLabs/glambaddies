# Vublishop Backend

Node/Express/PostgreSQL REST API for the Vublishop e-commerce app.

## Setup

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create the database and load schema + seed data:

   ```bash
   createdb vublishop
   psql -d vublishop -f ../database/schema.sql
   psql -d vublishop -f ../database/seed.sql
   ```

3. Configure environment:

   ```bash
   cp .env.example .env
   # edit .env: set DATABASE_URL, JWT_SECRET, ADMIN_JWT_SECRET, PAYSTACK_SECRET_KEY (test key)
   ```

4. Run:

   ```bash
   npm run dev   # nodemon
   npm start     # production
   npm test      # node --test
   ```

## Seed credentials

- Customers: `ama.mensah@example.com` / `Customer123!` (also `kwame.boateng@`, `efua.owusu@`)
- Admin: `admin@vublishop.com` / `Admin123!`

## API overview

All routes are prefixed with `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Products | `GET /products` (`q`, `category`, `min_price`, `max_price`, `in_stock`, `sort`, `page`, `limit`), `GET /products/:idOrSlug` |
| Categories | `GET /categories`, `GET /categories/:idOrSlug` |
| Cart | `GET /cart`, `POST /cart/items`, `PUT /cart/items/:productId`, `DELETE /cart/items/:productId`, `DELETE /cart` |
| Orders | `POST /orders`, `GET /orders`, `GET /orders/:id` |
| Payment | `POST /payment/initialize`, `GET /payment/verify/:reference` |
| Admin | `POST /vince-77-00/login`, `GET /vince-77-00/dashboard`, product/category CRUD, `GET /vince-77-00/orders`, `PUT /vince-77-00/orders/:id/status`, `GET /vince-77-00/users` |

Sort options for products: `newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`.

## Notes

- All money is stored as integer USD cents; API responses include both `*_cents` and a formatted decimal.
- Order creation runs in a single transaction: product rows are locked (`FOR UPDATE`), stock validated and decremented, and the cart cleared atomically.
- Paystack verification is strict and idempotent: reference ownership, `status === 'success'`, exact amount and currency are all checked, and a `UNIQUE` payment reference prevents double processing.
- Product images are uploaded via `multipart/form-data` (`images` field, max 5 files, 5MB each, JPEG/PNG/WebP/GIF only) and served from `/uploads`.
