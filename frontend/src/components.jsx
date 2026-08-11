import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, BarChart3, Box, Check, ChevronDown, Copy, Eye, EyeOff, Heart, LayoutDashboard, LogOut, Mail, Menu, Minus, Moon, Package, Plus, Search, Settings, ShoppingBag, Sun, Tag, Trash2, User, Users, X } from 'lucide-react'
import { useAuth, useCart, useTheme } from './contexts'
import { formatCurrency } from './utils'
import api, { asArray, errorMessage } from './services/api'
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

export function PasswordInput({ name = 'password', minLength = 8, autoComplete = 'current-password', placeholder }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="password-field">
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  )
}

export function ProductCard({ product }) {
  const { addItem } = useCart()
  const [imageBroken, setImageBroken] = useState(false)
  // A product without a working photo looks unprofessional — drop the card entirely.
  if (imageBroken || !product.image) return null
  return <article className="product-card">
    <Link to={`/products/${product.slug || product.id}`} className="product-image">
      {product.badge && <span className="badge">{product.badge}</span>}
      <img src={product.image} alt={product.name} loading="lazy" onError={() => setImageBroken(true)} />
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

export function CancelReasonDialog({
  open,
  orderId,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open, orderId])

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

  const trimmed = reason.trim()
  return (
    <div className="confirm-overlay" role="presentation" onClick={() => { if (!busy) onCancel?.() }}>
      <div
        className="confirm-dialog cancel-reason-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-reason-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon" aria-hidden="true"><Trash2 /></div>
        <h2 id="cancel-reason-title">Cancel order #{orderId}?</h2>
        <p>Tell the customer why this order is being cancelled. This reason is emailed and shown on their tracking page.</p>
        <label className="cancel-reason-field">
          Reason for cancellation
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            required
            placeholder="e.g. Item out of stock / customer requested cancellation"
            disabled={busy}
          />
        </label>
        <div className="confirm-actions">
          <button type="button" className="admin-button" disabled={busy} onClick={onCancel}>Keep order</button>
          <button
            type="button"
            className="admin-button danger"
            disabled={busy || trimmed.length < 3}
            onClick={() => onConfirm?.(trimmed)}
          >
            <Trash2 /> {busy ? 'Cancelling…' : 'Cancel order'}
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
            <div><span className="eyebrow">{item.brand}</span><h4>{item.name}</h4>{(item.size || item.color) && <p>{[item.color, item.size && `Size ${item.size}`].filter(Boolean).join(' · ')}</p>}<div className="quantity"><button onClick={() => updateQuantity(item.key, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.key, item.quantity + 1)}><Plus size={13} /></button></div></div>
            <div className="cart-price"><strong>{formatCurrency(item.price * item.quantity)}</strong><button onClick={() => removeItem(item.key)}><Trash2 size={15} /></button></div>
          </div>)}
      </div>
      {!!items.length && <div className="drawer-foot"><div className="total-line"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div><p>Delivery calculated at checkout.</p><Link className="button full" to="/checkout" onClick={() => setIsOpen(false)}>Checkout <ArrowRight size={16} /></Link></div>}
    </aside>
  </>
}

export function StoreLayout() {
  const [menu, setMenu] = useState(false)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterBusy, setNewsletterBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('Shop · Slay · Shine')
  const cart = useCart()
  const auth = useAuth()
  const theme = useTheme()
  const count = cart?.count || 0
  const setIsOpen = cart?.setIsOpen || (() => {})
  const customer = auth?.customer
  const isDark = theme?.isDark
  const toggleTheme = theme?.toggleTheme || (() => {})
  const location = useLocation()
  const category = new URLSearchParams(location.search).get('category')
  const [categories, setCategories] = useState([])
  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategories(asArray(data?.categories)))
      .catch(() => setCategories([]))
  }, [])
  useEffect(() => {
    api.get('/store/status')
      .then(({ data }) => {
        if (data?.announcement_text) setAnnouncement(String(data.announcement_text).slice(0, 80))
      })
      .catch(() => {})
  }, [location.pathname])
  const CATEGORY_ORDER = ['casual-dresses', 'party-dresses', 'school-dresses']
  const orderedCategories = asArray(categories)
    .filter((item) => CATEGORY_ORDER.includes(item.slug))
    .slice()
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug))
  const navLinks = [
    { label: 'New arrivals', to: '/shop', isActive: location.pathname === '/shop' && !category },
    ...orderedCategories.map((item) => ({ label: item.name, to: `/shop?category=${encodeURIComponent(item.slug)}`, isActive: location.pathname === '/shop' && category === item.slug })),
  ]
  const joinPrivateList = async (event) => {
    event.preventDefault()
    const email = newsletterEmail.trim()
    if (!email || newsletterBusy) return
    setNewsletterBusy(true)
    try {
      const { data } = await api.post('/store/newsletter', { email })
      toast.success(data.message || 'You’re on the private list')
      setNewsletterEmail('')
    } catch (joinError) {
      toast.error(errorMessage(joinError, 'Could not join the private list'))
    } finally {
      setNewsletterBusy(false)
    }
  }
  return <div className="store">
    <div className="announcement">{announcement}</div>
    <header className="site-header">
      <button className="mobile-menu" onClick={() => setMenu(!menu)}><Menu /></button>
      <Link className="logo" to="/" aria-label="GlamBaddies home">
        <img src="/logo.png" alt="" />
        <span className="logo-wordmark">GlamBaddies</span>
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
      <div className="header-actions"><Link className={`header-story${location.pathname === '/about' ? ' active' : ''}`} to="/about">Our story</Link><Link className={`header-story${location.pathname === '/track-order' ? ' active' : ''}`} to="/track-order">Track order</Link><button type="button" className="theme-toggle header-theme" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button><Link className="header-search" to="/shop" aria-label="Search"><Search /></Link><Link to={customer ? '/account' : '/login'} aria-label="Account"><User /></Link><button onClick={() => setIsOpen(true)} aria-label="Bag"><ShoppingBag /><span>{count}</span></button></div>
    </header>
    <main key={`${location.pathname}${location.search}`}><Outlet /></main>
    <footer>
      <div>
        <Link className="logo light" to="/" aria-label="GlamBaddies home">
          <img src="/logo.png" alt="GlamBaddies" />
        </Link>
        <p>Shop the latest girls&apos; dresses — curated for every occasion.</p>
        <div className="footer-social">
          <p className="footer-social-label">Connect with us</p>
          <div className="footer-social-row">
            <a
              className="footer-social-link whatsapp"
              href="https://wa.me/233547296587"
              target="_blank"
              rel="noreferrer"
              aria-label="Chat on WhatsApp"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.27-.71.9-.87 1.08-.16.18-.32.2-.6.07-.27-.14-1.15-.42-2.2-1.35-.81-.72-1.36-1.61-1.52-1.88-.16-.27-.02-.42.12-.55.13-.13.28-.32.42-.49.14-.16.18-.27.28-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3s.99 2.67 1.12 2.85c.14.18 1.95 2.98 4.72 4.18.66.28 1.18.45 1.58.58.66.21 1.27.18 1.75.11.53-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.11-.25-.18-.53-.32zM12.05 21.8h-.01a9.78 9.78 0 0 1-4.97-1.36l-.36-.21-3.7.97 1-3.61-.24-.37a9.76 9.76 0 0 1-1.5-5.2 9.8 9.8 0 0 1 9.8-9.79c2.62 0 5.08 1.02 6.93 2.87a9.73 9.73 0 0 1 2.87 6.93 9.8 9.8 0 0 1-9.82 9.77zm8.4-17.4A11.5 11.5 0 0 0 12.04 0C5.45 0 .1 5.35.1 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.26-1.64a11.9 11.9 0 0 0 5.77 1.47h.01c6.59 0 11.94-5.35 11.94-11.94 0-3.19-1.24-6.19-3.5-8.44z"/></svg>
              <span>WhatsApp</span>
            </a>
            <a
              className="footer-social-link snapchat"
              href="https://snapchat.com/t/2sHB2Wxc"
              target="_blank"
              rel="noreferrer"
              aria-label="Follow on Snapchat"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.07 2c-2.8 0-4.2 2.12-4.2 4.3v1.4c0 .2-.08.84-.9 1.02-.42.1-.7.34-.7.72 0 .34.26.58.7.74.92.34 1.58 1.08 1.66 2.02.02.22-.1.38-.34.52-.78.46-1.9 1.12-1.9 2.1 0 1.12 1.24 1.7 2.54 2.04.24.06.42.28.42.54 0 .1-.02.2-.06.28-.26.5-.86 1.14-1.84 1.14-.18 0-.36-.02-.54-.06-.34-.08-.66.16-.66.5 0 .62 1.3 1.14 3.16 1.14 1.68 0 2.96-.4 3.78-.9.16-.1.34-.1.5 0 .82.5 2.1.9 3.78.9 1.86 0 3.16-.52 3.16-1.14 0-.34-.32-.58-.66-.5-.18.04-.36.06-.54.06-.98 0-1.58-.64-1.84-1.14a.7.7 0 0 0-.06-.28c0-.26.18-.48.42-.54 1.3-.34 2.54-.92 2.54-2.04 0-.98-1.12-1.64-1.9-2.1-.24-.14-.36-.3-.34-.52.08-.94.74-1.68 1.66-2.02.44-.16.7-.4.7-.74 0-.38-.28-.62-.7-.72-.82-.18-.9-.82-.9-1.02V6.3c0-2.18-1.4-4.3-4.2-4.3h-.14z"/></svg>
              <span>Snapchat</span>
            </a>
            <span className="footer-social-link tiktok is-pending" title="TikTok coming soon" aria-label="TikTok coming soon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.16 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.2 8.2 0 0 0 4.8 1.54V6.84a4.84 4.84 0 0 1-1.05-.15z"/></svg>
              <span>TikTok</span>
            </span>
          </div>
          <a className="footer-phone" href="https://wa.me/233547296587">+233 54 729 6587</a>
        </div>
      </div>
      <div>
        <h4>Client services</h4>
        <Link to="/contact">Contact us</Link>
        <Link to="/track-order">Track order</Link>
        <Link to="/faq">Delivery & returns</Link>
      </div>
      <div>
        <h4>Discover</h4>
        <Link to="/about">Our story</Link>
        <Link to="/shop">New arrivals</Link>
        <Link to="/faq">Care guide</Link>
      </div>
      <div>
        <h4>Private list</h4>
        <p>New dress drops, considered edits and invitations.</p>
        <form onSubmit={joinPrivateList}>
          <input type="email" name="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="Email address" aria-label="Email address" required autoComplete="email" disabled={newsletterBusy} />
          <button type="submit" aria-label="Join private list" disabled={newsletterBusy}><ArrowRight /></button>
        </form>
      </div>
      <small>© 2026 GlamBaddies. Girls&apos; fashion.</small>
    </footer>
    <CartDrawer />
  </div>
}

const adminNav = [
  { label: 'Dashboard', to: ADMIN_PATH, icon: LayoutDashboard, end: true },
  { label: 'Products', to: `${ADMIN_PATH}/products`, icon: Box },
  { label: 'Orders', to: `${ADMIN_PATH}/orders`, icon: Package },
  { label: 'Customers', to: `${ADMIN_PATH}/customers`, icon: Users },
  { label: 'Promotions', to: `${ADMIN_PATH}/promotions`, icon: Mail },
  { label: 'Settings', to: `${ADMIN_PATH}/settings`, icon: Settings },
]

const adminSecondaryNav = [
  { label: 'Categories', to: `${ADMIN_PATH}/categories`, icon: Tag },
  { label: 'Analytics', to: `${ADMIN_PATH}/analytics`, icon: BarChart3 },
]

function adminInitials(name = 'A') {
  return String(name).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'GB'
}

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { admin, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  if (!admin || !(localStorage.getItem('glam_admin_token') || localStorage.getItem('vub_admin_token'))) {
    return <Navigate to={`${ADMIN_PATH}/login`} replace />
  }

  const crumbs = location.pathname
    .replace(ADMIN_PATH, '')
    .split('/')
    .filter(Boolean)
  const crumbLabel = crumbs.length
    ? crumbs.map((part) => part.replace(/-/g, ' ')).join(' / ')
    : 'Dashboard'

  return (
    <div className={`admin-shell${open ? ' menu-open' : ''}`}>
      {open ? <button type="button" className="admin-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside className={open ? 'open' : ''}>
        <div className="admin-brand">
          <img src="/logo.png" alt="" className="admin-brand-logo" />
          <strong>GlamBaddies</strong>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav aria-label="Admin">
          <p className="admin-nav-section">Main</p>
          {adminNav.map(({ label, to, icon: Icon, end }) => (
            <NavLink to={to} key={to} end={Boolean(end)} onClick={() => setOpen(false)}>
              <Icon />{label}
            </NavLink>
          ))}
          <p className="admin-nav-section">More</p>
          {adminSecondaryNav.map(({ label, to, icon: Icon }) => (
            <NavLink to={to} key={to} onClick={() => setOpen(false)}>
              <Icon />{label}
            </NavLink>
          ))}
        </nav>
        <button className="admin-logout" type="button" onClick={() => { logout('admin'); navigate(`${ADMIN_PATH}/login`) }}>
          <LogOut />Sign out
        </button>
      </aside>
      <section className="admin-main">
        <header>
          <button className="admin-menu" type="button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="admin-brand-inline">
            <img src="/logo.png" alt="" />
            <span>GlamBaddies</span>
          </div>
          <div className="admin-search"><Search /><input placeholder="Search products, orders..." /></div>
          <div className="admin-user">
            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span>{adminInitials(admin.name)}</span>
            <div><strong>{admin.name}</strong><small>Administrator</small></div>
            <ChevronDown />
          </div>
        </header>
        <div className="admin-breadcrumbs" aria-label="Breadcrumb">
          <Link to={ADMIN_PATH}>Admin</Link>
          <span>/</span>
          <span className="current">{crumbLabel}</span>
        </div>
        <Outlet />
      </section>
    </div>
  )
}
