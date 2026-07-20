import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AdminLayout, StoreLayout } from './components'
import { AuthProvider, CartProvider } from './contexts'
import { ADMIN_PATH } from './adminPath'
import { About, Account, Checkout, Home, InfoPage, Login, NotFound, OrderConfirmation, ProductDetail, Shop, TrackOrder } from './pages/StorePages'
import { AdminCategories, AdminCustomers, AdminLogin, AdminOrderDetail, AdminOrders, AdminProducts, AdminSettings, Analytics, Dashboard, ProductForm } from './pages/AdminPages'

function SmoothScrollManager() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior = reduceMotion ? 'auto' : 'smooth'

    if (hash) {
      requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior, block: 'start' })
      })
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior })
  }, [pathname, search, hash])

  return null
}

export default function App() {
  return <BrowserRouter><AuthProvider><CartProvider>
    <SmoothScrollManager />
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order-confirmation" element={<OrderConfirmation />} />
        <Route path="track-order" element={<TrackOrder />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Login register />} />
        <Route path="account" element={<Account />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<InfoPage type="contact" />} />
        <Route path="faq" element={<InfoPage type="faq" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path={`${ADMIN_PATH}/login`} element={<AdminLogin />} />
      <Route path={ADMIN_PATH} element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      {/* Old /admin URLs are retired — send visitors to the store. */}
      <Route path="/admin/*" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
    </Routes>
    <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
  </CartProvider></AuthProvider></BrowserRouter>
}
