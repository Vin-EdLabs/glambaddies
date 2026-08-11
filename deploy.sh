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

echo "GlamBaddies deployed successfully!"
echo "Frontend dist: $ROOT_DIR/frontend/dist"
echo "Sitemap: https://www.glambaddies.com/sitemap.xml"
