import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Fashion PDP image gallery.
 * Thumbs switch the main image only.
 * Clicking the main image opens full-screen view.
 */
export function ProductImageGallery({ images = [], alt = 'Product' }) {
  const list = (Array.isArray(images) ? images : []).filter(Boolean)
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    setActive(0)
    setLightbox(false)
  }, [list.join('|')])

  useEffect(() => {
    if (!lightbox) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setLightbox(false)
      if (event.key === 'ArrowLeft') {
        setActive((currentIndex) => (currentIndex - 1 + list.length) % list.length)
      }
      if (event.key === 'ArrowRight') {
        setActive((currentIndex) => (currentIndex + 1) % list.length)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, list.length])

  if (!list.length) {
    return (
      <div className="pig pig--empty" aria-label="No product images">
        <div className="pig__main pig__main--empty">No image</div>
      </div>
    )
  }

  const index = Math.min(active, list.length - 1)
  const current = list[index]
  const showNav = list.length > 1

  const go = (next) => {
    setActive((currentIndex) => {
      const total = list.length
      return (currentIndex + next + total) % total
    })
  }

  return (
    <div className="pig">
      <div className="pig__thumbs" role="listbox" aria-label="Product views">
        {list.map((src, i) => (
          <button
            type="button"
            key={`${src}-${i}`}
            role="option"
            aria-selected={i === index}
            className={`pig__thumb${i === index ? ' is-active' : ''}`}
            onClick={() => setActive(i)}
          >
            <img src={src} alt="" />
          </button>
        ))}
      </div>

      <div className="pig__stage">
        <button
          type="button"
          className="pig__main-hit"
          onClick={() => setLightbox(true)}
          aria-label="View full picture"
        >
          <img
            key={current}
            className="pig__image"
            src={current}
            alt={`${alt} — view ${index + 1}`}
          />
        </button>
        {showNav && (
          <>
            <button
              type="button"
              className="pig__nav pig__nav--prev"
              aria-label="Previous image"
              onClick={(event) => {
                event.stopPropagation()
                go(-1)
              }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="pig__nav pig__nav--next"
              aria-label="Next image"
              onClick={(event) => {
                event.stopPropagation()
                go(1)
              }}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {lightbox && (
        <div className="pig-lightbox" role="dialog" aria-modal="true" aria-label="Full product image">
          <button type="button" className="pig-lightbox__backdrop" aria-label="Close" onClick={() => setLightbox(false)} />
          <button type="button" className="pig-lightbox__close" aria-label="Close full view" onClick={() => setLightbox(false)}>
            <X size={22} />
          </button>
          {showNav && (
            <>
              <button type="button" className="pig-lightbox__nav pig-lightbox__nav--prev" aria-label="Previous" onClick={() => go(-1)}>
                <ChevronLeft size={26} />
              </button>
              <button type="button" className="pig-lightbox__nav pig-lightbox__nav--next" aria-label="Next" onClick={() => go(1)}>
                <ChevronRight size={26} />
              </button>
            </>
          )}
          <img src={current} alt={`${alt} full view ${index + 1}`} className="pig-lightbox__image" />
        </div>
      )}
    </div>
  )
}
