const { Readable } = require('stream');
const { SitemapStream, streamToPromise } = require('sitemap');
const db = require('../config/db');
const { getPublicSiteUrl } = require('../utils/site');

/**
 * GET /sitemap.xml — active products + core storefront pages.
 */
exports.getSitemap = async (req, res) => {
  try {
    const hostname = getPublicSiteUrl() || 'https://www.glambaddies.com';
    const { rows: products } = await db.query(
      `SELECT slug, updated_at
       FROM products
       WHERE is_active = TRUE AND slug IS NOT NULL AND slug <> ''
       ORDER BY updated_at DESC NULLS LAST, id DESC`
    );

    const links = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/shop', changefreq: 'daily', priority: 0.9 },
      { url: '/about', changefreq: 'monthly', priority: 0.5 },
      { url: '/contact', changefreq: 'monthly', priority: 0.5 },
      { url: '/faq', changefreq: 'monthly', priority: 0.4 },
      { url: '/track-order', changefreq: 'monthly', priority: 0.3 },
      ...products.map((product) => ({
        url: `/products/${product.slug}`,
        changefreq: 'weekly',
        priority: 0.8,
        lastmod: product.updated_at || undefined,
      })),
    ];

    const stream = new SitemapStream({ hostname });
    const data = await streamToPromise(Readable.from(links).pipe(stream));
    res.header('Content-Type', 'application/xml');
    res.send(data.toString());
  } catch (error) {
    console.error('[sitemap]', error.message);
    res.status(500).end();
  }
};
