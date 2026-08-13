import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ACCESSORY_CATEGORY_SLUGS, DRESS_CATEGORY_SLUGS, groupCategories } from '../utils'

const CLOSE_DELAY_MS = 160

export const FALLBACK_CATEGORIES = [
  { id: 'fb-casual', name: 'Casual Dresses', slug: 'casual-dresses' },
  { id: 'fb-party', name: 'Party Dresses', slug: 'party-dresses' },
  { id: 'fb-school', name: 'School Dresses', slug: 'school-dresses' },
  { id: 'fb-bags', name: 'Bags', slug: 'bags' },
  { id: 'fb-shoes', name: 'Shoes', slug: 'shoes' },
  { id: 'fb-beauty', name: 'Beauty & Accessories', slug: 'beauty' },
]

export function CollectionsDropdown({ categories = [] }) {
  const location = useLocation()
  const category = new URLSearchParams(location.search).get('category')
  const source = Array.isArray(categories) && categories.length ? categories : FALLBACK_CATEGORIES
  const { dresses, accessories, other } = groupCategories(source)
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

  const dressList = dresses.length
    ? dresses
    : FALLBACK_CATEGORIES.filter((item) => DRESS_CATEGORY_SLUGS.includes(item.slug))
  const accessoryList = (accessories.length || other.length)
    ? [...accessories, ...other]
    : FALLBACK_CATEGORIES.filter((item) => ACCESSORY_CATEGORY_SLUGS.includes(item.slug))

  const featuredImage = dressList[0]?.home_image_url
    || dressList[0]?.image_url
    || accessoryList[0]?.home_image_url
    || accessoryList[0]?.image_url
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
          <div className="nav-group">
            <p className="nav-group-label">Dresses</p>
            {dressList.map((item) => (
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
          <div className="nav-group">
            <p className="nav-group-label">Accessories</p>
            {accessoryList.map((item) => (
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
        </div>
        <Link to="/shop" className="nav-collections-feature" onClick={() => setOpen(false)}>
          <img src={featuredImage} alt="" />
          <span>Shop all →</span>
        </Link>
      </div>
    </div>
  )
}
