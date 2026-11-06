import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { slotLabel } from '../lib/format'
import { ErrorBox, Loader } from './ui'
import SlotPicker from './SlotPicker'

export default function RescheduleOrder({ order, onDone, onClose }) {
  const productIds = [...new Set(order.items.map((i) => i.product_id).filter(Boolean))].join(',')
  const [dates, setDates] = useState(null)
  const [date, setDate] = useState('')
  const [slotsRes, setSlotsRes] = useState(null)
  const [slotId, setSlotId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api('/slots/dates', { query: { fulfillment: order.fulfillment, days: 27, product_ids: productIds } })
      .then((d) => {
        if (!alive) return
        setDates(d)
        setDate(d.meta.earliest_date || '')
      })
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [order.fulfillment, productIds])

  useEffect(() => {
    if (!date) return
    let alive = true
    api('/slots', { query: { date, fulfillment: order.fulfillment, product_ids: productIds } })
      .then((d) => alive && setSlotsRes({ date, data: d.data }))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [date, order.fulfillment, productIds])

  const slots = slotsRes?.date === date ? slotsRes.data.filter((s) => !s.too_soon && s.id !== order.slot_id) : date ? null : []
  const chosen = (slots || []).some((s) => s.id === slotId && s.available) ? slotId : null

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api(`/orders/${order.id}/reschedule`, { method: 'POST', body: { slot_id: chosen } })
      onDone(res.message)
    } catch (err) {
      setError(err.errors?.slot_id ? new Error(err.errors.slot_id) : err)
      setBusy(false)
    }
  }

  return (
    <section className="card stack reschedule">
      <div>
        <h3>Choose a new date and time</h3>
        <p className="muted small">
          Now: {slotLabel(order)}. You can move this order online once, up to 24 hours before your time slot.
        </p>
      </div>
      <ErrorBox error={error} />
      {!dates ? (
        <Loader variant="lines" />
      ) : (
        <SlotPicker days={dates.days} date={date} onDate={setDate} slots={slots} slotId={chosen} onSlot={setSlotId} fulfillment={order.fulfillment} />
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Keep my current time
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !chosen}>
          {busy ? 'Moving…' : 'Move my order'}
        </button>
      </div>
    </section>
  )
}
