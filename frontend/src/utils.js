export const formatCurrency = (amount = 0) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

export const classNames = (...names) => names.filter(Boolean).join(' ')

/** Map backend order status to admin badge label */
export const orderStatusLabel = (status) => {
  const map = {
    pending: 'Pending',
    paid: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  }
  return map[status] || status
}
