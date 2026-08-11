import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'GlamBaddies'
const DEFAULT_DESC =
  'Shop the latest girls dresses at GlamBaddies. Casual, party, and school dresses delivered across Ghana.'
const DEFAULT_IMAGE = 'https://www.glambaddies.com/og-image.png'
const DEFAULT_URL = 'https://www.glambaddies.com'

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  noindex = false,
}) {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const desc = description || DEFAULT_DESC
  const img = image || DEFAULT_IMAGE
  const canonical = url || DEFAULT_URL
  const ogTitle = title || SITE_NAME

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_GH" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <meta name="theme-color" content="#e91e8c" />
    </Helmet>
  )
}
