/**
 * GlamBaddies catalogue rules for SEO / sitemap.
 * Dresses + accessory categories (bags, shoes, beauty).
 */

const DRESS_CATEGORY_SLUGS = [
  'girls-dresses',
  'party-dresses',
  'casual-dresses',
  'school-dresses',
  'occasion-dresses',
  'dresses',
  'bags',
  'shoes',
  'beauty',
];

/** Leftover previous-store categories that must never appear in SEO. */
const NON_DRESS_CATEGORY_SLUGS = [
  'food',
  'fruits',
  'fruit',
  'electronics',
  'home',
  'home-living',
  'games',
  'sneakers',
  'jackets',
  'trousers',
  'fashion',
  'sports',
];

/**
 * SQL boolean predicate for a categories row alias `c`.
 */
function dressCategorySql(alias = 'c') {
  const a = alias;
  const allowList = DRESS_CATEGORY_SLUGS.map((slug) => `'${slug}'`).join(', ');
  const denyList = NON_DRESS_CATEGORY_SLUGS.map((slug) => `'${slug}'`).join(', ');
  return `(
    ${a}.id IS NOT NULL
    AND ${a}.slug IS NOT NULL
    AND ${a}.slug <> ''
    AND LOWER(${a}.slug) NOT IN (${denyList})
    AND (
      LOWER(${a}.slug) IN (${allowList})
      OR LOWER(${a}.slug) LIKE '%dress%'
      OR LOWER(COALESCE(${a}.name, '')) LIKE '%dress%'
    )
  )`;
}

module.exports = {
  DRESS_CATEGORY_SLUGS,
  NON_DRESS_CATEGORY_SLUGS,
  dressCategorySql,
};
