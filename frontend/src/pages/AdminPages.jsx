import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, Box, Check, DollarSign, Edit3, Eye, EyeOff, Mail, Plus, Search, ShoppingCart, Trash2, Upload, Users } from 'lucide-react'
import { EmptyState, ErrorState, LoadingGrid, CopyValue, ConfirmDialog, CancelReasonDialog, PasswordInput } from '../components'
import { useAuth } from '../contexts'
import api, { asArray, bustProductCache, errorMessage, mapProduct, resolveImageUrl } from '../services/api'
import { formatCurrency, groupCategories, orderStatusLabel } from '../utils'
import { ADMIN_PATH } from '../adminPath'

function SaleModal({ product, open, busy, onClose, onSave, onClear }) {
  const [mode, setMode] = useState('fixed')
  const [original, setOriginal] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [percent, setPercent] = useState('20')
  const [ends, setEnds] = useState('')

  useEffect(() => {
    if (!open || !product) return
    const compare = product.compare_at_price || product.oldPrice || product.price || ''
    const base = compare ? String(Number(compare).toFixed(2)) : ''
    setOriginal(base)
    setSalePrice(product.is_on_sale && product.price != null
      ? String(Number(product.price).toFixed(2))
      : '')
    setPercent(String(product.discount_percent || 20))
    setMode(product.is_on_sale && product.discount_percent ? 'percent' : 'fixed')
    setEnds(product.sale_ends_at ? String(product.sale_ends_at).slice(0, 16) : '')
  }, [open, product])

  useEffect(() => {
    if (mode !== 'percent') return
    const base = Number(original)
    const pct = Number(percent)
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || pct < 1 || pct > 95) return
    setSalePrice((base * (1 - pct / 100)).toFixed(2))
  }, [mode, original, percent])

  if (!open || !product) return null
  const originalNum = Number(original)
  const saleNum = Number(salePrice)
  const percentNum = mode === 'percent'
    ? Number(percent)
    : (Number.isFinite(originalNum) && originalNum > 0 && Number.isFinite(saleNum)
      ? Math.round(((originalNum - saleNum) / originalNum) * 100)
      : null)
  const valid = Number.isFinite(originalNum) && originalNum > 0
    && Number.isFinite(saleNum) && saleNum > 0 && saleNum < originalNum
    && Number.isFinite(percentNum) && percentNum >= 1 && percentNum <= 95
  const youSave = valid ? originalNum - saleNum : null

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => { if (!busy) onClose() }}>
      <div className="confirm-dialog sale-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>Set discount</h2>
        <p>{product.name}</p>
        <div className="stack-form" style={{ textAlign: 'left', marginTop: '1rem' }}>
          <div className="discount-mode-toggle" role="group" aria-label="Discount type">
            <button type="button" className={mode === 'fixed' ? 'is-active' : ''} onClick={() => setMode('fixed')}>Fixed price</button>
            <button type="button" className={mode === 'percent' ? 'is-active' : ''} onClick={() => setMode('percent')}>Percentage</button>
          </div>
          <label>
            Current / old price (GHS)
            <input type="number" min="1" step="0.01" value={original} onChange={(event) => setOriginal(event.target.value)} />
          </label>
          {mode === 'percent' ? (
            <label>
              Discount %
              <input type="number" min="1" max="95" step="1" value={percent} onChange={(event) => setPercent(event.target.value)} />
            </label>
          ) : null}
          <label>
            New price (GHS)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={salePrice}
              readOnly={mode === 'percent'}
              onChange={(event) => setSalePrice(event.target.value)}
            />
          </label>
          <label>
            Sale ends (optional)
            <input type="datetime-local" value={ends} onChange={(event) => setEnds(event.target.value)} />
          </label>
          <p className="sale-modal-preview">
            {valid ? (
              <>
                Customers see <del>{formatCurrency(originalNum)}</del>{' '}
                <strong className="sale-price">{formatCurrency(saleNum)}</strong>
                {' '}(−{Math.round(percentNum)}%) · You save {formatCurrency(youSave)}
              </>
            ) : mode === 'percent'
              ? 'Enter current price and a percent (1–95)'
              : 'Enter old and new price'}
          </p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="admin-button" disabled={busy} onClick={onClose}>Cancel</button>
          {product.is_on_sale ? (
            <button type="button" className="admin-button danger" disabled={busy} onClick={onClear}>Clear sale</button>
          ) : null}
          <button
            type="button"
            className="admin-button primary"
            disabled={busy || !valid}
            onClick={() => onSave({
              compare_at_price: originalNum,
              sale_price: saleNum,
              discount_percent: Math.round(percentNum),
              sale_ends_at: ends || null,
            })}
          >
            {busy ? 'Saving…' : 'Save discount'}
          </button>
        </div>
      </div>
    </div>
  )
}

function useAdminData(load, dependencies) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const run = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }))
    load().then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(run, [run])
  return { ...state, retry: run, setData: (data) => setState({ data, loading: false, error: null }) }
}

export function AdminLogin() {
  const { admin, loginAdmin } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  if (admin && (localStorage.getItem('glam_admin_token') || localStorage.getItem('vub_admin_token'))) return <Navigate to={ADMIN_PATH} replace />
  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setSubmitting(true)
    try {
      const fields = Object.fromEntries(new FormData(form))
      await loginAdmin({ email: fields.email, password: fields.password })
      toast.success('Welcome to GlamBaddies Admin')
      navigate(ADMIN_PATH)
    } catch (error) {
      toast.error(errorMessage(error, 'Invalid email or password'))
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="admin-login"><div className="admin-login-brand"><img src="/logo.png" alt="GlamBaddies" /><strong>Admin</strong></div><form onSubmit={submit}><span className="eyebrow">Store management</span><h1>Welcome back</h1><p>Sign in to manage your GlamBaddies storefront.</p><label>Email address<input name="email" type="email" required /></label><label>Password<PasswordInput minLength={1} /></label><button className="button full" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'} <ArrowRight /></button><small>Protected access for GlamBaddies staff only.</small></form></div>
}

export function Dashboard() {
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => Promise.all([
      api.get('/glam-baddies/dashboard'),
      api.get('/glam-baddies/orders', { params: { limit: 5 } }).catch(() => ({ data: { orders: [] } })),
      api.get('/glam-baddies/settings').catch(() => ({ data: { purchases_enabled: true } })),
    ]).then(([stats, orders, settings]) => ({
      stats: stats.data.stats,
      orders: asArray(orders.data?.orders),
      purchases_enabled: settings.data.purchases_enabled !== false,
    })), [],
  )
  const togglePurchases = async () => {
    const next = !data.purchases_enabled
    const previous = data
    setData({ ...data, purchases_enabled: next })
    try {
      const { data: result } = await api.put('/glam-baddies/settings', { purchases_enabled: next })
      toast.success(result.message || (next ? 'Purchases enabled' : 'Purchases paused'))
    } catch (toggleError) {
      setData(previous)
      toast.error(errorMessage(toggleError, 'Could not update store availability'))
    }
  }
  const runDelete = async () => {
    if (!confirm?.id) return
    setBusy(true)
    try {
      await api.post(`/glam-baddies/orders/${confirm.id}/delete`)
      toast.success('Order deleted')
      setConfirm(null)
      retry()
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete order'))
    } finally {
      setBusy(false)
    }
  }
  return <AdminPage title="Dashboard" intro="Here’s what’s happening with GlamBaddies today.">{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : <>
    <section className="admin-card store-toggle-card">
      <div>
        <h2>Store purchases</h2>
        <p>{data.purchases_enabled ? 'Customers can add items and complete checkout.' : 'All items are unavailable for purchase right now.'}</p>
      </div>
      <button type="button" className={`store-toggle${data.purchases_enabled ? ' on' : ''}`} onClick={togglePurchases} aria-pressed={data.purchases_enabled}>
        <span>{data.purchases_enabled ? 'Open' : 'Paused'}</span>
        <i />
      </button>
    </section>
    <Stats stats={data.stats} />
    <section className="admin-card"><div className="card-head"><div><h2>Recent orders</h2><p>Latest transactions from your store</p></div><Link to={`${ADMIN_PATH}/orders`}>View all orders <ArrowRight /></Link></div>{asArray(data?.orders).length ? <OrderTable data={asArray(data.orders)} onDelete={(id) => setConfirm({
      id,
      title: `Delete order #${id}?`,
      message: 'This order will be permanently removed from your store.',
      detail: 'Revenue and order counts on the dashboard will update to match what remains.',
    })} /> : <EmptyState title="No orders yet" text="New orders will appear here." />}</section>
    <ConfirmDialog
      open={Boolean(confirm)}
      title={confirm?.title}
      message={confirm?.message}
      detail={confirm?.detail}
      confirmLabel="Delete order"
      busy={busy}
      onCancel={() => { if (!busy) setConfirm(null) }}
      onConfirm={runDelete}
    />
  </>}</AdminPage>
}

function Stats({ stats }) {
  return <div className="stat-grid">
    <Stat icon={ShoppingCart} title="Total Orders" value={Number(stats.total_orders).toLocaleString()} note={`${stats.pending_orders} pending`} />
    <Stat icon={DollarSign} title="Revenue (GHS)" value={formatCurrency(Number(stats.revenue_cents) / 100)} note="Paid, shipped and delivered" />
    <Stat icon={Box} title="Products Listed" value={Number(stats.active_products).toLocaleString()} note="Visible in storefront" />
    <Stat icon={Users} title="Active Customers" value={Number(stats.total_users).toLocaleString()} note="Registered accounts" />
  </div>
}

function Stat({ icon: Icon, title, value, note }) {
  return <div className="stat-card"><div><span><Icon /></span><small>{title}</small></div><strong>{value}</strong><p>{note}</p></div>
}

function AdminPage({ title, intro, action, children }) {
  return <div className="admin-page"><div className="admin-title"><div><h1>{title}</h1>{intro && <p>{intro}</p>}</div>{action}</div>{children}</div>
}

export function AdminProducts() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [confirm, setConfirm] = useState(null)
  const [saleProduct, setSaleProduct] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/glam-baddies/products', { params: { page, limit: 20, include_inactive: 1 } }).then(({ data: payload }) => ({
      ...payload,
      products: asArray(payload?.products).map(mapProduct),
      pagination: payload?.pagination || { total: 0 },
    })), [page],
  )
  const products = useMemo(() => asArray(data?.products).filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [data, query])
  const selectedCount = selected.size
  const allVisibleSelected = products.length > 0 && products.every((product) => selected.has(String(product.id)))

  useEffect(() => {
    setSelected(new Set())
  }, [page, query])

  const toggleOne = (id, checked) => {
    const key = String(id)
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleAllVisible = (checked) => {
    setSelected((current) => {
      const next = new Set(current)
      products.forEach((product) => {
        const key = String(product.id)
        if (checked) next.add(key)
        else next.delete(key)
      })
      return next
    })
  }

  const openProduct = (id) => navigate(`${ADMIN_PATH}/products/${id}/edit`)
  const saveSale = async (payload) => {
    if (!saleProduct?.id) return
    setBusy(true)
    try {
      const { data: result } = await api.patch(`/glam-baddies/products/${saleProduct.id}/sale`, payload)
      const mapped = mapProduct(result.product)
      setData({
        ...data,
        products: asArray(data?.products).map((item) => (String(item.id) === String(mapped.id) ? { ...item, ...mapped } : item)),
      })
      bustProductCache(result.revision)
      toast.success(result.message || 'Sale price set')
      setSaleProduct(null)
    } catch (saleError) {
      toast.error(errorMessage(saleError, 'Could not set sale'))
    } finally {
      setBusy(false)
    }
  }
  const clearSale = async () => {
    if (!saleProduct?.id) return
    setBusy(true)
    try {
      const { data: result } = await api.patch(`/glam-baddies/products/${saleProduct.id}/clear-sale`)
      const mapped = mapProduct(result.product)
      setData({
        ...data,
        products: asArray(data?.products).map((item) => (String(item.id) === String(mapped.id) ? { ...item, ...mapped, is_on_sale: false, oldPrice: undefined, badge: undefined } : item)),
      })
      bustProductCache(result.revision)
      toast.success(result.message || 'Sale cleared')
      setSaleProduct(null)
    } catch (saleError) {
      toast.error(errorMessage(saleError, 'Could not clear sale'))
    } finally {
      setBusy(false)
    }
  }
  const askDelete = (product) => setConfirm({
    ids: [product.id],
    title: `Delete ${product.name}?`,
    message: 'This dress will be removed from your catalogue.',
    detail: 'This permanently deletes the product and its images from the store.',
  })
  const askBulkDelete = () => {
    if (!selectedCount) return
    const count = selectedCount
    setConfirm({
      ids: [...selected].map(Number),
      title: count === 1 ? 'Delete 1 product?' : `Delete ${count} products?`,
      message: count === 1
        ? 'This dress will be removed from your catalogue.'
        : 'These dresses will be removed from your catalogue.',
      detail: 'This permanently deletes the selected products and their images from the store.',
    })
  }
  const runDelete = async () => {
    const ids = asArray(confirm?.ids).map(Number).filter((id) => Number.isInteger(id) && id >= 1)
    if (!ids.length) return
    setBusy(true)
    try {
      const { data: result } = ids.length === 1
        ? await api.delete(`/glam-baddies/products/${ids[0]}`)
        : await api.post('/glam-baddies/products/bulk-delete', { ids })
      const removed = new Set(
        (Array.isArray(result?.ids) && result.ids.length ? result.ids : ids).map(String),
      )
      setData({
        ...data,
        products: asArray(data?.products).filter((product) => !removed.has(String(product.id))),
        pagination: {
          ...data.pagination,
          total: Math.max(0, (data?.pagination?.total || removed.size) - removed.size),
        },
      })
      setSelected((current) => {
        const next = new Set(current)
        removed.forEach((id) => next.delete(id))
        return next
      })
      bustProductCache(result.revision)
      toast.success(result.message || (removed.size === 1 ? 'Product deleted' : `${removed.size} products deleted`))
      setConfirm(null)
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete product'))
    } finally {
      setBusy(false)
    }
  }
  const fallbackImage = '/logo.png'
  return (
    <AdminPage
      title="Products"
      intro={`${data?.pagination.total || 0} dresses in your catalogue`}
      action={<Link className="admin-button primary" to={`${ADMIN_PATH}/products/new`}><Plus /> Add New Product</Link>}
    >
      <div className="admin-toolbar products-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dresses..." /></label>
        {selectedCount ? (
          <div className="products-bulk-bar">
            <span>{selectedCount} selected</span>
            <button type="button" className="admin-button" onClick={() => setSelected(new Set())}>Clear</button>
            <button type="button" className="admin-button danger" onClick={askBulkDelete}>
              <Trash2 size={16} /> Delete selected
            </button>
          </div>
        ) : null}
      </div>
      {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : products.length ? (
        <>
          <section className="admin-card table-card products-table-desktop">
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th className="col-select">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        aria-label="Select all products on this page"
                        onChange={(event) => toggleAllVisible(event.target.checked)}
                      />
                    </th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price (GHS)</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={`clickable-row${selected.has(String(product.id)) ? ' is-selected' : ''}`}
                      tabIndex={0}
                      onClick={() => openProduct(product.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openProduct(product.id)
                        }
                      }}
                    >
                      <td className="col-select" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(String(product.id))}
                          aria-label={`Select ${product.name}`}
                          onChange={(event) => toggleOne(product.id, event.target.checked)}
                        />
                      </td>
                      <td>
                        <div className="table-product">
                          <img
                            src={product.image || fallbackImage}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.onerror = null
                              event.currentTarget.src = fallbackImage
                            }}
                          />
                          <span><b>{product.name}</b><small>#{product.id}</small></span>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>
                        {product.is_on_sale && product.oldPrice ? <del className="admin-old-price">{formatCurrency(product.oldPrice)}</del> : null}
                        {' '}
                        {formatCurrency(product.price)}
                      </td>
                      <td><span className={product.stock < 6 ? 'low-stock' : ''}>{product.stock} units</span></td>
                      <td>
                        <span className={`status ${product.is_active ? 'active' : 'draft'}`}>{product.is_active ? 'Active' : 'Inactive'}</span>
                        {product.is_on_sale ? <span className="on-sale-tag">ON SALE</span> : null}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className="row-actions">
                          <button type="button" className="admin-button primary sale-action-btn" onClick={() => setSaleProduct(product)}>
                            {product.is_on_sale ? 'Edit discount' : 'Set discount'}
                          </button>
                          <Link className="table-icon" to={`${ADMIN_PATH}/products/${product.id}/edit`} aria-label={`View ${product.name}`} title="View">
                            <Eye />
                          </Link>
                          <Link className="table-icon" to={`${ADMIN_PATH}/products/${product.id}/edit`} aria-label={`Edit ${product.name}`} title="Edit">
                            <Edit3 />
                          </Link>
                          <button
                            type="button"
                            className="table-icon danger"
                            aria-label={`Delete ${product.name}`}
                            title="Delete"
                            onClick={() => askDelete(product)}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} />
          </section>

          <div className="products-mobile-list">
            <label className="products-mobile-select-all">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => toggleAllVisible(event.target.checked)}
              />
              Select all on this page
            </label>
            {products.map((product) => (
              <article className={`product-mobile-card${selected.has(String(product.id)) ? ' is-selected' : ''}`} key={`mobile-${product.id}`}>
                <label className="product-mobile-check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(String(product.id))}
                    aria-label={`Select ${product.name}`}
                    onChange={(event) => toggleOne(product.id, event.target.checked)}
                  />
                </label>
                <button type="button" className="product-mobile-main" onClick={() => openProduct(product.id)}>
                  <img
                    src={product.image || fallbackImage}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = fallbackImage
                    }}
                  />
                  <div>
                    <div className="product-mobile-top">
                      <h3>{product.name}</h3>
                      <span className={`status ${product.is_active ? 'active' : 'draft'}`}>{product.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p>{product.category || 'Uncategorised'}{product.is_on_sale ? ' · ON SALE' : ''}</p>
                    <div className="product-mobile-meta">
                      <strong>{formatCurrency(product.price)}</strong>
                      <span className={product.stock < 6 ? 'low-stock' : ''}>{product.stock} in stock</span>
                    </div>
                  </div>
                </button>
                <div className="product-mobile-actions">
                  <button className="admin-button primary sale-action-btn" type="button" onClick={() => setSaleProduct(product)}>
                    {product.is_on_sale ? 'Edit discount' : 'Set discount'}
                  </button>
                  <Link className="admin-button" to={`${ADMIN_PATH}/products/${product.id}/edit`}>Edit</Link>
                  <button className="admin-button danger" type="button" onClick={() => askDelete(product)}>Delete</button>
                </div>
              </article>
            ))}
            <Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} />
          </div>
        </>
      ) : (
        <EmptyState title="No products found" text="Add a dress or change your search." action="Add New Product" to={`${ADMIN_PATH}/products/new`} />
      )}
      <SaleModal
        open={Boolean(saleProduct)}
        product={saleProduct}
        busy={busy}
        onClose={() => { if (!busy) setSaleProduct(null) }}
        onSave={saveSale}
        onClear={clearSale}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        detail={confirm?.detail}
        confirmLabel={asArray(confirm?.ids).length > 1 ? 'Delete selected' : 'Delete product'}
        busy={busy}
        onCancel={() => { if (!busy) setConfirm(null) }}
        onConfirm={runDelete}
      />
    </AdminPage>
  )
}

function Pagination({ page, total, limit, setPage }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages === 1) return null
  return <div className="form-actions"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div>
}

export function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [primaryNewIndex, setPrimaryNewIndex] = useState(0)
  const [useNewAsMain, setUseNewAsMain] = useState(!id)
  const [saving, setSaving] = useState(false)
  const [primaryBusy, setPrimaryBusy] = useState(null)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountMode, setDiscountMode] = useState('fixed')
  const [oldPrice, setOldPrice] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [discountPercentInput, setDiscountPercentInput] = useState('20')
  const [saleBusy, setSaleBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => Promise.all([
      api.get('/glam-baddies/categories'),
      id
        ? api.get('/glam-baddies/products', { params: { limit: 100, include_inactive: 1 } })
        : Promise.resolve({ data: { products: [] } }),
    ]).then(([categories, products]) => {
      const raw = asArray(products.data?.products).find((item) => String(item.id) === String(id)) || null
      return {
        categories: asArray(categories.data?.categories),
        product: raw,
      }
    }),
    [id],
  )
  const product = data?.product ? mapProduct(data.product) : null
  const productImages = asArray(data?.product?.images).filter((image) => typeof image === 'object' && image?.url)

  useEffect(() => {
    if (!product) {
      setDiscountOpen(false)
      setOldPrice('')
      setNewPrice('')
      setDiscountPercentInput('20')
      setDiscountMode('fixed')
      return
    }
    if (product.is_on_sale) {
      setDiscountOpen(true)
      setOldPrice(product.oldPrice != null ? String(Number(product.oldPrice).toFixed(2)) : '')
      setNewPrice(product.price != null ? String(Number(product.price).toFixed(2)) : '')
      setDiscountPercentInput(String(product.discount_percent || 20))
      setDiscountMode(product.discount_percent ? 'percent' : 'fixed')
    } else {
      setDiscountOpen(false)
      setOldPrice(product.price != null ? String(Number(product.price).toFixed(2)) : '')
      setNewPrice('')
      setDiscountPercentInput('20')
      setDiscountMode('fixed')
    }
  }, [product?.id, product?.is_on_sale, product?.oldPrice, product?.price, product?.discount_percent])

  useEffect(() => {
    if (!discountOpen || discountMode !== 'percent') return
    const base = Number(oldPrice)
    const pct = Number(discountPercentInput)
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(pct) || pct < 1 || pct > 95) return
    setNewPrice((base * (1 - pct / 100)).toFixed(2))
  }, [discountOpen, discountMode, oldPrice, discountPercentInput])

  const syncImages = (images) => {
    setData({ ...data, product: { ...data.product, images } })
  }

  const deleteImage = async (imageId) => {
    if (!imageId) return
    try {
      const { data: result } = await api.delete(`/glam-baddies/products/${id}/images/${imageId}`)
      syncImages(asArray(result.images))
      bustProductCache(result.revision)
      toast.success('Image removed')
    } catch (imageError) {
      toast.error(errorMessage(imageError, 'Could not delete image'))
    }
  }

  const setPrimary = async (imageId) => {
    if (!imageId || !id) return
    setPrimaryBusy(imageId)
    try {
      const { data: result } = await api.put(`/glam-baddies/products/${id}/images/${imageId}/primary`)
      syncImages(asArray(result.images))
      bustProductCache()
      toast.success(result.message || 'Main thumbnail set')
    } catch (primaryError) {
      toast.error(errorMessage(primaryError, 'Could not set main thumbnail'))
    } finally {
      setPrimaryBusy(null)
    }
  }

  const onPickFiles = (event) => {
    const next = [...event.target.files]
    setFiles(next)
    setPrimaryNewIndex(0)
    if (!id) setUseNewAsMain(true)
  }

  const oldNum = Number(oldPrice)
  const newNum = Number(newPrice)
  const discountPercent = discountMode === 'percent'
    ? Number(discountPercentInput)
    : (Number.isFinite(oldNum) && oldNum > 0 && Number.isFinite(newNum)
      ? Math.round(((oldNum - newNum) / oldNum) * 100)
      : null)
  const discountValid = Number.isFinite(oldNum) && oldNum > 0
    && Number.isFinite(newNum) && newNum > 0 && newNum < oldNum
    && Number.isFinite(discountPercent) && discountPercent >= 1 && discountPercent <= 95
  const youSave = discountValid ? oldNum - newNum : null

  const applyDiscount = async (productId) => {
    if (!productId || !discountValid) return false
    const { data: result } = await api.patch(`/glam-baddies/products/${productId}/sale`, {
      compare_at_price: oldNum,
      sale_price: newNum,
      discount_percent: Math.round(discountPercent),
    })
    bustProductCache(result?.revision)
    if (data) {
      setData({
        ...data,
        product: {
          ...data.product,
          ...result.product,
          price: result.product?.price ?? newNum,
          compare_at_price: result.product?.compare_at_price ?? oldNum,
          is_on_sale: true,
          discount_percent: result.product?.discount_percent ?? discountPercent,
        },
      })
    }
    return true
  }

  const clearDiscount = async () => {
    if (!id) return
    setSaleBusy(true)
    try {
      const { data: result } = await api.patch(`/glam-baddies/products/${id}/clear-sale`)
      bustProductCache(result?.revision)
      toast.success(result?.message || 'Discount cleared')
      setDiscountOpen(false)
      setNewPrice('')
      if (data) {
        setData({
          ...data,
          product: {
            ...data.product,
            ...result.product,
            is_on_sale: false,
            compare_at_price: null,
            discount_percent: null,
          },
        })
      }
    } catch (clearError) {
      toast.error(errorMessage(clearError, 'Could not clear discount'))
    } finally {
      setSaleBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    const form = new FormData(formElement)
    form.set('is_active', form.get('is_active') === 'true' ? 'true' : 'false')
    // When a discount is set, the regular price field should match the sale (new) price.
    if (discountOpen && discountValid) {
      form.set('price', String(newNum))
    }
    files.forEach((file) => form.append('images', file))
    if (files.length && (useNewAsMain || !id)) {
      form.set('primary_image_index', String(primaryNewIndex))
    }
    try {
      const { data: saved } = await api({
        method: id ? 'put' : 'post',
        url: id ? `/glam-baddies/products/${id}` : '/glam-baddies/products',
        data: form,
      })
      const productId = id || saved?.product?.id || saved?.id
      if (discountOpen && discountValid && productId) {
        await applyDiscount(productId)
      }
      bustProductCache()
      toast.success(id ? 'Product updated' : 'Product created')
      navigate(`${ADMIN_PATH}/products`)
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save product'))
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <AdminPage title="Product"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Product"><ErrorState retry={retry} /></AdminPage>
  if (id && !product) return <AdminPage title="Product"><EmptyState title="Product not found" text="It may have been deleted." action="Back to products" to={`${ADMIN_PATH}/products`} /></AdminPage>
  const categoryOptions = asArray(data?.categories)
  const { dresses, accessories, other } = groupCategories(categoryOptions)
  const defaultCategoryId = product?.category_id
    || categoryOptions.find((category) => category.slug === 'casual-dresses')?.id
    || categoryOptions[0]?.id
    || ''
  return (
    <AdminPage
      title={product ? 'Edit product' : 'Add New Product'}
      action={(
        <div className="form-actions">
          <button type="button" onClick={() => navigate(`${ADMIN_PATH}/products`)}>Cancel</button>
          <button className="admin-button primary" form="product-form" disabled={saving}>
            <Check /> {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      )}
    >
      <form id="product-form" className="product-form" onSubmit={submit}>
        <div>
          <section className="admin-card">
            <h2>Basic information</h2>
            <label>Product name<input name="name" required defaultValue={product?.name} placeholder="e.g. Floral Summer Dress" /></label>
            <label>Description<textarea name="description" rows="6" defaultValue={product?.description} placeholder="Describe the dress..." /></label>
            <label>
              Category
              {categoryOptions.length <= 1
                ? <><input type="hidden" name="category_id" value={defaultCategoryId} /><input type="text" readOnly value={categoryOptions[0]?.name || 'Dresses'} className="readonly-field" /></>
                : (
                  <select name="category_id" defaultValue={defaultCategoryId} required>
                    {dresses.length ? (
                      <optgroup label="Dresses">
                        {dresses.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                      </optgroup>
                    ) : null}
                    {accessories.length ? (
                      <optgroup label="Accessories">
                        {accessories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                      </optgroup>
                    ) : null}
                    {other.length ? (
                      <optgroup label="More">
                        {other.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                      </optgroup>
                    ) : null}
                  </select>
                )}
            </label>
          </section>

          <section className="admin-card media-card">
            <div className="card-head">
              <div>
                <h2>Product images</h2>
                <p>Add several angles. Choose one as the main thumbnail shoppers see first.</p>
              </div>
            </div>
            <label className="upload-area">
              <span className="upload-area-icon"><Upload /></span>
              <b>Tap to add images</b>
              <small>PNG, JPG or WEBP · up to 12 images · max 15MB each</small>
              <span className="upload-area-cta">Choose photos</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={onPickFiles} />
            </label>

            {productImages.length > 0 && (
              <div className="media-grid">
                {productImages.map((image) => {
                  const isPrimary = Boolean(image.is_primary)
                  return (
                    <div className={`media-tile${isPrimary ? ' is-primary' : ''}`} key={image.id}>
                      <img src={resolveImageUrl(image.url)} alt="" />
                      {isPrimary ? <span className="media-badge">Main thumb</span> : null}
                      <div className="media-actions">
                        {!isPrimary && (
                          <button type="button" className="admin-button" disabled={primaryBusy === image.id} onClick={() => setPrimary(image.id)}>
                            {primaryBusy === image.id ? 'Setting…' : 'Use as main'}
                          </button>
                        )}
                        <button type="button" className="admin-button danger" onClick={() => deleteImage(image.id)} aria-label="Delete image">
                          <Trash2 /> Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {files.length > 0 && (
              <div className="media-new">
                <h3>New uploads</h3>
                <p className="settings-hint">These angles will be added to this dress when you save.</p>
                {id && (
                  <label className="media-toggle">
                    <input
                      type="checkbox"
                      checked={useNewAsMain}
                      onChange={(event) => setUseNewAsMain(event.target.checked)}
                    />
                    <span>Use one of these new photos as the main thumbnail</span>
                  </label>
                )}
                <div className="media-grid">
                  {files.map((file, index) => (
                    <label className={`media-tile selectable${(useNewAsMain || !id) && primaryNewIndex === index ? ' is-primary' : ''}`} key={`${file.name}-${file.lastModified}-${index}`}>
                      <img src={URL.createObjectURL(file)} alt={file.name} />
                      {(useNewAsMain || !id) && primaryNewIndex === index ? <span className="media-badge">Main thumb</span> : <span className="media-badge muted">View {index + 1}</span>}
                      {(useNewAsMain || !id) && (
                        <>
                          <input
                            type="radio"
                            name="new_primary"
                            checked={primaryNewIndex === index}
                            onChange={() => setPrimaryNewIndex(index)}
                          />
                          <span className="media-pick">{primaryNewIndex === index ? 'Selected as main' : 'Make main'}</span>
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
        <aside>
          <section className="admin-card">
            <h2>Pricing</h2>
            <label>
              Price (GHS)
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={product?.price}
                placeholder="0.00"
                key={`price-${product?.id || 'new'}-${product?.price ?? ''}-${product?.is_on_sale ? 1 : 0}`}
              />
            </label>
            <p className="settings-hint">Use Discount below to set an old price + sale price for the shop.</p>
          </section>
          <section className="admin-card product-discount-card">
            <div className="card-head">
              <div>
                <h2>Discount</h2>
                <p>Show % off and strikethrough on shop cards before customers open the item.</p>
              </div>
            </div>
            {!discountOpen ? (
              <button type="button" className="admin-button primary" onClick={() => {
                setDiscountOpen(true)
                if (!oldPrice && product?.price != null) setOldPrice(String(Number(product.price).toFixed(2)))
              }}
              >
                Add discount
              </button>
            ) : (
              <div className="stack-form">
                <div className="discount-mode-toggle" role="group" aria-label="Discount type">
                  <button type="button" className={discountMode === 'fixed' ? 'is-active' : ''} onClick={() => setDiscountMode('fixed')}>Fixed price</button>
                  <button type="button" className={discountMode === 'percent' ? 'is-active' : ''} onClick={() => setDiscountMode('percent')}>Percentage</button>
                </div>
                <label>
                  Current / old price (GHS)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={oldPrice}
                    onChange={(event) => setOldPrice(event.target.value)}
                    placeholder="e.g. 200.00"
                  />
                </label>
                {discountMode === 'percent' ? (
                  <label>
                    Discount %
                    <input
                      type="number"
                      min="1"
                      max="95"
                      step="1"
                      value={discountPercentInput}
                      onChange={(event) => setDiscountPercentInput(event.target.value)}
                      placeholder="e.g. 20"
                    />
                  </label>
                ) : null}
                <label>
                  New price (GHS)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={newPrice}
                    readOnly={discountMode === 'percent'}
                    onChange={(event) => setNewPrice(event.target.value)}
                    placeholder="e.g. 150.00"
                  />
                </label>
                <p className="discount-preview">
                  {discountValid ? (
                    <>
                      Shop shows <del>{formatCurrency(oldNum)}</del>{' '}
                      <span className="sale-price">{formatCurrency(newNum)}</span>
                      {' '}· −{Math.round(discountPercent)}% · You save {formatCurrency(youSave)}
                    </>
                  ) : discountMode === 'percent' ? (
                    'Enter current price and percent — new price calculates automatically.'
                  ) : (
                    'Enter old and new price — % and “You save” calculate automatically.'
                  )}
                </p>
                <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                  {id && product?.is_on_sale ? (
                    <button type="button" className="admin-button danger" disabled={saleBusy} onClick={clearDiscount}>
                      {saleBusy ? 'Clearing…' : 'Clear discount'}
                    </button>
                  ) : (
                    <button type="button" className="admin-button" onClick={() => { setDiscountOpen(false); setNewPrice('') }}>
                      Cancel
                    </button>
                  )}
                  {id ? (
                    <button
                      type="button"
                      className="admin-button primary"
                      disabled={!discountValid || saleBusy}
                      onClick={async () => {
                        setSaleBusy(true)
                        try {
                          await applyDiscount(id)
                          toast.success('Discount applied — customers will see % and strike on cards')
                        } catch (saleError) {
                          toast.error(errorMessage(saleError, 'Could not apply discount'))
                        } finally {
                          setSaleBusy(false)
                        }
                      }}
                    >
                      {saleBusy ? 'Saving…' : 'Apply discount'}
                    </button>
                  ) : null}
                </div>
                {!id ? (
                  <p className="settings-hint">Discount will apply when you save this new product.</p>
                ) : null}
              </div>
            )}
          </section>
          <section className="admin-card">
            <h2>Inventory</h2>
            <label>Quantity<input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 0} /></label>
          </section>
          <section className="admin-card">
            <h2>Status</h2>
            <label>Product status<select name="is_active" defaultValue={String(product?.is_active ?? true)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
          </section>
        </aside>
      </form>
    </AdminPage>
  )
}

const orderStatuses = ['pending', 'paid', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']
export function AdminOrders() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [clearing, setClearing] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [cancelPrompt, setCancelPrompt] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/glam-baddies/orders', { params: { status: status || undefined, page, limit: 20 } })
      .then(({ data: result }) => ({
        ...result,
        orders: asArray(result?.orders),
        pagination: result?.pagination || { total: 0 },
      })),
    [status, page],
  )
  const updateStatus = async (id, nextStatus, cancelReason = '') => {
    if (nextStatus === 'cancelled' && !cancelReason) {
      setCancelPrompt({ id })
      return false
    }
    const previous = data
    setData({ ...data, orders: asArray(data?.orders).map((order) => order.id === id ? { ...order, status: nextStatus } : order) })
    try {
      const { data: result } = await api.put(`/glam-baddies/orders/${id}/status`, {
        status: nextStatus,
        ...(nextStatus === 'cancelled' ? { cancel_reason: cancelReason } : {}),
      })
      if (nextStatus === 'cancelled') {
        if (result?.email_sent) toast.success('Order cancelled — customer emailed')
        else toast.success(`Order cancelled${result?.email_error ? ` (email not sent: ${result.email_error})` : ' — no customer email on file'}`)
      } else {
        toast.success(result?.email_sent ? 'Order status updated — customer emailed' : 'Order status updated')
      }
      return true
    } catch (updateError) {
      setData(previous)
      toast.error(errorMessage(updateError, 'Could not update order'))
      return false
    }
  }
  const confirmCancel = async (reason) => {
    if (!cancelPrompt?.id) return
    setBusy(true)
    try {
      const ok = await updateStatus(cancelPrompt.id, 'cancelled', reason)
      if (ok) setCancelPrompt(null)
    } finally {
      setBusy(false)
    }
  }
  const askDelete = (id) => setConfirm({
    type: 'one',
    id,
    title: `Delete order #${id}?`,
    message: 'This order will be permanently removed from your store.',
    detail: 'Dashboard revenue will only include the orders that remain.',
    confirmLabel: 'Delete order',
  })
  const askClearAll = () => setConfirm({
    type: 'all',
    title: 'Clear all orders?',
    message: 'Every order in the store will be deleted at once.',
    detail: 'This resets dashboard income to zero and cannot be undone.',
    confirmLabel: 'Clear all orders',
  })
  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.type === 'all') {
        setClearing(true)
        const { data: result } = await api.post('/glam-baddies/orders/clear')
        toast.success(result.message || 'All orders cleared')
        setPage(1)
        setConfirm(null)
        retry()
      } else {
        const previous = data
        const nextOrders = asArray(data?.orders).filter((order) => order.id !== confirm.id)
        setData({
          ...data,
          orders: nextOrders,
          pagination: {
            ...data.pagination,
            total: Math.max(0, (data.pagination?.total || 0) - 1),
          },
        })
        try {
          await api.post(`/glam-baddies/orders/${confirm.id}/delete`)
          toast.success('Order deleted')
          setConfirm(null)
          if (!nextOrders.length && page > 1) setPage(page - 1)
          else retry()
        } catch (deleteError) {
          setData(previous)
          throw deleteError
        }
      }
    } catch (actionError) {
      toast.error(errorMessage(actionError, 'Could not complete delete'))
    } finally {
      setBusy(false)
      setClearing(false)
    }
  }
  const orders = asArray(data?.orders)
  const totalOrders = data?.pagination?.total || 0
  return <AdminPage title="Orders" intro="Manage and fulfil customer orders. Delete orders to remove them from dashboard revenue." action={<button type="button" className="admin-button danger" disabled={clearing || loading || !totalOrders} onClick={askClearAll}><Trash2 /> {clearing ? 'Clearing…' : 'Clear all orders'}</button>}>
    <div className="admin-toolbar"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All status</option>{orderStatuses.map((item) => <option value={item} key={item}>{orderStatusLabel(item)}</option>)}</select></div>
    {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : orders.length ? <section className="admin-card table-card"><OrderTable data={orders} onStatus={updateStatus} onDelete={askDelete} /><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No orders found" text="Orders matching this status will appear here." />}
    <ConfirmDialog
      open={Boolean(confirm)}
      title={confirm?.title}
      message={confirm?.message}
      detail={confirm?.detail}
      confirmLabel={confirm?.confirmLabel}
      busy={busy}
      onCancel={() => { if (!busy) setConfirm(null) }}
      onConfirm={runConfirm}
    />
    <CancelReasonDialog
      open={Boolean(cancelPrompt)}
      orderId={cancelPrompt?.id}
      busy={busy}
      onCancel={() => { if (!busy) setCancelPrompt(null) }}
      onConfirm={confirmCancel}
    />
  </AdminPage>
}

function OrderTable({ data, onStatus, onDelete }) {
  return (
    <div className="data-table">
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Method</th>
            <th>Date</th>
            <th>Total (GHS)</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {asArray(data).map((order) => {
            const ship = order.shipping_address || {}
            const method = ship.fulfillment_method === 'pickup' ? 'Pickup' : 'Delivery'
            const name = ship.full_name || order.user_name || 'Customer'
            const contact = ship.phone || order.user_email || '—'
            return (
              <tr key={order.id}>
                <td><b>#{order.id}</b></td>
                <td>
                  <div className="customer-cell">
                    <span>{String(name).split(' ').map((item) => item[0]).join('').slice(0, 2)}</span>
                    <div>
                      <b>{name}</b>
                      <small>{contact}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`fulfillment-pill ${ship.fulfillment_method === 'pickup' ? 'pickup' : 'delivery'}`}>
                    {method}
                  </span>
                </td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td><b>{formatCurrency(Number(order.total ?? order.total_cents / 100))}</b></td>
                <td>
                  {onStatus ? (
                    <select className={`status ${order.status}`} value={order.status} onChange={(event) => onStatus(order.id, event.target.value)}>
                      {orderStatuses.map((item) => <option value={item} key={item}>{orderStatusLabel(item)}</option>)}
                    </select>
                  ) : (
                    <span className={`status ${order.status}`}>{orderStatusLabel(order.status)}</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <Link className="table-icon" to={`${ADMIN_PATH}/orders/${order.id}`} aria-label={`View order ${order.id}`}><Eye /></Link>
                    {onDelete ? <button type="button" className="table-icon danger" aria-label={`Delete order ${order.id}`} onClick={() => onDelete(order.id)}><Trash2 /></button> : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [riderOpen, setRiderOpen] = useState(false)
  const [riderForm, setRiderForm] = useState({ rider_name: '', rider_phone: '', rider_photo_url: '' })
  const [riderPhotoFile, setRiderPhotoFile] = useState(null)
  const [riderPhotoPreview, setRiderPhotoPreview] = useState('')
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get(`/glam-baddies/orders/${id}`).then(({ data }) => data.order), [id],
  )
  const updateStatus = async (nextStatus, cancelReason = '') => {
    if (nextStatus === 'cancelled' && !cancelReason) {
      setCancelOpen(true)
      return
    }
    const previous = data
    setData({ ...data, status: nextStatus })
    try {
      const { data: result } = await api.put(`/glam-baddies/orders/${id}/status`, {
        status: nextStatus,
        ...(nextStatus === 'cancelled' ? { cancel_reason: cancelReason } : {}),
      })
      if (result?.order) {
        setData({
          ...data,
          status: result.order.status,
          shipping_address: {
            ...(typeof data.shipping_address === 'string'
              ? JSON.parse(data.shipping_address)
              : (data.shipping_address || {})),
            ...(nextStatus === 'cancelled' ? { cancel_reason: cancelReason } : {}),
          },
        })
      }
      toast.success(nextStatus === 'cancelled' ? 'Order cancelled — customer notified' : 'Order status updated')
      setCancelOpen(false)
    } catch (updateError) {
      setData(previous)
      toast.error(errorMessage(updateError, 'Could not update order'))
    }
  }
  const confirmCancel = async (reason) => {
    setBusy(true)
    try {
      const previous = data
      setData({ ...data, status: 'cancelled' })
      try {
        const { data: result } = await api.put(`/glam-baddies/orders/${id}/status`, {
          status: 'cancelled',
          cancel_reason: reason,
        })
        setData({
          ...data,
          status: result?.order?.status || 'cancelled',
          shipping_address: {
            ...(typeof data.shipping_address === 'string'
              ? JSON.parse(data.shipping_address)
              : (data.shipping_address || {})),
            cancel_reason: reason,
          },
        })
        toast.success(
          result?.email_sent
            ? 'Order cancelled — customer emailed'
            : `Order cancelled${result?.email_error ? ` (email not sent: ${result.email_error})` : ' — no customer email on file'}`
        )
        setCancelOpen(false)
      } catch (updateError) {
        setData(previous)
        toast.error(errorMessage(updateError, 'Could not update order'))
      }
    } finally {
      setBusy(false)
    }
  }
  const deleteOrder = async () => {
    setDeleting(true)
    try {
      await api.post(`/glam-baddies/orders/${id}/delete`)
      toast.success('Order deleted')
      navigate(`${ADMIN_PATH}/orders`)
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete order'))
      setDeleting(false)
      setConfirmOpen(false)
    }
  }
  const openRider = () => {
    setRiderForm({
      rider_name: data?.rider_name || '',
      rider_phone: data?.rider_phone || '',
      rider_photo_url: data?.rider_photo_url || '',
    })
    setRiderPhotoFile(null)
    setRiderPhotoPreview(data?.rider_photo_url ? resolveImageUrl(data.rider_photo_url) : '')
    setRiderOpen(true)
  }
  const onRiderPhoto = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setRiderPhotoFile(file)
    setRiderPhotoPreview(URL.createObjectURL(file))
  }
  const saveRider = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const form = new FormData()
      form.set('rider_name', riderForm.rider_name)
      form.set('rider_phone', riderForm.rider_phone)
      if (riderForm.rider_photo_url) form.set('rider_photo_url', riderForm.rider_photo_url)
      if (riderPhotoFile) form.set('photo', riderPhotoFile)
      const { data: result } = await api.patch(`/glam-baddies/orders/${id}/assign-rider`, form)
      setData({ ...data, ...result.order })
      toast.success(result.message || 'Rider assigned')
      setRiderOpen(false)
      setRiderPhotoFile(null)
    } catch (riderError) {
      toast.error(errorMessage(riderError, 'Could not assign rider'))
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <AdminPage title="Order"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Order"><ErrorState retry={retry} /></AdminPage>
  if (!data) return <AdminPage title="Order"><EmptyState title="Order not found" text="This order may have been removed." action="Back to orders" to={`${ADMIN_PATH}/orders`} /></AdminPage>
  const address = typeof data.shipping_address === 'string' ? JSON.parse(data.shipping_address) : (data.shipping_address || {})
  const bagItems = asArray(address.bag_items)
  const fulfillment = String(address.fulfillment_method || 'delivery').toLowerCase()
  return <AdminPage title={`Order #${data.id}`} intro={`Placed ${new Date(data.created_at).toLocaleString()}`} action={<div className="form-actions"><button type="button" className="admin-button" onClick={openRider}>{data.rider_name ? 'Edit rider' : 'Assign rider'}</button><button type="button" className="admin-button danger" disabled={deleting} onClick={() => setConfirmOpen(true)}><Trash2 /> Delete order</button><button className="admin-button" onClick={() => navigate(`${ADMIN_PATH}/orders`)}>Back to orders</button></div>}>
    <ConfirmDialog
      open={confirmOpen}
      title={`Delete order #${data.id}?`}
      message="This order will be permanently removed from your store."
      detail="Dashboard revenue will only include the orders that remain."
      confirmLabel="Delete order"
      busy={deleting}
      onCancel={() => { if (!deleting) setConfirmOpen(false) }}
      onConfirm={deleteOrder}
    />
    <CancelReasonDialog
      open={cancelOpen}
      orderId={data.id}
      busy={busy}
      onCancel={() => { if (!busy) setCancelOpen(false) }}
      onConfirm={confirmCancel}
    />
    <div className="dashboard-grid">
      <section className="admin-card">
        <div className="card-head"><div><h2>Customer</h2><p>Who placed this order</p></div></div>
        <div className="customer-cell"><span>{(address.full_name || data.user_name || 'C').split(' ').map((item) => item[0]).join('')}</span><div><b>{address.full_name || data.user_name}</b><small>{address.phone || data.user_email}</small></div></div>
        <div className="stack-form" style={{ marginTop: '1.5rem' }}>
          <label>Status<select className={`status ${data.status}`} value={data.status} onChange={(event) => updateStatus(event.target.value)}>{orderStatuses.map((item) => <option value={item} key={item}>{orderStatusLabel(item)}</option>)}</select></label>
          {address.cancel_reason && (
            <p><small>Cancel reason</small><br /><strong>{address.cancel_reason}</strong></p>
          )}
          <p><small>Fulfillment</small><br /><strong className={`fulfillment-badge ${fulfillment}`}>{fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</strong></p>
          <div><small>Order ID</small><div><CopyValue value={String(data.id)} label="Copy order id" /></div></div>
          {data.payment_reference && <div><small>Payment reference</small><div><CopyValue value={data.payment_reference} label="Copy payment reference" /></div></div>}
          <p><small>Total</small><br /><strong>{formatCurrency(Number(data.total ?? data.total_cents / 100))}</strong></p>
          {data.rider_name ? (
            <div className="admin-rider-summary">
              {data.rider_photo_url ? (
                <img src={resolveImageUrl(data.rider_photo_url)} alt="" className="admin-rider-photo" />
              ) : (
                <span className="admin-rider-avatar">{String(data.rider_name).split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
              )}
              <div>
                <small>Assigned rider</small>
                <strong>{data.rider_name}</strong>
                <span>{data.rider_phone || '—'}</span>
              </div>
            </div>
          ) : (
            <p className="admin-rider-empty">No rider assigned yet. Use Assign rider above.</p>
          )}
        </div>
      </section>
      <section className="admin-card">
        <div className="card-head"><div><h2>{fulfillment === 'pickup' ? 'Pickup details' : 'Delivery details'}</h2><p>Customer contact & notes</p></div></div>
        <p><strong>{address.full_name || [address.first_name, address.last_name].filter(Boolean).join(' ') || data.user_name}</strong></p>
        <p>{address.phone || '—'}</p>
        <p>{address.email || data.user_email || '—'}</p>
        <p><small>Location</small><br />{address.location || address.street || (fulfillment === 'pickup' ? 'Store pickup' : '—')}</p>
        <p><small>Additional note</small><br />{address.additional_note || address.location_note || '—'}</p>
      </section>
    </div>
    {riderOpen ? (
      <section className="admin-card" style={{ marginTop: '1.5rem' }}>
        <div className="card-head"><div><h2>Assign rider</h2><p>Name, phone and photo show on the customer Track order page</p></div></div>
        <form className="stack-form" onSubmit={saveRider}>
          <label>Rider name<input required value={riderForm.rider_name} onChange={(event) => setRiderForm((current) => ({ ...current, rider_name: event.target.value }))} placeholder="e.g. Kwame Mensah" /></label>
          <label>Contact / phone<input required type="tel" value={riderForm.rider_phone} onChange={(event) => setRiderForm((current) => ({ ...current, rider_phone: event.target.value }))} placeholder="e.g. 0241234567" /></label>
          <label>
            Profile photo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onRiderPhoto} />
          </label>
          {riderPhotoPreview ? (
            <div className="admin-rider-summary">
              <img src={riderPhotoPreview} alt="" className="admin-rider-photo" />
              <div>
                <small>Photo preview</small>
                <strong>{riderForm.rider_name || 'Rider'}</strong>
                <span>{riderForm.rider_phone || '—'}</span>
              </div>
            </div>
          ) : null}
          <label>
            Or photo URL (optional)
            <input
              type="url"
              value={riderForm.rider_photo_url}
              onChange={(event) => {
                const value = event.target.value
                setRiderForm((current) => ({ ...current, rider_photo_url: value }))
                if (!riderPhotoFile) setRiderPhotoPreview(value ? resolveImageUrl(value) : '')
              }}
              placeholder="https://..."
            />
          </label>
          <div className="form-actions">
            <button type="button" className="admin-button" disabled={busy} onClick={() => setRiderOpen(false)}>Cancel</button>
            <button type="submit" className="admin-button primary" disabled={busy}>{busy ? 'Saving…' : 'Save rider'}</button>
          </div>
        </form>
      </section>
    ) : null}
    <section className="admin-card table-card" style={{ marginTop: '1.5rem' }}>
      <div className="card-head"><div><h2>Items</h2><p>{data.items?.length || 0} line items</p></div></div>
      <div className="data-table"><table><thead><tr><th>Product</th><th>Colour</th><th>Size</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>{(data.items || []).map((item) => {
        const snap = bagItems.find((bag) => Number(bag.product_id) === Number(item.product_id)) || {}
        return <tr key={item.id}><td><div className="table-product">{item.image_url ? <img src={resolveImageUrl(item.image_url)} alt="" /> : <span />} <span><b>{item.product_name}</b><small>#{item.product_id || 'snapshot'}</small></span></div></td><td>{snap.color || '—'}</td><td>{snap.size || '—'}</td><td>{item.quantity}</td><td>{formatCurrency(Number(item.unit_price ?? item.unit_price_cents / 100))}</td><td><b>{formatCurrency(Number(item.line_total ?? (item.unit_price_cents * item.quantity) / 100))}</b></td></tr>
      })}</tbody></table></div>
    </section>
  </AdminPage>
}

export function AdminCategories() {
  const [editing, setEditing] = useState(null)
  const [tileSavingId, setTileSavingId] = useState(null)
  const [tileUploadingId, setTileUploadingId] = useState(null)
  const { data: categories, loading, error, retry, setData } = useAdminData(
    () => api.get('/glam-baddies/categories').then(({ data }) => asArray(data?.categories)),
    [],
  )

  const save = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    try {
      const { data } = editing?.id
        ? await api.put(`/glam-baddies/categories/${editing.id}`, values)
        : await api.post('/glam-baddies/categories', values)
      setData(
        editing?.id
          ? categories.map((item) => (item.id === editing.id ? { ...item, ...data.category } : item))
          : [...categories, { ...data.category, product_count: 0 }],
      )
      setEditing(null)
      toast.success(editing?.id ? 'Category updated' : 'Category created — homepage tile added')
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save category'))
    }
  }

  const remove = async (category) => {
    if (!window.confirm(`Delete ${category.name}? Products will become uncategorised.`)) return
    try {
      await api.delete(`/glam-baddies/categories/${category.id}`)
      setData(categories.filter((item) => item.id !== category.id))
      toast.success('Category deleted')
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete category'))
    }
  }

  const updateHomeField = (categoryId, field, value) => {
    setData(asArray(categories).map((item) => (
      item.id === categoryId ? { ...item, [field]: value } : item
    )))
  }

  const saveHomeTile = async (category) => {
    if (!category?.id || tileSavingId) return
    setTileSavingId(category.id)
    try {
      const { data } = await api.put(`/glam-baddies/categories/${category.id}`, {
        name: category.name,
        description: category.description || '',
        home_eyebrow: category.home_eyebrow || '',
        home_title: category.home_title || '',
        home_image_url: category.home_image_url || '',
      })
      setData(asArray(categories).map((item) => (
        item.id === category.id ? { ...item, ...data.category } : item
      )))
      toast.success('Homepage tile saved')
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save homepage tile'))
    } finally {
      setTileSavingId(null)
    }
  }

  const uploadHomeImage = async (category, file) => {
    if (!category?.id || !file) return
    setTileUploadingId(category.id)
    try {
      const body = new FormData()
      body.append('image', file)
      const { data } = await api.post(`/glam-baddies/categories/${category.id}/home-image`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setData(asArray(categories).map((item) => (
        item.id === category.id ? { ...item, ...data.category } : item
      )))
      toast.success(data.message || 'Image uploaded')
    } catch (uploadError) {
      toast.error(errorMessage(uploadError, 'Could not upload image'))
    } finally {
      setTileUploadingId(null)
    }
  }

  return (
    <AdminPage
      title="Categories"
      intro="Each category appears in the shop and gets its own homepage image tile."
      action={<button className="admin-button primary" type="button" onClick={() => setEditing({})}><Plus /> Add category</button>}
    >
      {editing && (
        <form className="admin-card stack-form" onSubmit={save}>
          <label>
            Name
            <input name="name" required defaultValue={editing.name || ''} placeholder="e.g. Formal dresses" />
          </label>
          <label>
            Description
            <textarea name="description" defaultValue={editing.description || ''} placeholder="Optional short description" />
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
            <button className="admin-button primary" type="submit">Save category</button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorState retry={retry} />
      ) : asArray(categories).length ? (
        <div className="category-admin-grid category-admin-grid--home">
          {asArray(categories).map((category) => (
            <article className="admin-card category-home-card" key={category.id}>
              <div className="category-home-card-head">
                <span>
                  <h3>{category.name}</h3>
                  <p>{category.product_count || 0} products · {category.slug}</p>
                </span>
                <div className="row-actions">
                  <button type="button" onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`}><Edit3 /></button>
                  <button type="button" onClick={() => remove(category)} aria-label={`Delete ${category.name}`}><Trash2 /></button>
                </div>
              </div>

              <div className="homepage-feature-preview">
                {category.home_image_url ? (
                  <img src={resolveImageUrl(category.home_image_url) || category.home_image_url} alt="" />
                ) : (
                  <span className="homepage-feature-empty">No homepage image</span>
                )}
                <div className="homepage-feature-caption">
                  <span className="eyebrow">{category.home_eyebrow || 'Eyebrow'}</span>
                  <strong>{category.home_title || 'Homepage title'}</strong>
                </div>
              </div>

              <div className="category-home-fields">
                <label>
                  <span>Eyebrow</span>
                  <input
                    type="text"
                    maxLength={40}
                    value={category.home_eyebrow || ''}
                    onChange={(event) => updateHomeField(category.id, 'home_eyebrow', event.target.value.slice(0, 40))}
                    placeholder="e.g. Casual"
                  />
                </label>
                <label>
                  <span>Title</span>
                  <input
                    type="text"
                    maxLength={80}
                    value={category.home_title || ''}
                    onChange={(event) => updateHomeField(category.id, 'home_title', event.target.value.slice(0, 80))}
                    placeholder="e.g. Everyday dresses"
                  />
                </label>
              </div>
              <label className="homepage-feature-upload">
                <span className="homepage-feature-upload-icon"><Upload size={18} /></span>
                <span className="homepage-feature-upload-copy">
                  <b>{tileUploadingId === category.id ? 'Uploading…' : 'Upload homepage image'}</b>
                  <small>Tap to choose a photo from your phone</small>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={tileUploadingId === category.id}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) uploadHomeImage(category, file)
                  }}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="admin-button primary"
                  disabled={tileSavingId === category.id || tileUploadingId === category.id}
                  onClick={() => saveHomeTile(category)}
                >
                  <Check /> {tileSavingId === category.id ? 'Saving…' : 'Save homepage tile'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No categories yet" text="Create a category to organise products and add a homepage tile." />
      )}
    </AdminPage>
  )
}

export function AdminCustomers() {
  const [page, setPage] = useState(1)
  const { data, loading, error, retry } = useAdminData(() => api.get('/glam-baddies/users', { params: { page, limit: 20 } }).then(({ data }) => data), [page])
  return <AdminPage title="Customers" intro={`${data?.pagination.total || 0} customer profiles`}>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : data.users.length ? <section className="admin-card table-card"><div className="data-table"><table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Joined</th></tr></thead><tbody>{data.users.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span>{String(customer.name || 'C').split(' ').map((item) => item[0]).join('').slice(0, 2)}</span><div><b>{customer.name}</b><small>{customer.email || '—'}</small></div></div></td><td>{customer.phone || '—'}</td><td>{customer.order_count}</td><td>{new Date(customer.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No customers yet" text="Registered customers will appear here." />}</AdminPage>
}

export function AdminNewsletter() {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/glam-baddies/newsletter', { params: { page, limit: 30, q: query || undefined } })
      .then(({ data: result }) => ({
        subscribers: asArray(result?.subscribers),
        pagination: result?.pagination || { total: 0 },
      })),
    [page, query],
  )
  const remove = async (subscriber) => {
    if (!window.confirm(`Remove ${subscriber.email} from the private list?`)) return
    setBusyId(subscriber.id)
    const previous = data
    setData({
      ...data,
      subscribers: asArray(data?.subscribers).filter((item) => item.id !== subscriber.id),
      pagination: { ...data.pagination, total: Math.max(0, (data.pagination?.total || 0) - 1) },
    })
    try {
      await api.delete(`/glam-baddies/newsletter/${subscriber.id}`)
      toast.success('Removed from private list')
    } catch (deleteError) {
      setData(previous)
      toast.error(errorMessage(deleteError, 'Could not remove subscriber'))
    } finally {
      setBusyId(null)
    }
  }
  const subscribers = asArray(data?.subscribers)
  const total = data?.pagination?.total || 0
  return (
    <AdminPage title="Private list" intro={`${total} newsletter sign-ups from the store footer`}>
      <div className="admin-toolbar">
        <label>
          <Search />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            placeholder="Search emails…"
            aria-label="Search private list"
          />
        </label>
      </div>
      {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : subscribers.length ? (
        <section className="admin-card table-card">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subscribers.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td>
                      <div className="customer-cell">
                        <span>{String(subscriber.email || '?')[0].toUpperCase()}</span>
                        <div>
                          <b>{subscriber.email}</b>
                          <small>#{subscriber.id}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="status active">{subscriber.source || 'footer'}</span></td>
                    <td>{new Date(subscriber.created_at).toLocaleString()}</td>
                    <td className="row-actions">
                      <a className="table-icon" href={`mailto:${subscriber.email}`} aria-label={`Email ${subscriber.email}`}><Mail /></a>
                      <button type="button" className="table-icon danger" disabled={busyId === subscriber.id} onClick={() => remove(subscriber)} aria-label={`Remove ${subscriber.email}`}>
                        <Trash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={30} setPage={setPage} />
        </section>
      ) : (
        <EmptyState title="No sign-ups yet" text="When shoppers join the private list in the footer, their emails will appear here." />
      )}
    </AdminPage>
  )
}

export function Analytics() {
  const { data, loading, error, retry } = useAdminData(
    () => api.get('/glam-baddies/analytics', { params: { days: 14 } }).then(({ data: result }) => result),
    [],
  )
  if (loading) return <AdminPage title="Analytics" intro="Live performance across your storefront"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Analytics"><ErrorState retry={retry} /></AdminPage>

  const stats = data.stats
  const daily = asArray(data.daily)
  const status = data.status || {}
  const topProducts = asArray(data.top_products)
  const periodRevenue = daily.reduce((sum, day) => sum + Number(day.revenue_cents || 0), 0)
  const periodOrders = daily.reduce((sum, day) => sum + Number(day.order_count || 0), 0)

  return (
    <AdminPage title="Analytics" intro="Revenue, orders and fulfilment at a glance.">
      <Stats stats={stats} />
      <div className="analytics-grid">
        <section className="admin-card analytics-card">
          <div className="card-head">
            <div>
              <h2>Revenue trend</h2>
              <p>Paid, shipped and delivered · last 14 days</p>
            </div>
            <strong className="analytics-period-total">{formatCurrency(periodRevenue / 100)}</strong>
          </div>
          <RevenueAreaChart data={daily} />
        </section>
        <section className="admin-card analytics-card">
          <div className="card-head">
            <div>
              <h2>Order volume</h2>
              <p>{periodOrders} orders placed in this period</p>
            </div>
          </div>
          <OrdersBarChart data={daily} />
        </section>
      </div>
      <div className="analytics-grid secondary">
        <section className="admin-card analytics-card">
          <div className="card-head"><div><h2>Order status</h2><p>Current fulfilment mix</p></div></div>
          <StatusDonut status={status} />
        </section>
        <section className="admin-card analytics-card">
          <div className="card-head"><div><h2>Top products</h2><p>By revenue from paid orders</p></div></div>
          {topProducts.length ? (
            <div className="top-products-chart">
              {topProducts.map((product) => {
                const max = Math.max(...topProducts.map((item) => item.revenue_cents), 1)
                return (
                  <div key={product.name} className="top-product-row">
                    <div>
                      <b>{product.name}</b>
                      <small>{product.units} sold · {formatCurrency(product.revenue_cents / 100)}</small>
                    </div>
                    <span style={{ '--fill': `${Math.max(8, (product.revenue_cents / max) * 100)}%` }} />
                  </div>
                )
              })}
            </div>
          ) : <EmptyState title="No paid sales yet" text="Top products will appear once orders are paid." />}
        </section>
      </div>
    </AdminPage>
  )
}

function RevenueAreaChart({ data }) {
  const points = asArray(data)
  const width = 640
  const height = 220
  const padX = 16
  const padY = 18
  const values = points.map((item) => Number(item.revenue_cents) / 100)
  const max = Math.max(...values, 1)
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0
  const coords = points.map((item, index) => {
    const x = padX + index * step
    const y = height - padY - ((Number(item.revenue_cents) / 100) / max) * (height - padY * 2)
    return [x, y]
  })
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const area = coords.length
    ? `${line} L${coords[coords.length - 1][0]},${height - padY} L${coords[0][0]},${height - padY} Z`
    : ''
  const labels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % 3 === 0)

  return (
    <div className="chart-frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue over the last 14 days">
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2a37" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1f2a37" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padY - ratio * (height - padY * 2)
          return <line key={ratio} x1={padX} x2={width - padX} y1={y} y2={y} className="chart-grid" />
        })}
        {area ? <path d={area} fill="url(#revenueFill)" /> : null}
        {line ? <path d={line} className="chart-line" fill="none" /> : null}
        {coords.map(([x, y], index) => (
          <circle key={points[index].day} cx={x} cy={y} r="3.5" className="chart-dot">
            <title>{`${new Date(points[index].day).toLocaleDateString()} · ${formatCurrency(values[index])}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-x">
        {labels.map((item) => (
          <span key={item.day}>{new Date(item.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        ))}
      </div>
    </div>
  )
}

function OrdersBarChart({ data }) {
  const points = asArray(data)
  const max = Math.max(...points.map((item) => Number(item.order_count)), 1)
  return (
    <div className="orders-bars" role="img" aria-label="Orders placed each day">
      {points.map((item) => {
        const value = Number(item.order_count)
        const height = Math.max(4, (value / max) * 100)
        return (
          <div key={item.day} className="orders-bar">
            <span style={{ height: `${height}%` }} title={`${value} orders`} />
            <small>{new Date(item.day).toLocaleDateString(undefined, { day: 'numeric' })}</small>
          </div>
        )
      })}
    </div>
  )
}

function StatusDonut({ status }) {
  const entries = orderStatuses.map((key) => ({ key, value: Number(status[key] || 0) }))
  const rawTotal = entries.reduce((sum, item) => sum + item.value, 0)
  const total = rawTotal || 1
  const colors = {
    pending: '#c4a35a',
    paid: '#3d7a5f',
    shipped: '#4a6fa5',
    delivered: '#1f2a37',
    cancelled: '#a85a45',
  }
  let offset = 0
  const radius = 54
  const circumference = 2 * Math.PI * radius

  return (
    <div className="status-donut">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} className="donut-track" />
        {entries.filter((item) => item.value > 0).map((item) => {
          const length = (item.value / total) * circumference
          const segment = (
            <circle
              key={item.key}
              cx="70"
              cy="70"
              r={radius}
              className="donut-segment"
              stroke={colors[item.key]}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          )
          offset += length
          return segment
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-total">{rawTotal}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-label">orders</text>
      </svg>
      <ul>
        {entries.map((item) => (
          <li key={item.key}><i style={{ background: colors[item.key] }} />{item.key}<b>{item.value}</b></li>
        ))}
      </ul>
    </div>
  )
}

export function AdminSettings() {
  const { admin } = useAuth()
  const [tab, setTab] = useState('account')
  const [saving, setSaving] = useState(false)
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [adminSaving, setAdminSaving] = useState(false)
  const [showPublic, setShowPublic] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [liveConfirmed, setLiveConfirmed] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/glam-baddies/settings').then(({ data: settings }) => {
      setLiveConfirmed(settings.payment_mode === 'live')
      return {
        purchases_enabled: settings.purchases_enabled !== false,
        payment_mode: settings.payment_mode === 'live' ? 'live' : 'test',
        test_public: settings.paystack_test_public_key || '',
        test_secret: settings.paystack_test_secret_key || '',
        live_public: settings.paystack_live_public_key || '',
        live_secret: settings.paystack_live_secret_key || '',
        usd_to_ghs_rate: Number(settings.usd_to_ghs_rate) > 0 ? Number(settings.usd_to_ghs_rate) : 15.5,
        announcement_text: settings.announcement_text || 'Shop · Slay · Shine',
        homepage_features: asArray(settings.homepage_features),
        default_rider_name: settings.default_rider_name || '',
        default_rider_phone: settings.default_rider_phone || '',
        default_rider_photo_url: settings.default_rider_photo_url || '',
      }
    }),
    [],
  )
  const {
    data: adminsData,
    loading: adminsLoading,
    error: adminsError,
    retry: retryAdmins,
    setData: setAdminsData,
  } = useAdminData(
    () => api.get('/glam-baddies/admins').then(({ data: payload }) => asArray(payload?.admins)),
    [],
  )

  const mode = data?.payment_mode || 'test'
  const publicKey = mode === 'live' ? data?.live_public || '' : data?.test_public || ''
  const secretKey = mode === 'live' ? data?.live_secret || '' : data?.test_secret || ''

  const setMode = (next) => {
    setData({ ...data, payment_mode: next })
    setLiveConfirmed(false)
    setShowPublic(false)
    setShowSecret(false)
  }

  const setPublicKey = (value) => {
    setLiveConfirmed(false)
    setData(mode === 'live'
      ? { ...data, live_public: value }
      : { ...data, test_public: value })
  }

  const setSecretKey = (value) => {
    setLiveConfirmed(false)
    setData(mode === 'live'
      ? { ...data, live_secret: value }
      : { ...data, test_secret: value })
  }

  const savePayments = async (event) => {
    event.preventDefault()
    if (!data || saving) return
    setSaving(true)
    try {
      const { data: result } = await api.put('/glam-baddies/settings', {
        payment_mode: data.payment_mode,
        paystack_test_public_key: data.test_public,
        paystack_test_secret_key: data.test_secret,
        paystack_live_public_key: data.live_public,
        paystack_live_secret_key: data.live_secret,
      })
      setData({
        ...data,
        purchases_enabled: result.purchases_enabled !== false,
        payment_mode: result.payment_mode === 'live' ? 'live' : 'test',
        test_public: result.paystack_test_public_key || '',
        test_secret: result.paystack_test_secret_key || '',
        live_public: result.paystack_live_public_key || '',
        live_secret: result.paystack_live_secret_key || '',
        usd_to_ghs_rate: Number(result.usd_to_ghs_rate) > 0 ? Number(result.usd_to_ghs_rate) : data.usd_to_ghs_rate,
      })
      setLiveConfirmed(
        Boolean(result.live_confirmed) ||
          (result.payment_mode === 'live' && liveConfirmed && data.payment_mode === 'live')
      )
      toast.success(result.message || 'Payment settings saved')
    } catch (saveError) {
      setLiveConfirmed(false)
      toast.error(errorMessage(saveError, 'Could not verify or save payment settings'))
    } finally {
      setSaving(false)
    }
  }

  const togglePurchases = async () => {
    const next = !data.purchases_enabled
    const previous = data
    setData({ ...data, purchases_enabled: next })
    try {
      const { data: result } = await api.put('/glam-baddies/settings', { purchases_enabled: next })
      toast.success(result.message || (next ? 'Purchases enabled' : 'Purchases paused'))
    } catch (toggleError) {
      setData(previous)
      toast.error(errorMessage(toggleError, 'Could not update store availability'))
    }
  }

  const saveAnnouncement = async (event) => {
    event.preventDefault()
    if (!data || announcementSaving) return
    const text = String(data.announcement_text || '').trim().slice(0, 80)
    if (!text) {
      toast.error('Enter a short announcement')
      return
    }
    setAnnouncementSaving(true)
    try {
      const { data: result } = await api.put('/glam-baddies/settings', { announcement_text: text })
      setData({ ...data, announcement_text: result.announcement_text || text })
      toast.success(result.message || 'Announcement bar updated')
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save announcement'))
    } finally {
      setAnnouncementSaving(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const fields = Object.fromEntries(new FormData(form))
    if (fields.new_password !== fields.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    setPasswordSaving(true)
    try {
      const { data: result } = await api.put('/glam-baddies/password', {
        current_password: fields.current_password,
        new_password: fields.new_password,
      })
      toast.success(result.message || 'Password updated')
      form.reset()
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not change password'))
    } finally {
      setPasswordSaving(false)
    }
  }

  const createAdmin = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const fields = Object.fromEntries(new FormData(form))
    if (fields.password !== fields.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    setAdminSaving(true)
    try {
      const { data: result } = await api.post('/glam-baddies/admins', {
        name: fields.name,
        email: fields.email,
        password: fields.password,
      })
      setAdminsData([...(adminsData || []), result.admin])
      toast.success(result.message || 'Admin added')
      form.reset()
      setShowAdminPassword(false)
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not add admin'))
    } finally {
      setAdminSaving(false)
    }
  }

  const removeAdmin = async (target) => {
    if (!window.confirm(`Remove admin ${target.email}?`)) return
    try {
      await api.delete(`/glam-baddies/admins/${target.id}`)
      setAdminsData((adminsData || []).filter((item) => item.id !== target.id))
      toast.success('Admin removed')
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not remove admin'))
    }
  }

  return (
    <AdminPage title="Settings" intro="Account security, store availability, and payment keys.">
      <div className="settings-shell">
        <aside className="settings-nav" role="tablist" aria-label="Settings sections">
          <button type="button" role="tab" aria-selected={tab === 'account'} className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>
            <span>Account</span>
            <small>Password &amp; admins</small>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'store'} className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}>
            <span>Store</span>
            <small>Purchases, banner, rider &amp; homepage</small>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>
            <span>Payments</span>
            <small>Paystack keys</small>
          </button>
        </aside>

        <div className="settings-panel">
          {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : tab === 'account' ? (
            <div className="store-settings-stack">
              <section className="admin-card account-settings">
                <div className="card-head">
                  <div>
                    <h2>Admin account</h2>
                    <p>Update the password used to sign in to the admin panel.</p>
                  </div>
                </div>
                <div className="account-profile">
                  <span>{(admin?.name || 'A').split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                  <div>
                    <b>{admin?.name || 'Administrator'}</b>
                    <small>{admin?.email || '—'}</small>
                  </div>
                </div>
                <form className="stack-form password-form" onSubmit={changePassword}>
                  <h3>Change password</h3>
                  <label>
                    Current password
                    <span className="secret-field">
                      <input name="current_password" type={showCurrent ? 'text' : 'password'} required autoComplete="current-password" />
                      <button type="button" className="reveal-key" onClick={() => setShowCurrent((value) => !value)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'}>
                        {showCurrent ? <EyeOff /> : <Eye />}
                      </button>
                    </span>
                  </label>
                  <label>
                    New password
                    <span className="secret-field">
                      <input name="new_password" type={showNew ? 'text' : 'password'} required minLength={8} autoComplete="new-password" />
                      <button type="button" className="reveal-key" onClick={() => setShowNew((value) => !value)} aria-label={showNew ? 'Hide new password' : 'Show new password'}>
                        {showNew ? <EyeOff /> : <Eye />}
                      </button>
                    </span>
                  </label>
                  <label>
                    Confirm new password
                    <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
                  </label>
                  <p className="settings-hint">Use at least 8 characters. You will stay signed in after updating.</p>
                  <div className="form-actions">
                    <button type="submit" className="admin-button primary" disabled={passwordSaving}>
                      <Check /> {passwordSaving ? 'Updating…' : 'Update password'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="admin-card">
                <div className="card-head">
                  <div>
                    <h2>Admin users</h2>
                    <p>Add more people who can manage GlamBaddies.</p>
                  </div>
                </div>
                {adminsLoading ? <LoadingGrid /> : adminsError ? <ErrorState retry={retryAdmins} /> : (
                  <div className="data-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Joined</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {asArray(adminsData).map((item) => (
                          <tr key={item.id}>
                            <td>
                              <b>{item.name}</b>
                              {Number(item.id) === Number(admin?.id) ? <small> (you)</small> : null}
                            </td>
                            <td>{item.email}</td>
                            <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</td>
                            <td>
                              {Number(item.id) === Number(admin?.id) ? null : (
                                <button type="button" className="table-icon danger" aria-label={`Remove ${item.email}`} onClick={() => removeAdmin(item)}>
                                  <Trash2 />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <form className="stack-form password-form" onSubmit={createAdmin} style={{ marginTop: '1.5rem' }}>
                  <h3>Add admin</h3>
                  <label>
                    Full name
                    <input name="name" required autoComplete="name" placeholder="e.g. Ama Mensah" />
                  </label>
                  <label>
                    Email
                    <input name="email" type="email" required autoComplete="email" placeholder="admin@example.com" />
                  </label>
                  <label>
                    Password
                    <span className="secret-field">
                      <input name="password" type={showAdminPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" />
                      <button type="button" className="reveal-key" onClick={() => setShowAdminPassword((value) => !value)} aria-label={showAdminPassword ? 'Hide password' : 'Show password'}>
                        {showAdminPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </span>
                  </label>
                  <label>
                    Confirm password
                    <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="admin-button primary" disabled={adminSaving}>
                      <Plus /> {adminSaving ? 'Adding…' : 'Add admin'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : tab === 'store' ? (
            <div className="store-settings-stack">
              <section className="admin-card store-toggle-card">
                <div>
                  <h2>Store purchases</h2>
                  <p>{data.purchases_enabled ? 'Customers can add items and complete checkout.' : 'All items are unavailable for purchase right now.'}</p>
                </div>
                <button type="button" className={`store-toggle${data.purchases_enabled ? ' on' : ''}`} onClick={togglePurchases} aria-pressed={data.purchases_enabled}>
                  <span>{data.purchases_enabled ? 'Open' : 'Paused'}</span>
                  <i />
                </button>
              </section>
              <form className="admin-card stack-form" onSubmit={saveAnnouncement}>
                <div className="card-head">
                  <div>
                    <h2>Announcement bar</h2>
                    <p>Short black bar text at the top of the storefront. Keep it brief.</p>
                  </div>
                </div>
                <label>
                  Announcement text
                  <input
                    type="text"
                    maxLength={80}
                    required
                    value={data?.announcement_text ?? ''}
                    onChange={(event) => setData({ ...data, announcement_text: event.target.value.slice(0, 80) })}
                    placeholder="e.g. Shop · Slay · Shine"
                  />
                </label>
                <p className="settings-hint">{(data?.announcement_text || '').length}/80 characters</p>
                <div className="form-actions">
                  <button type="submit" className="admin-button primary" disabled={announcementSaving}>
                    <Check /> {announcementSaving ? 'Saving…' : 'Save announcement'}
                  </button>
                </div>
              </form>

              <section className="admin-card">
                <div className="card-head">
                  <div>
                    <h2>Delivery rider</h2>
                    <p>Set the rider name, phone and photo under the Rider page in the sidebar.</p>
                  </div>
                  <Link className="admin-button" to={`${ADMIN_PATH}/rider`}>Open Rider</Link>
                </div>
              </section>

              <section className="admin-card">
                <div className="card-head">
                  <div>
                    <h2>Homepage category tiles</h2>
                    <p>
                      Every category has its own homepage image tile. Edit images and text under{' '}
                      <Link to={`${ADMIN_PATH}/categories`}>Categories</Link>.
                    </p>
                  </div>
                </div>
                {asArray(data?.homepage_features).length ? (
                  <div className="homepage-feature-grid homepage-feature-grid--readonly">
                    {asArray(data.homepage_features).map((feature) => (
                      <article className="homepage-feature-card" key={feature.id || feature.category_slug}>
                        <div className="homepage-feature-preview">
                          {feature.image_url ? (
                            <img src={resolveImageUrl(feature.image_url) || feature.image_url} alt="" />
                          ) : (
                            <span>No image</span>
                          )}
                        </div>
                        <p><b>{feature.eyebrow || feature.category_slug}</b></p>
                        <p>{feature.title || '—'}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="settings-hint">No categories yet. Add one under Categories to create a homepage tile.</p>
                )}
                <div className="form-actions">
                  <Link className="admin-button primary" to={`${ADMIN_PATH}/categories`}>
                    Manage category tiles
                  </Link>
                </div>
              </section>

              <section className="admin-card">
                <div className="card-head">
                  <div>
                    <h2>Currency</h2>
                    <p>GlamBaddies prices and Paystack charges are in GHS — no conversion.</p>
                  </div>
                </div>
                <p className="settings-hint">Catalogue prices, order totals, and Paystack charges all use Ghanaian Cedi (GHS). Enter product prices in GHS.</p>
              </section>
            </div>
          ) : (
            <form className="admin-card payments-settings" onSubmit={savePayments}>
              <div className={`payment-mode-banner ${mode}${liveConfirmed && mode === 'live' ? ' confirmed' : ''}`}>
                {mode === 'live'
                  ? (liveConfirmed
                    ? 'LIVE MODE confirmed — Paystack live keys verified. Accepting real payments.'
                    : 'LIVE MODE selected — Save to verify live keys with Paystack before going live.')
                  : 'TEST MODE — No real payments are processed'}
              </div>

              <div className="payment-mode-row">
                <div>
                  <h2>Payment mode</h2>
                  <p>Switch between Paystack test and live keys. Live mode is only enabled after Paystack confirms your live keys.</p>
                </div>
                <div className="mode-switch" role="group" aria-label="Payment mode">
                  <button type="button" className={mode === 'test' ? 'active' : ''} onClick={() => setMode('test')}>Test</button>
                  <button type="button" className={mode === 'live' ? 'active live' : ''} onClick={() => setMode('live')}>Live</button>
                </div>
              </div>

              <label>
                Paystack Public Key
                <span className="secret-field">
                  <input
                    type={showPublic ? 'text' : 'password'}
                    value={publicKey}
                    onChange={(event) => setPublicKey(event.target.value)}
                    placeholder={mode === 'live' ? 'pk_live_…' : 'pk_test_…'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="button" className="reveal-key" onClick={() => setShowPublic((value) => !value)} aria-label={showPublic ? 'Hide public key' : 'Show public key'}>
                    {showPublic ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </label>

              <label>
                Paystack Secret Key
                <span className="secret-field">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secretKey}
                    onChange={(event) => setSecretKey(event.target.value)}
                    placeholder={mode === 'live' ? 'sk_live_…' : 'sk_test_…'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="button" className="reveal-key" onClick={() => setShowSecret((value) => !value)} aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}>
                    {showSecret ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </label>

              <p className="settings-hint">
                Keys for <strong>{mode}</strong> mode are shown above.
                {mode === 'live' ? ' Saving will contact Paystack to confirm these are real live keys before live mode is activated.' : ' Switch to Live and save with pk_live_ / sk_live_ keys to go live.'}
              </p>

              <div className="form-actions">
                <button type="submit" className="admin-button primary" disabled={saving}>
                  <Check /> {saving ? (mode === 'live' ? 'Verifying live keys…' : 'Saving…') : 'Save payment settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminPage>
  )
}

export function AdminRider() {
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/glam-baddies/settings').then(({ data: settings }) => ({
      default_rider_name: settings.default_rider_name || '',
      default_rider_phone: settings.default_rider_phone || '',
      default_rider_photo_url: settings.default_rider_photo_url || '',
    })),
    [],
  )

  const save = async (event) => {
    event.preventDefault()
    if (!data || saving) return
    setSaving(true)
    try {
      const { data: result } = await api.put('/glam-baddies/settings', {
        default_rider_name: data.default_rider_name,
        default_rider_phone: data.default_rider_phone,
        default_rider_photo_url: data.default_rider_photo_url,
      })
      setData({
        default_rider_name: result.default_rider_name || '',
        default_rider_phone: result.default_rider_phone || '',
        default_rider_photo_url: result.default_rider_photo_url || '',
      })
      toast.success(result.message || 'Rider saved — customers can call them from Track order')
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save rider'))
    } finally {
      setSaving(false)
    }
  }

  const onPhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !data) return
    setPhotoBusy(true)
    try {
      const form = new FormData()
      form.set('photo', file)
      const { data: result } = await api.post('/glam-baddies/settings/default-rider-photo', form)
      setData({
        ...data,
        default_rider_photo_url: result.default_rider_photo_url || result.uploaded_url || '',
      })
      toast.success(result.message || 'Rider photo updated')
    } catch (uploadError) {
      toast.error(errorMessage(uploadError, 'Could not upload rider photo'))
    } finally {
      setPhotoBusy(false)
      event.target.value = ''
    }
  }

  if (loading) return <AdminPage title="Rider"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Rider"><ErrorState retry={retry} /></AdminPage>

  return (
    <AdminPage
      title="Rider"
      intro="Set the delivery rider shown on every Track order page. Customers can tap Call to phone them."
    >
      <form className="admin-card stack-form" onSubmit={save} style={{ maxWidth: 520 }}>
        <div className="card-head">
          <div>
            <h2>Delivery rider profile</h2>
            <p>Name, contact number and profile picture for the Track order page.</p>
          </div>
        </div>
        <label>
          Rider name
          <input
            required
            value={data?.default_rider_name ?? ''}
            onChange={(event) => setData({ ...data, default_rider_name: event.target.value })}
            placeholder="e.g. Kwame Mensah"
          />
        </label>
        <label>
          Phone number
          <input
            required
            type="tel"
            value={data?.default_rider_phone ?? ''}
            onChange={(event) => setData({ ...data, default_rider_phone: event.target.value })}
            placeholder="e.g. 0241234567"
          />
        </label>
        <label>
          Profile picture
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPhoto} disabled={photoBusy} />
        </label>
        {data?.default_rider_photo_url || data?.default_rider_name ? (
          <div className="admin-rider-summary" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
            {data.default_rider_photo_url ? (
              <img src={resolveImageUrl(data.default_rider_photo_url)} alt="" className="admin-rider-photo" />
            ) : (
              <span className="admin-rider-avatar">
                {String(data.default_rider_name || 'R').split(' ').map((p) => p[0]).join('').slice(0, 2)}
              </span>
            )}
            <div>
              <small>Preview on Track order</small>
              <strong>{data.default_rider_name || 'Rider'}</strong>
              <span>{data.default_rider_phone || '—'}</span>
            </div>
          </div>
        ) : null}
        <p className="settings-hint">Saving updates this rider on all orders so every customer sees them when tracking.</p>
        <div className="form-actions">
          <button type="submit" className="admin-button primary" disabled={saving || photoBusy}>
            <Check /> {saving ? 'Saving…' : 'Save rider'}
          </button>
        </div>
      </form>
    </AdminPage>
  )
}
