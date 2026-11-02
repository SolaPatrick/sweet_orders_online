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

export function optionText(options = []) {
  return options.map((o) => o.option_name || o.name).join(' · ')
}

export function methodLabel(method) {
  const names = { gcash: 'GCash', card: 'Card', paymaya: 'Maya', grab_pay: 'GrabPay', simulated: 'Test payment' }
  return method ? names[method] || method : '—'
}
