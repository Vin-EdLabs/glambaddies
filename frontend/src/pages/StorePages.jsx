import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PaystackPop from '@paystack/inline-js'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Filter, Heart, MapPin, Minus, Package, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react'
import { EmptyState, ErrorState, LoadingGrid, PasswordInput, ProductCard, CopyValue } from '../components'
import SEO from '../components/SEO'
import { ProductImageGallery } from '../ProductImageGallery'
import { useAuth, useCart } from '../contexts'
import api, { asArray, errorMessage, getProductCacheRev, mapProduct, mapProducts, syncCatalogueRevision } from '../services/api'
import { formatCurrency } from '../utils'
import { DRESS_COLORS, DRESS_SIZES } from '../dressOptions'

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
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus()
    })
    onFocus()
    const timer = window.setInterval(onFocus, 30000)
    return () => {
      window.removeEventListener('glam:products-changed', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [])
  return rev
}

export function Home() {
  const productsRev = useProductCacheRev()
  const { data, loading, error, retry } = useApi(
    () => Promise.all([
      api.get('/products', { params: { category: 'casual-dresses', limit: 4, sort: 'newest' } }),
      api.get('/products', { params: { category: 'party-dresses', limit: 4, sort: 'newest' } }),
      api.get('/products', { params: { category: 'school-dresses', limit: 4, sort: 'newest' } }),
    ]).then(([casualResult, partyResult, schoolResult]) => {
      const revision =
        casualResult.data?.revision ??
        partyResult.data?.revision ??
        schoolResult.data?.revision
      if (revision != null) {
        try { localStorage.setItem('glam_products_rev', String(revision)) } catch { /* ignore */ }
      }
      return {
        casual: mapProducts(casualResult.data?.products),
        party: mapProducts(partyResult.data?.products),
        school: mapProducts(schoolResult.data?.products),
      }
    }),
    [productsRev],
  )

  const categories = [
    {
      key: 'casual',
      eyebrow: 'Casual dresses',
      title: 'Everyday glam',
      text: 'Soft silhouettes for sunny days, weekends and little moments in between.',
      to: '/shop?category=casual-dresses',
      products: asArray(data?.casual),
    },
    {
      key: 'party',
      eyebrow: 'Party dresses',
      title: 'Ready to celebrate',
      text: 'Tulle, shimmer and statement pieces made for birthdays and big nights.',
      to: '/shop?category=party-dresses',
      products: asArray(data?.party),
    },
    {
      key: 'school',
      eyebrow: 'School dresses',
      title: 'Smart day looks',
      text: 'Neat, comfortable dresses that look polished from morning assembly to after school.',
      to: '/shop?category=school-dresses',
      products: asArray(data?.school),
    },
  ]

  return (
    <>
      <SEO
        title="Girls Dresses in Ghana"
        description="Shop the latest girls dresses at GlamBaddies. Casual, party, and school dresses delivered across Ghana."
        url={`${SITE_URL}/`}
      />

      <section className="hero-band" aria-label="GlamBaddies hero">
        <div className="hero-section">
          <img src="/hero.png" alt="GlamBaddies GH — Look good. Stay glam." />
          <div className="hero-copy">
            <img className="hero-brand" src="/logo.png" alt="GlamBaddies — Shop. Slay. Shine." />
            <h1>Shop. Slay.<br /><em>Shine.</em></h1>
            <p>Girls&apos; dresses only — bold, glamorous looks made to turn heads.</p>
            <Link className="button light-button" to="/shop">Shop the latest girls&apos; dresses <ArrowRight /></Link>
          </div>
        </div>
      </section>

      {categories.map((category) => (
        <section className="section home-category" key={category.key}>
          <div className="section-head home-category-head">
            <div>
              <span className="eyebrow">{category.eyebrow}</span>
              <h2>{category.title}</h2>
              <p className="home-category-copy">{category.text}</p>
            </div>
            <Link className="browse-all" to={category.to}>
              Browse all
              <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <LoadingGrid />
          ) : error ? (
            <ErrorState retry={retry} />
          ) : category.products.length ? (
            <>
              <div className="product-grid home-category-grid">
                {category.products.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>
              <div className="home-category-foot">
                <Link className="browse-all browse-all--solid" to={category.to}>
                  Browse all {category.eyebrow.toLowerCase()}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </>
          ) : (
            <EmptyState
              title={`New ${category.eyebrow.toLowerCase()} coming soon`}
              text="Our next edit is being prepared."
              action="Browse all dresses"
              to="/shop"
            />
          )}
        </section>
      ))}

      <section className="editorial-grid editorial-grid--three" aria-label="Shop by category">
        {[
          {
            to: '/shop?category=casual-dresses',
            image: '/edit-casual.jpg',
            eyebrow: 'Casual',
            title: 'Everyday dresses',
            alt: 'Casual girls dresses',
          },
          {
            to: '/shop?category=party-dresses',
            image: '/edit-party.jpg',
            eyebrow: 'Party',
            title: 'Celebration looks',
            alt: 'Party girls dresses',
          },
          {
            to: '/shop?category=school-dresses',
            image: '/edit-school.jpg',
            eyebrow: 'School',
            title: 'Smart day dresses',
            alt: 'School girls dresses',
          },
        ].map((edit) => (
          <Link to={edit.to} key={edit.to}>
            <img src={edit.image} alt={edit.alt} />
            <div>
              <span className="eyebrow">{edit.eyebrow}</span>
              <h2>{edit.title}</h2>
              <span className="browse-all browse-all--on-dark">Browse all <ArrowRight size={14} /></span>
            </div>
          </Link>
        ))}
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
  const query = params.get('q') || ''
  const requestKey = `${category}|${query}|${sort}|${productsRev}`
  const { data, loading, error, retry } = useApi(
    () => Promise.all([
      api.get('/products', { params: { category: category || undefined, q: query || undefined, sort, limit: 100 } }),
      api.get('/categories'),
    ]).then(([productsResult, categoriesResult]) => {
      if (productsResult.data?.revision != null) {
        try { localStorage.setItem('glam_products_rev', String(productsResult.data.revision)) } catch { /* ignore */ }
      }
      return {
        products: mapProducts(productsResult.data?.products),
        pagination: productsResult.data?.pagination || { total: 0 },
        categories: asArray(categoriesResult.data?.categories),
      }
    }),
    [requestKey],
  )
  const products = asArray(data?.products)
  const categories = asArray(data?.categories)
  const title = categories.find((item) => item.slug === category)?.name || (query ? `Results for “${query}”` : 'Shop all')
  return <div className="shop-page">
    <SEO
      title="Shop All Dresses"
      description="Browse casual, party, and school dresses at GlamBaddies — girls' fashion delivered across Ghana."
      url={`${SITE_URL}/shop`}
    />
    <div className="page-title"><span className="eyebrow">The collection</span><h1>{title}</h1><p>Shop the latest girls&apos; dresses — curated for every occasion.</p></div>
    <div className="catalog-toolbar"><button onClick={() => setMobileFilters(true)}><Filter /> Filters</button><span>{data?.pagination?.total || 0} pieces</span><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name_asc">Name</option></select><ChevronDown /></label></div>
    <div className="catalog"><aside className={mobileFilters ? 'open' : ''}><button className="filter-close" onClick={() => setMobileFilters(false)}><X /></button><FilterGroup title="Category" values={categories} active={category} /></aside>
      {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <EmptyState title="No pieces found" text="Try changing your filters or search phrase." action="View all products" to="/shop" />}</div>
  </div>
}

function FilterGroup({ title, values, active }) {
  return <div className="filter-group"><h3>{title}<Minus /></h3>{asArray(values).map((value) => <label key={value.id}><Link to={`/shop?category=${encodeURIComponent(value.slug)}`}><input type="checkbox" readOnly checked={active === value.slug} /> <span>{value.name}</span></Link></label>)}</div>
}

export function ProductDetail() {
  const { id } = useParams()
  const { addItem } = useCart()
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
  const add = () => {
    if (!color) return toast.error('Please select a colour')
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
        <div className="detail-price">{formatCurrency(product.price)}</div>
        <p>{product.description}</p>
        <div className="option-block">
          <div className="size-head"><strong>Colour</strong><span>{color || 'Select'}</span></div>
          <div className="color-swatches" role="listbox" aria-label="Colour">
            {DRESS_COLORS.map((item) => (
              <button
                type="button"
                key={item.name}
                title={item.name}
                className={`color-swatch${item.pattern ? ' leopard' : ''}${color === item.name ? ' selected' : ''}`}
                style={{ '--swatch': item.value }}
                aria-label={item.name}
                aria-selected={color === item.name}
                onClick={() => setColor(item.name)}
              />
            ))}
          </div>
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
        <button className="wishlist" type="button"><Heart /> Add to wishlist</button>
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

const statusStep = { pending: 1, paid: 2, shipped: 3, delivered: 4, cancelled: 0 }
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
      setOrders(asArray(data?.orders).length ? asArray(data.orders) : (data?.order ? [data.order] : []))
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
