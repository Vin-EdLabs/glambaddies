export const formatCurrency = (amount = 0) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

export const classNames = (...names) => names.filter(Boolean).join(' ')

export const DRESS_CATEGORY_SLUGS = ['casual-dresses', 'party-dresses', 'school-dresses']
export const ACCESSORY_CATEGORY_SLUGS = ['bags', 'shoes', 'beauty']

export function groupCategories(categories = []) {
  const list = Array.isArray(categories) ? categories : []
  const dresses = list.filter((item) => DRESS_CATEGORY_SLUGS.includes(item.slug))
  const accessories = list.filter((item) => ACCESSORY_CATEGORY_SLUGS.includes(item.slug))
  const other = list.filter(
    (item) => !DRESS_CATEGORY_SLUGS.includes(item.slug) && !ACCESSORY_CATEGORY_SLUGS.includes(item.slug),
  )
  return { dresses, accessories, other }
}

export function formatSaleCountdown(endsAt) {
  if (!endsAt) return ''
  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return ''
  const diff = end - Date.now()
  if (diff <= 0) return 'Offer ended'
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `Offer ends in ${days}d ${hours}h`
  if (hours > 0) return `Offer ends in ${hours}h ${minutes}m`
  return `Offer ends in ${minutes}m`
}

/** Map backend order status to admin badge label */
export const orderStatusLabel = (status) => {
  const map = {
    pending: 'Pending',
    paid: 'Confirmed',
    shipped: 'Shipped',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  }
  return map[status] || status
}
