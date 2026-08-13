import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, X } from 'lucide-react'
import { groupCategories } from '../utils'
import { FALLBACK_CATEGORIES } from './CollectionsDropdown'

export function MobileMenu({ open, onClose, categories = [] }) {
  const location = useLocation()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const category = new URLSearchParams(location.search).get('category')
  const source = Array.isArray(categories) && categories.length ? categories : FALLBACK_CATEGORIES
  const { dresses, accessories, other } = groupCategories(source)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      setCollectionsOpen(true)
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previous
      }
    }
    return undefined
  }, [open])

  useEffect(() => {
    if (!open && mounted) {
      setClosing(true)
      const timer = window.setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, 160)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [open, mounted])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  const shopActive = location.pathname === '/shop' && !category
  const go = () => onClose()
  const featuredImage = dresses[0]?.home_image_url
    || dresses[0]?.image_url
    || accessories[0]?.home_image_url
    || accessories[0]?.image_url
    || '/edit-party.jpg'
  const hasCollections = dresses.length || accessories.length || other.length
  const categoryActive = Boolean(category)

  return (
    <div
      className={`mobile-nav-overlay${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`mobile-nav-panel${closing ? ' is-closing' : ''}`}>
        <div className="mobile-nav-header">
          <Link to="/" className="mobile-nav-logo" onClick={go} aria-label="GlamBaddies home">
            <img src="/logo.png" alt="GlamBaddies" />
          </Link>
          <button type="button" className="mobile-nav-close" onClick={onClose} aria-label="Close menu">
            <X size={24} />
          </button>
        </div>

        <nav className="mobile-nav-body">
          <Link
            to="/shop"
            className={`mobile-nav-link${shopActive ? ' is-active' : ''}`}
            onClick={go}
          >
            <span>New arrivals</span>
            <span className="mobile-nav-arrow" aria-hidden="true">→</span>
          </Link>

          {hasCollections ? (
            <div className="mobile-collections">
              <button
                type="button"
                className={`mobile-collections-toggle${collectionsOpen ? ' is-open' : ''}${categoryActive ? ' is-active' : ''}`}
                aria-expanded={collectionsOpen}
                onClick={() => setCollectionsOpen((value) => !value)}
              >
                <span>Collections</span>
                <ChevronDown size={18} className="mobile-collections-chevron" aria-hidden="true" />
              </button>

              <div className={`mobile-collections-collapse${collectionsOpen ? ' is-open' : ''}`}>
                <div className="mobile-collections-collapse-inner">
                  <div className="mobile-collections-panel">
                    <div className="mobile-collections-columns">
                      {dresses.length ? (
                        <div className="nav-group">
                          <p className="nav-group-label">Dresses</p>
                          {dresses.map((item) => (
                            <Link
                              key={item.slug}
                              to={`/shop?category=${encodeURIComponent(item.slug)}`}
                              className={category === item.slug ? 'active' : undefined}
                              onClick={go}
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                      {(accessories.length || other.length) ? (
                        <div className="nav-group">
                          <p className="nav-group-label">{accessories.length ? 'Accessories' : 'More'}</p>
                          {[...accessories, ...other].map((item) => (
                            <Link
                              key={item.slug}
                              to={`/shop?category=${encodeURIComponent(item.slug)}`}
                              className={category === item.slug ? 'active' : undefined}
                              onClick={go}
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Link to="/shop?sort=newest" className="mobile-collections-feature" onClick={go}>
                      <img src={featuredImage} alt="" />
                      <span>New in →</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mobile-nav-divider" aria-hidden="true" />

          <Link
            to="/wishlist"
            className={`mobile-nav-link${location.pathname === '/wishlist' ? ' is-active' : ''}`}
            onClick={go}
          >
            <span>Wishlist</span>
            <span className="mobile-nav-arrow" aria-hidden="true">→</span>
          </Link>
          <Link
            to="/about"
            className={`mobile-nav-link${location.pathname === '/about' ? ' is-active' : ''}`}
            onClick={go}
          >
            <span>Our story</span>
            <span className="mobile-nav-arrow" aria-hidden="true">→</span>
          </Link>
          <Link
            to="/track-order"
            className={`mobile-nav-link${location.pathname === '/track-order' ? ' is-active' : ''}`}
            onClick={go}
          >
            <span>Track order</span>
            <span className="mobile-nav-arrow" aria-hidden="true">→</span>
          </Link>
        </nav>

        <div className="mobile-nav-footer">
          <p>Shop. Slay. Shine.</p>
          <div className="mobile-nav-social">
            <a href="https://wa.me/233547296587" target="_blank" rel="noreferrer" aria-label="WhatsApp">WhatsApp</a>
            <a href="https://snapchat.com/t/2sHB2Wxc" target="_blank" rel="noreferrer" aria-label="Snapchat">Snapchat</a>
          </div>
        </div>
      </div>
    </div>
  )
}
