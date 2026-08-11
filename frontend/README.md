# GlamBaddies Frontend

React + Vite storefront and admin console for GlamBaddies.
Production: https://www.glambaddies.com

## Dev

```bash
cp .env.example .env
npm install
npm run dev
```

Local defaults: API at `http://localhost:3100/api`, UI at `http://localhost:5173`.

Production build env:

```text
VITE_API_URL=https://www.glambaddies.com/api
VITE_APP_URL=https://www.glambaddies.com
```

Dark mode (pink / black / white) is toggled from the header; light mode is unchanged.
