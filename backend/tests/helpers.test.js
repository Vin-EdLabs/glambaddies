const test = require('node:test');
const assert = require('node:assert/strict');

const {
  slugify,
  parsePagination,
  toCents,
  centsToDollars,
} = require('../src/utils/helpers');

test('slugify normalizes names into URL-safe slugs', () => {
  assert.equal(slugify('Wireless Headphones!'), 'wireless-headphones');
  assert.equal(slugify('  Home & Living  '), 'home-living');
  assert.equal(slugify('---Weird---Input---'), 'weird-input');
});

test('parsePagination clamps invalid and oversized values', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 12, offset: 0 });
  assert.deepEqual(parsePagination({ page: '3', limit: '10' }), {
    page: 3,
    limit: 10,
    offset: 20,
  });
  assert.deepEqual(parsePagination({ page: '-5', limit: '9999' }), {
    page: 1,
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(parsePagination({ page: 'abc', limit: 'xyz' }), {
    page: 1,
    limit: 12,
    offset: 0,
  });
});

test('toCents converts dollar amounts and rejects invalid input', () => {
  assert.equal(toCents('19.99'), 1999);
  assert.equal(toCents(0), 0);
  assert.equal(toCents('0.1'), 10);
  assert.equal(toCents('-5'), null);
  assert.equal(toCents('abc'), null);
  assert.equal(toCents(Infinity), null);
});

test('centsToDollars formats with two decimals', () => {
  assert.equal(centsToDollars(15798), '157.98');
  assert.equal(centsToDollars(0), '0.00');
});
