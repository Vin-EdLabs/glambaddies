import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { groupCategories } from '../utils'

const CLOSE_DELAY_MS = 160

export function CollectionsDropdown({ categories = [] }) {
  const location = useLocation()
  const category = new URLSearchParams(location.search).get('category')
  const { dresses, accessories, other } = groupCategories(categories)
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(0)
  const rootRef = useRef(null)

  const clearClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = 0
    }
  }

  const scheduleClose = () => {
    clearClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  useEffect(() => () => clearClose(), [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  if (!dresses.length && !accessories.length && !other.length) return null

  const featuredImage = dresses[0]?.home_image_url
    || dresses[0]?.image_url
    || accessories[0]?.home_image_url
    || accessories[0]?.image_url
    || '/edit-party.jpg'

  return (
    <div
      ref={rootRef}
      className={`nav-collections${open ? ' is-open' : ''}`}
      onMouseEnter={() => {
        clearClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        clearClose()
        setOpen(true)
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) scheduleClose()
      }}
    >
      <button
        type="button"
        className={`nav-collections-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        Collections
      </button>
      <div
        className="nav-collections-panel"
        hidden={!open}
        onMouseEnter={() => {
          clearClose()
          setOpen(true)
        }}
        onMouseLeave={scheduleClose}
      >
        <div className="nav-collections-columns">
          {dresses.length ? (
            <div className="nav-group">
              <p className="nav-group-label">Dresses</p>
              {dresses.map((item) => (
                <Link
                  key={item.slug}
                  to={`/shop?category=${encodeURIComponent(item.slug)}`}
                  className={category === item.slug ? 'active' : undefined}
                  onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        <Link to="/shop?sort=newest" className="nav-collections-feature" onClick={() => setOpen(false)}>
          <img src={featuredImage} alt="" />
          <span>New in →</span>
        </Link>
      </div>
    </div>
  )
}
