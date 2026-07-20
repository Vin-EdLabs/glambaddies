import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '')

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  if (!config.headers?.Authorization) {
    const isAdmin = config.url?.startsWith('/vince-77-00')
    const token = localStorage.getItem(isAdmin ? 'vub_admin_token' : 'vub_customer_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  // Bust browser/proxy caches for catalogue reads.
  if (String(config.method || 'get').toLowerCase() === 'get' && String(config.url || '').startsWith('/products')) {
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
    const isAdmin = requestUrl.includes('/vince-77-00')
    if (status === 401 && !isAuthAttempt) {
      const type = isAdmin ? 'admin' : 'customer'
      const tokenKey = `vub_${type}_token`
      const hadToken = Boolean(localStorage.getItem(tokenKey))
      localStorage.removeItem(tokenKey)
      localStorage.removeItem(`vub_${type}`)
      // Only bounce signed-in users to login — guests can stay on checkout.
      if (hadToken) {
        const destination = isAdmin ? '/vince-77-00/login' : `/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
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
  if (!url) return 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80'
  return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

export const mapProduct = (product) => {
  if (!product || typeof product !== 'object') {
    return {
      id: '',
      name: 'Unavailable product',
      price: 0,
      category: 'Uncategorised',
      image: resolveImageUrl(),
      images: [],
      stock: 0,
      sizes: [],
    }
  }
  const rawImages = asArray(product.images)
  const images = rawImages.map((image) => resolveImageUrl(typeof image === 'string' ? image : image?.url))
  const primaryIndex = rawImages.findIndex((image) => image?.is_primary)
  return {
    ...product,
    id: String(product.id ?? ''),
    price: Number(product.price ?? Number(product.price_cents || 0) / 100),
    category: product.category_name || product.category || 'Uncategorised',
    categorySlug: product.category_slug,
    image: images[primaryIndex >= 0 ? primaryIndex : 0] || resolveImageUrl(product.image_url || product.image),
    images,
    sizes: asArray(product.sizes),
  }
}

export const mapProducts = (products) => asArray(products).map(mapProduct)

/** Notify storefront pages to refetch products after admin catalogue changes. */
export const bustProductCache = () => {
  try {
    localStorage.setItem('vub_products_rev', String(Date.now()))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('vub:products-changed'))
  }
}

export const getProductCacheRev = () => {
  try {
    return localStorage.getItem('vub_products_rev') || '0'
  } catch {
    return '0'
  }
}

export const errorMessage = (error, fallback = 'Something went wrong') =>
  error?.error || error?.message || fallback

export default api
