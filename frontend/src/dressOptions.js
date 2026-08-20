/** Shared GlamBaddies dress colour options */
export const DRESS_COLORS = [
  { name: 'Black', value: '#111111' },
  { name: 'Wine', value: '#722F37' },
  { name: 'Butter yellow', value: '#F5D76E' },
  { name: 'Yellow', value: '#F4C430' },
  { name: 'White', value: '#F5F5F5' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Baby pink', value: '#F8C8DC' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Orange', value: '#FF8C00' },
  { name: 'Baby blue', value: '#89CFF0' },
  { name: 'Red', value: '#DC143C' },
  { name: 'Purple', value: '#7B2D8E' },
  { name: 'Ash', value: '#B2BEB5' },
  { name: 'Pink', value: '#e91e8c' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Leopard print', value: '#C4A484', pattern: true },
]

export const DRESS_SIZES = ['6', '8', '10', '12', '14']

/**
 * Normalize product.available_colors into { [colorName]: qty }.
 * Supports:
 * - null/undefined → null (legacy: all colours open)
 * - ["Black","Pink"] → { Black: 1, Pink: 1 } (legacy checklist)
 * - [{ name, qty|quantity|stock }] → object
 * - { Black: 3, Pink: 0 } → object
 */
export function normalizeColorStock(raw) {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const map = {}
    for (const entry of raw) {
      if (typeof entry === 'string') {
        const name = entry.trim()
        if (name) map[name] = map[name] != null ? map[name] : 1
        continue
      }
      if (entry && typeof entry === 'object') {
        const name = String(entry.name || entry.color || '').trim()
        if (!name) continue
        const qty = Number(entry.qty ?? entry.quantity ?? entry.stock ?? 0)
        map[name] = Number.isFinite(qty) && qty >= 0 ? Math.floor(qty) : 0
      }
    }
    return map
  }
  if (typeof raw === 'object') {
    const map = {}
    for (const [name, value] of Object.entries(raw)) {
      const key = String(name || '').trim()
      if (!key) continue
      const qty = Number(value)
      map[key] = Number.isFinite(qty) && qty >= 0 ? Math.floor(qty) : 0
    }
    return map
  }
  return null
}

export function getColorQty(stockMap, colorName) {
  if (stockMap == null) return null
  const qty = stockMap[colorName]
  if (qty == null) return 0
  const n = Number(qty)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

/** null map = unrestricted; otherwise qty > 0 means in stock */
export function isColorInStock(stockMap, colorName) {
  if (stockMap == null) return true
  return getColorQty(stockMap, colorName) > 0
}
