import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

const LEGACY_KEY = 'sweet_orders_cart'
const GUEST = 'guest'
const NONE = []
const CartContext = createContext(null)

function storageKey(owner) {
  return `sweet_orders_cart:${owner}`
}

function read(owner) {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(owner)))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(owner, items) {
  try {
    const key = storageKey(owner)
    const next = JSON.stringify(items)
    if (localStorage.getItem(key) === next) return
    if (items.length) localStorage.setItem(key, next)
    else localStorage.removeItem(key)
  } catch {
    return
  }
}

function capped(item, quantity) {
  return Math.max(1, Math.min(item.max_qty ?? 50, quantity))
}

function mergeInto(list, extra) {
  const out = [...list]
  extra.forEach((item) => {
    const i = out.findIndex((x) => x.key === item.key)
    if (i === -1) out.push(item)
    else out[i] = { ...out[i], selected: out[i].selected !== false || item.selected !== false, quantity: capped(out[i], out[i].quantity + item.quantity) }
  })
  return out
}

function adoptLegacy() {
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY))
    localStorage.removeItem(LEGACY_KEY)
    if (Array.isArray(old) && old.length) write(GUEST, mergeInto(read(GUEST), old))
  } catch {
    return
  }
}

function openCart(owner) {
  adoptLegacy()
  if (owner === GUEST) return read(GUEST)
  const guest = read(GUEST)
  if (!guest.length) return read(owner)
  const merged = mergeInto(read(owner), guest)
  write(owner, merged)
  write(GUEST, [])
  return merged
}

export function CartProvider({ children }) {
  const { user, loading } = useAuth()
  const owner = loading ? null : user ? `user-${user.id}` : GUEST
  const [cart, setCart] = useState({ owner: null, items: [] })

  if (owner !== cart.owner) {
    setCart({ owner, items: owner ? openCart(owner) : [] })
  }

  const items = cart.owner === owner ? cart.items : NONE

  useEffect(() => {
    if (cart.owner) write(cart.owner, cart.items)
  }, [cart])

  useEffect(() => {
    if (!owner) return
    const onStorage = (e) => {
      if (e.key === storageKey(owner) || e.key === null) {
        setCart({ owner, items: read(owner) })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [owner])

  const update = useCallback((fn) => {
    setCart((c) => (c.owner ? { ...c, items: fn(c.items) } : c))
  }, [])

  const add = useCallback((item) => {
    const key = [
      item.product_id,
      [...item.option_ids].sort().join('-'),
      item.cake_message || '',
      item.notes || '',
      (item.addons || []).map((a) => `${a.id}:${a.text || ''}`).join(','),
      item.design_upload_id || '',
    ].join('|')
    update((list) => {
      const found = list.find((i) => i.key === key)
      if (found) {
        return list.map((i) => (i.key === key ? { ...i, ...item, selected: true, quantity: Math.min(item.max_qty ?? 50, i.quantity + item.quantity) } : i))
      }
      return [...list, { ...item, key, selected: true, quantity: Math.min(item.max_qty ?? 50, item.quantity) }]
    })
  }, [update])

  const setQuantity = useCallback((key, quantity) => {
    update((list) => list.map((i) => (i.key === key ? { ...i, quantity: capped(i, quantity) } : i)))
  }, [update])

  const setSelected = useCallback((key, selected) => {
    update((list) => list.map((i) => (i.key === key ? { ...i, selected } : i)))
  }, [update])

  const selectAll = useCallback((selected) => {
    update((list) => list.map((i) => ({ ...i, selected })))
  }, [update])

  const remove = useCallback((key) => update((list) => list.filter((i) => i.key !== key)), [update])
  const removeKeys = useCallback((keys) => update((list) => list.filter((i) => !keys.includes(i.key))), [update])
  const clear = useCallback(() => update(() => []), [update])

  const value = useMemo(() => {
    const checkoutItems = items.filter((i) => i.selected !== false)
    const count = items.reduce((n, i) => n + i.quantity, 0)
    const checkoutCount = checkoutItems.reduce((n, i) => n + i.quantity, 0)
    const checkoutSubtotal = checkoutItems.reduce((n, i) => n + i.unit_price * i.quantity, 0)
    const checkoutLeadHours = checkoutItems.reduce((n, i) => Math.max(n, i.lead_time_hours || 0), 0)
    return {
      ready: Boolean(owner),
      items,
      count,
      checkoutItems,
      checkoutCount,
      checkoutSubtotal,
      checkoutLeadHours,
      allSelected: items.length > 0 && checkoutItems.length === items.length,
      add,
      setQuantity,
      setSelected,
      selectAll,
      remove,
      removeKeys,
      clear,
    }
  }, [owner, items, add, setQuantity, setSelected, selectAll, remove, removeKeys, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  return useContext(CartContext)
}
