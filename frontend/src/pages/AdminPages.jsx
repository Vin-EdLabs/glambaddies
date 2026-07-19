import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, Box, Check, DollarSign, Edit3, Eye, EyeOff, Plus, Search, ShoppingCart, Trash2, Upload, Users } from 'lucide-react'
import { EmptyState, ErrorState, LoadingGrid, CopyValue } from '../components'
import { useAuth } from '../contexts'
import api, { errorMessage, mapProduct, resolveImageUrl } from '../services/api'
import { formatCurrency } from '../utils'

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
  if (admin && localStorage.getItem('vub_admin_token')) return <Navigate to="/admin" replace />
  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setSubmitting(true)
    try {
      const fields = Object.fromEntries(new FormData(form))
      await loginAdmin({ email: fields.email, password: fields.password })
      toast.success('Welcome to Vublishop Admin')
      navigate('/admin')
    } catch (error) {
      toast.error(errorMessage(error, 'Invalid email or password'))
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="admin-login"><div className="admin-login-brand"><img src="/logo.png" alt="Vublishop" /><strong>Admin</strong></div><form onSubmit={submit}><span className="eyebrow">Store management</span><h1>Welcome back</h1><p>Sign in to manage your storefront.</p><label>Email address<input name="email" type="email" required /></label><label>Password<input name="password" type="password" required /></label><button className="button full" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'} <ArrowRight /></button><small>Protected access for Vublishop staff only.</small></form></div>
}

export function Dashboard() {
  const { data, loading, error, retry, setData } = useAdminData(
    () => Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/orders', { params: { limit: 5 } }),
      api.get('/admin/settings'),
    ]).then(([stats, orders, settings]) => ({
      stats: stats.data.stats,
      orders: orders.data.orders,
      purchases_enabled: settings.data.purchases_enabled,
    })), [],
  )
  const togglePurchases = async () => {
    const next = !data.purchases_enabled
    const previous = data
    setData({ ...data, purchases_enabled: next })
    try {
      const { data: result } = await api.put('/admin/settings', { purchases_enabled: next })
      toast.success(result.message || (next ? 'Purchases enabled' : 'Purchases paused'))
    } catch (toggleError) {
      setData(previous)
      toast.error(errorMessage(toggleError, 'Could not update store availability'))
    }
  }
  return <AdminPage title="Overview" intro="Here’s what’s happening with your store today.">{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : <>
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
    <section className="admin-card"><div className="card-head"><div><h2>Recent orders</h2><p>Latest transactions from your store</p></div><Link to="/admin/orders">View all orders <ArrowRight /></Link></div>{data.orders.length ? <OrderTable data={data.orders} /> : <EmptyState title="No orders yet" text="New orders will appear here." />}</section>
  </>}</AdminPage>
}

function Stats({ stats }) {
  return <div className="stat-grid"><Stat icon={DollarSign} title="Revenue" value={formatCurrency(Number(stats.revenue_cents) / 100)} note="Paid, shipped and delivered" /><Stat icon={ShoppingCart} title="Orders" value={Number(stats.total_orders).toLocaleString()} note={`${stats.pending_orders} pending`} /><Stat icon={Users} title="Customers" value={Number(stats.total_users).toLocaleString()} note="Registered accounts" /><Stat icon={Box} title="Active products" value={Number(stats.active_products).toLocaleString()} note="Visible in storefront" /></div>
}

function Stat({ icon: Icon, title, value, note }) {
  return <div className="stat-card"><div><span><Icon /></span><small>{title}</small></div><strong>{value}</strong><p>{note}</p></div>
}

function AdminPage({ title, intro, action, children }) {
  return <div className="admin-page"><div className="admin-title"><div><h1>{title}</h1>{intro && <p>{intro}</p>}</div>{action}</div>{children}</div>
}

export function AdminProducts() {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/admin/products', { params: { page, limit: 20 } }).then(({ data }) => ({ ...data, products: data.products.map(mapProduct) })), [page],
  )
  const products = useMemo(() => (data?.products || []).filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [data, query])
  const remove = async (id) => {
    if (!window.confirm('Delete this product? Products in past orders will be deactivated.')) return
    try {
      const { data: result } = await api.delete(`/admin/products/${id}`)
      setData({ ...data, products: data.products.filter((product) => product.id !== id), pagination: { ...data.pagination, total: data.pagination.total - 1 } })
      toast.success(result.deactivated ? 'Product deactivated' : 'Product deleted')
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete product'))
    }
  }
  return <AdminPage title="Products" intro={`${data?.pagination.total || 0} products in your catalogue`} action={<Link className="admin-button primary" to="/admin/products/new"><Plus /> Add product</Link>}><div className="admin-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this page..." /></label></div>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : products.length ? <section className="admin-card table-card"><div className="data-table"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="table-product"><img src={product.image} alt="" /><span><b>{product.name}</b><small>#{product.id}</small></span></div></td><td>{product.category}</td><td>{formatCurrency(product.price)}</td><td><span className={product.stock < 6 ? 'low-stock' : ''}>{product.stock} units</span></td><td><span className={`status ${product.is_active ? 'active' : 'draft'}`}>{product.is_active ? 'Active' : 'Draft'}</span></td><td className="row-actions"><Link to={`/admin/products/${product.id}/edit`}><Edit3 /></Link><button onClick={() => remove(product.id)}><Trash2 /></button></td></tr>)}</tbody></table></div><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No products found" text="Add a product or change your search." action="Add product" to="/admin/products/new" />}</AdminPage>
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
  const [saving, setSaving] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => Promise.all([api.get('/categories'), id ? api.get('/admin/products', { params: { limit: 100 } }) : Promise.resolve({ data: { products: [] } })]).then(([categories, products]) => ({ categories: categories.data.categories, product: products.data.products.find((item) => String(item.id) === id) || null })), [id],
  )
  const product = data?.product ? mapProduct(data.product) : null
  const productImages = Array.isArray(data?.product?.images) ? data.product.images : []
  const deleteImage = async (imageId) => {
    if (!imageId) return
    try {
      await api.delete(`/admin/products/${id}/images/${imageId}`)
      setData({ ...data, product: { ...data.product, images: data.product.images.filter((image) => image.id !== imageId) } })
      toast.success('Image deleted')
    } catch (imageError) {
      toast.error(errorMessage(imageError, 'Could not delete image'))
    }
  }
  const submit = async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    const form = new FormData(formElement)
    form.set('is_active', form.get('is_active') === 'true' ? 'true' : 'false')
    files.forEach((file) => form.append('images', file))
    try {
      await api({ method: id ? 'put' : 'post', url: id ? `/admin/products/${id}` : '/admin/products', data: form })
      toast.success(id ? 'Product updated' : 'Product created')
      navigate('/admin/products')
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save product'))
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <AdminPage title="Product"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Product"><ErrorState retry={retry} /></AdminPage>
  if (id && !product) return <AdminPage title="Product"><EmptyState title="Product not found" text="It may have been deleted." action="Back to products" to="/admin/products" /></AdminPage>
  return <AdminPage title={product ? 'Edit product' : 'Add product'} action={<div className="form-actions"><button onClick={() => navigate('/admin/products')}>Cancel</button><button className="admin-button primary" form="product-form" disabled={saving}><Check /> {saving ? 'Saving…' : 'Save product'}</button></div>}><form id="product-form" className="product-form" onSubmit={submit}><div><section className="admin-card"><h2>Basic information</h2><label>Product name<input name="name" required defaultValue={product?.name} placeholder="Enter product name" /></label><label>Description<textarea name="description" rows="6" defaultValue={product?.description} placeholder="Describe the product..." /></label><label>Category<select name="category_id" defaultValue={product?.category_id || ''}><option value="">Uncategorised</option>{data.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></section><section className="admin-card"><h2>Media</h2><label className="upload-area"><Upload /><b>Choose images to upload</b><small>PNG, JPG or WEBP. Maximum 5MB each.</small><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles([...event.target.files])} /></label><div className="category-admin-grid">{productImages.map((image) => <div className="uploaded-image" key={image.id}><img src={resolveImageUrl(image.url)} alt="" /><button type="button" onClick={() => deleteImage(image.id)}><Trash2 /></button></div>)}{files.map((file) => <div className="uploaded-image" key={`${file.name}-${file.lastModified}`}><img src={URL.createObjectURL(file)} alt="New upload preview" /></div>)}</div></section></div><aside><section className="admin-card"><h2>Pricing</h2><label>Price (USD)<input name="price" type="number" min="0" step="0.01" required defaultValue={product?.price} /></label></section><section className="admin-card"><h2>Inventory</h2><label>Quantity<input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 0} /></label></section><section className="admin-card"><h2>Status</h2><label>Product status<select name="is_active" defaultValue={String(product?.is_active ?? true)}><option value="true">Active</option><option value="false">Draft</option></select></label></section></aside></form></AdminPage>
}

const orderStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
export function AdminOrders() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, retry, setData } = useAdminData(() => api.get('/admin/orders', { params: { status: status || undefined, page, limit: 20 } }).then(({ data }) => data), [status, page])
  const updateStatus = async (id, nextStatus) => {
    const previous = data
    setData({ ...data, orders: data.orders.map((order) => order.id === id ? { ...order, status: nextStatus } : order) })
    try {
      await api.put(`/admin/orders/${id}/status`, { status: nextStatus })
      toast.success('Order status updated')
    } catch (updateError) {
      setData(previous)
      toast.error(errorMessage(updateError, 'Could not update order'))
    }
  }
  return <AdminPage title="Orders" intro="Manage and fulfil customer orders"><div className="admin-toolbar"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All status</option>{orderStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></div>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : data.orders.length ? <section className="admin-card table-card"><OrderTable data={data.orders} onStatus={updateStatus} /><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No orders found" text="Orders matching this status will appear here." />}</AdminPage>
}

function OrderTable({ data, onStatus }) {
  return <div className="data-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{data.map((order) => <tr key={order.id}><td><b>#{order.id}</b></td><td><div className="customer-cell"><span>{(order.user_name || 'C').split(' ').map((item) => item[0]).join('')}</span><div><b>{order.user_name || 'Customer'}</b><small>{order.user_email}</small></div></div></td><td>{new Date(order.created_at).toLocaleDateString()}</td><td><b>{formatCurrency(Number(order.total ?? order.total_cents / 100))}</b></td><td>{onStatus ? <select className={`status ${order.status}`} value={order.status} onChange={(event) => onStatus(order.id, event.target.value)}>{orderStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select> : <span className={`status ${order.status}`}>{order.status}</span>}</td><td><Link className="table-icon" to={`/admin/orders/${order.id}`} aria-label={`View order ${order.id}`}><Eye /></Link></td></tr>)}</tbody></table></div>
}

export function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get(`/admin/orders/${id}`).then(({ data }) => data.order), [id],
  )
  const updateStatus = async (nextStatus) => {
    const previous = data
    setData({ ...data, status: nextStatus })
    try {
      await api.put(`/admin/orders/${id}/status`, { status: nextStatus })
      toast.success('Order status updated')
    } catch (updateError) {
      setData(previous)
      toast.error(errorMessage(updateError, 'Could not update order'))
    }
  }
  if (loading) return <AdminPage title="Order"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Order"><ErrorState retry={retry} /></AdminPage>
  if (!data) return <AdminPage title="Order"><EmptyState title="Order not found" text="This order may have been removed." action="Back to orders" to="/admin/orders" /></AdminPage>
  const address = typeof data.shipping_address === 'string' ? JSON.parse(data.shipping_address) : (data.shipping_address || {})
  return <AdminPage title={`Order #${data.id}`} intro={`Placed ${new Date(data.created_at).toLocaleString()}`} action={<button className="admin-button" onClick={() => navigate('/admin/orders')}>Back to orders</button>}>
    <div className="dashboard-grid">
      <section className="admin-card">
        <div className="card-head"><div><h2>Customer</h2><p>Who placed this order</p></div></div>
        <div className="customer-cell"><span>{(data.user_name || 'C').split(' ').map((item) => item[0]).join('')}</span><div><b>{data.user_name}</b><small>{data.user_email}</small></div></div>
        <div className="stack-form" style={{ marginTop: '1.5rem' }}>
          <label>Status<select className={`status ${data.status}`} value={data.status} onChange={(event) => updateStatus(event.target.value)}>{orderStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <div><small>Order ID</small><div><CopyValue value={String(data.id)} label="Copy order id" /></div></div>
          {data.payment_reference && <div><small>Payment reference</small><div><CopyValue value={data.payment_reference} label="Copy payment reference" /></div></div>}
          <p><small>Total</small><br /><strong>{formatCurrency(Number(data.total ?? data.total_cents / 100))}</strong></p>
        </div>
      </section>
      <section className="admin-card">
        <div className="card-head"><div><h2>Shipping address</h2><p>Delivery destination</p></div></div>
        <p>{[address.first_name, address.last_name].filter(Boolean).join(' ') || data.user_name}</p>
        <p>{address.street || address.address_line1 || '—'}</p>
        <p>{[address.city, address.state, address.postal_code].filter(Boolean).join(', ') || '—'}</p>
        <p>{address.country || '—'}</p>
        {address.phone && <p>{address.phone}</p>}
      </section>
    </div>
    <section className="admin-card table-card" style={{ marginTop: '1.5rem' }}>
      <div className="card-head"><div><h2>Items</h2><p>{data.items?.length || 0} line items</p></div></div>
      <div className="data-table"><table><thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>{(data.items || []).map((item) => <tr key={item.id}><td><div className="table-product">{item.image_url ? <img src={resolveImageUrl(item.image_url)} alt="" /> : <span />} <span><b>{item.product_name}</b><small>#{item.product_id || 'snapshot'}</small></span></div></td><td>{item.quantity}</td><td>{formatCurrency(Number(item.unit_price ?? item.unit_price_cents / 100))}</td><td><b>{formatCurrency(Number(item.line_total ?? (item.unit_price_cents * item.quantity) / 100))}</b></td></tr>)}</tbody></table></div>
    </section>
  </AdminPage>
}

export function AdminCategories() {
  const [editing, setEditing] = useState(null)
  const { data: categories, loading, error, retry, setData } = useAdminData(() => api.get('/categories').then(({ data }) => data.categories), [])
  const save = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    try {
      const { data } = editing?.id ? await api.put(`/admin/categories/${editing.id}`, values) : await api.post('/admin/categories', values)
      setData(editing?.id ? categories.map((item) => item.id === editing.id ? { ...item, ...data.category } : item) : [...categories, { ...data.category, product_count: 0 }])
      setEditing(null)
      toast.success(editing?.id ? 'Category updated' : 'Category created')
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save category'))
    }
  }
  const remove = async (category) => {
    if (!window.confirm(`Delete ${category.name}? Products will become uncategorised.`)) return
    try {
      await api.delete(`/admin/categories/${category.id}`)
      setData(categories.filter((item) => item.id !== category.id))
      toast.success('Category deleted')
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete category'))
    }
  }
  return <AdminPage title="Categories" intro="Organise products into collections" action={<button className="admin-button primary" onClick={() => setEditing({})}><Plus /> Add category</button>}>{editing && <form className="admin-card stack-form" onSubmit={save}><label>Name<input name="name" required defaultValue={editing.name} /></label><label>Description<textarea name="description" defaultValue={editing.description} /></label><div className="form-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="admin-button primary">Save category</button></div></form>}{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : categories.length ? <div className="category-admin-grid">{categories.map((category) => <article className="admin-card" key={category.id}><div><span><h3>{category.name}</h3><p>{category.product_count} products</p></span><div className="row-actions"><button onClick={() => setEditing(category)}><Edit3 /></button><button onClick={() => remove(category)}><Trash2 /></button></div></div></article>)}</div> : <EmptyState title="No categories yet" text="Create a category to organise products." />}</AdminPage>
}

export function AdminCustomers() {
  const [page, setPage] = useState(1)
  const { data, loading, error, retry } = useAdminData(() => api.get('/admin/users', { params: { page, limit: 20 } }).then(({ data }) => data), [page])
  return <AdminPage title="Customers" intro={`${data?.pagination.total || 0} customer profiles`}>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : data.users.length ? <section className="admin-card table-card"><div className="data-table"><table><thead><tr><th>Customer</th><th>Orders</th><th>Joined</th></tr></thead><tbody>{data.users.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span>{customer.name.split(' ').map((item) => item[0]).join('')}</span><div><b>{customer.name}</b><small>{customer.email}</small></div></div></td><td>{customer.order_count}</td><td>{new Date(customer.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No customers yet" text="Registered customers will appear here." />}</AdminPage>
}

export function Analytics() {
  const { data: stats, loading, error, retry } = useAdminData(() => api.get('/admin/dashboard').then(({ data }) => data.stats), [])
  return <AdminPage title="Analytics" intro="Live performance totals across your storefront">{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : <><Stats stats={stats} /><section className="admin-card analytics-placeholder"><DollarSign /><h2>{formatCurrency(Number(stats.revenue_cents) / 100)} lifetime revenue</h2><p>Revenue includes orders currently paid, shipped or delivered.</p></section></>}</AdminPage>
}

export function AdminSettings() {
  const [tab, setTab] = useState('payments')
  const [saving, setSaving] = useState(false)
  const [showPublic, setShowPublic] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [liveConfirmed, setLiveConfirmed] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/admin/settings').then(({ data: settings }) => {
      setLiveConfirmed(settings.payment_mode === 'live')
      return {
        purchases_enabled: settings.purchases_enabled !== false,
        payment_mode: settings.payment_mode === 'live' ? 'live' : 'test',
        test_public: settings.paystack_test_public_key || '',
        test_secret: settings.paystack_test_secret_key || '',
        live_public: settings.paystack_live_public_key || '',
        live_secret: settings.paystack_live_secret_key || '',
      }
    }),
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
      const { data: result } = await api.put('/admin/settings', {
        payment_mode: data.payment_mode,
        paystack_test_public_key: data.test_public,
        paystack_test_secret_key: data.test_secret,
        paystack_live_public_key: data.live_public,
        paystack_live_secret_key: data.live_secret,
      })
      setData({
        purchases_enabled: result.purchases_enabled !== false,
        payment_mode: result.payment_mode === 'live' ? 'live' : 'test',
        test_public: result.paystack_test_public_key || '',
        test_secret: result.paystack_test_secret_key || '',
        live_public: result.paystack_live_public_key || '',
        live_secret: result.paystack_live_secret_key || '',
      })
      setLiveConfirmed(Boolean(result.live_confirmed))
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
      const { data: result } = await api.put('/admin/settings', { purchases_enabled: next })
      toast.success(result.message || (next ? 'Purchases enabled' : 'Purchases paused'))
    } catch (toggleError) {
      setData(previous)
      toast.error(errorMessage(toggleError, 'Could not update store availability'))
    }
  }

  return (
    <AdminPage title="Settings" intro="Manage store availability and Paystack payment keys.">
      <div className="settings-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'store'} className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}>Store</button>
        <button type="button" role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Payments</button>
      </div>

      {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : tab === 'store' ? (
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
    </AdminPage>
  )
}
