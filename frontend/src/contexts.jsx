import { createContext, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from './services/api'

const CartContext = createContext(null)
const AuthContext = createContext(null)

const readCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('vub_cart')) || []
    return saved.map((item) => item.price > 1000
      ? { ...item, price: item.price / 1000, oldPrice: item.oldPrice ? item.oldPrice / 1000 : undefined }
      : item)
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart)
  const [isOpen, setIsOpen] = useState(false)

  const commit = (next) => {
    setItems(next)
    localStorage.setItem('vub_cart', JSON.stringify(next))
  }

  const addItem = (product, size = product.sizes?.[0]) => {
    const key = `${product.id}${size ? `-${size}` : ''}`
    const found = items.find((item) => item.key === key)
    const snapshot = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: Number(product.price),
      image: product.image,
      stock: product.stock,
    }
    commit(found
      ? items.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item)
      : [...items, { ...snapshot, key, size, quantity: 1 }])
    toast.success(`${product.name} added to bag`)
    setIsOpen(true)
  }
  const removeItem = (key) => commit(items.filter((item) => item.key !== key))
  const updateQuantity = (key, quantity) => quantity < 1
    ? removeItem(key)
    : commit(items.map((item) => item.key === key ? { ...item, quantity } : item))
  const clearCart = () => commit([])
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const value = { items, count, subtotal, isOpen, setIsOpen, addItem, removeItem, updateQuantity, clearCart }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(() => JSON.parse(localStorage.getItem('vub_customer') || 'null'))
  const [admin, setAdmin] = useState(() => JSON.parse(localStorage.getItem('vub_admin') || 'null'))

  useEffect(() => {
    if (!localStorage.getItem('vub_customer_token')) return
    api.get('/auth/me').then(({ data }) => {
      localStorage.setItem('vub_customer', JSON.stringify(data.user))
      setCustomer(data.user)
    }).catch(() => setCustomer(null))
  }, [])

  const loginCustomer = async (details = {}, register = false) => {
    const { data } = await api.post(register ? '/auth/register' : '/auth/login', details)
    localStorage.setItem('vub_customer_token', data.token)
    localStorage.setItem('vub_customer', JSON.stringify(data.user))
    setCustomer(data.user)
    return data.user
  }
  const loginAdmin = async (details = {}) => {
    const { data } = await api.post('/admin/login', details)
    localStorage.setItem('vub_admin_token', data.token)
    localStorage.setItem('vub_admin', JSON.stringify(data.admin))
    setAdmin(data.admin)
    return data.admin
  }
  const logout = (type = 'customer') => {
    localStorage.removeItem(`vub_${type}_token`)
    localStorage.removeItem(`vub_${type}`)
    if (type === 'admin') setAdmin(null)
    else setCustomer(null)
  }

  return <AuthContext.Provider value={{ customer, admin, loginCustomer, loginAdmin, logout }}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export const useCart = () => useContext(CartContext)
// oxlint-disable-next-line react/only-export-components
export const useAuth = () => useContext(AuthContext)
