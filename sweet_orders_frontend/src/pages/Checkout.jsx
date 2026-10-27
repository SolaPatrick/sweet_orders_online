import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { clock, longDate, peso } from '../lib/format'
import { Empty, ErrorBox, Field, Loader, Segmented } from '../components/ui'

function localDate(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Checkout() {
  const { user } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()

  const [fulfillment, setFulfillment] = useState('pickup')
  const [address, setAddress] = useState('')
  const [datesRes, setDatesRes] = useState(null)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [date, setDate] = useState('')
  const [slotsRes, setSlotsRes] = useState(null)
  const [pickedSlotId, setSlotId] = useState(null)
  const [phone, setPhone] = useState(user?.phone || '')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState('gcash')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api('/slots/dates', { query: { fulfillment, days: 14 } })
      .then((d) => {
        if (!alive) return
        setDatesRes({ fulfillment, data: d.data })
        setDeliveryFee(d.delivery_fee)
        const earliest = localDate(Date.now() + cart.leadHours * 3600 * 1000)
        const first = d.data.find((x) => !x.blocked && x.open_slots > 0 && x.date >= earliest)
        setDate((cur) => (cur && d.data.some((x) => x.date === cur && !x.blocked) ? cur : first?.date || ''))
      })
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [fulfillment, cart.leadHours])

  const slotsKey = `${date}|${fulfillment}|${cart.leadHours}`
  useEffect(() => {
    if (!date) return
    let alive = true
    api('/slots', { query: { date, fulfillment, lead_hours: cart.leadHours } })
      .then((d) => alive && setSlotsRes({ key: slotsKey, data: d.data }))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [date, fulfillment, cart.leadHours, slotsKey])

  const dates = datesRes?.fulfillment === fulfillment ? datesRes.data : null
  const slots = !date ? [] : slotsRes?.key === slotsKey ? slotsRes.data : null

  if (!cart.items.length) {
    return (
      <div className="container page">
        <h1>Checkout</h1>
        <Empty title="Your cart is empty.">
          <Link to="/menu" className="btn btn-primary">
            Browse the menu
          </Link>
        </Empty>
      </div>
    )
  }

  const earliestDay = datesRes?.earliest || ''
  const fee = fulfillment === 'delivery' ? deliveryFee : 0
  const total = cart.subtotal + fee
  const visibleSlots = (slots || []).filter((s) => !s.too_soon)
  const slotId = visibleSlots.some((s) => s.id === pickedSlotId && s.available) ? pickedSlotId : null

  const placeOrder = async (e) => {
    e.preventDefault()
    setErrors({})
    setError(null)
    const local = {}
    if (fulfillment === 'delivery' && address.trim().length < 10) local.delivery_address = 'Please enter your full delivery address.'
    if (!slotId) local.slot_id = 'Please choose a time slot.'
    if (!/^(\+639|09)\d{9}$/.test(phone.replace(/[\s-]/g, ''))) local.contact_phone = 'Enter a mobile number like 0917 123 4567.'
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    setBusy(true)
    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          fulfillment,
          slot_id: slotId,
          delivery_address: fulfillment === 'delivery' ? address : '',
          contact_phone: phone,
          notes,
          payment_method: method,
          items: cart.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            option_ids: i.option_ids,
            cake_message: i.cake_message,
            notes: i.notes,
          })),
        },
      })
      cart.clear()
      if (res.payment.mode === 'simulate') navigate(`/order-confirmed/${res.order.id}`)
      else window.location.assign(res.payment.checkout_url)
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
      if (err.status === 409) {
        api('/slots', { query: { date, fulfillment, lead_hours: cart.leadHours } }).then((d) => setSlotsRes({ key: slotsKey, data: d.data }))
      }
      setBusy(false)
    }
  }

  return (
    <div className="container page">
      <h1>Checkout</h1>
      <form className="two-col" onSubmit={placeOrder} noValidate>
        <div className="stack">
          <ErrorBox error={error} />
          <section className="card">
            <h3>1. Pickup or delivery</h3>
            <Segmented
              value={fulfillment}
              onChange={setFulfillment}
              options={[
                { value: 'pickup', label: 'Pickup at the café' },
                { value: 'delivery', label: deliveryFee ? `Delivery +${peso(deliveryFee)}` : 'Delivery' },
              ]}
            />
            {fulfillment === 'delivery' && (
              <Field label="Delivery address" error={errors.delivery_address}>
                <input value={address} placeholder="House no., street, barangay, city" onChange={(e) => setAddress(e.target.value)} />
              </Field>
            )}
          </section>

          <section className="card">
            <h3>2. Date and time slot</h3>
            {!dates ? (
              <Loader />
            ) : (
              <Segmented
                className="wrap"
                value={date}
                onChange={setDate}
                options={dates.map((d) => {
                  const tooSoon = d.date < earliestDay
                  return {
                    value: d.date,
                    label: `${longDate(d.date)}${d.blocked ? ' · Closed' : tooSoon ? ' · Too soon' : d.open_slots === 0 ? ' · Full' : ''}`,
                    disabled: d.blocked || tooSoon || d.open_slots === 0,
                  }
                })}
              />
            )}
            {slots === null ? (
              <Loader />
            ) : visibleSlots.length === 0 ? (
              <p className="muted">No open slots on this date. Please pick another date.</p>
            ) : (
              <Segmented
                className="wrap"
                value={slotId}
                onChange={setSlotId}
                options={visibleSlots.map((s) => ({
                  value: s.id,
                  label: `${clock(s.start_time)}–${clock(s.end_time)} · ${s.is_blocked ? 'Closed' : s.is_full ? 'Full' : `${s.places_left} left`}`,
                  disabled: !s.available,
                }))}
              />
            )}
            {errors.slot_id && <span className="field-error">{errors.slot_id}</span>}
            {cart.leadHours > 0 && <p className="muted small">Slots earlier than the {cart.leadHours}-hour lead time are hidden.</p>}
          </section>

          <section className="card">
            <h3>3. Contact</h3>
            <div className="grid-2">
              <Field label="Mobile number" error={errors.contact_phone}>
                <input value={phone} placeholder="0917 123 4567" onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Email">
                <input value={user?.email || ''} disabled />
              </Field>
            </div>
            <Field label="Order notes (optional)" error={errors.notes}>
              <input value={notes} maxLength={1000} placeholder="Anything we should know?" onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </section>
        </div>

        <aside className="card summary">
          <h3>Your order</h3>
          {cart.items.map((i) => (
            <div key={i.key} className="kv small">
              <span>
                {i.name} × {i.quantity}
              </span>
              <span>{peso(i.unit_price * i.quantity)}</span>
            </div>
          ))}
          {Object.entries(errors)
            .filter(([k]) => k.startsWith('items.'))
            .map(([k, v]) => (
              <span key={k} className="field-error">
                {v}
              </span>
            ))}
          <div className="kv">
            <span>Delivery fee</span>
            <span>{peso(fee)}</span>
          </div>
          <div className="kv total">
            <span>Total</span>
            <strong>{peso(total)}</strong>
          </div>
          <span className="field-label">Pay with</span>
          <Segmented
            value={method}
            onChange={setMethod}
            options={[
              { value: 'gcash', label: 'GCash' },
              { value: 'card', label: 'Card' },
            ]}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Placing order…' : `Pay ${peso(total)} with PayMongo`}
          </button>
          <p className="muted small">You will be sent to PayMongo to pay securely. The final total is checked by our server.</p>
        </aside>
      </form>
    </div>
  )
}
