import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { ALLERGEN_DISCLAIMER, isMobile, isReadyMade, longDate, maxQuantity, mergeAllergens, peso, pesoExact } from '../../lib/format'
import { AllergenLine } from '../../components/Allergens'
import LineExtras from '../../components/LineExtras'
import SlotPicker from '../../components/SlotPicker'
import ZoneCombobox from '../../components/ZoneCombobox'
import { Empty, ErrorBox, Field, Loader, QuantityStepper, Segmented, useApi } from '../../components/ui'

const GROUPS = ['size', 'flavor', 'frosting']

function Configure({ product, onAdd, onCancel }) {
  const groups = useMemo(
    () => GROUPS.map((g) => ({ group: g, options: product.options.filter((o) => o.option_group === g) })).filter((g) => g.options.length),
    [product],
  )
  const [chosen, setChosen] = useState(() => Object.fromEntries(groups.map((g) => [g.group, g.options[0].id])))
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [addonPick, setAddonPick] = useState({})
  const customizable = Boolean(product.is_customizable)
  const addonsApi = useApi(customizable ? '/addons' : null)
  const addonList = addonsApi.data?.data || []
  const picked = addonList
    .filter((a) => addonPick[a.id])
    .map((a) => ({ id: a.id, name: a.name, price: a.price, text: a.has_text ? addonPick[a.id].text.trim() : '' }))
  const selected = groups.map((g) => g.options.find((o) => o.id === chosen[g.group])).filter(Boolean)
  const unit = product.base_price + selected.reduce((n, o) => n + o.price_add, 0) + picked.reduce((n, a) => n + a.price, 0)

  const toggle = (a, on) =>
    setAddonPick((p) => {
      const next = { ...p }
      if (on) next[a.id] = { text: '' }
      else delete next[a.id]
      return next
    })

  return (
    <section className="card stack new-order-config">
      <div className="row between">
        <h3>{product.name}</h3>
        <strong>{peso(unit)}</strong>
      </div>
      {groups.map((g) => (
        <div key={g.group} className="option-group">
          <span className="field-label">{g.group[0].toUpperCase() + g.group.slice(1)}</span>
          <Segmented
            className="wrap"
            value={chosen[g.group]}
            onChange={(v) => setChosen((c) => ({ ...c, [g.group]: v }))}
            options={g.options.map((o) => ({ value: o.id, label: o.price_add ? `${o.name} +${peso(o.price_add)}` : o.name }))}
          />
        </div>
      ))}
      {customizable && (
        <Field label="Cake message (optional)">
          <input maxLength={100} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
      )}
      {customizable && addonList.length > 0 && (
        <fieldset className="addon-picker">
          <legend className="field-label">Add-ons (per cake)</legend>
          {addonList.map((a) => (
            <div key={a.id} className="addon-row">
              <label className="check">
                <input type="checkbox" checked={!!addonPick[a.id]} onChange={(e) => toggle(a, e.target.checked)} />
                {a.name} <span className="muted">+{peso(a.price)}</span>
              </label>
              {a.has_text && addonPick[a.id] ? (
                <input
                  maxLength={150}
                  value={addonPick[a.id].text}
                  aria-label={`${a.name} message`}
                  onChange={(e) => setAddonPick((p) => ({ ...p, [a.id]: { text: e.target.value } }))}
                />
              ) : null}
            </div>
          ))}
        </fieldset>
      )}
      <Field label="Notes for the baker (optional)">
        <input maxLength={255} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="row between wrap">
        <QuantityStepper value={quantity} onChange={setQuantity} max={50} />
        <div className="row">
          <button type="button" className="btn btn-light btn-small" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() =>
              onAdd({
                product_id: product.id,
                name: product.name,
                unit_price: unit,
                quantity,
                max_qty: 50,
                ready_made: false,
                lead_time_hours: product.lead_time_hours,
                option_ids: selected.map((o) => o.id),
                option_labels: selected.map((o) => o.name),
                cake_message: customizable ? message.trim() : '',
                notes: notes.trim(),
                addons: picked,
                allergens: mergeAllergens(product.allergens || [], ...selected.map((o) => o.allergens || [])),
              })
            }
          >
            Add · {peso(unit * quantity)}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function NewOrder() {
  const navigate = useNavigate()
  const productsApi = useApi('/products', { available: 1, per_page: 100, sort: 'name' })
  const [search, setSearch] = useState('')
  const [configuring, setConfiguring] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const [lines, setLines] = useState([])
  const [nextKey, setNextKey] = useState(1)
  const [source, setSource] = useState('walk_in')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [when, setWhen] = useState('now')
  const [fulfillment, setFulfillment] = useState('pickup')
  const [zones, setZones] = useState(null)
  const [zoneId, setZoneId] = useState('')
  const [street, setStreet] = useState('')
  const [landmark, setLandmark] = useState('')
  const [address, setAddress] = useState('')
  const [datesRes, setDatesRes] = useState(null)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [date, setDate] = useState('')
  const [slotsRes, setSlotsRes] = useState(null)
  const [pickedSlotId, setSlotId] = useState(null)
  const [payment, setPayment] = useState('cash_now')
  const [received, setReceived] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [allergyNote, setAllergyNote] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const takeNow = source === 'walk_in' && when === 'now'
  const type = takeNow ? 'pickup' : fulfillment
  const leadHours = Math.max(0, ...lines.map((l) => l.lead_time_hours || 0))
  const productIds = [...new Set(lines.map((l) => l.product_id))].join(',')
  const madeToOrder = lines.filter((l) => !l.ready_made)

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
    if (takeNow) return
    let alive = true
    api('/slots/dates', { query: { fulfillment: type, days: 27, lead_hours: leadHours, product_ids: productIds } })
      .then((d) => {
        if (!alive) return
        setDatesRes({ type, days: d.days, meta: d.meta })
        setDeliveryFee(d.delivery_fee)
        setDate((cur) => (cur && d.days.some((x) => x.date === cur && x.status === 'open') ? cur : d.meta.earliest_date || ''))
      })
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [takeNow, type, leadHours, productIds])

  const slotsKey = `${date}|${type}|${leadHours}|${productIds}`
  useEffect(() => {
    if (takeNow || !date) return
    let alive = true
    api('/slots', { query: { date, fulfillment: type, lead_hours: leadHours, product_ids: productIds } })
      .then((d) => alive && setSlotsRes({ key: slotsKey, data: d.data }))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [takeNow, date, type, leadHours, productIds, slotsKey])

  const dates = datesRes?.type === type ? datesRes : null
  const slots = !date ? [] : slotsRes?.key === slotsKey ? slotsRes.data : null
  const visibleSlots = (slots || []).filter((s) => !s.too_soon)
  const slotId = visibleSlots.some((s) => s.id === pickedSlotId && s.available) ? pickedSlotId : null

  const useZones = Boolean(zones?.length)
  const zone = useZones ? zones.find((z) => String(z.id) === zoneId) : null
  const fee = type === 'delivery' ? (useZones ? zone?.fee || 0 : deliveryFee) : 0
  const subtotal = lines.reduce((n, l) => n + l.unit_price * l.quantity, 0)
  const total = subtotal + fee
  const mustPayNow = takeNow || type === 'delivery'
  const cashNow = mustPayNow || payment === 'cash_now'
  const amount = Number(received)
  const change = cashNow && received !== '' && amount >= total ? amount - total : 0

  const products = (productsApi.data?.data || []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))

  const addLine = (line) => {
    setLines((cur) => [...cur, { ...line, key: nextKey }])
    setNextKey((k) => k + 1)
    setConfiguring(null)
  }

  const choose = async (product) => {
    setError(null)
    if (isReadyMade(product)) {
      const existing = lines.find((l) => l.product_id === product.id)
      const max = maxQuantity(product)
      if (existing) {
        setLines((cur) => cur.map((l) => (l.key === existing.key ? { ...l, quantity: Math.min(l.quantity + 1, max) } : l)))
        return
      }
      addLine({
        product_id: product.id,
        name: product.name,
        unit_price: product.base_price,
        quantity: 1,
        max_qty: max,
        ready_made: true,
        lead_time_hours: product.lead_time_hours,
        option_ids: [],
        option_labels: [],
        cake_message: '',
        notes: '',
        addons: [],
        allergens: product.allergens || [],
      })
      return
    }
    setLoadingId(product.id)
    try {
      const res = await api(`/products/${product.id}`)
      setConfiguring(res.data)
    } catch (err) {
      setError(err)
    }
    setLoadingId(null)
  }

  const save = async (e) => {
    e.preventDefault()
    setErrors({})
    setError(null)
    const local = {}
    if (!name.trim()) local.customer_name = 'Enter the customer name.'
    if (phone.trim() ? !isMobile(phone) : !takeNow) local.contact_phone = 'Enter a mobile number like 0917 123 4567.'
    if (!lines.length) local.items = 'Add at least one product.'
    if (takeNow && madeToOrder.length) local.items = `${madeToOrder[0].name} is made to order, so pick a time slot.`
    if (!takeNow && !slotId) local.slot_id = 'Please choose a time slot.'
    if (type === 'delivery') {
      if (useZones) {
        if (!zone) local.zone_id = 'Please choose the barangay.'
        if (street.trim().length < 5) local.address_street = 'Please enter the house number and street.'
      } else if (address.trim().length < 10) {
        local.delivery_address = 'Please enter the full delivery address.'
      }
    }
    if (cashNow && (received === '' || amount < total)) local.amount_received = `Enter at least ${pesoExact(total)}.`
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    setBusy(true)
    try {
      const res = await api('/admin/orders', {
        method: 'POST',
        body: {
          source,
          customer_name: name,
          contact_phone: phone,
          contact_email: email.trim(),
          take_now: takeNow,
          fulfillment: type,
          slot_id: takeNow ? '' : slotId,
          zone_id: type === 'delivery' && useZones ? Number(zoneId) : '',
          address_street: type === 'delivery' && useZones ? street : '',
          address_landmark: type === 'delivery' && useZones ? landmark : '',
          delivery_address: type === 'delivery' && !useZones ? address : '',
          payment: cashNow ? 'cash_now' : 'pay_at_pickup',
          amount_received: cashNow ? amount : '',
          reference: cashNow ? reference : '',
          notes,
          allergy_note: allergyNote,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            option_ids: l.option_ids,
            cake_message: l.cake_message,
            notes: l.notes,
            addons: l.addons.map((a) => ({ id: a.id, text: a.text || '' })),
          })),
        },
      })
      navigate(`/admin/orders/${res.data.id}`)
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={save} noValidate>
      <div>
        <h1>New order</h1>
        <span className="muted">For customers at the counter or on the phone. Prices are checked by the server when you save.</span>
      </div>
      <ErrorBox error={error} />
      <div className="two-col wide-left">
        <div className="stack">
          <section className="card stack">
            <h3>1. Products</h3>
            <Field label="Search">
              <input type="search" value={search} placeholder="Product name" onChange={(e) => setSearch(e.target.value)} />
            </Field>
            {productsApi.loading ? (
              <Loader />
            ) : productsApi.error ? (
              <ErrorBox error={productsApi.error} onRetry={productsApi.reload} />
            ) : products.length === 0 ? (
              <Empty title="No products match." />
            ) : (
              <div className="new-order-products">
                {products.map((p) => {
                  const ready = isReadyMade(p)
                  const soldOut = ready && maxQuantity(p) === 0
                  return (
                    <button key={p.id} type="button" className="new-order-product" disabled={soldOut || loadingId === p.id} onClick={() => choose(p)}>
                      <span>
                        <strong>{p.name}</strong>
                        <span className="muted small">
                          {ready ? (soldOut ? 'Sold out' : `Ready-made · ${maxQuantity(p)} left`) : `Made to order · ${p.lead_time_hours} hours`}
                        </span>
                      </span>
                      <span>{peso(p.base_price)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
          {configuring && <Configure key={configuring.id} product={configuring} onAdd={addLine} onCancel={() => setConfiguring(null)} />}

          <section className="card stack">
            <h3>2. Customer</h3>
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: 'walk_in', label: 'At the counter' },
                { value: 'phone', label: 'On the phone' },
              ]}
            />
            <div className="grid-2">
              <Field label="Name" error={errors.customer_name}>
                <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={takeNow ? 'Mobile number (optional)' : 'Mobile number'} error={errors.contact_phone}>
                <input value={phone} placeholder="0917 123 4567" onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
            <Field label="Email (optional)" error={errors.contact_email}>
              <input type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </section>

          <section className="card stack">
            <h3>3. When</h3>
            {source === 'walk_in' && (
              <Segmented
                value={when}
                onChange={setWhen}
                options={[
                  { value: 'now', label: 'Take now' },
                  { value: 'slot', label: 'Pick a time slot' },
                ]}
              />
            )}
            {takeNow ? (
              <p className="muted small">Ready-made items only. The order is paid in cash and completed right away, with no time slot.</p>
            ) : (
              <>
                <Segmented
                  value={fulfillment}
                  onChange={setFulfillment}
                  options={[
                    { value: 'pickup', label: 'Pickup' },
                    { value: 'delivery', label: 'Delivery' },
                  ]}
                />
                {type === 'delivery' && zones === null && <Loader text="Loading delivery areas…" />}
                {type === 'delivery' && zones !== null && !useZones && (
                  <Field label="Delivery address" error={errors.delivery_address}>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} />
                  </Field>
                )}
                {type === 'delivery' && useZones && (
                  <div className="stack">
                    <ZoneCombobox zones={zones} value={zoneId} onChange={setZoneId} label="Barangay / area" error={errors.zone_id} />
                    <Field label="House no. and street" error={errors.address_street}>
                      <input value={street} maxLength={255} onChange={(e) => setStreet(e.target.value)} />
                    </Field>
                    <Field label="Landmark (optional)" error={errors.address_landmark}>
                      <input value={landmark} maxLength={255} onChange={(e) => setLandmark(e.target.value)} />
                    </Field>
                  </div>
                )}
                {!dates ? (
                  <Loader />
                ) : (
                  <SlotPicker
                    key={type}
                    days={dates.days}
                    date={date}
                    onDate={setDate}
                    slots={slots && visibleSlots}
                    slotId={slotId}
                    onSlot={setSlotId}
                    fulfillment={type}
                    note={leadHours && dates.meta.earliest_date ? `This order needs ${leadHours} hour${leadHours === 1 ? '' : 's'}, so the earliest is ${longDate(dates.meta.earliest_date)}.` : ''}
                  />
                )}
                {errors.slot_id && <span className="field-error">{errors.slot_id}</span>}
              </>
            )}
          </section>

          <section className="card stack">
            <h3>4. Notes</h3>
            <Field label="Order notes (optional)" error={errors.notes}>
              <input value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Allergies (optional)" error={errors.allergy_note}>
              <textarea rows={2} maxLength={500} value={allergyNote} onChange={(e) => setAllergyNote(e.target.value)} />
            </Field>
            <p className="muted small">{ALLERGEN_DISCLAIMER}</p>
          </section>
        </div>

        <aside className="card summary">
          <h3>Order</h3>
          {lines.length === 0 && <p className="muted small">No products yet.</p>}
          {lines.map((l) => (
            <div key={l.key} className="summary-line stack-tight">
              <div className="kv small">
                <span>
                  <strong>{l.name}</strong>
                  {l.option_labels.length > 0 && <span className="muted"> · {l.option_labels.join(' · ')}</span>}
                </span>
                <span>{peso(l.unit_price * l.quantity)}</span>
              </div>
              <LineExtras addons={l.addons} />
              {l.cake_message && <div className="muted small">Message: {l.cake_message}</div>}
              <AllergenLine allergens={l.allergens} />
              <div className="row between">
                <QuantityStepper
                  value={l.quantity}
                  max={l.max_qty}
                  onChange={(q) => setLines((cur) => cur.map((x) => (x.key === l.key ? { ...x, quantity: q } : x)))}
                />
                <button type="button" className="link-button danger" onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          {errors.items && <span className="field-error">{errors.items}</span>}
          {Object.entries(errors)
            .filter(([k]) => k.startsWith('items.'))
            .map(([k, v]) => (
              <span key={k} className="field-error">
                {v}
              </span>
            ))}
          {type === 'delivery' && (
            <div className="kv">
              <span>Delivery fee</span>
              <span>{useZones && !zone ? 'Choose the area' : peso(fee)}</span>
            </div>
          )}
          <div className="kv total">
            <span>Total</span>
            <strong>{pesoExact(total)}</strong>
          </div>

          <span className="field-label">Payment</span>
          {mustPayNow ? (
            <p className="muted small">{takeNow ? 'Paid in cash now.' : 'Delivery orders are paid in cash now. Pay at pickup is for pickup orders.'}</p>
          ) : (
            <Segmented
              value={payment}
              onChange={setPayment}
              options={[
                { value: 'cash_now', label: 'Cash now' },
                { value: 'pay_at_pickup', label: 'Pay at pickup' },
              ]}
            />
          )}
          {cashNow ? (
            <>
              <Field label="Amount received" error={errors.amount_received}>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} />
              </Field>
              <div className="kv">
                <span>Change to give</span>
                <strong>{pesoExact(change)}</strong>
              </div>
              <Field label="Receipt no. (optional)" error={errors.reference}>
                <input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
              </Field>
            </>
          ) : (
            <p className="muted small">The customer pays when they pick up. You can record the cash from the order page.</p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : takeNow ? 'Complete sale' : 'Save order'}
          </button>
        </aside>
      </div>
    </form>
  )
}
