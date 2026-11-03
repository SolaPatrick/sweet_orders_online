export function peso(amount) {
  const n = Number(amount || 0)
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
}

export function pesoExact(amount) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toDate(value) {
  if (!value) return null
  return new Date(String(value).replace(' ', 'T'))
}

export function shortDate(value) {
  const d = toDate(value)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

export function longDate(value) {
  const d = toDate(value)
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
}

export function dateTime(value) {
  const d = toDate(value)
  return d
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''
}

export function dayTime(value) {
  const d = toDate(value)
  return d ? d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
}

export function timeOnly(value) {
  const d = toDate(value)
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
}

export function clock(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export function slotLabel(o) {
  return `${longDate(o.slot_date)}, ${clock(o.start_time)}–${clock(o.end_time)}`
}

export const STATUS_LABELS = {
  pending_payment: 'Pending payment',
  awaiting_cash: 'Pay at counter',
  paid: 'Paid',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const EVENT_LABELS = {
  order_placed: 'Order placed',
  payment_confirmed: 'Payment received',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
  contact: 'Contact form',
  refunded: 'Refunded',
  password_reset: 'Password reset',
  slot_conflict: 'Slot conflict alert',
  stock_short: 'Stock alert',
}

export const PAYMENT_LABELS = { unpaid: 'Unpaid', paid: 'Paid', failed: 'Failed', refunded: 'Refunded' }

export const ROLE_LABELS = { customer: 'Customer', staff: 'Staff', admin: 'Admin' }

export const OCCASIONS = [
  ['birthday', 'Birthday'],
  ['anniversary', 'Anniversary'],
  ['wedding', 'Wedding'],
  ['graduation', 'Graduation'],
  ['christening', 'Christening'],
  ['other', 'Other'],
]

export function occasionLabel(value) {
  return OCCASIONS.find(([v]) => v === value)?.[1] || value || ''
}

export const MOBILE_RE = /^(\+639|09)\d{9}$/

export function isMobile(value) {
  return MOBILE_RE.test(String(value || '').replace(/[\s-]/g, ''))
}

export function label(map, key) {
  return map[key] || (key ? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '')
}

export function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const ALLERGEN_DISCLAIMER = "Made in a kitchen that also handles nuts, eggs, dairy and wheat. We can't guarantee any item is allergen-free."

export function allergenNames(list = []) {
  return list.map((a) => a.name).join(', ')
}

export function mergeAllergens(...lists) {
  const seen = new Map()
  lists.flat().forEach((a) => a && seen.set(a.id, a))
  return [...seen.values()].sort((a, b) => a.id - b.id)
}

export function isCashOrder(order) {
  return (order?.payments || []).some((p) => p.provider === 'cash') || order?.payment_method === 'cash'
}

export function isReadyMade(product) {
  return product?.product_type === 'ready_made'
}

export function maxQuantity(product) {
  return isReadyMade(product) ? Math.min(50, product.stock_qty || 0) : 50
}

export function availability(product) {
  if (!product?.is_available) return null
  if (isReadyMade(product)) {
    return product.stock_qty > 0 ? { text: 'Available today', tone: 'paid' } : { text: 'Sold out today', tone: 'cancelled' }
  }
  if (product.sold_out_today) return { text: 'Sold out today', tone: 'warning' }
  const hours = product.lead_time_hours || 0
  if (hours >= 24) {
    const days = Math.ceil(hours / 24)
    return { text: `Order ${days} day${days === 1 ? '' : 's'} ahead`, tone: 'preparing' }
  }
  if (hours > 0) return { text: `Order ${hours} hour${hours === 1 ? '' : 's'} ahead`, tone: 'preparing' }
  return null
}

export function optionText(options = []) {
  return options.map((o) => o.option_name || o.name).join(' · ')
}

export function methodLabel(method) {
  const names = { cash: 'Cash at the counter', gcash: 'GCash', card: 'Card', paymaya: 'Maya', grab_pay: 'GrabPay', simulated: 'Test payment' }
  return method ? names[method] || method : '—'
}
