function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Parses ?page and ?limit into safe LIMIT/OFFSET values.
function parsePagination(query, { defaultLimit = 12, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

// Converts a decimal dollar amount (e.g. "19.99") to integer cents.
// Returns null when the input is not a valid non-negative amount.
function toCents(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

module.exports = { slugify, parsePagination, toCents, centsToDollars };
