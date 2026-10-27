import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CART_KEY = 'sweet_orders_cart'
const CartContext = createContext(null)

function load() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load)

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items])

  const add = useCallback((item) => {
    const key = [item.product_id, [...item.option_ids].sort().join('-'), item.cake_message || '', item.notes || ''].join('|')
    setItems((list) => {
      const found = list.find((i) => i.key === key)
      if (found) {
        return list.map((i) => (i.key === key ? { ...i, quantity: Math.min(50, i.quantity + item.quantity) } : i))
      }
      return [...list, { ...item, key }]
    })
  }, [])

  const setQuantity = useCallback((key, quantity) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(50, quantity)) } : i)))
  }, [])

  const remove = useCallback((key) => setItems((list) => list.filter((i) => i.key !== key)), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0)
    const subtotal = items.reduce((n, i) => n + i.unit_price * i.quantity, 0)
    const leadHours = items.reduce((n, i) => Math.max(n, i.lead_time_hours || 0), 0)
    return { items, count, subtotal, leadHours, add, setQuantity, remove, clear }
  }, [items, add, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  return useContext(CartContext)
}
