import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api, { asArray, mapProduct, resolveImageUrl } from '../services/api'
import { formatCurrency } from '../utils'

const SUGGESTIONS = [
  { label: 'New arrivals in Dresses', to: '/shop' },
  { label: 'Party dresses', to: '/shop?category=party-dresses' },
  { label: 'School dresses', to: '/shop?category=school-dresses' },
  { label: 'Girls bags and handbags', to: '/shop?category=bags' },
  { label: 'Beauty and accessories', to: '/shop?category=beauty' },
]

export function SearchOverlay({ open, onClose }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({ products: [], categories: [] })
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      setQuery('')
      setResults({ products: [], categories: [] })
      const focusTimer = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
      }, 60)
      return () => window.clearTimeout(focusTimer)
    }
    return undefined
  }, [open])

  useEffect(() => {
    if (!open && mounted) {
      setClosing(true)
      const timer = window.setTimeout(() => {
        setMounted(false)
        setClosing(false)
        setQuery('')
        setResults({ products: [], categories: [] })
      }, 180)
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

  useEffect(() => {
    if (!open) return undefined
    const value = query.trim()
    if (value.length < 1) {
      setResults({ products: [], categories: [] })
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      api.get('/products/search', { params: { q: value, limit: 5 } })
        .then(({ data }) => {
          setResults({
            products: asArray(data?.products).slice(0, 5).map(mapProduct),
            categories: asArray(data?.categories).slice(0, 3),
          })
        })
        .catch(() => setResults({ products: [], categories: [] }))
        .finally(() => setLoading(false))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [query, open])

  if (!mounted) return null

  const value = query.trim()
  const hasQuery = value.length > 0
  const empty = hasQuery && !loading && !results.products.length && !results.categories.length

  const go = (to) => {
    onClose()
    navigate(to)
  }

  const goAll = () => {
    go(value ? `/shop?q=${encodeURIComponent(value)}&search=${encodeURIComponent(value)}` : '/shop')
  }

  const submit = (event) => {
    event.preventDefault()
    goAll()
  }

  return (
    <div
      className={`search-overlay${closing ? ' is-closing' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="search-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search GlamBaddies"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {loading ? <div className="search-overlay-progress" aria-hidden="true" /> : null}

        <form className="search-overlay-top" onSubmit={submit}>
          <Search size={16} className="search-overlay-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search GlamBaddies..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
          />
          <button type="button" className="search-overlay-close" onClick={onClose} aria-label="Close search">
            ×
          </button>
        </form>

        <div className="search-overlay-body">
          {!hasQuery ? (
            <>
              <p className="search-overlay-label">Suggested</p>
              <div className="search-overlay-suggestions">
                {SUGGESTIONS.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    className="search-overlay-suggestion"
                    onClick={() => go(item.to)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {!empty ? <p className="search-overlay-label">Results</p> : null}

              {results.products.length ? (
                <div className="search-overlay-list">
                  {results.products.map((product) => {
                    const image = product.image || resolveImageUrl(product.primary_image_url) || '/logo.png'
                    return (
                      <Link
                        key={product.id}
                        to={`/products/${product.slug || product.id}`}
                        className="search-overlay-product"
                        onClick={onClose}
                      >
                        <img src={image} alt="" />
                        <span className="search-overlay-product-copy">
                          <b>{product.name}</b>
                          <small>{product.category || product.category_name || 'GlamBaddies'}</small>
                          <em className="search-overlay-price">
                            {product.oldPrice ? <del>{formatCurrency(product.oldPrice)}</del> : null}
                            <span className={product.is_on_sale ? 'sale-price' : undefined}>
                              {formatCurrency(product.price)}
                            </span>
                            {product.badge ? <span className="search-overlay-sale-tag">{product.badge}</span> : null}
                          </em>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : null}

              {results.categories.length ? (
                <>
                  <p className="search-overlay-label">In categories</p>
                  <div className="search-overlay-categories">
                    {results.categories.map((category) => (
                      <Link
                        key={category.id || category.slug}
                        to={`/shop?category=${encodeURIComponent(category.slug)}`}
                        className="search-overlay-category"
                        onClick={onClose}
                      >
                        <span>{category.name}</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}

              {empty ? (
                <div className="search-overlay-empty">
                  <p>No results for “{value}”</p>
                  <Link to="/shop" onClick={onClose}>Browse collections →</Link>
                </div>
              ) : null}

              {!empty ? (
                <button type="button" className="search-overlay-all" onClick={goAll}>
                  View all results →
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
