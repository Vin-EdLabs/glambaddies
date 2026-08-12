#!/bin/bash
set -euo pipefail

echo "Deploying GlamBaddies..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Pull latest code
git pull origin main

# Root tooling (if any)
if [ -f package.json ]; then
  npm install
fi

# Backend dependencies + production check
cd backend
npm install
npm run build
cd "$ROOT_DIR"

# Build frontend
cd frontend
npm install
npm run build
cd "$ROOT_DIR"

# Optional migrations / schema notes
npm run migrate 2>/dev/null || true

# Restart API
pm2 restart glambaddies --update-env || pm2 start ecosystem.config.js --env production

# NOTE: Do NOT overwrite /etc/nginx here. Server nginx is managed on the VPS.
# Repo file deploy/nginx-glambaddies.conf is a reference sample only — copy it
# manually if you intentionally want to replace the live site config.

# Always write a static sitemap into dist so /sitemap.xml works even if
# the nginx proxy location is not installed yet.
sleep 1
SITEMAP_OUT="$ROOT_DIR/frontend/dist/sitemap.xml"
for _ in 1 2 3 4 5 6; do
  if curl -sf "http://127.0.0.1:3100/sitemap.xml" -o "$SITEMAP_OUT"; then
    echo "Wrote $SITEMAP_OUT"
    break
  fi
  sleep 1
done
if [ ! -s "$SITEMAP_OUT" ]; then
  echo "Warning: could not fetch sitemap from Express (http://127.0.0.1:3100/sitemap.xml)"
fi

echo "GlamBaddies deployed successfully!"
echo "Frontend dist: $ROOT_DIR/frontend/dist"
echo "Sitemap: https://www.glambaddies.com/sitemap.xml"
echo "Sitemap (API): https://www.glambaddies.com/api/sitemap.xml"
