import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './brand-theme.css'
import './copy.css'
import './store-ui.css'
import './ProductImageGallery.css'
import './admin-mobile.css'
import './dark-mode.css'
import App from './App.jsx'

// GlamBaddies does not use push notifications or service workers.
// Clear any stale registrations that could break mobile/API loads.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations?.()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {})
      })
    })
    .catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
