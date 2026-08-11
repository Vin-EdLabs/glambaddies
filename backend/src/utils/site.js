/**
 * Shared production / cookie helpers for GlamBaddies.
 */
const isProd = process.env.NODE_ENV === 'production';

const DEFAULT_ORIGINS = [
  'https://www.glambaddies.com',
  'https://glambaddies.com',
  'http://localhost:5173',
  'http://localhost:3100',
];

function getAllowedOrigins() {
  const fromEnv = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.BASE_URL,
  ]
    .filter(Boolean)
    .map((value) => String(value).replace(/\/$/, ''));

  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

function getFrontendOrigin() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      process.env.APP_URL ||
      (isProd ? 'https://www.glambaddies.com' : 'http://localhost:5173')
  ).replace(/\/$/, '');
}

function getPublicSiteUrl() {
  return String(
    process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      (isProd ? 'https://www.glambaddies.com' : 'http://localhost:5173')
  ).replace(/\/$/, '');
}

function getSupportEmail() {
  return (
    String(process.env.SUPPORT_EMAIL || '').trim() ||
    'support@glambaddies.com'
  );
}

/** Cookie options for any future httpOnly cookies (JWT currently uses localStorage). */
function getCookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    domain: isProd ? '.glambaddies.com' : undefined,
    path: '/',
    ...overrides,
  };
}

module.exports = {
  isProd,
  getAllowedOrigins,
  getFrontendOrigin,
  getPublicSiteUrl,
  getSupportEmail,
  getCookieOptions,
};
