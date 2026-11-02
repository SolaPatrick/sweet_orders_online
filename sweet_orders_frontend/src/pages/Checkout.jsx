import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { ALLERGEN_DISCLAIMER, isMobile, longDate, OCCASIONS, peso } from '../lib/format'
import { AllergenLine } from '../components/Allergens'
import LineExtras from '../components/LineExtras'
import VerifyEmailNotice from '../components/VerifyEmailNotice'
import { POLICY_VERSION } from '../lib/policies'
import { Empty, ErrorBox, Field, Loader, Segmented } from '../components/ui'
import SlotPicker from '../components/SlotPicker'
import ZoneCombobox from '../components/ZoneCombobox'

function hoursText(n) {
  return n === 1 ? '1 hour' : `${n} hours`
}

export default function Checkout() {
  const { user, setUser } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()

  const [fulfillment, setFulfillment] = useState('pickup')
  const [address, setAddress] = useState('')
  const [zones, setZones] = useState(null)
  const [zoneId, setZoneId] = useState(user?.last_zone_id ? String(user.last_zone_id) : '')
  const [street, setStreet] = useState(user?.last_address_street || '')
  const [landmark, setLandmark] = useState(user?.last_address_landmark || '')
  const [datesRes, setDatesRes] = useState(null)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [date, setDate] = useState('')
  const [slotsRes, setSlotsRes] = useState(null)
  const [pickedSlotId, setSlotId] = useState(null)
  const [phone, setPhone] = useState(user?.phone || '')
  const [notes, setNotes] = useState('')
  const [allergyNote, setAllergyNote] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [occasion, setOccasion] = useState('')
  const [pickupBy, setPickupBy] = useState('me')
  const [pickupName, setPickupName] = useState('')
  const [pickupPhone, setPickupPhone] = useState('')
  const [method, setMethod] = useState('gcash')
  const [payWhere, setPayWhere] = useState('online')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api('/delivery-zones')
      .then((d) => alive && setZones(d.data))
      .catch(() => alive && setZones([]))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {})
  }, [setUser])

  const productIds = [...new Set(cart.items.map((i) => i.product_id))].join(',')

  useEffect(() => {
    let alive = true
    api('/slots/dates', { query: { fulfillment, days: 27, lead_hours: cart.leadHours, product_ids: productIds } })
      .then((d) => {
        if (!alive) return
        setDatesRes({ fulfillment, days: d.days, meta: d.meta })
        setDeliveryFee(d.delivery_fee)
        setDate((cur) => (cur && d.days.some((x) => x.date === cur && x.status === 'open') ? cur : d.meta.earliest_date || ''))
      })
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [fulfillment, cart.leadHours, productIds])

  const slotsKey = `${date}|${fulfillment}|${cart.leadHours}|${productIds}`
  useEffect(() => {
    if (!date) return
    let alive = true
    api('/slots', { query: { date, fulfillment, lead_hours: cart.leadHours, product_ids: productIds } })
      .then((d) => alive && setSlotsRes({ key: slotsKey, data: d.data }))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [date, fulfillment, cart.leadHours, productIds, slotsKey])

  const dates = datesRes?.fulfillment === fulfillment ? datesRes : null
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

  const useZones = Boolean(zones?.length)
  const zone = useZones ? zones.find((z) => String(z.id) === zoneId) : null
  const minZoneFee = useZones ? Math.min(...zones.map((z) => z.fee)) : 0
  const fee = fulfillment === 'delivery' ? (useZones ? zone?.fee || 0 : deliveryFee) : 0
  const total = cart.subtotal + fee
  const visibleSlots = (slots || []).filter((s) => !s.too_soon)
  const slotId = visibleSlots.some((s) => s.id === pickedSlotId && s.available) ? pickedSlotId : null
  const slowest = dates?.meta.lead_item || [...cart.items].sort((a, b) => (b.lead_time_hours || 0) - (a.lead_time_hours || 0))[0]
  const leadHours = dates?.meta.lead_hours ?? cart.leadHours
  const earliestDate = dates?.meta.earliest_date
  const leadNote = !leadHours
    ? ''
    : earliestDate
      ? `Your ${slowest?.name || 'order'} needs ${hoursText(slowest?.lead_time_hours || leadHours)}, so the earliest is ${longDate(earliestDate)}.`
      : `Your ${slowest?.name || 'order'} needs ${hoursText(slowest?.lead_time_hours || leadHours)}. There are no open dates in the next 4 weeks.`
  const cash = fulfillment === 'pickup' && payWhere === 'cash'
  const verified = Boolean(user?.email_verified)
  const deliveryLabel = useZones ? `Delivery from ${peso(minZoneFee)}` : deliveryFee ? `Delivery +${peso(deliveryFee)}` : 'Delivery'

  const placeOrder = async (e) => {
    e.preventDefault()
    setErrors({})
    setError(null)
    const local = {}
    if (fulfillment === 'delivery') {
      if (useZones) {
        if (!zone) local.zone_id = 'Please choose your barangay.'
        if (street.trim().length < 5) local.address_street = 'Please enter your house number and street.'
      } else if (address.trim().length < 10) {
        local.delivery_address = 'Please enter your full delivery address.'
      }
    }
    if (!slotId) local.slot_id = 'Please choose a time slot.'
    if (cash && !verified) local.payment_method = 'Please verify your email first to pay at the counter.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) local.contact_email = 'Enter an email like ana@email.com.'
    if (!accepted) local.accept_policies = 'Please agree to the Terms, Cancellation policy and Privacy notice.'
    if (!isMobile(phone)) local.contact_phone = 'Enter a mobile number like 0917 123 4567.'
    if (recipientPhone.trim() && !isMobile(recipientPhone)) local.recipient_phone = 'Enter a mobile number like 0917 123 4567.'
    if (fulfillment === 'pickup' && pickupBy === 'other') {
      if (!pickupName.trim()) local.pickup_name = 'Who will pick up the order?'
      if (!isMobile(pickupPhone)) local.pickup_phone = 'Enter a mobile number like 0917 123 4567.'
    }
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    const someoneElse = fulfillment === 'pickup' && pickupBy === 'other'
    setBusy(true)
    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          fulfillment,
          slot_id: slotId,
          delivery_address: fulfillment === 'delivery' && !useZones ? address : '',
          zone_id: fulfillment === 'delivery' && useZones ? Number(zoneId) : '',
          address_street: fulfillment === 'delivery' && useZones ? street : '',
          address_landmark: fulfillment === 'delivery' && useZones ? landmark : '',
          contact_phone: phone,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          occasion,
          pickup_name: someoneElse ? pickupName : '',
          pickup_phone: someoneElse ? pickupPhone : '',
          notes,
          allergy_note: allergyNote,
          contact_email: contactEmail.trim(),
          accept_policies: accepted,
          payment_method: cash ? 'cash' : method,
          items: cart.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            option_ids: i.option_ids,
            cake_message: i.cake_message,
            notes: i.notes,
            addons: (i.addons || []).map((a) => ({ id: a.id, text: a.text || '' })),
            design_upload_id: i.design_upload_id || null,
          })),
        },
      })
      cart.clear()
      if (res.payment.mode === 'simulate' || res.payment.mode === 'cash') navigate(`/order-confirmed/${res.order.id}`)
      else window.location.assign(res.payment.checkout_url)
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
      if (err.status === 409) {
        api('/slots', { query: { date, fulfillment, lead_hours: cart.leadHours, product_ids: productIds } }).then((d) => setSlotsRes({ key: slotsKey, data: d.data }))
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
                { value: 'delivery', label: deliveryLabel },
              ]}
            />
            {fulfillment === 'delivery' && zones === null && <Loader text="Loading delivery areas…" />}
            {fulfillment === 'delivery' && zones !== null && !useZones && (
              <Field label="Delivery address" error={errors.delivery_address}>
                <input value={address} placeholder="House no., street, barangay, city" onChange={(e) => setAddress(e.target.value)} />
              </Field>
            )}
            {fulfillment === 'delivery' && useZones && (
              <div className="stack">
                <ZoneCombobox
                  zones={zones}
                  value={zoneId}
                  onChange={setZoneId}
                  label="Barangay / area"
                  hint="Type to search. We only deliver to the areas listed here."
                  error={errors.zone_id}
                />
                <Field label="House no. and street" error={errors.address_street}>
                  <input value={street} maxLength={255} placeholder="e.g. 12 Rizal St., Purok 3" onChange={(e) => setStreet(e.target.value)} />
                </Field>
                <Field label="Landmark (optional)" error={errors.address_landmark}>
                  <input value={landmark} maxLength={255} placeholder="e.g. green gate near the chapel" onChange={(e) => setLandmark(e.target.value)} />
                </Field>
              </div>
            )}
          </section>

          <section className="card">
            <h3>2. Date and time slot</h3>
            {!dates ? (
              <Loader />
            ) : (
              <SlotPicker
                key={fulfillment}
                days={dates.days}
                date={date}
                onDate={setDate}
                slots={slots && visibleSlots}
                slotId={slotId}
                onSlot={setSlotId}
                fulfillment={fulfillment}
                note={leadNote}
              />
            )}
            {errors.slot_id && <span className="field-error">{errors.slot_id}</span>}
          </section>

          <section className="card">
            <h3>3. Who is this for?</h3>
            <p className="muted small">Optional. Tell us who will receive it so we can greet them right.</p>
            <div className="grid-2">
              <Field label="Recipient name" error={errors.recipient_name}>
                <input value={recipientName} maxLength={100} placeholder="e.g. Lola Nena" onChange={(e) => setRecipientName(e.target.value)} />
              </Field>
              <Field label="Recipient mobile" error={errors.recipient_phone}>
                <input value={recipientPhone} placeholder="0917 123 4567" onChange={(e) => setRecipientPhone(e.target.value)} />
              </Field>
            </div>
            <Field label="Occasion" error={errors.occasion}>
              <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                <option value="">No special occasion</option>
                {OCCASIONS.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          {fulfillment === 'pickup' && (
            <section className="card">
              <h3>4. Who will pick up?</h3>
              <Segmented
                value={pickupBy}
                onChange={setPickupBy}
                options={[
                  { value: 'me', label: 'Me' },
                  { value: 'other', label: 'Someone else' },
                ]}
              />
              {pickupBy === 'other' ? (
                <div className="grid-2">
                  <Field label="Name of the person picking up" error={errors.pickup_name}>
                    <input value={pickupName} maxLength={100} placeholder="e.g. Maria Santos" onChange={(e) => setPickupName(e.target.value)} />
                  </Field>
                  <Field label="Their mobile number" error={errors.pickup_phone}>
                    <input value={pickupPhone} placeholder="0917 123 4567" onChange={(e) => setPickupPhone(e.target.value)} />
                  </Field>
                </div>
              ) : (
                <p className="muted small">We will hand the order to {user?.name}.</p>
              )}
              <p className="muted small">You will get a 4-digit claim code. Give it to whoever picks up; we ask for it at the counter.</p>
            </section>
          )}

          <section className="card">
            <h3>{fulfillment === 'pickup' ? '5' : '4'}. Contact</h3>
            <div className="grid-2">
              <Field label="Mobile number" error={errors.contact_phone}>
                <input value={phone} placeholder="0917 123 4567" onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Email for order updates" error={errors.contact_email}>
                <input type="email" value={contactEmail} maxLength={255} placeholder="ana@email.com" onChange={(e) => setContactEmail(e.target.value)} />
              </Field>
            </div>
            <Field label="Order notes (optional)" error={errors.notes}>
              <input value={notes} maxLength={1000} placeholder="Anything we should know?" onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Any allergies we should know? (optional)" error={errors.allergy_note} hint={`${allergyNote.length}/500`}>
              <textarea
                rows={2}
                maxLength={500}
                value={allergyNote}
                placeholder="e.g. My daughter is allergic to peanuts and tree nuts."
                onChange={(e) => setAllergyNote(e.target.value)}
              />
            </Field>
            <p className="muted small">{ALLERGEN_DISCLAIMER}</p>
          </section>
        </div>

        <aside className="card summary">
          <h3>Your order</h3>
          {cart.items.map((i) => (
            <div key={i.key} className="summary-line">
              <div className="kv small">
                <span>
                  {i.name} × {i.quantity}
                </span>
                <span>{peso(i.unit_price * i.quantity)}</span>
              </div>
              <LineExtras addons={i.addons} photoUrl={i.design_photo_url} />
              <AllergenLine allergens={i.allergens} mine={user?.allergies} />
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
            <span>{fulfillment === 'delivery' && zone ? `Delivery fee (${zone.name})` : 'Delivery fee'}</span>
            <span>{fulfillment === 'delivery' && useZones && !zone ? 'Choose your area' : peso(fee)}</span>
          </div>
          <div className="kv total">
            <span>Total</span>
            <strong>{peso(total)}</strong>
          </div>
          <span className="field-label">How will you pay?</span>
          {fulfillment === 'pickup' ? (
            <Segmented
              value={cash ? 'cash' : 'online'}
              onChange={setPayWhere}
              options={[
                { value: 'online', label: 'Pay online' },
                { value: 'cash', label: 'Pay at the counter' },
              ]}
            />
          ) : (
            <p className="muted small">Delivery orders are paid online. Cash at the counter is for pickup orders.</p>
          )}
          {!cash && (
            <Segmented
              value={method}
              onChange={setMethod}
              options={[
                { value: 'gcash', label: 'GCash' },
                { value: 'card', label: 'Card' },
              ]}
            />
          )}
          {cash && !verified && (
            <VerifyEmailNotice email={user?.email}>
              To pay in cash at the counter, please verify your email first. Open the link we sent to <strong>{user?.email}</strong>, then come back
              here. Paying online does not need this.
            </VerifyEmailNotice>
          )}
          {errors.payment_method && <span className="field-error">{errors.payment_method}</span>}
          <label className="check consent">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              I agree to the{' '}
              <a href="/policies/terms" target="_blank" rel="noreferrer">
                Terms
              </a>
              ,{' '}
              <a href="/policies/cancellation" target="_blank" rel="noreferrer">
                Cancellation policy
              </a>{' '}
              and{' '}
              <a href="/policies/privacy" target="_blank" rel="noreferrer">
                Privacy notice
              </a>{' '}
              <span className="muted">(version {POLICY_VERSION})</span>.
            </span>
          </label>
          {errors.accept_policies && <span className="field-error">{errors.accept_policies}</span>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || (cash && !verified)}>
            {busy ? 'Placing order…' : cash ? `Place order · pay ${peso(total)} at the counter` : `Pay ${peso(total)} with PayMongo`}
          </button>
          <p className="muted small">
            {cash
              ? 'Your order is confirmed right away. Pay in cash when you pick it up and show your claim code.'
              : 'You will be sent to PayMongo to pay securely. The final total is checked by our server.'}
          </p>
        </aside>
      </form>
    </div>
  )
}
