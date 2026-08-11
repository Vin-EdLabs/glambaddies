const { Readable } = require('stream');
const { SitemapStream, streamToPromise } = require('sitemap');
const db = require('../config/db');
const { getPublicSiteUrl } = require('../utils/site');
const { dressCategorySql } = require('../utils/dressCategories');

const PRODUCTION_HOST = 'https://www.glambaddies.com';

function siteHost() {
  const fromEnv = getPublicSiteUrl();
  // Prefer the public production host for crawlable URLs
  if (!fromEnv || /localhost|127\.0\.0\.1/i.test(fromEnv)) {
    return PRODUCTION_HOST;
  }
  return fromEnv;
}

function toIsoDate(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function absoluteAssetUrl(hostname, url) {
  const clean = String(url || '').trim();
  if (!clean || clean === 'undefined' || clean === 'null' || clean === 'Unknown') {
    return null;
  }
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith('//')) return `https:${clean}`;
  if (clean.startsWith('/')) return `${hostname}${clean}`;
  // Relative upload paths (e.g. uploads/foo.jpg)
  return `${hostname}/${clean.replace(/^\.\//, '')}`;
}

/**
 * GET /sitemap.xml
 * Includes:
 *  - home, New arrivals (/shop), Our story (/about), Track order
 *  - active dress-category shop filters
 *  - active dress product detail pages with image sitemap entries
 */
exports.getSitemap = async (req, res) => {
  try {
    const hostname = siteHost();
    const isDressCategory = dressCategorySql('c');

    const [{ rows: categories }, { rows: products }] = await Promise.all([
      db.query(
        `SELECT c.slug, c.name,
                MAX(p.updated_at) AS updated_at
         FROM categories c
         INNER JOIN products p
           ON p.category_id = c.id
          AND p.is_active = TRUE
         WHERE ${isDressCategory}
         GROUP BY c.id, c.slug, c.name
         ORDER BY c.name ASC`
      ),
      db.query(
        `SELECT p.slug, p.name, p.description, p.updated_at, p.created_at,
                COALESCE(
                  (
                    SELECT json_agg(
                      json_build_object(
                        'url', pi.url,
                        'is_primary', pi.is_primary
                      )
                      ORDER BY pi.is_primary DESC, pi.id ASC
                    )
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                  ),
                  '[]'::json
                ) AS images
         FROM products p
         INNER JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = TRUE
           AND p.slug IS NOT NULL
           AND p.slug <> ''
           AND ${isDressCategory}
         ORDER BY p.updated_at DESC NULLS LAST, p.id DESC`
      ),
    ]);

    const latestProductUpdate = products.reduce((latest, product) => {
      const stamp = product.updated_at || product.created_at;
      if (!stamp) return latest;
      const ms = new Date(stamp).getTime();
      if (Number.isNaN(ms)) return latest;
      return latest == null || ms > latest ? ms : latest;
    }, null);

    const catalogueLastmod = toIsoDate(latestProductUpdate) || toIsoDate(new Date());

    // Public routes only: home, New arrivals, Our story, Track order (+ dress catalogue URLs)
    const links = [
      {
        url: '/',
        changefreq: 'daily',
        priority: 1.0,
        lastmod: catalogueLastmod,
      },
      {
        url: '/shop',
        changefreq: 'daily',
        priority: 0.9,
        lastmod: catalogueLastmod,
      },
      {
        url: '/about',
        changefreq: 'monthly',
        priority: 0.7,
      },
      {
        url: '/track-order',
        changefreq: 'monthly',
        priority: 0.6,
      },
      ...categories.map((category) => ({
        url: `/shop?category=${encodeURIComponent(category.slug)}`,
        changefreq: 'daily',
        priority: 0.85,
        lastmod: toIsoDate(category.updated_at) || catalogueLastmod,
      })),
      ...products.map((product) => {
        const images = Array.isArray(product.images) ? product.images : [];
        const img = images
          .map((image) => {
            const src = absoluteAssetUrl(hostname, image?.url);
            if (!src) return null;
            return {
              url: src,
              title: product.name || undefined,
              caption: product.description
                ? String(product.description).slice(0, 220)
                : product.name || undefined,
            };
          })
          .filter(Boolean)
          // Google recommends a sensible cap; keep primary + a few extras
          .slice(0, 8);

        return {
          url: `/products/${encodeURIComponent(product.slug)}`,
          changefreq: 'weekly',
          priority: 0.8,
          lastmod: toIsoDate(product.updated_at || product.created_at),
          ...(img.length ? { img } : {}),
        };
      }),
    ];

    const stream = new SitemapStream({
      hostname,
      xmlns: {
        news: false,
        xhtml: false,
        image: true,
        video: false,
      },
    });

    const xml = await streamToPromise(Readable.from(links).pipe(stream));

    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex', // the sitemap file itself need not be indexed
    });
    res.send(xml.toString());
  } catch (error) {
    console.error('[sitemap]', error.message);
    res.status(500).type('text/plain').send('Sitemap unavailable');
  }
};
