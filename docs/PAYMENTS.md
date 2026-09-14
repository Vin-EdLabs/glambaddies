# GlamBaddies payments (Paystack)

This store has **no staff payroll**. Money in GlamBaddies means **customer checkout** via **Paystack**, in **GHS** only (no USD conversion).

This guide covers every side: shopper, admin, API, database, webhooks, email, Apple Pay, and ops.

---

## 1. Big picture

```text
Bag → Checkout form → Create order (pending)
       → Pay with Paystack popup  OR  Apple Pay
       → Verify payment with Paystack
       → Order status = paid
       → Receipt email (customer + admin)
```

| Side | What it does |
|------|----------------|
| **Shopper** | Places order, pays (card / MoMo / bank / Apple Pay) |
| **Admin** | Turns purchases on/off, sets Test vs Live keys |
| **API** | Creates order, locks amount, talks to Paystack, verifies |
| **Paystack** | Takes the money, sends webhook + verify response |
| **Database** | Orders, `payments` rows, keys in `store_settings` |
| **Email** | Payment receipt after successful verify |

Currency rule: catalogue prices, order totals, and Paystack charges are all **GHS**. Amounts are stored as **pesewas** (`total_cents` / `amount_cents` = GHS × 100).

---

## 2. Shopper side (storefront)

### Flow

1. Add items to bag (size + colour).
2. Checkout → submit shipping / pickup details.
3. Backend creates a **pending** order and returns a short-lived **checkout token**.
4. Shopper pays:
   - **Paystack popup** (default): card, mobile money, bank transfer, etc.
   - **Apple Pay** (Apple devices): uses Paystack `paymentRequest` when available.
5. Frontend calls **verify** with the payment reference.
6. On success → order is **paid**, bag clears, receipt email is sent.

### Key frontend pieces

| Piece | Location |
|-------|----------|
| Checkout + Paystack / Apple Pay | `frontend/src/pages/StorePages.jsx` |
| Paystack JS | `@paystack/inline-js` (`PaystackPop`) |
| Public key (build-time fallback) | `VITE_PAYSTACK_PUBLIC_KEY` in `frontend/.env` |

Checkout uses the **checkout JWT** from `/orders/guest` (not only a logged-in customer JWT).

### Channels

Default Paystack channels: `card`, `mobile_money`, `bank_transfer`.  
Also allowed in code: `apple_pay`, `bank`, `ussd`, `qr`, `eft`.

---

## 3. Admin side (Settings → Payments)

Path: `/glam-baddies` → Settings → **Payments**.

| Control | Meaning |
|---------|---------|
| **Purchases enabled** | When off, checkout / payment APIs refuse new buys |
| **Payment mode** | `test` or `live` |
| **Public key** | `pk_test_…` or `pk_live_…` (browser / Apple Pay) |
| **Secret key** | `sk_test_…` or `sk_live_…` (server only — never expose to shoppers) |

### Test vs Live

- **Test**: no real money; use Paystack test cards / MoMo sandboxes.
- **Live**: real charges. Saving Live mode **verifies keys with Paystack** before the store treats Live as confirmed.
- Keys are stored in the DB (`store_settings`), so you can change them **without restarting** the API (env keys are only a bootstrap / fallback).

Admin UI: `frontend/src/pages/AdminPages.jsx` (payments settings form).  
API: `PUT /api/glam-baddies/settings`.

---

## 4. API side (backend)

Routes: `backend/src/routes/payment.routes.js`  
Controller: `backend/src/controllers/payment.controller.js`  
Auth: `checkoutAuth` — customer JWT **or** checkout JWT.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/payment/prepare` | Apple Pay: lock order reference + return GHS amount + public key |
| `POST` | `/api/payment/initialize` | Paystack popup: create Paystack transaction, return `access_code` |
| `GET` | `/api/payment/verify/:reference` | Confirm success with Paystack, mark order paid, write `payments` row |

### Order creation (before pay)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/orders/guest` | Guest (or signed-in) bag → pending order + `checkout_token` |
| `POST` | `/api/orders` | Logged-in cart → pending order |

Stock (and colour stock, when configured) is reserved/decremented when the **order** is created, not only after pay — see `orders.controller.js`.

### What “lock payment” means

On prepare/initialize the API:

1. Builds a unique reference: `GLAM-{orderId}-{random}`.
2. Saves `orders.payment_reference`.
3. Stores Paystack metadata on `shipping_address` JSON (`paystack_currency`, `paystack_amount_minor`, email, etc.).

Verify later checks that Paystack’s **currency** and **amount** match that locked total.

### Purchases gate

`assertPurchasesEnabled()` runs before payment. If admin turned purchases off, payment fails with an error.

---

## 5. Paystack dashboard side

Configure in [Paystack Dashboard](https://dashboard.paystack.com):

1. **API keys** — copy test and live public/secret into Admin → Payments.
2. **Webhook URL** (production):

   ```text
   https://www.glambaddies.com/api/webhook/paystack
   ```

3. Enable the channels you want (card, MoMo, Apple Pay, etc.) for your Ghana merchant account.
4. Currency: merchant must support **GHS**.

Webhook handler: `backend/src/controllers/webhook.controller.js`  
Route: `POST /api/webhook/paystack`

On `charge.success`, the webhook marks a matching pending order as **paid** (by `payment_reference`). Signature is checked with HMAC-SHA512 using the active secret key.

**Note:** Full receipt + `payments` row insertion is driven primarily by **`/payment/verify`**. Prefer always verifying from the storefront after Paystack success; the webhook is a backup for status.

---

## 6. Database side

### `store_settings`

| Column | Role |
|--------|------|
| `purchases_enabled` | Store open/closed for buying |
| `payment_mode` | `test` \| `live` |
| `paystack_test_public_key` / `_secret_key` | Test keys |
| `paystack_live_public_key` / `_secret_key` | Live keys |

Migration reference: `database/payment-settings.sql`.

### `orders`

| Column | Role |
|--------|------|
| `status` | `pending` → `paid` (and later fulfilment statuses) |
| `total_cents` | Order total in GHS pesewas |
| `currency` | `GHS` |
| `payment_reference` | Unique Paystack reference |
| `paystack_transaction_id` | Gateway transaction id after verify |
| `paid_at` | When payment succeeded |
| `shipping_address` | JSON: address + bag lines + locked Paystack fields |

### `payments`

One row per successful verified charge (`reference` unique). Stores amount, channel, provider (`paystack`), and a trimmed `raw_response`.

Schema: `database/schema.sql`.

---

## 7. Email side

After a successful verify (or retry if mail failed earlier):

- Customer payment receipt
- Admin notification (same mail service)

Service: `backend/src/services/orderEmails.js`  
Mail failure does **not** undo a successful payment (logged only).

---

## 8. Environment / config side

### Backend (`backend/.env`)

Useful vars:

```text
APP_NAME=GlamBaddies
APP_URL=https://www.glambaddies.com
CLIENT_URL=https://www.glambaddies.com
JWT_SECRET=...
PAYSTACK_SECRET_KEY=sk_...          # optional bootstrap; admin DB keys preferred
PAYSTACK_BASE_URL=https://api.paystack.co
MAIL_FROM_ADDRESS=noreply@...
SUPPORT_EMAIL=support@...
```

### Frontend

```text
VITE_API_URL=https://www.glambaddies.com/api
VITE_APP_URL=https://www.glambaddies.com
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...   # fallback; runtime key also comes from prepare/initialize
```

Local: `VITE_API_URL=/api` (Vite proxies to the API).

---

## 9. End-to-end sequences

### A. Paystack popup (most shoppers)

```text
1. POST /orders/guest          → order + checkout_token
2. POST /payment/initialize    → access_code + reference
3. PaystackPop.resumeTransaction(access_code)
4. onSuccess → GET /payment/verify/:reference
5. Order paid + payments row + receipt email
```

### B. Apple Pay

```text
1. POST /orders/guest
2. POST /payment/prepare       → amount (pesewas) + public key + reference
3. PaystackPop.paymentRequest({ amount, currency: 'GHS', ... })
4. onSuccess → GET /payment/verify/:reference
```

Prepare does **not** call Paystack `/transaction/initialize`; Apple Pay creates the charge via the browser payment sheet.

### C. Exclusive method

Checkout keeps one path only: either `apple` or `paystack` owns the order reference for that session (see `paymentMethodRef` in `StorePages.jsx`).

---

## 10. Security & money safety

- Amount charged = **server order total**, never a client-typed price.
- Verify checks Paystack **amount + currency** against the locked values.
- Secret keys stay on the server / admin DB; only public keys reach the browser.
- Payment routes require checkout or customer auth.
- Webhook signature must match HMAC of the body with the secret key.
- Verify is **idempotent**: repeating verify for the same reference does not double-charge or double-insert (`payments.reference` unique / `23505` handling).
- Live mode requires keys that look like live keys and pass Paystack verification on save.

---

## 11. Ops checklist (go live)

1. Apply payment settings migration if needed: `database/payment-settings.sql`.
2. In Admin → Payments, paste **live** `pk_live_` / `sk_live_` keys, set **Live**, Save (wait for verification).
3. Confirm **Purchases enabled**.
4. In Paystack Dashboard, set webhook to  
   `https://www.glambaddies.com/api/webhook/paystack`.
5. Place a small real or test order and confirm:
   - Order becomes `paid`
   - Row appears in `payments`
   - Receipt email arrives
6. DNS must point at your **VPS** (not Vercel) so `/api` and webhooks hit this backend.

---

## 12. Common problems

| Symptom | Likely cause |
|---------|----------------|
| “Payment provider is not configured” | Missing keys in Admin → Payments |
| “LIVE but keys missing/invalid” | Wrong key type for mode (`pk_test` in Live, etc.) |
| Purchases / checkout blocked | `purchases_enabled` is false |
| Verify 402 | Paystack transaction not `success` |
| Amount mismatch | Order total changed or wrong locked amount |
| Webhook 401 | Secret key mismatch vs dashboard |
| No receipt email | SMTP / mail env; payment can still be paid |
| Apple Pay missing | Non-Apple device, or Paystack Apple Pay not enabled |

---

## 13. Code map (quick)

| Area | Path |
|------|------|
| Payment API | `backend/src/controllers/payment.controller.js` |
| Payment routes | `backend/src/routes/payment.routes.js` |
| Checkout auth | `backend/src/middleware/checkoutAuth.js` |
| Store payment config | `backend/src/controllers/store.controller.js` |
| Admin settings | `backend/src/controllers/admin.controller.js` |
| Webhook | `backend/src/controllers/webhook.controller.js` |
| Orders / stock | `backend/src/controllers/orders.controller.js` |
| Receipts | `backend/src/services/orderEmails.js` |
| Checkout UI | `frontend/src/pages/StorePages.jsx` |
| Admin Payments UI | `frontend/src/pages/AdminPages.jsx` |
| SQL | `database/schema.sql`, `database/payment-settings.sql` |

---

## 14. What this is *not*

- Not employee **payroll** / salaries / wages  
- Not rider commission accounting (riders are assigned for delivery tracking only)  
- Not multi-currency conversion (GHS only)

If you need a separate staff payroll product, that would be a new feature — not part of this Paystack checkout system.
