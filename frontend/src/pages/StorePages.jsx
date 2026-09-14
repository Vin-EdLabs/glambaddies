import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PaystackPop from '@paystack/inline-js'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Filter, Heart, MapPin, Minus, Package, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react'
import { EmptyState, ErrorState, LoadingGrid, PasswordInput, ProductCard, CopyValue } from '../components'
import SEO from '../components/SEO'
import { ProductImageGallery } from '../ProductImageGallery'
import { useAuth, useCart, useWishlist } from '../contexts'
import api, { asArray, errorMessage, getProductCacheRev, mapProduct, mapProducts, resolveImageUrl, syncCatalogueRevision } from '../services/api'
import { formatCurrency, groupCategories } from '../utils'
import { DRESS_COLORS, DRESS_SIZES, getColorQty, isColorInStock, normalizeColorStock } from '../dressOptions'

const SITE_URL = String(import.meta.env.VITE_APP_URL || 'https://www.glambaddies.com').replace(/\/$/, '')

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return undefined
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

function useApi(load, dependencies) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const run = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }))
    load().then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(run, [run])
  return { ...state, retry: run }
}

/** Refetch storefront catalogue when products change (local or server revision). */
function useProductCacheRev() {
  const [rev, setRev] = useState(() => getProductCacheRev())
  useEffect(() => {
    const sync = () => setRev(getProductCacheRev())
    const onFocus = () => {
      syncCatalogueRevision().then(sync).catch(sync)
    }
    window.addEventListener('glam:products-changed', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('focus', onFocus)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    document.addEventListener('visibilitychange', onVisibility)
    // One sync on mount; avoid hammering /store/status (was causing 429s).
    onFocus()
    const timer = window.setInterval(onFocus, 120000)
    return () => {
      window.removeEventListener('glam:products-changed', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [])
  return rev
}

/** Fades + slides an element in the first time it scrolls into view. */
function useReveal(delayMs = 0) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return {
    ref,
    className: `reveal${visible ? ' reveal-in' : ''}`,
    style: { '--reveal-delay': `${delayMs}ms` },
  }
}

const HOME_CATEGORY_SHOWCASE = [
  {
    slug: 'casual-dresses',
    group: 'Dresses',
    eyebrow: 'Casual',
    title: 'Everyday dresses',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
  },
  {
    slug: 'party-dresses',
    group: 'Dresses',
    eyebrow: 'Party',
    title: 'Celebration looks',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80',
  },
  {
    slug: 'school-dresses',
    group: 'Dresses',
    eyebrow: 'School',
    title: 'Smart day dresses',
    image: 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=600&q=80',
  },
  {
    slug: 'bags',
    group: 'Bags',
    eyebrow: 'Bags',
    title: 'Carry the look',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
  },
  {
    slug: 'shoes',
    group: 'Shoes',
    eyebrow: 'Shoes',
    title: 'Step into glam',
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80',
  },
  {
    slug: 'beauty',
    group: 'Beauty',
    eyebrow: 'Beauty',
    title: 'Makeup & tiny essentials',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80',
  },
]

function isTestCategory(category) {
  const slug = String(category?.slug || '').toLowerCase()
  const name = String(category?.name || '').toLowerCase()
  return slug.includes('vincet') || name.includes('vincet') || slug.includes('test') || name.includes('test')
}

function categorySectionCopy(category) {
  const name = String(category?.name || 'Dresses').trim()
  const eyebrow = String(category?.home_eyebrow || name).trim() || name
  const title = String(category?.home_title || name).trim() || name
  const text = String(category?.description || '').trim()
  return { eyebrow, title, text }
}

function RevealItem({ as: Tag = 'div', delay = 0, className = '', children }) {
  const reveal = useReveal(delay)
  return (
    <Tag ref={reveal.ref} className={`${reveal.className}${className ? ` ${className}` : ''}`} style={reveal.style}>
      {children}
    </Tag>
  )
}

// No wrapper element — ProductCard must stay a direct child of .product-grid
// (CSS like ".product-card:last-child" depends on real grid-item siblings).
function RevealProductCard({ product, delay }) {
  const reveal = useReveal(delay)
  return <ProductCard product={product} cardRef={reveal.ref} className={reveal.className} style={reveal.style} />
}

function CategoryTile({ edit }) {
  const reveal = useReveal(Math.min(edit.index * 70, 350))
  return (
    <Link
      ref={reveal.ref}
      className={`home-category-card ${reveal.className}`}
      to={edit.to}
      style={reveal.style}
    >
      <div className="home-category-card-media">
        <img src={edit.image} alt={edit.alt} loading="lazy" />
      </div>
      <div className="home-category-card-copy">
        <span>{edit.group}</span>
        <h2>{edit.title}</h2>
      </div>
      <span className="home-category-card-arrow" aria-hidden="true">→</span>
    </Link>
  )
}

function CategorySection({ category }) {
  const head = useReveal(0)
  return (
    <section className="section home-category">
      <div ref={head.ref} className={`section-head home-category-head ${head.className}`} style={head.style}>
        <div>
          <span className="eyebrow">{category.eyebrow}</span>
          <h2>{category.title}</h2>
          {category.text ? <p className="home-category-copy">{category.text}</p> : null}
        </div>
        <Link className="browse-all" to={category.to}>
          Shop all
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="product-grid home-category-products">
        {category.products.map((product, index) => (
          <RevealProductCard key={product.id} product={product} delay={Math.min(index * 80, 320)} />
        ))}
      </div>
      <div className="home-category-foot">
        <Link className="browse-all browse-all--solid" to={category.to}>
          Shop all {category.eyebrow.toLowerCase()}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}

export function Home() {
  const productsRev = useProductCacheRev()
  const { data, loading, error, retry } = useApi(
    () => api.get('/categories').then(async ({ data: categoriesPayload }) => {
      const allCategories = asArray(categoriesPayload?.categories).filter((category) => !isTestCategory(category))
      const productResults = await Promise.all(
        allCategories.map((category) =>
          api.get('/products', {
            params: { category: category.slug, limit: 4, sort: 'newest' },
          }).catch(() => ({ data: { products: [] } })),
        ),
      )

      const revision = productResults.find((result) => result.data?.revision != null)?.data?.revision
      if (revision != null) {
        try { localStorage.setItem('glam_products_rev', String(revision)) } catch { /* ignore */ }
      }

      const showcaseBySlug = Object.fromEntries(HOME_CATEGORY_SHOWCASE.map((item) => [item.slug, item]))
      // Built from the live categories, never from the fixed showcase list — a
      // deleted category must not keep a tile just because it used to be one of
      // the launch defaults. The showcase entry (if any) only supplies cosmetic
      // fallbacks — group label / stock photo — for a category that still exists.
      const features = allCategories.map((category) => {
        const showcase = showcaseBySlug[category.slug]
        return {
          id: `category-${category.id}`,
          category_id: category.id,
          category_slug: category.slug,
          group: showcase?.group || category.name,
          eyebrow: category.home_eyebrow || showcase?.eyebrow || category.name,
          title: category.home_title || showcase?.title || category.name,
          image_url: category.home_image_url || showcase?.image || '',
        }
      }).filter((feature) => feature.image_url)

      const sections = allCategories
        .map((category, index) => {
          const copy = categorySectionCopy(category)
          const products = mapProducts(productResults[index]?.data?.products)
          return {
            key: `category-${category.id || category.slug}`,
            slug: category.slug,
            eyebrow: copy.eyebrow,
            title: copy.title,
            text: copy.text,
            to: `/shop?category=${encodeURIComponent(category.slug)}`,
            products,
          }
        })
        .filter((section) => section.products.length > 0)

      return {
        features,
        sections,
        categoryNames: allCategories.map((category) => category.name).filter(Boolean),
      }
    }),
    [productsRev],
  )

  const categories = asArray(data?.sections)

  // Static tiles only stand in before the first successful load / on API error —
  // once real data has loaded, an empty list means "no categories" and should
  // render as empty, not silently show demo tiles for categories that don't exist.
  const featureSource = data
    ? asArray(data.features)
    : HOME_CATEGORY_SHOWCASE.map((item) => ({
        category_slug: item.slug,
        eyebrow: item.eyebrow,
        title: item.title,
        group: item.group,
        image_url: item.image,
      }))

  const featureTiles = featureSource.map((feature, index) => {
    const fallback = HOME_CATEGORY_SHOWCASE[index] || HOME_CATEGORY_SHOWCASE[0]
    const slug = feature.category_slug || fallback.slug
    const eyebrow = feature.eyebrow || fallback.eyebrow
    const title = feature.title || fallback.title
    const group = feature.group || fallback.group || 'Shop'
    const image = feature.image_url || fallback.image
    return {
      key: `tile-${feature.category_id || index}-${slug}`,
      to: `/shop?category=${encodeURIComponent(slug)}`,
      image,
      group,
      eyebrow,
      title,
      alt: `${title} — GlamBaddies`,
      index,
    }
  })

  const collectionLine = asArray(data?.categoryNames).length
    ? `${asArray(data.categoryNames).join(', ')} — the full GlamBaddies edit in one place.`
    : 'The full GlamBaddies edit in one place.'

  return (
    <>
      <SEO
        title="Girls Fashion in Ghana"
        description="Shop GlamBaddies — girls' dresses, bags, shoes and beauty, delivered across Ghana."
        url={`${SITE_URL}/`}
      />

      <section className="hero-band" aria-label="GlamBaddies hero">
        <div className="hero-section">
          <img src="/hero.png" alt="GlamBaddies GH — Look good. Stay glam." />
          <div className="hero-copy">
            <img className="hero-brand" src="/logo.png" alt="GlamBaddies — Shop. Slay. Shine." />
            <h1>Shop. Slay.<br /><em>Shine.</em></h1>
            <p>Bold glam for girls — dresses, bags, shoes and beauty made to turn heads.</p>
            <Link className="button light-button" to="/shop">Shop the collection <ArrowRight /></Link>
          </div>
        </div>
      </section>

      {featureTiles.length ? (
        <section className="home-category-editorial" aria-label="Shop by category">
          <RevealItem as="p" className="home-category-editorial-title">Shop by category</RevealItem>
          <div className="home-category-grid">
            {featureTiles.map((edit) => (
              <CategoryTile edit={edit} key={edit.key} />
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <section className="section home-category">
          <LoadingGrid />
        </section>
      ) : error ? (
        <section className="section home-category">
          <ErrorState retry={retry} />
        </section>
      ) : (
        categories.map((category) => (
          <CategorySection category={category} key={category.key} />
        ))
      )}

      <section className="home-shop-all" aria-label="Shop every dress">
        <RevealItem className="home-shop-all-inner">
          <span className="eyebrow">The full collection</span>
          <h2>Shop the collection</h2>
          <p>{collectionLine}</p>
          <Link className="browse-all browse-all--solid" to="/shop">
            Shop all
            <ArrowRight size={16} />
          </Link>
        </RevealItem>
      </section>

      <section className="manifesto">
        <span className="eyebrow">Shop · Slay · Shine</span>
        <h2>Little dresses.<br />Big energy.</h2>
        <p>GlamBaddies is a girls&apos; fashion boutique devoted only to dresses — bold cuts, soft glam, and looks that turn heads.</p>
        <Link to="/about">Discover GlamBaddies <ArrowRight /></Link>
      </section>

      <section className="benefits">
        <div><Truck /><h3>Complimentary delivery</h3><p>On orders over GHS 500</p></div>
        <div><RotateCcw /><h3>Considered returns</h3><p>Easy returns within 14 days</p></div>
        <div><ShieldCheck /><h3>Secure payment</h3><p>Protected checkout with Paystack (GHS)</p></div>
      </section>
    </>
  )
}

export function Shop() {
  const [params] = useSearchParams()
  const [sort, setSort] = useState('newest')
  const [mobileFilters, setMobileFilters] = useState(false)
  const productsRev = useProductCacheRev()
  const category = params.get('category') || ''
  const query = params.get('q') || params.get('search') || ''
  const requestKey = `${category}|${query}|${sort}|${productsRev}`
  const { data, loading, error, retry } = useApi(
    () => Promise.all([
      api.get('/products', { params: { category: category || undefined, q: query || undefined, sort, limit: 100 } }),
      api.get('/categories').catch(() => ({ data: { categories: [] } })),
    ]).then(([productsResult, categoriesResult]) => {
      if (productsResult.data?.revision != null) {
        try { localStorage.setItem('glam_products_rev', String(productsResult.data.revision)) } catch { /* ignore */ }
      }
      return {
        products: mapProducts(productsResult.data?.products),
        pagination: productsResult.data?.pagination || { total: 0 },
        categories: asArray(categoriesResult.data?.categories).filter((item) => !isTestCategory(item)),
      }
    }),
    [requestKey],
  )
  const products = asArray(data?.products)
  const categories = asArray(data?.categories)
  const { dresses, accessories, other } = groupCategories(categories)
  const pillCategories = [...dresses, ...accessories, ...other]
  const title = categories.find((item) => item.slug === category)?.name || (query ? `Results for “${query}”` : 'Shop all')
  return <div className="shop-page">
    <SEO
      title="Shop the Collection"
      description="Browse dresses, bags, shoes and beauty at GlamBaddies — girls' fashion delivered across Ghana."
      url={`${SITE_URL}/shop`}
    />
    <div className="page-title"><span className="eyebrow">The collection</span><h1>{title}</h1><p>Dresses, bags, shoes &amp; beauty — curated for every occasion.</p></div>
    <div className="shop-category-pills" aria-label="Categories">
      <Link className={`shop-pill${!category ? ' is-active' : ''}`} to="/shop">All</Link>
      {pillCategories.map((item) => (
        <Link
          key={item.slug}
          className={`shop-pill${category === item.slug ? ' is-active' : ''}`}
          to={`/shop?category=${encodeURIComponent(item.slug)}`}
        >
          {item.name}
        </Link>
      ))}
    </div>
    <div className="catalog-toolbar"><button onClick={() => setMobileFilters(true)}><Filter /> Filters</button><span>{data?.pagination?.total || 0} pieces</span><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name_asc">Name</option></select><ChevronDown /></label></div>
    <div className="catalog"><aside className={mobileFilters ? 'open' : ''}><button className="filter-close" onClick={() => setMobileFilters(false)}><X /></button><FilterGroup title="Category" values={categories} active={category} /></aside>
      {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <EmptyState title={category ? `No ${title} yet` : 'No pieces found'} text={category ? 'New pieces for this category will show up here soon. Browse the full shop meanwhile.' : 'Try changing your filters or search phrase.'} action="View all products" to="/shop" />}</div>
  </div>
}

function FilterGroup({ title, values, active }) {
  return <div className="filter-group"><h3>{title}<Minus /></h3>{asArray(values).map((value) => <label key={value.id}><Link to={`/shop?category=${encodeURIComponent(value.slug)}`}><input type="checkbox" readOnly checked={active === value.slug} /> <span>{value.name}</span></Link></label>)}</div>
}

export function ProductDetail() {
  const { id } = useParams()
  const { addItem } = useCart()
  const { hasItem, toggleItem } = useWishlist()
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const productsRev = useProductCacheRev()
  const { data: product, loading, error, retry } = useApi(
    () => api.get(`/products/${id}`).then(({ data }) => mapProduct(data?.product)),
    [id, productsRev],
  )

  useEffect(() => {
    setSize('')
    setColor('')
  }, [id])

  if (loading) return <div className="section"><LoadingGrid /></div>
  if (error?.status === 404) {
    return (
      <>
        <SEO title="Page Not Found" noindex />
        <EmptyState title="Piece not found" text="This item may no longer be available." action="Continue shopping" to="/shop" />
      </>
    )
  }
  if (error) return <ErrorState retry={retry} />
  const images = asArray(product?.images).length ? asArray(product.images) : [product?.image].filter(Boolean)
  const productPath = `/products/${product.slug || product.id}`
  const colorStock = normalizeColorStock(product.available_colors)
  // null = older products (every colour open). Object = qty per colour (0 = sold out).
  const restrictColors = colorStock != null
  const isColorAvailable = (name) => isColorInStock(colorStock, name)
  const add = () => {
    if (!color) return toast.error('Please select a colour')
    if (!isColorAvailable(color)) {
      return toast.error(`${color} is sold out — pick another colour`, { id: `color-${color}` })
    }
    if (!size) return toast.error('Please select a size')
    addItem(product, { size, color })
  }
  return (
    <div className="product-detail">
      <SEO
        title={product.name}
        description={product.description || `${product.name} — girls' dress at GlamBaddies.`}
        image={absoluteUrl(product.image)}
        url={`${SITE_URL}${productPath}`}
        type="product"
      />
      <ProductImageGallery images={images} alt={product.name} />
      <div className="product-summary">
        <span className="eyebrow">{product.brand || product.category}</span>
        <h1>{product.name}</h1>
        <div className={`detail-price${product.is_on_sale ? ' is-on-sale' : ''}`}>
          {product.oldPrice ? <del>{formatCurrency(product.oldPrice)}</del> : null}
          <strong className={product.is_on_sale ? 'sale-price' : undefined}>{formatCurrency(product.price)}</strong>
        </div>
        {product.is_on_sale && product.savings > 0 ? (
          <p className="sale-save">You save {formatCurrency(product.savings)}</p>
        ) : null}
        <p>{product.description}</p>
        <div className="option-block">
          <div className="size-head">
            <strong>Colour</strong>
            <span>{color ? (isColorAvailable(color) ? color : `${color} · sold out`) : 'Select'}</span>
          </div>
          <div className="color-swatches" role="listbox" aria-label="Colour">
            {DRESS_COLORS.map((item) => {
              const available = isColorAvailable(item.name)
              const qty = restrictColors ? getColorQty(colorStock, item.name) : null
              return (
                <button
                  type="button"
                  key={item.name}
                  title={available ? (qty != null ? `${item.name} · ${qty} left` : item.name) : `${item.name} — sold out`}
                  className={`color-swatch${item.pattern ? ' leopard' : ''}${color === item.name ? ' selected' : ''}${available ? '' : ' is-unavailable'}`}
                  style={{ '--swatch': item.value }}
                  aria-label={available ? item.name : `${item.name} sold out`}
                  aria-selected={color === item.name}
                  aria-disabled={!available}
                  onClick={() => {
                    if (!available) {
                      toast.error(`${item.name} is sold out. Please choose another colour.`, { id: `color-${item.name}` })
                      return
                    }
                    setColor(item.name)
                  }}
                />
              )
            })}
          </div>
          {restrictColors ? (
            <p className="color-availability-hint">
              {Object.values(colorStock).some((qty) => Number(qty) > 0)
                ? 'Colours with a slash are sold out for this piece.'
                : 'Every colour is sold out for this piece right now.'}
            </p>
          ) : null}
        </div>
        <div className="option-block">
          <div className="size-head"><strong>Size</strong><button type="button">Size guide</button></div>
          <div className="size-grid">
            {DRESS_SIZES.map((item) => (
              <button type="button" className={size === item ? 'selected' : ''} onClick={() => setSize(item)} key={item}>{item}</button>
            ))}
          </div>
        </div>
        <button className="button full" disabled={!product.stock} onClick={add}>{product.stock ? 'Add to bag' : 'Sold out'} <ShoppingBag /></button>
        <button
          className={`wishlist${hasItem(product.id) ? ' is-saved' : ''}`}
          type="button"
          aria-pressed={hasItem(product.id)}
          onClick={() => toggleItem(product)}
        >
          <Heart fill={hasItem(product.id) ? 'currentColor' : 'none'} />
          {hasItem(product.id) ? 'Saved to wishlist' : 'Add to wishlist'}
        </button>
        <details open><summary>Details & composition <Plus /></summary><p>{product.description || 'Thoughtfully made from premium materials.'}</p></details>
        <details><summary>Delivery & returns <Plus /></summary><p>Choose pickup or delivery at checkout. Returns accepted within 14 days.</p></details>
        <details open><summary>Track your order <Plus /></summary><p>Use the phone number from checkout anytime on the <Link to="/track-order">Track order</Link> page — no sign-in needed.</p></details>
      </div>
    </div>
  )
}

/** Amount + currency from /payment/prepare (GHS pesewas for Ghana Paystack). */
function paystackAmountFromSession(session) {
  const currency = String(session?.currency || 'GHS').toUpperCase()
  const amount = Math.round(Number(session.amount_ghs_pesewas ?? session.amount))
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error('Invalid payment amount')
  }
  return { amount, currency }
}

export function Checkout() {
  const { items, subtotal, clearCart } = useCart()
  const { customer } = useAuth()
  const navigate = useNavigate()
  const checkoutFormRef = useRef(null)
  const applePayMountedRef = useRef(false)
  /** Exclusive checkout path: only one of 'apple' | 'paystack' owns the order reference. */
  const paymentMethodRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [checkoutToken, setCheckoutToken] = useState('')
  const [purchasesEnabled, setPurchasesEnabled] = useState(true)
  const [applePayReady, setApplePayReady] = useState(false)
  const [fulfillment, setFulfillment] = useState('delivery')
  const shipping = 0

  useEffect(() => {
    api.get('/store/status')
      .then(({ data }) => {
        setPurchasesEnabled(data.purchases_enabled !== false)
      })
      .catch(() => {
        setPurchasesEnabled(true)
      })
  }, [])

  // On Apple devices, mount Paystack Apple Pay (GHS) once the form is valid.
  useEffect(() => {
    const form = checkoutFormRef.current
    if (!form) return undefined
    let timer
    const tryMount = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (
          !form.checkValidity() ||
          applePayMountedRef.current ||
          paymentMethodRef.current === 'paystack' ||
          submitting
        ) {
          return
        }
        mountApplePay(form).catch(() => {})
      }, 400)
    }
    form.addEventListener('focusout', tryMount)
    form.addEventListener('change', tryMount)
    return () => {
      window.clearTimeout(timer)
      form.removeEventListener('focusout', tryMount)
      form.removeEventListener('change', tryMount)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, purchasesEnabled, submitting, fulfillment])

  const payHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : undefined)

  const clearApplePayUi = () => {
    applePayMountedRef.current = false
    setApplePayReady(false)
    const appleHost = document.getElementById('paystack-apple-pay')
    if (appleHost) appleHost.replaceChildren()
  }

  useEffect(() => {
    setPendingOrder(null)
    setCheckoutToken('')
    clearApplePayUi()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment])

  const ensureOrder = async (form) => {
    let order = pendingOrder
    let token = checkoutToken
    if (!order || !token) {
      const fields = Object.fromEntries(new FormData(form))
      fields.fulfillment_method = fulfillment
      fields.full_name = fields.full_name || fields.name
      fields.location = fields.location || ''
      fields.additional_note = fields.additional_note || ''
      fields.location_note = fields.additional_note
      const result = await api.post('/orders/guest', {
        shipping_address: {
          ...fields,
          bag_items: items.map((item) => ({
            product_id: Number(item.id),
            name: item.name,
            size: item.size || null,
            color: item.color || null,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        items: items.map((item) => ({
          product_id: Number(item.id),
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        })),
      })
      order = result.data.order
      token = result.data.checkout_token
      setPendingOrder(order)
      setCheckoutToken(token)
      try {
        if (fields.phone) sessionStorage.setItem('glam_track_phone', String(fields.phone).trim())
      } catch { /* ignore */ }
    }
    return { order, token }
  }

  const verifyPayment = async (reference, token) => {
    const { data } = await api.get(
      `/payment/verify/${encodeURIComponent(reference)}`,
      { headers: payHeaders(token) },
    )
    if (!data.verified) throw new Error('Payment could not be verified')
    const phone =
      pendingOrder?.shipping_address?.phone ||
      (() => {
        try { return sessionStorage.getItem('glam_track_phone') || '' } catch { return '' }
      })()
    clearCart()
    setCheckoutToken('')
    setPendingOrder(null)
    paymentMethodRef.current = null
    const qs = new URLSearchParams({
      order: String(data.order_id || ''),
      reference: String(reference || ''),
    })
    if (phone) qs.set('phone', phone)
    navigate(`/order-confirmation?${qs.toString()}`)
  }

  /** Apple Pay only: /payment/prepare → paymentRequest with backend GHS pesewas. */
  const mountApplePay = async (form) => {
    if (applePayMountedRef.current || paymentMethodRef.current === 'paystack' || submitting) return
    const canApple = Boolean(
      typeof window !== 'undefined' &&
        window.ApplePaySession &&
        typeof window.ApplePaySession.canMakePayments === 'function' &&
        window.ApplePaySession.canMakePayments()
    )
    if (!canApple) return

    const { order, token } = await ensureOrder(form)
    // Do not call /payment/initialize here — Apple Pay uses prepare only.
    const { data: session } = await api.post(
      '/payment/prepare',
      { order_id: order.id },
      { headers: payHeaders(token) },
    )

    const amountPayload = paystackAmountFromSession(session)
    const publicKey =
      session.paystack_public_key ||
      import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
    if (!publicKey) return

    paymentMethodRef.current = 'apple'
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    const popup = new PaystackPop()
    await popup.paymentRequest({
      key: publicKey,
      email: session.email,
      amount: amountPayload.amount,
      currency: amountPayload.currency,
      ref: session.reference,
      reference: session.reference,
      container: 'paystack-apple-pay',
      type: 'buy',
      styles: {
        theme: 'dark',
        applePay: {
          width: '100%',
          height: '52px',
          borderRadius: '4px',
          type: 'buy',
          locale: 'en',
        },
      },
      onElementsMount: (elements) => {
        setApplePayReady(Boolean(elements))
      },
      onSuccess: (transaction) => {
        const reference = transaction?.reference || session.reference
        verifyPayment(reference, token).catch((verifyError) => {
          toast.error(errorMessage(verifyError, 'Payment verification failed'))
        })
      },
      onCancel: () => toast.error('Payment cancelled'),
      onError: (error) => toast.error(errorMessage(error, 'Payment failed')),
    })
    applePayMountedRef.current = true
  }

  /** Paystack popup: backend GHS initialize → resumeTransaction(access_code). */
  const startCheckout = async (event) => {
    event.preventDefault()
    const form = checkoutFormRef.current
    if (!form || !items.length || submitting) return
    if (!form.reportValidity()) return
    setSubmitting(true)
    try {
      const { data: store } = await api.get('/store/status')
      if (!store.purchases_enabled) {
        setPurchasesEnabled(false)
        throw new Error('Item unavailable. Please try again later.')
      }
      setPurchasesEnabled(true)

      const { order, token } = await ensureOrder(form)

      // Switch exclusive path: abandon any Apple Pay prepare session before initialize.
      paymentMethodRef.current = 'paystack'
      clearApplePayUi()

      const { data: payment } = await api.post(
        '/payment/initialize',
        {
          order_id: order.id,
          channels: ['card', 'mobile_money', 'bank_transfer'],
        },
        { headers: payHeaders(token) },
      )

      // Currency is locked on the Paystack transaction (GHS for Ghana merchants).
      if (!payment.access_code) {
        if (payment.authorization_url) {
          window.location.assign(payment.authorization_url)
          return
        }
        throw new Error('Payment could not be started')
      }

      const popup = new PaystackPop()
      popup.resumeTransaction(payment.access_code, {
        onSuccess: () => verifyPayment(payment.reference, token).catch((verifyError) => toast.error(errorMessage(verifyError, 'Payment verification failed'))),
        onCancel: () => {
          paymentMethodRef.current = null
          toast.error('Payment cancelled')
        },
        onError: (error) => {
          paymentMethodRef.current = null
          toast.error(errorMessage(error, 'Payment failed'))
        },
      })
    } catch (error) {
      paymentMethodRef.current = null
      if (!String(error?.error || error?.message || '').toLowerCase().includes('unavailable')) {
        setPendingOrder(null)
        setCheckoutToken('')
        clearApplePayUi()
      }
      toast.error(errorMessage(error, 'Checkout failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!items.length) {
    return (
      <>
        <SEO title="Checkout" noindex />
        <EmptyState title="Your bag is empty" text="Add a piece before starting checkout." action="Return to shop" to="/shop" />
      </>
    )
  }
  return (
    <div className="checkout-page">
      <SEO title="Checkout" noindex />
      <form ref={checkoutFormRef} onSubmit={startCheckout}>
        <Link to="/shop"><ArrowLeft /> Continue shopping</Link>
        <h1>Checkout</h1>
        {!customer && <p className="guest-note">Checking out as a guest — no account needed. Prefer an account? <Link to="/login?next=/checkout">Sign in</Link></p>}
        {!purchasesEnabled && (
          <div className="store-paused-banner" role="alert">
            <Package />
            <div>
              <strong>Items unavailable</strong>
              <p>Purchases are paused right now. Please try again later.</p>
            </div>
          </div>
        )}
        <fieldset>
          <legend>Your details</legend>
          <div className="form-grid">
            <label className="span-2">Full name<input name="full_name" required autoComplete="name" placeholder="e.g. Ama Mensah" defaultValue={customer?.name || ''} /></label>
            <label>Phone number<input name="phone" type="tel" required autoComplete="tel" placeholder="e.g. 0241234567" defaultValue={customer?.phone || ''} /></label>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Required for receipts & order updates"
                defaultValue={customer?.email || ''}
              />
            </label>
            <label className="span-2">Location<input name="location" required autoComplete="street-address" placeholder="Area, landmark, or pickup point" /></label>
            <label className="span-2">Additional note <small>(optional)</small><input name="additional_note" placeholder="Anything else we should know" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>How should we get it to you?</legend>
          <div className="fulfillment-options">
            <label className={`fulfillment-card${fulfillment === 'delivery' ? ' selected' : ''}`}>
              <input type="radio" name="fulfillment_method" value="delivery" checked={fulfillment === 'delivery'} onChange={() => setFulfillment('delivery')} />
              <Truck />
              <span><strong>Delivery</strong><small>We bring it to you</small></span>
            </label>
            <label className={`fulfillment-card${fulfillment === 'pickup' ? ' selected' : ''}`}>
              <input type="radio" name="fulfillment_method" value="pickup" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} />
              <MapPin />
              <span><strong>Pickup</strong><small>Collect in store</small></span>
            </label>
          </div>
        </fieldset>

        <div className="checkout-pay-actions">
          <div id="paystack-apple-pay" className="paystack-apple-pay" />
          {applePayReady && (
            <div className="checkout-pay-divider" role="separator" aria-label="or">
              <span>or</span>
            </div>
          )}
          <button type="submit" className="button full checkout-paystack-button" disabled={submitting || !purchasesEnabled}>
            {!purchasesEnabled ? 'Unavailable — try again later' : submitting ? 'Preparing payment…' : 'Pay securely with Paystack'}
            <ShieldCheck />
          </button>
        </div>
      </form>
      <OrderSummary items={items} subtotal={subtotal} shipping={shipping} />
    </div>
  )
}

function OrderSummary({ items, subtotal, shipping }) {
  return <aside className="order-summary"><h2>Your order</h2>{items.map((item) => <div className="summary-item" key={item.key}><div><img src={item.image} alt="" /><span>{item.quantity}</span></div><p><strong>{item.name}</strong>{(item.color || item.size) && <small>{[item.color, item.size && `Size ${item.size}`].filter(Boolean).join(' · ')}</small>}</p><b>{formatCurrency(item.price * item.quantity)}</b></div>)}<div className="summary-lines"><p><span>Subtotal</span><b>{formatCurrency(subtotal)}</b></p><p><span>Delivery</span><b>{shipping ? formatCurrency(shipping) : 'Complimentary'}</b></p><p className="grand-total"><span>Total</span><b>{formatCurrency(subtotal + shipping)}</b></p></div></aside>
}

export function OrderConfirmation() {
  const [params] = useSearchParams()
  const phone =
    params.get('phone') ||
    (() => {
      try { return sessionStorage.getItem('glam_track_phone') || '' } catch { return '' }
    })()
  if (!params.get('reference') && !params.get('trxref') && !params.get('order') && !phone) {
    return (
      <>
        <SEO title="Order Confirmed" noindex />
        <EmptyState title="No confirmed order" text="A verified payment is required before an order is confirmed." action="View your account" to="/account" />
      </>
    )
  }
  const trackTo = phone
    ? `/track-order?phone=${encodeURIComponent(phone)}`
    : '/track-order'
  return (
    <div className="confirmation">
      <SEO title="Order Confirmed" noindex />
      <div className="success-mark"><Check /></div>
      <span className="eyebrow">Order confirmed</span>
      <h1>Thank you for your order.</h1>
      <p>We’re preparing your pieces now. Use your phone number to track delivery anytime — no sign-in required.</p>
      <div className="confirmation-card confirmation-card--phone">
        <span>Tracking phone</span>
        <CopyValue value={phone || '—'} label="Copy phone number" />
      </div>
      <div>
        <Link className="button" to={trackTo}>Track your order</Link>
        <Link className="text-link" to="/shop">Continue shopping</Link>
      </div>
    </div>
  )
}

/** Paystack callback_url landing — forward reference query params to order confirmation. */
export function PaymentVerify() {
  const [params] = useSearchParams()
  const qs = new URLSearchParams()
  const reference = params.get('reference') || params.get('trxref') || ''
  const order = params.get('order') || ''
  if (reference) qs.set('reference', reference)
  if (params.get('trxref')) qs.set('trxref', params.get('trxref'))
  if (order) qs.set('order', order)
  const phone = (() => {
    try { return sessionStorage.getItem('glam_track_phone') || '' } catch { return '' }
  })()
  if (phone) qs.set('phone', phone)
  const target = qs.toString() ? `/order-confirmation?${qs.toString()}` : '/order-confirmation'
  return (
    <>
      <SEO title="Verifying Payment" noindex />
      <Navigate to={target} replace />
    </>
  )
}

const statusStep = { pending: 1, paid: 2, shipped: 3, out_for_delivery: 3, delivered: 4, cancelled: 0 }

function RiderCard({ rider }) {
  if (!rider?.name) return null
  const initials = String(rider.name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R'
  const photo = resolveImageUrl(rider.photo_url || rider.photo)
  const phone = rider.phone || rider.rider_phone || ''
  const tel = String(phone).replace(/[^\d+]/g, '')
  const waDigits = String(phone).replace(/\D/g, '')
  const wa = waDigits.length >= 9
    ? `https://wa.me/${waDigits.startsWith('0') ? `233${waDigits.slice(1)}` : waDigits}`
    : ''
  return (
    <section className="rider-card" aria-label="Delivery rider">
      {photo ? (
        <img className="rider-photo" src={photo} alt={rider.name} />
      ) : (
        <span className="rider-avatar" aria-hidden="true">{initials}</span>
      )}
      <div className="rider-copy">
        <small>Your rider</small>
        <strong>{rider.name}</strong>
        {phone ? <span className="rider-phone">{phone}</span> : null}
      </div>
      <div className="rider-actions">
        {tel ? (
          <a className="rider-call" href={`tel:${tel}`}>Call rider</a>
        ) : null}
        {wa ? (
          <a className="rider-whatsapp" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
        ) : null}
      </div>
    </section>
  )
}

export function TrackOrder() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('phone') || '')
  const [orders, setOrders] = useState([])
  const [lookupError, setLookupError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const lookup = async (phone) => {
    const value = String(phone || '').trim()
    if (!value) {
      setLookupError('Enter the phone number used at checkout.')
      setOrders([])
      return
    }
    setLookingUp(true)
    setLookupError('')
    try {
      const { data } = await api.get('/orders/track', { params: { phone: value } })
      const fallbackRider = data?.default_rider || null
      const list = asArray(data?.orders).length ? asArray(data.orders) : (data?.order ? [data.order] : [])
      setOrders(list.map((order) => ({
        ...order,
        rider: order.rider || fallbackRider,
      })))
    } catch (error) {
      setOrders([])
      setLookupError(errorMessage(error, 'No orders found for that phone number.'))
    } finally {
      setLookingUp(false)
    }
  }

  useEffect(() => {
    const preset = params.get('phone')
    if (preset) lookup(preset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const submit = (event) => {
    event.preventDefault()
    lookup(query)
  }

  return (
    <div className="narrow-page">
      <SEO
        title="Track Your Order"
        description="Track your GlamBaddies order with the phone number used at checkout."
        url={`${SITE_URL}/track-order`}
      />
      <span className="eyebrow">Client services</span>
      <h1>Track your order</h1>
      <p>Enter the phone number you used at checkout. No account sign-in needed.</p>
      <form className="stack-form" onSubmit={submit}>
        <label>
          Phone number
          <input
            required
            type="tel"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. 0241234567"
            autoComplete="tel"
          />
        </label>
        <button className="button" disabled={lookingUp}>
          {lookingUp ? 'Looking up…' : 'Track order'}
        </button>
      </form>
      {lookupError && <p className="track-error">{lookupError}</p>}
      {orders.map((order) => {
        const step = statusStep[order?.status] || 0
        return (
          <div className="tracking-result" key={order.id}>
            <div className="tracking-result__head">
              <Package />
              <span>
                <small>Phone</small>
                <strong className="tracking-phone">{order.phone || query}</strong>
              </span>
              <b className={`status ${order.status}`}>{order.status}</b>
            </div>
            <div className="timeline">
              {[Check, Package, Truck, Check].map((Icon, index) => (
                <span className={step > index + 1 ? 'done' : step === index + 1 ? 'active' : ''} key={index}>
                  <Icon />
                </span>
              ))}
            </div>
            <div className="timeline-labels">
              <b>Confirmed</b>
              <b>Paid</b>
              <b>Shipped</b>
              <b>Delivered</b>
            </div>
            {order.fulfillment_method === 'pickup' ? null : order.rider ? (
              <RiderCard rider={order.rider} />
            ) : (
              <p className="track-rider-empty">Rider details will show here once assigned.</p>
            )}
            <div className="track-meta">
              <p>
                <small>Fulfillment</small>
                <strong>{order.fulfillment_method === 'pickup' ? 'Pickup' : 'Delivery'}</strong>
              </p>
              {order.full_name && (
                <p>
                  <small>Name</small>
                  <strong>{order.full_name}</strong>
                </p>
              )}
              {order.location && (
                <p>
                  <small>Location</small>
                  <strong>{order.location}</strong>
                </p>
              )}
            {order.additional_note && (
              <p>
                <small>Additional note</small>
                <strong>{order.additional_note}</strong>
              </p>
            )}
            {order.status === 'cancelled' && order.cancel_reason && (
              <p className="track-cancel-reason">
                <small>Cancel reason</small>
                <strong>{order.cancel_reason}</strong>
              </p>
            )}
          </div>
          {order.items?.length > 0 && (
            <ul className="track-items">
              {asArray(order.items).map((item, index) => (
                <li key={`${item.product_name}-${index}`}>
                  <span>
                    {item.product_name}
                    {(item.color || item.size) && (
                      <small className="track-item-opts">
                        {[item.color, item.size && `Size ${item.size}`].filter(Boolean).join(' · ')}
                      </small>
                    )}
                  </span>
                  <small>×{item.quantity}</small>
                </li>
              ))}
            </ul>
          )}
          <p className="track-total">
            <span>Order total</span>
            <b>{formatCurrency(Number(order.total ?? order.total_cents / 100))}</b>
          </p>
          {order.status === 'cancelled'
            ? <p>This order was cancelled.</p>
            : <p><Clock3 /> Placed {new Date(order.created_at).toLocaleString()} · Status: {order.status}</p>}
        </div>
        )
      })}
    </div>
  )
}

export function Login({ register = false }) {
  const { loginCustomer } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [isRegister, setIsRegister] = useState(register)
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setSubmitting(true)
    try {
      const fields = Object.fromEntries(new FormData(form))
      await loginCustomer({
        name: fields.name,
        phone: fields.phone,
        password: fields.password,
      }, isRegister)
      toast.success(isRegister ? 'Account created' : 'Welcome back')
      const next = params.get('next')
      navigate(next?.startsWith('/') ? next : '/account')
    } catch (error) {
      toast.error(errorMessage(error, isRegister ? 'Could not create account' : 'Invalid phone or password'))
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="auth-page glam-auth">
      <SEO title={isRegister ? 'Create Account' : 'Sign In'} noindex />
      <div className="auth-image">
        <img src="/hero.png" alt="GlamBaddies dresses" />
        <div className="auth-image-copy">
          <img src="/logo.png" alt="GlamBaddies" />
          <p>Shop · Slay · Shine</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <span className="eyebrow">GlamBaddies</span>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p>
          {isRegister
            ? 'Full name, phone number and password — that’s all you need.'
            : 'Sign in with your phone number to track orders and shop faster.'}
        </p>
        {isRegister && (
          <label>
            Full name
            <input name="name" required autoComplete="name" placeholder="Your full name" />
          </label>
        )}
        <label>
          Phone number
          <input name="phone" type="tel" required autoComplete="tel" placeholder="e.g. 0241234567" />
        </label>
        <label>
          Password
          <PasswordInput autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="At least 8 characters" />
        </label>
        <button className="button full" disabled={submitting}>
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight />
        </button>
        <div className="auth-links">
          <button type="button" className="text-link" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
          <Link className="text-link" to="/track-order">Track an order</Link>
          <Link className="text-link" to="/shop">Continue shopping</Link>
        </div>
      </form>
    </div>
  )
}

export function Wishlist() {
  const { items, removeItem, clearWishlist } = useWishlist()
  const { addItem } = useCart()

  return (
    <div className="section wishlist-page">
      <SEO
        title="Wishlist"
        description="Your saved GlamBaddies pieces."
        url={`${SITE_URL}/wishlist`}
        noindex
      />
      <div className="section-head">
        <div>
          <span className="eyebrow">Saved for later</span>
          <h2>Wishlist</h2>
          <p>{items.length ? `${items.length} saved piece${items.length === 1 ? '' : 's'}` : 'Tap the heart on any piece to save it quietly.'}</p>
        </div>
        {items.length ? (
          <button type="button" className="text-button" onClick={clearWishlist}>Clear all</button>
        ) : null}
      </div>
      {items.length ? (
        <div className="product-grid">
          {items.map((product) => (
            <article className="product-card" key={product.id}>
              <Link to={`/products/${product.slug || product.id}`} className="product-image">
                {product.badge ? <span className="badge sale-badge">{product.badge}</span> : null}
                <img src={product.image} alt={product.name} loading="lazy" />
                <button
                  type="button"
                  className="heart is-saved"
                  aria-label="Remove from wishlist"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    removeItem(product.id)
                  }}
                >
                  <Heart size={18} fill="currentColor" />
                </button>
              </Link>
              <div className="product-info">
                <p className="eyebrow">{product.brand || 'GlamBaddies'}</p>
                <Link to={`/products/${product.slug || product.id}`}>{product.name}</Link>
                <div className="product-price-row">
                  {product.oldPrice ? <del>{formatCurrency(product.oldPrice)}</del> : null}
                  <strong className={product.is_on_sale ? 'sale-price' : undefined}>{formatCurrency(product.price)}</strong>
                </div>
                <button type="button" className="quick-add" onClick={() => addItem(product)}>
                  Quick add <Plus size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          text="Browse the shop and tap the heart to save pieces — no alerts, just a quiet save."
          action="Shop all"
          to="/shop"
        />
      )}
    </div>
  )
}

export function Account() {
  const { customer, logout } = useAuth()
  const navigate = useNavigate()
  const { data: orders, loading, error, retry } = useApi(() => customer ? api.get('/orders').then(({ data }) => asArray(data?.orders)) : Promise.resolve([]), [customer?.id])
  useEffect(() => { if (!customer) navigate('/login') }, [customer, navigate])
  if (!customer) return null
  const orderList = asArray(orders)
  const trackPhone = customer?.phone || ''
  return <div className="account-page"><SEO title="Your Account" noindex /><div className="page-title"><span className="eyebrow">Private client</span><h1>Good afternoon, {customer.name}.</h1></div><div className="account-grid"><aside><button className="active">Order history</button><button type="button" onClick={() => navigate(trackPhone ? `/track-order?phone=${encodeURIComponent(trackPhone)}` : '/track-order')}>Track order</button><button type="button" onClick={() => navigate('/shop')}>Continue shopping</button><button onClick={() => { logout(); navigate('/') }}>Sign out</button></aside><section><h2>Order history</h2>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : orderList.length ? orderList.map((order) => {
    const ship = order.shipping_address || {}
    const phone = ship.phone || trackPhone
    return <div className="account-order" key={order.id}><div><small>Phone</small><CopyValue value={phone || '—'} label="Copy phone number" /></div><div><small>Date</small><b>{new Date(order.created_at).toLocaleDateString()}</b></div><div><small>Total</small><b>{formatCurrency(Number(order.total ?? order.total_cents / 100))}</b></div><span className={`status ${order.status}`}>{order.status}</span><Link to={phone ? `/track-order?phone=${encodeURIComponent(phone)}` : '/track-order'}>Track <ArrowRight /></Link></div>
  }) : <EmptyState title="No orders yet" text="Your order history will appear here." action="Start shopping" to="/shop" />}</section></div></div>
}

export function About() {
  return (
    <div className="story-page">
      <SEO
        title="About GlamBaddies"
        description="GlamBaddies is a girls' fashion boutique devoted only to dresses — bold cuts, soft glam, and looks that turn heads."
        url={`${SITE_URL}/about`}
      />
      <section><div><span className="eyebrow">Our story</span><h1>Girls&apos; fashion,<br />dresses only.</h1><p>GlamBaddies began with a simple conviction: little girls deserve dresses that feel personal, joyful and beautifully made — and nothing else cluttering the rack.</p></div><img src="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1400&q=90" alt="Girls dresses on a rail" /></section><blockquote>“We dress the twirl — never just the trend.”</blockquote><section className="reverse"><div><span className="eyebrow">Our approach</span><h2>Only the dresses that earn it.</h2><p>Every piece in our boutique is a girls&apos; dress — casual, party or school — chosen for comfort, quality and that extra spark of glam.</p></div><img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=90" alt="Editorial girls fashion" /></section>
    </div>
  )
}

export function InfoPage({ type }) {
  const content = type === 'contact'
    ? ['Contact us', 'Our client care team is available Monday to Saturday.', 'support@glambaddies.com']
    : ['Frequently asked questions', 'Everything you need to know about delivery, returns and caring for your dresses.', 'How long does delivery take?']
  return (
    <div className="narrow-page">
      <SEO
        title={type === 'contact' ? 'Contact Us' : 'FAQ'}
        description={content[1]}
        url={`${SITE_URL}/${type === 'contact' ? 'contact' : 'faq'}`}
      />
      <span className="eyebrow">Client services</span>
      <h1>{content[0]}</h1>
      <p>{content[1]}</p>
      <div className="info-card">
        <h3>{content[2]}</h3>
        <p>{type === 'contact' ? 'Our team is ready to help with dresses, orders and delivery.' : 'Delivery times vary by destination and are confirmed during checkout.'}</p>
      </div>
      {type !== 'contact' && ['What is your return policy?', 'How do I care for my dress?', 'Can I change my order?'].map((question) => (
        <details key={question}>
          <summary>{question}<Plus /></summary>
          <p>Contact client care within 14 days and we will guide you through the next step.</p>
        </details>
      ))}
    </div>
  )
}

export function NotFound() {
  return (
    <>
      <SEO title="Page Not Found" noindex />
      <EmptyState title="Page not found" text="The page you’re looking for has moved or no longer exists." action="Return home" />
    </>
  )
}
