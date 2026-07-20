import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, BarChart3, Box, Check, ChevronDown, Copy, Heart, LayoutDashboard, LogOut, Menu, Minus, Package, Plus, Search, Settings, ShoppingBag, Tag, Trash2, User, Users, X } from 'lucide-react'
import { useAuth, useCart } from './contexts'
import { formatCurrency } from './utils'
import api, { asArray } from './services/api'
import { ADMIN_PATH } from './adminPath'

export function CopyValue({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      toast.success('Copied')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Could not copy')
    }
  }
  return (
    <button type="button" className={`copy-chip${copied ? ' copied' : ''}`} onClick={copy} aria-label={`${label} ${value}`}>
      <span>{value}</span>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export function ProductCard({ product }) {
  const { addItem } = useCart()
  return <article className="product-card">
    <Link to={`/products/${product.slug || product.id}`} className="product-image">
      {product.badge && <span className="badge">{product.badge}</span>}
      <img src={product.image} alt={product.name} loading="lazy" />
      <button className="heart" aria-label="Save product"><Heart size={18} /></button>
    </Link>
    <div className="product-info">
      <p className="eyebrow">{product.brand || product.category}</p>
      <Link to={`/products/${product.slug || product.id}`}>{product.name}</Link>
      <div><strong>{formatCurrency(product.price)}</strong>{product.oldPrice && <del>{formatCurrency(product.oldPrice)}</del>}</div>
      <button className="quick-add" onClick={() => addItem(product)}>Quick add <Plus size={14} /></button>
    </div>
  </article>
}

export function EmptyState({ icon: Icon = Package, title, text, action, to = '/' }) {
  return <div className="empty-state"><Icon size={36} strokeWidth={1.2} /><h2>{title}</h2><p>{text}</p>{action && <Link className="button" to={to}>{action}</Link>}</div>
}

export function LoadingGrid() {
  return <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><span /></div>)}</div>
}

export function ErrorState({ retry }) {
  return <div className="empty-state"><h2>Something went wrong</h2><p>We could not load this content. Please try again.</p><button className="button" onClick={retry}>Try again</button></div>
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => { if (!busy) onCancel?.() }}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon" aria-hidden="true"><Trash2 /></div>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        {detail ? <p className="confirm-detail">{detail}</p> : null}
        <div className="confirm-actions">
          <button type="button" className="admin-button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="admin-button danger" disabled={busy} onClick={onConfirm}>
            <Trash2 /> {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function CartDrawer() {
  const { items, subtotal, isOpen, setIsOpen, removeItem, updateQuantity } = useCart()
  return <>
    <div className={`drawer-overlay ${isOpen ? 'show' : ''}`} onClick={() => setIsOpen(false)} />
    <aside className={`cart-drawer ${isOpen ? 'show' : ''}`} aria-hidden={!isOpen}>
      <div className="drawer-head"><div><span className="eyebrow">Your selection</span><h2>Shopping bag</h2></div><button className="icon-button" onClick={() => setIsOpen(false)}><X /></button></div>
      <div className="drawer-items">
        {!items.length ? <EmptyState icon={ShoppingBag} title="Your bag is empty" text="Discover pieces selected for a considered wardrobe." action="Shop new arrivals" to="/shop" /> :
          items.map((item) => <div className="cart-row" key={item.key}>
            <img src={item.image} alt="" />
            <div><span className="eyebrow">{item.brand}</span><h4>{item.name}</h4>{item.size && <p>Size {item.size}</p>}<div className="quantity"><button onClick={() => updateQuantity(item.key, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.key, item.quantity + 1)}><Plus size={13} /></button></div></div>
            <div className="cart-price"><strong>{formatCurrency(item.price * item.quantity)}</strong><button onClick={() => removeItem(item.key)}><Trash2 size={15} /></button></div>
          </div>)}
      </div>
      {!!items.length && <div className="drawer-foot"><div className="total-line"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div><p>Delivery calculated at checkout.</p><Link className="button full" to="/checkout" onClick={() => setIsOpen(false)}>Checkout <ArrowRight size={16} /></Link></div>}
    </aside>
  </>
}

export function StoreLayout() {
  const [menu, setMenu] = useState(false)
  const { count, setIsOpen } = useCart()
  const { customer } = useAuth()
  const location = useLocation()
  const category = new URLSearchParams(location.search).get('category')
  const [categories, setCategories] = useState([])
  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategories(asArray(data?.categories)))
      .catch(() => setCategories([]))
  }, [])
  const CATEGORY_ORDER = ['fashion', 'electronics', 'games', 'home-living', 'beauty', 'sports']
  const orderedCategories = asArray(categories).slice().sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.slug)
    const bi = CATEGORY_ORDER.indexOf(b.slug)
    return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi)
  })
  const navLinks = [
    { label: 'New arrivals', to: '/shop', isActive: location.pathname === '/shop' && !category },
    ...orderedCategories.map((item) => ({ label: item.name, to: `/shop?category=${encodeURIComponent(item.slug)}`, isActive: location.pathname === '/shop' && category === item.slug })),
  ]
  return <div className="store">
    <div className="announcement">Complimentary delivery on orders over $50</div>
    <header className="site-header">
      <button className="mobile-menu" onClick={() => setMenu(!menu)}><Menu /></button>
      <Link className="logo" to="/" aria-label="Vublishop home">
        <img src="/logo.png" alt="" />
        <span className="logo-wordmark">Vublishop</span>
      </Link>
      <nav className={menu ? 'open' : ''}>
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={link.isActive ? 'active' : undefined}
            onClick={() => setMenu(false)}
          >
            {link.label}
          </Link>
        ))}
        <Link className="mobile-story" to="/about" onClick={() => setMenu(false)}>Our story</Link>
        <Link className="mobile-story" to="/track-order" onClick={() => setMenu(false)}>Track order</Link>
      </nav>
      <div className="header-actions"><Link className={`header-story${location.pathname === '/about' ? ' active' : ''}`} to="/about">Our story</Link><Link className={`header-story${location.pathname === '/track-order' ? ' active' : ''}`} to="/track-order">Track order</Link><Link className="header-search" to="/shop" aria-label="Search"><Search /></Link><Link to={customer ? '/account' : '/login'} aria-label="Account"><User /></Link><button onClick={() => setIsOpen(true)} aria-label="Bag"><ShoppingBag /><span>{count}</span></button></div>
    </header>
    <main key={`${location.pathname}${location.search}`}><Outlet /></main>
    <footer><div><Link className="logo light" to="/" aria-label="Vublishop home"><img src="/logo.png" alt="Vublishop" /></Link><p>Shop better. Live better. Curated fashion, bags, games and lifestyle.</p></div><div><h4>Client services</h4><Link to="/contact">Contact us</Link><Link to="/track-order">Track order</Link><Link to="/faq">Delivery & returns</Link></div><div><h4>Discover</h4><Link to="/about">Our story</Link><Link to="/shop">New arrivals</Link><Link to="/faq">Care guide</Link></div><div><h4>Private list</h4><p>New collections, considered edits and invitations.</p><form onSubmit={(e) => e.preventDefault()}><input type="email" placeholder="Email address" aria-label="Email address" /><button><ArrowRight /></button></form></div><small>© 2026 VUBLISHOP. Worldwide.</small></footer>
    <CartDrawer />
  </div>
}

const adminNav = [
  ['Overview', ADMIN_PATH, LayoutDashboard], ['Products', `${ADMIN_PATH}/products`, Box], ['Orders', `${ADMIN_PATH}/orders`, Package],
  ['Categories', `${ADMIN_PATH}/categories`, Tag], ['Customers', `${ADMIN_PATH}/customers`, Users], ['Analytics', `${ADMIN_PATH}/analytics`, BarChart3],
  ['Settings', `${ADMIN_PATH}/settings`, Settings],
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  if (!admin || !localStorage.getItem('vub_admin_token')) return <Navigate to={`${ADMIN_PATH}/login`} replace />
  return <div className="admin-shell">
    <aside className={open ? 'open' : ''}><div className="admin-brand"><img src="/logo.png" alt="" className="admin-brand-logo" /><strong>VUBLISHOP</strong><button onClick={() => setOpen(false)}><X /></button></div><nav>{adminNav.map(([label, to, Icon]) => <NavLink to={to} key={to} end={to === ADMIN_PATH} onClick={() => setOpen(false)}><Icon />{label}</NavLink>)}</nav><button className="admin-logout" onClick={() => { logout('admin'); navigate(`${ADMIN_PATH}/login`) }}><LogOut />Sign out</button></aside>
    <section className="admin-main"><header><button className="admin-menu" onClick={() => setOpen(true)}><Menu /></button><div className="admin-search"><Search /><input placeholder="Search anything..." /></div><div className="admin-user"><span>SC</span><div><strong>{admin.name}</strong><small>Administrator</small></div><ChevronDown /></div></header><Outlet /></section>
  </div>
}
