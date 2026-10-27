import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import { clock, longDate, todayISO } from '../../lib/format'
import { ConfirmDialog, ErrorBox, Field, Loader, Notice, Segmented, Toggle, useApi } from '../../components/ui'

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Slots() {
  const [weekStart, setWeekStart] = useState(todayISO())
  const [type, setType] = useState('pickup')
  const weekEnd = addDays(weekStart, 6)
  const { data, loading, error, reload } = useApi('/admin/slots', { from: weekStart, to: weekEnd, fulfillment: type })

  const [selected, setSelected] = useState(null)
  const [edit, setEdit] = useState({ capacity: '', is_blocked: false })
  const [gen, setGen] = useState({ from: todayISO(), to: todayISO(13), times: '09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00', duration_minutes: '60', capacity: '5', fulfillment: 'both', skip_monday: true })
  const [blockDate, setBlockDate] = useState('')
  const [errors, setErrors] = useState({})
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const days = useMemo(() => {
    const list = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i)
      list.push({ date, slots: (data?.data || []).filter((s) => s.slot_date === date) })
    }
    return list
  }, [data, weekStart])

  const run = async (fn) => {
    setBusy(true)
    setErrors({})
    setActionError(null)
    try {
      const res = await fn()
      setNotice(res.message)
      await reload()
      return res
    } catch (err) {
      setErrors(err.errors || {})
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  const pick = (s) => {
    setSelected(s)
    setEdit({ capacity: String(s.capacity), is_blocked: !!s.is_blocked })
    setErrors({})
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Time slots and blocked dates</h1>
          <span className="muted">
            {longDate(weekStart)} to {longDate(weekEnd)}
          </span>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ‹ Prev week
          </button>
          <button type="button" className="btn" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next week ›
          </button>
        </div>
      </div>
      <Segmented
        value={type}
        onChange={(v) => {
          setType(v)
          setSelected(null)
        }}
        options={[
          { value: 'pickup', label: 'Pickup' },
          { value: 'delivery', label: 'Delivery' },
        ]}
      />
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError && !Object.keys(errors).length ? actionError : null} />

      <div className="two-col wide-left">
        <section className="stack">
          {loading && !data ? (
            <Loader />
          ) : error ? (
            <ErrorBox error={error} onRetry={reload} />
          ) : (
            <div className="week">
              {days.map((d) => {
                const closed = d.slots.length > 0 && d.slots.every((s) => s.is_blocked)
                return (
                  <div key={d.date} className={`card day ${closed ? 'closed' : ''}`}>
                    <strong>{longDate(d.date)}</strong>
                    {d.slots.length === 0 && <span className="muted small">No slots</span>}
                    {closed && <span className="muted small">Closed (blocked)</span>}
                    {d.slots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`slot ${s.is_blocked ? 'blocked' : s.is_full ? 'full' : ''} ${selected?.id === s.id ? 'active' : ''}`}
                        onClick={() => pick(s)}
                      >
                        {clock(s.start_time)}
                        <span>
                          {s.booked_count}/{s.capacity}
                          {s.is_blocked ? ' · Closed' : s.is_full ? ' · Full' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
          <p className="muted small">Click a slot to change its capacity or block it. A slot with bookings can be blocked but not deleted.</p>

          {selected && (
            <form
              className="card stack"
              noValidate
              onSubmit={async (e) => {
                e.preventDefault()
                const res = await run(() => api(`/admin/slots/${selected.id}`, { method: 'PUT', body: edit }))
                if (res) setSelected(res.data)
              }}
            >
              <h3>
                Slot: {longDate(selected.slot_date)}, {clock(selected.start_time)}–{clock(selected.end_time)} ({selected.fulfillment})
              </h3>
              <p className="muted small">{selected.booked_count} booking(s)</p>
              <div className="row wrap">
                <Field label="Capacity" error={errors.capacity}>
                  <input type="number" min="0" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} />
                </Field>
                <Toggle checked={edit.is_blocked} onChange={(v) => setEdit({ ...edit, is_blocked: v })} label="Blocked (closed)" />
              </div>
              <div className="actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save slot
                </button>
                <button type="button" className="btn btn-danger-outline" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  Delete slot
                </button>
                <button type="button" className="btn" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            </form>
          )}
        </section>

        <div className="stack">
          <form
            className="card stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              run(() =>
                api('/admin/slots/generate', {
                  method: 'POST',
                  body: {
                    from: gen.from,
                    to: gen.to,
                    times: gen.times.split(',').map((t) => t.trim()).filter(Boolean),
                    duration_minutes: gen.duration_minutes,
                    capacity: gen.capacity,
                    fulfillment: gen.fulfillment,
                    skip_weekdays: gen.skip_monday ? [1] : [],
                  },
                }),
              )
            }}
          >
            <h3>Create slots</h3>
            <div className="grid-2">
              <Field label="From" error={errors.from}>
                <input type="date" value={gen.from} onChange={(e) => setGen({ ...gen, from: e.target.value })} />
              </Field>
              <Field label="To" error={errors.to}>
                <input type="date" value={gen.to} onChange={(e) => setGen({ ...gen, to: e.target.value })} />
              </Field>
            </div>
            <Field label="Start times (comma separated)" error={errors.times}>
              <input value={gen.times} onChange={(e) => setGen({ ...gen, times: e.target.value })} />
            </Field>
            <div className="grid-3">
              <Field label="Minutes each" error={errors.duration_minutes}>
                <input type="number" min="15" step="15" value={gen.duration_minutes} onChange={(e) => setGen({ ...gen, duration_minutes: e.target.value })} />
              </Field>
              <Field label="Capacity per slot" error={errors.capacity}>
                <input type="number" min="1" value={gen.capacity} onChange={(e) => setGen({ ...gen, capacity: e.target.value })} />
              </Field>
              <Field label="Type">
                <select value={gen.fulfillment} onChange={(e) => setGen({ ...gen, fulfillment: e.target.value })}>
                  <option value="both">Both</option>
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                </select>
              </Field>
            </div>
            <label className="check">
              <input type="checkbox" checked={gen.skip_monday} onChange={(e) => setGen({ ...gen, skip_monday: e.target.checked })} />
              Skip Mondays (café closed)
            </label>
            <div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Create slots
              </button>
            </div>
          </form>

          <form
            className="card stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              run(() => api('/admin/slots/block-date', { method: 'POST', body: { date: blockDate, blocked: true } })).then((r) => r && setBlockDate(''))
            }}
          >
            <h3>Blocked dates</h3>
            <Field label="Block a date" error={errors.date}>
              <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
            </Field>
            <div>
              <button type="submit" className="btn" disabled={busy}>
                Block date
              </button>
            </div>
            {(data?.blocked_dates || []).length === 0 ? (
              <p className="muted small">No blocked dates.</p>
            ) : (
              <ul className="plain-list">
                {data.blocked_dates.map((d) => (
                  <li key={d}>
                    {longDate(d)} ·{' '}
                    <button type="button" className="link-button" onClick={() => run(() => api('/admin/slots/block-date', { method: 'POST', body: { date: d, blocked: false } }))}>
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Custom cakes need 48 hours, so slots inside that window are hidden from customers for them.</p>
          </form>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this slot?"
        message="The slot will be removed. Slots that already have orders cannot be deleted; block them instead."
        busy={busy}
        onConfirm={async () => {
          const res = await run(() => api(`/admin/slots/${selected.id}`, { method: 'DELETE' }))
          setConfirmDelete(false)
          if (res) setSelected(null)
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
