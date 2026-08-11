# GlamBaddies Frontend

React + Vite storefront and admin console for GlamBaddies.
Production: https://www.glambaddies.com

## Dev

```bash
cp .env.example .env
npm install
npm run dev
```

Local defaults: API at `/api` (Vite proxies to `:3100`), UI at `http://localhost:5173`.
Production builds use `VITE_API_URL=/api` so Nginx serves the API.

Production build env:

```text
VITE_API_URL=https://www.glambaddies.com/api
VITE_APP_URL=https://www.glambaddies.com
```

Dark mode (pink / black / white) is toggled from the header; light mode is unchanged.
