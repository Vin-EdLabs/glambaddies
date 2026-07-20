import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PaystackPop from '@paystack/inline-js'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Filter, Heart, Minus, Package, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react'
import { EmptyState, ErrorState, LoadingGrid, ProductCard, CopyValue } from '../components'
import { useAuth, useCart } from '../contexts'
import api, { asArray, errorMessage, getProductCacheRev, mapProduct, mapProducts, syncCatalogueRevision } from '../services/api'
import { formatCurrency } from '../utils'

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
    window.addEventListener('vub:products-changed', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus()
    })
    onFocus()
    const timer = window.setInterval(onFocus, 30000)
    return () => {
      window.removeEventListener('vub:products-changed', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [])
  return rev
}

export function Home() {
  const productsRev = useProductCacheRev()
  const { data: products, loading, error, retry } = useApi(
    () => api.get('/products', { params: { limit: 8, sort: 'newest' } }).then(({ data }) => {
      if (data?.revision != null) {
        try { localStorage.setItem('vub_products_rev', String(data.revision)) } catch { /* ignore */ }
      }
      return mapProducts(data?.products)
    }), [productsRev],
  )
  const list = asArray(products)
  const edits = [
    {
      to: '/shop?category=fashion',
      image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1400&q=90',
      eyebrow: 'Fashion',
      title: 'The men’s edit',
      alt: 'Menswear styled on a rack',
    },
    {
      to: '/shop?category=electronics',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=90',
      eyebrow: 'Electronics',
      title: 'Modern essentials',
      alt: 'Premium wireless headphones',
    },
    {
      to: '/shop?category=games',
      image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1400&q=90',
      eyebrow: 'Games',
      title: 'Play in focus',
      alt: 'Gaming console and controller',
    },
    {
      to: '/shop?category=home-living',
      image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1400&q=90',
      eyebrow: 'Home & Living',
      title: 'Quiet interiors',
      alt: 'Minimal living room interior',
    },
    {
      to: '/shop?category=food',
      image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1400&q=90',
      eyebrow: 'Food & Grocery',
      title: 'Fresh from the market',
      alt: 'Fresh fruit and grocery produce',
    },
    {
      to: '/shop?category=beauty',
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=90',
      eyebrow: 'Beauty',
      title: 'Daily rituals',
      alt: 'Beauty and skincare essentials',
    },
  ]
  return <>
    <section className="hero-section">
      <img src="/hero.jpg" alt="Vublishop premium edit — fashion, bags and games" />
      <div className="hero-copy">
        <img className="hero-brand" src="/logo.png" alt="Vublishop" />
        <h1>Shop better.<br /><em>Live better.</em></h1>
        <p>Premium fashion, electronics, games, home, beauty and fresh food — curated for the way you live.</p>
        <Link className="button light-button" to="/shop">Discover the collection <ArrowRight /></Link>
      </div>
    </section>
    <section className="section"><div className="section-head"><div><span className="eyebrow">Just in</span><h2>New expressions</h2></div><Link to="/shop">View all <ArrowRight /></Link></div>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : list.length ? <div className="product-grid">{list.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <EmptyState title="New pieces coming soon" text="Our next edit is being prepared." action="Browse the collection" to="/shop" />}</section>
    <section className="editorial-grid">{edits.map((edit) => <Link to={edit.to} key={edit.to}><img src={edit.image} alt={edit.alt} /><div><span className="eyebrow">{edit.eyebrow}</span><h2>{edit.title}</h2><span>Shop now <ArrowRight /></span></div></Link>)}</section>
    <section className="manifesto"><span className="eyebrow">Our point of view</span><h2>Buy less. Choose beautifully.<br />Wear it your way.</h2><p>We bring together independent voices and enduring design, selected for quality, character and relevance beyond a single season.</p><Link to="/about">Discover Vublishop <ArrowRight /></Link></section>
    <section className="benefits"><div><Truck /><h3>Complimentary delivery</h3><p>On orders over $50</p></div><div><RotateCcw /><h3>Considered returns</h3><p>Easy returns within 14 days</p></div><div><ShieldCheck /><h3>Secure payment</h3><p>Protected checkout with Paystack</p></div></section>
  </>
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
        try { localStorage.setItem('vub_products_rev', String(productsResult.data.revision)) } catch { /* ignore */ }
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
  return <div className="shop-page"><div className="page-title"><span className="eyebrow">The collection</span><h1>{title}</h1><p>A considered wardrobe of directional essentials and enduring statements.</p></div>
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
  const productsRev = useProductCacheRev()
  const { data: product, loading, error, retry } = useApi(() => api.get(`/products/${id}`).then(({ data }) => mapProduct(data?.product)), [id, productsRev])
  if (loading) return <div className="section"><LoadingGrid /></div>
  if (error?.status === 404) return <EmptyState title="Piece not found" text="This item may no longer be available." action="Continue shopping" to="/shop" />
  if (error) return <ErrorState retry={retry} />
  const images = asArray(product?.images).length ? asArray(product.images) : [product?.image].filter(Boolean)
  const sizes = asArray(product?.sizes)
  const add = () => sizes.length && !size ? toast.error('Please select a size') : addItem(product, size || undefined)
  return <div className="product-detail"><div className="product-gallery">{images.map((image, index) => <img src={image} alt={`${product.name} view ${index + 1}`} key={`${image}-${index}`} />)}</div><div className="product-summary"><span className="eyebrow">{product.brand || product.category}</span><h1>{product.name}</h1><div className="detail-price">{formatCurrency(product.price)}</div><p>{product.description}</p>{sizes.length > 0 && <><div className="size-head"><strong>Select size</strong><button>Size guide</button></div><div className="size-grid">{sizes.map((item) => <button className={size === item ? 'selected' : ''} onClick={() => setSize(item)} key={item}>{item}</button>)}</div></>}<button className="button full" disabled={!product.stock} onClick={add}>{product.stock ? 'Add to bag' : 'Sold out'} <ShoppingBag /></button><button className="wishlist"><Heart /> Add to wishlist</button><details open><summary>Details & composition <Plus /></summary><p>{product.description || 'Thoughtfully made from premium materials.'}</p></details><details><summary>Delivery & returns <Plus /></summary><p>International delivery times vary by destination. Returns are accepted within 14 days.</p></details></div></div>
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

  // On Apple devices, mount Paystack Apple Pay (USD) once the form is valid.
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
  }, [items.length, purchasesEnabled, submitting])

  const payHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : undefined)

  const clearApplePayUi = () => {
    applePayMountedRef.current = false
    setApplePayReady(false)
    const appleHost = document.getElementById('paystack-apple-pay')
    if (appleHost) appleHost.replaceChildren()
  }

  const ensureOrder = async (form) => {
    let order = pendingOrder
    let token = checkoutToken
    if (!order || !token) {
      const fields = Object.fromEntries(new FormData(form))
      const result = await api.post('/orders/guest', {
        shipping_address: fields,
        items: items.map((item) => ({
          product_id: Number(item.id),
          quantity: item.quantity,
        })),
      })
      order = result.data.order
      token = result.data.checkout_token
      setPendingOrder(order)
      setCheckoutToken(token)
    }
    return { order, token }
  }

  const verifyPayment = async (reference, token) => {
    const { data } = await api.get(
      `/payment/verify/${encodeURIComponent(reference)}`,
      { headers: payHeaders(token) },
    )
    if (!data.verified) throw new Error('Payment could not be verified')
    clearCart()
    setCheckoutToken('')
    setPendingOrder(null)
    paymentMethodRef.current = null
    navigate(`/order-confirmation?order=${data.order_id}&reference=${encodeURIComponent(reference)}`)
  }

  /** Apple Pay only: /payment/prepare → paymentRequest with backend USD cents. */
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

  if (!items.length) return <EmptyState title="Your bag is empty" text="Add a piece before starting checkout." action="Return to shop" to="/shop" />
  return (
    <div className="checkout-page">
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
          <legend>Contact</legend>
          <label>email address<input name="email" type="email" required defaultValue={customer?.email || ''} autoComplete="email" /></label>
        </fieldset>
        <fieldset>
          <legend>Delivery address</legend>
          <div className="form-grid">
            <label>First name<input name="first_name" required autoComplete="given-name" /></label>
            <label>Last name<input name="last_name" required autoComplete="family-name" /></label>
            <label className="span-2">Street address<input name="street" required autoComplete="street-address" /></label>
            <label>City<input name="city" required autoComplete="address-level2" /></label>
            <label>State / Province<input name="state" autoComplete="address-level1" /></label>
            <label className="span-2">Country<input name="country" required autoComplete="country-name" /></label>
            <label>Phone number<input name="phone" type="tel" required autoComplete="tel" /></label>
            <label>Postal / ZIP code<input name="postal_code" autoComplete="postal-code" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Delivery method</legend>
          <label className="delivery-option">
            <input type="radio" checked readOnly />
            <Truck />
            <span><strong>Standard delivery</strong><small>1–3 working days</small></span>
            <b>{shipping ? formatCurrency(shipping) : 'Complimentary'}</b>
          </label>
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
  return <aside className="order-summary"><h2>Your order</h2>{items.map((item) => <div className="summary-item" key={item.key}><div><img src={item.image} alt="" /><span>{item.quantity}</span></div><p><strong>{item.name}</strong>{item.size && <small>Size {item.size}</small>}</p><b>{formatCurrency(item.price * item.quantity)}</b></div>)}<div className="summary-lines"><p><span>Subtotal</span><b>{formatCurrency(subtotal)}</b></p><p><span>Delivery</span><b>{shipping ? formatCurrency(shipping) : 'Complimentary'}</b></p><p className="grand-total"><span>Total</span><b>{formatCurrency(subtotal + shipping)}</b></p></div></aside>
}

export function OrderConfirmation() {
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref')
  const orderId = params.get('order')
  if (!reference) return <EmptyState title="No confirmed order" text="A verified payment is required before an order is confirmed." action="View your account" to="/account" />
  return <div className="confirmation"><div className="success-mark"><Check /></div><span className="eyebrow">Order confirmed</span><h1>Thank you for your order.</h1><p>We’re preparing your pieces now. Save your payment reference — you’ll need it to track delivery anytime, no sign-in required.</p><div className="confirmation-card"><span>Order ID</span><CopyValue value={orderId || '—'} label="Copy order ID" /><span>Payment reference</span><CopyValue value={reference} label="Copy payment reference" /></div><div><Link className="button" to={`/track-order?reference=${encodeURIComponent(reference)}`}>Track your order</Link><Link className="text-link" to="/shop">Continue shopping</Link></div></div>
}

const statusStep = { pending: 1, paid: 2, shipped: 3, delivered: 4, cancelled: 0 }
export function TrackOrder() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('reference') || '')
  const [order, setOrder] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const lookup = async (reference) => {
    const value = String(reference || '').trim()
    if (!value) {
      setLookupError('Enter your payment reference to track an order.')
      setOrder(null)
      return
    }
    setLookingUp(true)
    setLookupError('')
    try {
      const { data } = await api.get(`/orders/track/${encodeURIComponent(value)}`)
      setOrder(data.order)
    } catch (error) {
      setOrder(null)
      setLookupError(errorMessage(error, 'No order found for that payment reference.'))
    } finally {
      setLookingUp(false)
    }
  }

  useEffect(() => {
    const preset = params.get('reference')
    if (preset) lookup(preset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const submit = (event) => {
    event.preventDefault()
    lookup(query)
  }

  const step = statusStep[order?.status] || 0
  return (
    <div className="narrow-page">
      <span className="eyebrow">Client services</span>
      <h1>Track your order</h1>
      <p>Enter the payment reference from your confirmation email or receipt. No account sign-in needed.</p>
      <form className="stack-form" onSubmit={submit}>
        <label>
          Payment reference
          <input
            required
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. VUB-12-a1b2c3d4"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button className="button" disabled={lookingUp}>
          {lookingUp ? 'Looking up…' : 'Track order'}
        </button>
      </form>
      {lookupError && <p className="track-error">{lookupError}</p>}
      {order && (
        <div className="tracking-result">
          <div>
            <Package />
            <span>
              <small>Payment reference</small>
              <strong>{order.payment_reference}</strong>
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
          {order.items?.length > 0 && (
            <ul className="track-items">
              {asArray(order.items).map((item, index) => (
                <li key={`${item.product_name}-${index}`}>
                  <span>{item.product_name}</span>
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
      )}
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
        email: fields.email,
        password: fields.password,
      }, isRegister)
      toast.success(isRegister ? 'Account created' : 'Welcome back')
      const next = params.get('next')
      navigate(next?.startsWith('/') ? next : '/account')
    } catch (error) {
      toast.error(errorMessage(error, isRegister ? 'Could not create account' : 'Invalid email or password'))
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="auth-page"><div className="auth-image"><img src="https://images.unsplash.com/photo-1537832816519-689ad163238b?auto=format&fit=crop&w=1200&q=85" alt="" /></div><form onSubmit={submit}><span className="eyebrow">Vublishop private client</span><h1>{isRegister ? 'Create an account' : 'Welcome back'}</h1><p>{isRegister ? 'Save your details and enjoy a more personal shopping experience.' : 'Sign in to view orders, saved pieces and account details.'}</p>{isRegister && <label>Full name<input name="name" required /></label>}<label>Email address<input name="email" type="email" required /></label><label>Password<input name="password" type="password" required minLength="8" /></label><button className="button full" disabled={submitting}>{submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight /></button><button type="button" className="text-link" onClick={() => setIsRegister(!isRegister)}>{isRegister ? 'Already have an account? Sign in' : 'New to Vublishop? Create an account'}</button></form></div>
}

export function Account() {
  const { customer, logout } = useAuth()
  const navigate = useNavigate()
  const { data: orders, loading, error, retry } = useApi(() => customer ? api.get('/orders').then(({ data }) => asArray(data?.orders)) : Promise.resolve([]), [customer?.id])
  useEffect(() => { if (!customer) navigate('/login') }, [customer, navigate])
  if (!customer) return null
  const orderList = asArray(orders)
  return <div className="account-page"><div className="page-title"><span className="eyebrow">Private client</span><h1>Good afternoon, {customer.name}.</h1></div><div className="account-grid"><aside><button className="active">Order history</button><button type="button" onClick={() => navigate('/track-order')}>Track order</button><button type="button" onClick={() => navigate('/shop')}>Continue shopping</button><button onClick={() => { logout(); navigate('/') }}>Sign out</button></aside><section><h2>Order history</h2>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : orderList.length ? orderList.map((order) => <div className="account-order" key={order.id}><div><small>Order ID</small><CopyValue value={String(order.id)} label="Copy order ID" /></div><div><small>Date</small><b>{new Date(order.created_at).toLocaleDateString()}</b></div><div><small>Total</small><b>{formatCurrency(Number(order.total ?? order.total_cents / 100))}</b></div><span className={`status ${order.status}`}>{order.status}</span><Link to={`/track-order`}>Track <ArrowRight /></Link></div>) : <EmptyState title="No orders yet" text="Your order history will appear here." action="Start shopping" to="/shop" />}</section></div></div>
}

export function About() {
  return <div className="story-page"><section><div><span className="eyebrow">Our story</span><h1>A point of view,<br />not just a store.</h1><p>Vublishop began with a simple conviction: the things we choose should feel personal, purposeful and beautifully made.</p></div><img src="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1400&q=90" alt="Curated clothing rail" /></section><blockquote>“We select for the person you are becoming — never only for the season.”</blockquote><section className="reverse"><div><span className="eyebrow">Our approach</span><h2>Considered at every step.</h2><p>Our edit brings a global perspective to modern style. We value independent makers, exceptional materials and products that earn their place in your life.</p></div><img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=90" alt="Minimal editorial fashion" /></section></div>
}

export function InfoPage({ type }) {
  const content = type === 'contact' ? ['Contact us', 'Our client care team is available Monday to Saturday.', 'clientcare@vublishop.com'] : ['Frequently asked questions', 'Everything you need to know about delivery, returns and caring for your pieces.', 'How long does delivery take?']
  return <div className="narrow-page"><span className="eyebrow">Client services</span><h1>{content[0]}</h1><p>{content[1]}</p><div className="info-card"><h3>{content[2]}</h3><p>{type === 'contact' ? 'Our team is ready to help with products, orders and delivery.' : 'Delivery times vary by destination and are confirmed during checkout.'}</p></div>{type !== 'contact' && ['What is your return policy?', 'How do I care for my purchase?', 'Can I change my order?'].map((question) => <details key={question}><summary>{question}<Plus /></summary><p>Contact client care within 14 days and we will guide you through the next step.</p></details>)}</div>
}

export function NotFound() {
  return <EmptyState title="Page not found" text="The page you’re looking for has moved or no longer exists." action="Return home" />
}
