#!/usr/bin/env node
/**
 * Production "build" for the GlamBaddies API.
 * Plain Node/Express — no transpile step. This verifies the app can load cleanly.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'server.js');

function fail(message) {
  console.error(`\n✗ Backend build failed: ${message}\n`);
  process.exit(1);
}

console.log('Building GlamBaddies backend…');

if (!fs.existsSync(entry)) {
  fail(`missing ${entry}`);
}

// Syntax-check entrypoint
const check = spawnSync(process.execPath, ['--check', entry], {
  cwd: root,
  encoding: 'utf8',
});
if (check.status !== 0) {
  fail(check.stderr || check.stdout || 'syntax check failed');
}
console.log('  ✓ server.js syntax OK');

// Resolve critical dependencies
const required = [
  'express',
  'cors',
  'helmet',
  'compression',
  'express-rate-limit',
  'dotenv',
  'pg',
  'jsonwebtoken',
  'nodemailer',
  'sitemap',
];
for (const name of required) {
  try {
    require.resolve(name);
  } catch {
    fail(`dependency missing: ${name} (run npm install)`);
  }
}
console.log(`  ✓ ${required.length} runtime dependencies resolved`);

// Load the Express app without binding a port (server.js guards listen)
let app;
try {
  // Avoid hard exit if JWT secrets are missing during build-only check
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'build-check-secret';
  process.env.ADMIN_JWT_SECRET =
    process.env.ADMIN_JWT_SECRET || 'build-check-admin-secret';
  // eslint-disable-next-line global-require, import/no-dynamic-require
  app = require(entry);
} catch (error) {
  fail(error.message || String(error));
}

if (!app || typeof app.use !== 'function') {
  fail('server.js did not export an Express app');
}
console.log('  ✓ Express app loads');

console.log('\n✓ Backend build complete — ready for `npm start` / PM2\n');
