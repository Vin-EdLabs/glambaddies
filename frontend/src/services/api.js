import axios from 'axios'

/** Relative `/api` so production traffic goes through Nginx (never bake in localhost/IPs). */
export const API_URL = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '') || '/api'
export const API_ORIGIN = API_URL.replace(/\/api$/i, '')

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  if (!config.headers?.Authorization) {
    const isAdmin = config.url?.startsWith('/glam-baddies')
    const token = localStorage.getItem(isAdmin ? 'glam_admin_token' : 'glam_customer_token')
      || localStorage.getItem(isAdmin ? 'vub_admin_token' : 'vub_customer_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  // Bust browser/proxy caches for catalogue reads.
  const url = String(config.url || '')
  if (String(config.method || 'get').toLowerCase() === 'get' && (url.startsWith('/products') || url.startsWith('/categories'))) {
    config.headers['Cache-Control'] = 'no-cache'
    config.headers.Pragma = 'no-cache'
    config.params = { ...(config.params || {}), _ts: Date.now() }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = String(error.config?.url || '')
    const isAuthAttempt = /\/(login|register)$/.test(requestUrl)
    const isAdmin = requestUrl.includes('/glam-baddies')
    if (status === 401 && !isAuthAttempt) {
      const type = isAdmin ? 'admin' : 'customer'
      const tokenKey = `glam_${type}_token`
      const hadToken = Boolean(localStorage.getItem(tokenKey) || localStorage.getItem(`vub_${type}_token`))
      localStorage.removeItem(tokenKey)
      localStorage.removeItem(`glam_${type}`)
      localStorage.removeItem(`vub_${type}_token`)
      localStorage.removeItem(`vub_${type}`)
      // Only bounce signed-in users to login — guests can stay on checkout.
      if (hadToken && typeof window !== 'undefined') {
        const destination = isAdmin ? '/glam-baddies/login' : `/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
        if (!window.location.pathname.startsWith(destination.split('?')[0])) window.location.assign(destination)
      }
    }
    const payload = error.response?.data || error
    if (payload && typeof payload === 'object') payload.status = status
    return Promise.reject(payload)
  },
)

/** Always return an array so .map / spread never crash on bad API payloads. */
export const asArray = (value) => (Array.isArray(value) ? value : [])

export const resolveImageUrl = (url) => {
  if (!url || url === 'undefined' || url === 'null' || url === 'Unknown') {
    return ''
  }
  const value = String(url).trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  // Same-origin relative path (works with Nginx /uploads proxy)
  if (value.startsWith('/')) return value
  if (API_ORIGIN) {
    return `${API_ORIGIN}/${value.replace(/^\.\//, '')}`
  }
  return `/${value.replace(/^\.\//, '')}`
}

export const mapProduct = (product) => {
  if (!product || typeof product !== 'object') {
    return {
      id: '',
      name: 'Unavailable product',
      price: 0,
      category: 'Uncategorised',
      image: '',
      images: [],
      stock: 0,
      sizes: [],
      is_active: false,
    }
  }
  const rawImages = asArray(product.images).filter((image) => {
    const imageUrl = typeof image === 'string' ? image : image?.url
    return Boolean(imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null' && imageUrl !== 'Unknown')
  })
  const images = rawImages.map((image) => resolveImageUrl(typeof image === 'string' ? image : image?.url)).filter(Boolean)
  const primaryIndex = rawImages.findIndex((image) => image?.is_primary)
  const price = Number(product.price ?? Number(product.price_cents || 0) / 100)
  const compareAt = Number(
    product.compare_at_price
      ?? (product.compare_at_price_cents != null ? Number(product.compare_at_price_cents) / 100 : 0),
  )
  const isOnSale = Boolean(
    product.is_on_sale
      && compareAt > price
      && (!product.sale_ends_at || new Date(product.sale_ends_at).getTime() > Date.now()),
  )
  const discountPercent = Number(product.discount_percent) || (isOnSale && compareAt > 0
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0)
  const savings = isOnSale ? Math.max(0, compareAt - price) : 0
  return {
    ...product,
    id: String(product.id ?? ''),
    price,
    oldPrice: isOnSale ? compareAt : undefined,
    compare_at_price: isOnSale ? compareAt : undefined,
    compare_at_price_cents: product.compare_at_price_cents ?? null,
    discount_percent: discountPercent || null,
    is_on_sale: isOnSale,
    sale_ends_at: product.sale_ends_at || null,
    savings,
    badge: isOnSale ? (discountPercent ? `-${discountPercent}%` : 'SALE') : product.badge,
    category: product.category_name || product.category || 'Uncategorised',
    categorySlug: product.category_slug,
    image: images[primaryIndex >= 0 ? primaryIndex : 0]
      || resolveImageUrl(product.primary_image_url || product.image_url || product.image)
      || '',
    images,
    sizes: asArray(product.sizes),
    available_colors: product.available_colors == null
      ? null
      : (typeof product.available_colors === 'object' && !Array.isArray(product.available_colors)
        ? product.available_colors
        : asArray(product.available_colors)),
    is_active: product.is_active !== false && product.is_active !== 'false' && product.is_active !== 0,
  }
}

export const mapProducts = (products) =>
  asArray(products)
    // Public catalogue safety net — never render deactivated rows.
    .filter((product) => product && product.is_active !== false && product.is_active !== 'false' && product.is_active !== 0)
    .map(mapProduct)

/** Notify storefront pages to refetch products after admin catalogue changes. */
export const bustProductCache = (revision) => {
  const next = String(revision || Date.now())
  try {
    localStorage.setItem('glam_products_rev', next)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('glam:products-changed', { detail: { revision: next } }))
  }
}

export const getProductCacheRev = () => {
  try {
    return localStorage.getItem('glam_products_rev') || localStorage.getItem('vub_products_rev') || '0'
  } catch {
    return '0'
  }
}

let lastCatalogueSyncAt = 0
const CATALOGUE_SYNC_MIN_MS = 60_000

/** Sync catalogue revision from the API (works across devices/browsers). */
export const syncCatalogueRevision = async ({ force = false } = {}) => {
  const now = Date.now()
  if (!force && now - lastCatalogueSyncAt < CATALOGUE_SYNC_MIN_MS) {
    return getProductCacheRev()
  }
  lastCatalogueSyncAt = now
  try {
    const { data } = await api.get('/store/status', {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      params: { _ts: now },
    })
    const revision = data?.catalogue_revision
    if (revision != null && String(revision) !== getProductCacheRev()) {
      bustProductCache(revision)
      return String(revision)
    }
    return getProductCacheRev()
  } catch {
    return getProductCacheRev()
  }
}

export const errorMessage = (error, fallback = 'Something went wrong') =>
  error?.error || error?.message || fallback

export default api
