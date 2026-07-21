import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, Box, Check, DollarSign, Edit3, Eye, EyeOff, Mail, Plus, Search, ShoppingCart, Trash2, Upload, Users } from 'lucide-react'
import { EmptyState, ErrorState, LoadingGrid, CopyValue, ConfirmDialog, PasswordInput } from '../components'
import { useAuth } from '../contexts'
import api, { asArray, bustProductCache, errorMessage, mapProduct, mapProducts, resolveImageUrl } from '../services/api'
import { formatCurrency } from '../utils'
import { ADMIN_PATH } from '../adminPath'

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
  if (admin && localStorage.getItem('vub_admin_token')) return <Navigate to={ADMIN_PATH} replace />
  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setSubmitting(true)
    try {
      const fields = Object.fromEntries(new FormData(form))
      await loginAdmin({ email: fields.email, password: fields.password })
      toast.success('Welcome to Vublishop Admin')
      navigate(ADMIN_PATH)
    } catch (error) {
      toast.error(errorMessage(error, 'Invalid email or password'))
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="admin-login"><div className="admin-login-brand"><img src="/logo.png" alt="Vublishop" /><strong>Admin</strong></div><form onSubmit={submit}><span className="eyebrow">Store management</span><h1>Welcome back</h1><p>Sign in to manage your storefront.</p><label>Email address<input name="email" type="email" required /></label><label>Password<PasswordInput minLength={1} /></label><button className="button full" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'} <ArrowRight /></button><small>Protected access for Vublishop staff only.</small></form></div>
}

export function Dashboard() {
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => Promise.all([
      api.get('/vince-77-00/dashboard'),
      api.get('/vince-77-00/orders', { params: { limit: 5 } }),
      api.get('/vince-77-00/settings'),
    ]).then(([stats, orders, settings]) => ({
      stats: stats.data.stats,
      orders: asArray(orders.data?.orders),
      purchases_enabled: settings.data.purchases_enabled,
    })), [],
  )
  const togglePurchases = async () => {
    const next = !data.purchases_enabled
    const previous = data
    setData({ ...data, purchases_enabled: next })
    try {
      const { data: result } = await api.put('/vince-77-00/settings', { purchases_enabled: next })
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
      await api.post(`/vince-77-00/orders/${confirm.id}/delete`)
      toast.success('Order deleted')
      setConfirm(null)
      retry()
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete order'))
    } finally {
      setBusy(false)
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
    () => api.get('/vince-77-00/products', { params: { page, limit: 20 } }).then(({ data }) => ({ ...data, products: mapProducts(data?.products), pagination: data?.pagination || { total: 0 } })), [page],
  )
  const products = useMemo(() => asArray(data?.products).filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [data, query])
  const remove = async (id) => {
    if (!window.confirm('Delete this product? Products in past orders will be deactivated.')) return
    const targetId = String(id)
    try {
      const { data: result } = await api.delete(`/vince-77-00/products/${targetId}`)
      // Remove from local React state immediately (no page refresh needed).
      setData({
        ...data,
        products: asArray(data?.products).filter((product) => String(product.id) !== targetId),
        pagination: {
          ...data.pagination,
          total: Math.max(0, (data?.pagination?.total || 1) - 1),
        },
      })
      bustProductCache(result.revision)
      toast.success(result.deleted ? 'Product deleted' : 'Product removed from store')
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete product'))
    }
  }
  return <AdminPage title="Products" intro={`${data?.pagination.total || 0} products in your catalogue`} action={<Link className="admin-button primary" to={`${ADMIN_PATH}/products/new`}><Plus /> Add product</Link>}><div className="admin-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this page..." /></label></div>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : products.length ? <section className="admin-card table-card"><div className="data-table"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="table-product"><img src={product.image} alt="" /><span><b>{product.name}</b><small>#{product.id}</small></span></div></td><td>{product.category}</td><td>{formatCurrency(product.price)}</td><td><span className={product.stock < 6 ? 'low-stock' : ''}>{product.stock} units</span></td><td><span className={`status ${product.is_active ? 'active' : 'draft'}`}>{product.is_active ? 'Active' : 'Draft'}</span></td><td className="row-actions"><Link to={`${ADMIN_PATH}/products/${product.id}/edit`}><Edit3 /></Link><button onClick={() => remove(product.id)}><Trash2 /></button></td></tr>)}</tbody></table></div><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No products found" text="Add a product or change your search." action="Add product" to={`${ADMIN_PATH}/products/new`} />}</AdminPage>
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
    () => Promise.all([api.get('/categories'), id ? api.get('/vince-77-00/products', { params: { limit: 100 } }) : Promise.resolve({ data: { products: [] } })]).then(([categories, products]) => ({ categories: asArray(categories.data?.categories), product: mapProducts(products.data?.products).find((item) => String(item.id) === id) || null })), [id],
  )
  const product = data?.product ? mapProduct(data.product) : null
  const productImages = Array.isArray(data?.product?.images) ? data.product.images : []
  const deleteImage = async (imageId) => {
    if (!imageId) return
    try {
      await api.delete(`/vince-77-00/products/${id}/images/${imageId}`)
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
      await api({ method: id ? 'put' : 'post', url: id ? `/vince-77-00/products/${id}` : '/vince-77-00/products', data: form })
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
  return <AdminPage title={product ? 'Edit product' : 'Add product'} action={<div className="form-actions"><button onClick={() => navigate(`${ADMIN_PATH}/products`)}>Cancel</button><button className="admin-button primary" form="product-form" disabled={saving}><Check /> {saving ? 'Saving…' : 'Save product'}</button></div>}><form id="product-form" className="product-form" onSubmit={submit}><div><section className="admin-card"><h2>Basic information</h2><label>Product name<input name="name" required defaultValue={product?.name} placeholder="Enter product name" /></label><label>Description<textarea name="description" rows="6" defaultValue={product?.description} placeholder="Describe the product..." /></label><label>Category<select name="category_id" defaultValue={product?.category_id || ''}><option value="">Uncategorised</option>{asArray(data?.categories).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></section><section className="admin-card"><h2>Media</h2><label className="upload-area"><Upload /><b>Choose images to upload</b><small>PNG, JPG or WEBP. Maximum 5MB each.</small><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles([...event.target.files])} /></label><div className="category-admin-grid">{productImages.map((image) => <div className="uploaded-image" key={image.id}><img src={resolveImageUrl(image.url)} alt="" /><button type="button" onClick={() => deleteImage(image.id)}><Trash2 /></button></div>)}{files.map((file) => <div className="uploaded-image" key={`${file.name}-${file.lastModified}`}><img src={URL.createObjectURL(file)} alt="New upload preview" /></div>)}</div></section></div><aside><section className="admin-card"><h2>Pricing</h2><label>Price (USD)<input name="price" type="number" min="0" step="0.01" required defaultValue={product?.price} /></label></section><section className="admin-card"><h2>Inventory</h2><label>Quantity<input name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 0} /></label></section><section className="admin-card"><h2>Status</h2><label>Product status<select name="is_active" defaultValue={String(product?.is_active ?? true)}><option value="true">Active</option><option value="false">Draft</option></select></label></section></aside></form></AdminPage>
}

const orderStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
export function AdminOrders() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [clearing, setClearing] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/vince-77-00/orders', { params: { status: status || undefined, page, limit: 20 } })
      .then(({ data: result }) => ({
        ...result,
        orders: asArray(result?.orders),
        pagination: result?.pagination || { total: 0 },
      })),
    [status, page],
  )
  const updateStatus = async (id, nextStatus) => {
    const previous = data
    setData({ ...data, orders: asArray(data?.orders).map((order) => order.id === id ? { ...order, status: nextStatus } : order) })
    try {
      await api.put(`/vince-77-00/orders/${id}/status`, { status: nextStatus })
      toast.success('Order status updated')
    } catch (updateError) {
      setData(previous)
      toast.error(errorMessage(updateError, 'Could not update order'))
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
        const { data: result } = await api.post('/vince-77-00/orders/clear')
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
          await api.post(`/vince-77-00/orders/${confirm.id}/delete`)
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
    <div className="admin-toolbar"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All status</option>{orderStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></div>
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
  </AdminPage>
}

function OrderTable({ data, onStatus, onDelete }) {
  return <div className="data-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{asArray(data).map((order) => <tr key={order.id}><td><b>#{order.id}</b></td><td><div className="customer-cell"><span>{(order.user_name || 'C').split(' ').map((item) => item[0]).join('')}</span><div><b>{order.user_name || 'Customer'}</b><small>{order.user_email}</small></div></div></td><td>{new Date(order.created_at).toLocaleDateString()}</td><td><b>{formatCurrency(Number(order.total ?? order.total_cents / 100))}</b></td><td>{onStatus ? <select className={`status ${order.status}`} value={order.status} onChange={(event) => onStatus(order.id, event.target.value)}>{orderStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select> : <span className={`status ${order.status}`}>{order.status}</span>}</td><td><div className="row-actions"><Link className="table-icon" to={`${ADMIN_PATH}/orders/${order.id}`} aria-label={`View order ${order.id}`}><Eye /></Link>{onDelete ? <button type="button" className="table-icon danger" aria-label={`Delete order ${order.id}`} onClick={() => onDelete(order.id)}><Trash2 /></button> : null}</div></td></tr>)}</tbody></table></div>
}

export function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get(`/vince-77-00/orders/${id}`).then(({ data }) => data.order), [id],
  )
  const updateStatus = async (nextStatus) => {
    const previous = data
    setData({ ...data, status: nextStatus })
    try {
      await api.put(`/vince-77-00/orders/${id}/status`, { status: nextStatus })
      toast.success('Order status updated')
    } catch (updateError) {
      setData(previous)
      toast.error(errorMessage(updateError, 'Could not update order'))
    }
  }
  const deleteOrder = async () => {
    setDeleting(true)
    try {
      await api.post(`/vince-77-00/orders/${id}/delete`)
      toast.success('Order deleted')
      navigate(`${ADMIN_PATH}/orders`)
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete order'))
      setDeleting(false)
      setConfirmOpen(false)
    }
  }
  if (loading) return <AdminPage title="Order"><LoadingGrid /></AdminPage>
  if (error) return <AdminPage title="Order"><ErrorState retry={retry} /></AdminPage>
  if (!data) return <AdminPage title="Order"><EmptyState title="Order not found" text="This order may have been removed." action="Back to orders" to={`${ADMIN_PATH}/orders`} /></AdminPage>
  const address = typeof data.shipping_address === 'string' ? JSON.parse(data.shipping_address) : (data.shipping_address || {})
  return <AdminPage title={`Order #${data.id}`} intro={`Placed ${new Date(data.created_at).toLocaleString()}`} action={<div className="form-actions"><button type="button" className="admin-button danger" disabled={deleting} onClick={() => setConfirmOpen(true)}><Trash2 /> Delete order</button><button className="admin-button" onClick={() => navigate(`${ADMIN_PATH}/orders`)}>Back to orders</button></div>}>
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
  const { data: categories, loading, error, retry, setData } = useAdminData(() => api.get('/categories').then(({ data }) => asArray(data?.categories)), [])
  const save = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    try {
      const { data } = editing?.id ? await api.put(`/vince-77-00/categories/${editing.id}`, values) : await api.post('/vince-77-00/categories', values)
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
      await api.delete(`/vince-77-00/categories/${category.id}`)
      setData(categories.filter((item) => item.id !== category.id))
      toast.success('Category deleted')
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, 'Could not delete category'))
    }
  }
  return <AdminPage title="Categories" intro="Organise products into collections" action={<button className="admin-button primary" onClick={() => setEditing({})}><Plus /> Add category</button>}>{editing && <form className="admin-card stack-form" onSubmit={save}><label>Name<input name="name" required defaultValue={editing.name} /></label><label>Description<textarea name="description" defaultValue={editing.description} /></label><div className="form-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="admin-button primary">Save category</button></div></form>}{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : asArray(categories).length ? <div className="category-admin-grid">{asArray(categories).map((category) => <article className="admin-card" key={category.id}><div><span><h3>{category.name}</h3><p>{category.product_count} products</p></span><div className="row-actions"><button onClick={() => setEditing(category)}><Edit3 /></button><button onClick={() => remove(category)}><Trash2 /></button></div></div></article>)}</div> : <EmptyState title="No categories yet" text="Create a category to organise products." />}</AdminPage>
}

export function AdminCustomers() {
  const [page, setPage] = useState(1)
  const { data, loading, error, retry } = useAdminData(() => api.get('/vince-77-00/users', { params: { page, limit: 20 } }).then(({ data }) => data), [page])
  return <AdminPage title="Customers" intro={`${data?.pagination.total || 0} customer profiles`}>{loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : data.users.length ? <section className="admin-card table-card"><div className="data-table"><table><thead><tr><th>Customer</th><th>Orders</th><th>Joined</th></tr></thead><tbody>{data.users.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span>{customer.name.split(' ').map((item) => item[0]).join('')}</span><div><b>{customer.name}</b><small>{customer.email}</small></div></div></td><td>{customer.order_count}</td><td>{new Date(customer.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div><Pagination page={page} total={data.pagination.total} limit={20} setPage={setPage} /></section> : <EmptyState title="No customers yet" text="Registered customers will appear here." />}</AdminPage>
}

export function AdminNewsletter() {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/vince-77-00/newsletter', { params: { page, limit: 30, q: query || undefined } })
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
      await api.delete(`/vince-77-00/newsletter/${subscriber.id}`)
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
    () => api.get('/vince-77-00/analytics', { params: { days: 14 } }).then(({ data: result }) => result),
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
  const [rateSaving, setRateSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showPublic, setShowPublic] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [liveConfirmed, setLiveConfirmed] = useState(false)
  const { data, loading, error, retry, setData } = useAdminData(
    () => api.get('/vince-77-00/settings').then(({ data: settings }) => {
      setLiveConfirmed(settings.payment_mode === 'live')
      return {
        purchases_enabled: settings.purchases_enabled !== false,
        payment_mode: settings.payment_mode === 'live' ? 'live' : 'test',
        test_public: settings.paystack_test_public_key || '',
        test_secret: settings.paystack_test_secret_key || '',
        live_public: settings.paystack_live_public_key || '',
        live_secret: settings.paystack_live_secret_key || '',
        usd_to_ghs_rate: Number(settings.usd_to_ghs_rate) > 0 ? Number(settings.usd_to_ghs_rate) : 15.5,
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
      const { data: result } = await api.put('/vince-77-00/settings', {
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
      const { data: result } = await api.put('/vince-77-00/settings', { purchases_enabled: next })
      toast.success(result.message || (next ? 'Purchases enabled' : 'Purchases paused'))
    } catch (toggleError) {
      setData(previous)
      toast.error(errorMessage(toggleError, 'Could not update store availability'))
    }
  }

  const saveRate = async (event) => {
    event.preventDefault()
    if (!data || rateSaving) return
    const rate = Number(data.usd_to_ghs_rate)
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error('Enter a valid USD → GHS rate greater than 0')
      return
    }
    setRateSaving(true)
    try {
      // Prefer dedicated route; fall back to general settings if API is older.
      let result
      try {
        ({ data: result } = await api.put('/vince-77-00/settings/rate', { usd_to_ghs_rate: rate }))
      } catch (routeError) {
        if (routeError?.status !== 404) throw routeError
        ({ data: result } = await api.put('/vince-77-00/settings', { usd_to_ghs_rate: rate }))
      }
      setData({
        ...data,
        usd_to_ghs_rate: Number(result.usd_to_ghs_rate) > 0 ? Number(result.usd_to_ghs_rate) : rate,
      })
      toast.success(result.message || `USD → GHS rate updated to ${rate}`)
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save exchange rate'))
    } finally {
      setRateSaving(false)
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
      const { data: result } = await api.put('/vince-77-00/password', {
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

  return (
    <AdminPage title="Settings" intro="Account security, store availability, and payment keys.">
      <div className="settings-shell">
        <aside className="settings-nav" role="tablist" aria-label="Settings sections">
          <button type="button" role="tab" aria-selected={tab === 'account'} className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>
            <span>Account</span>
            <small>Password &amp; profile</small>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'store'} className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}>
            <span>Store</span>
            <small>Purchases &amp; rate</small>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>
            <span>Payments</span>
            <small>Paystack keys</small>
          </button>
        </aside>

        <div className="settings-panel">
          {loading ? <LoadingGrid /> : error ? <ErrorState retry={retry} /> : tab === 'account' ? (
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
              <form className="admin-card stack-form" onSubmit={saveRate}>
                <div className="card-head">
                  <div>
                    <h2>USD → GHS rate</h2>
                    <p>Reference rate stored with orders. Customers still pay in USD on Paystack.</p>
                  </div>
                </div>
                <label>
                  Exchange rate
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    required
                    value={data?.usd_to_ghs_rate ?? 15.5}
                    onChange={(event) => setData({ ...data, usd_to_ghs_rate: event.target.value })}
                    placeholder="e.g. 15.5"
                  />
                </label>
                <p className="settings-hint">1 USD = {Number(data?.usd_to_ghs_rate) || 15.5} GHS</p>
                <div className="form-actions">
                  <button type="submit" className="admin-button primary" disabled={rateSaving}>
                    <Check /> {rateSaving ? 'Saving…' : 'Save rate'}
                  </button>
                </div>
              </form>
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
