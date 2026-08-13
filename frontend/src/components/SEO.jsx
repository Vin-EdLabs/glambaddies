import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'GlamBaddies'
const DEFAULT_DESC =
  'GlamBaddies is Ghana\'s premium girls fashion store. Shop the latest casual dresses, party dresses, school dresses, handbags, shoes, sunglasses, makeup and beauty accessories for girls. Every piece is handpicked for the girl who knows her style. Fast delivery across Accra, Kumasi and all major cities in Ghana. Pay with Mobile Money or card. Shop. Slay. Shine.'
const DEFAULT_IMAGE = 'https://www.glambaddies.com/og-image.png'
const DEFAULT_URL = 'https://www.glambaddies.com'
const DEFAULT_TITLE = 'GlamBaddies – Girls Dresses, Bags, Shoes & Beauty Accessories | Ghana Fashion Store'

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  noindex = false,
  product = null,
  category = null,
}) {
  const pageTitle = title
    ? `${title} | ${SITE_NAME}`
    : DEFAULT_TITLE
  const desc = description || DEFAULT_DESC
  const img = image || DEFAULT_IMAGE
  const canonical = url || DEFAULT_URL
  const ogTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} – Ghana's Premium Girls Fashion Store`

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={desc} />
      <meta
        name="keywords"
        content="girls dresses Ghana, girls fashion Ghana, party dresses Ghana, school dresses Ghana, casual dresses Ghana, girls bags Ghana, girls shoes Ghana, girls accessories Ghana, girls makeup Ghana, sunglasses Ghana, girls boutique Ghana, GlamBaddies, fashion Ghana, Accra fashion, girls clothing Ghana, online shopping Ghana"
      />
      <meta name="author" content="GlamBaddies" />
      <meta name="copyright" content="GlamBaddies" />
      <meta name="language" content="English" />
      <meta name="geo.region" content="GH" />
      <meta name="geo.placename" content="Ghana" />
      <meta name="rating" content="general" />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogTitle} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_GH" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      <meta name="twitter:image:alt" content={ogTitle} />

      {/* Robots */}
      <meta
        name="robots"
        content={noindex ? 'noindex, nofollow' : 'index, follow'}
      />
      <meta name="theme-color" content="#e91e8c" />

      {/* Product structured data */}
      {product && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            image: product.image,
            url: canonical,
            brand: {
              '@type': 'Brand',
              name: 'GlamBaddies',
            },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'GHS',
              price: product.price,
              availability: product.inStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              seller: {
                '@type': 'Organization',
                name: 'GlamBaddies',
              },
              url: canonical,
              priceValidUntil: new Date(
                new Date().setFullYear(new Date().getFullYear() + 1)
              )
                .toISOString()
                .split('T')[0],
            },
            ...(product.compareAtPrice && {
              offers: {
                '@type': 'AggregateOffer',
                priceCurrency: 'GHS',
                lowPrice: product.price,
                highPrice: product.compareAtPrice,
              },
            }),
          })}
        </script>
      )}

      {/* Category structured data */}
      {category && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${category.name} | GlamBaddies Ghana`,
            description: `Shop ${category.name} at GlamBaddies Ghana. Fast delivery across Accra, Kumasi and all major cities in Ghana.`,
            url: canonical,
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: 'https://www.glambaddies.com',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Shop',
                  item: 'https://www.glambaddies.com/shop',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: category.name,
                  item: canonical,
                },
              ],
            },
          })}
        </script>
      )}
    </Helmet>
  )
}