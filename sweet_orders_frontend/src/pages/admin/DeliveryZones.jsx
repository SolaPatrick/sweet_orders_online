import { useState } from 'react'
import { api } from '../../api/client'
import { peso } from '../../lib/format'
import { byName, byPlace, matchesPlace } from '../../lib/places'
import { ConfirmDialog, Empty, ErrorBox, Field, Loader, Notice, Toggle, useApi } from '../../components/ui'

const BLANK = { name: '', city: '', fee: '', is_active: true }

export default function DeliveryZones() {
  const { data, loading, error, reload } = useApi('/admin/delivery-zones')
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [find, setFind] = useState('')

  const zones = [...(data?.data || [])].sort(byPlace)
  const shownZones = zones.filter((z) => matchesPlace(z, find))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setActionError(null)
    try {
      const body = { ...form, fee: form.fee === '' ? '' : Number(form.fee) }
      const res = editing
        ? await api(`/admin/delivery-zones/${editing}`, { method: 'PUT', body })
        : await api('/admin/delivery-zones', { method: 'POST', body })
      setNotice(res.message)
      setForm(BLANK)
      setEditing(null)
      reload()
    } catch (err) {
      setErrors(err.errors || {})
      if (!Object.keys(err.errors || {}).length) setActionError(err)
    }
    setBusy(false)
  }

  const toggleActive = async (z) => {
    setActionError(null)
    try {
      await api(`/admin/delivery-zones/${z.id}`, { method: 'PUT', body: { name: z.name, city: z.city, fee: z.fee, is_active: !z.is_active } })
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  const remove = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await api(`/admin/delivery-zones/${toDelete.id}`, { method: 'DELETE' })
      setNotice(res.message)
      reload()
    } catch (err) {
      setActionError(err)
    }
    setToDelete(null)
    setBusy(false)
  }

  return (
    <div className="stack">
      <div>
        <h1>Delivery areas</h1>
        <span className="muted">
          Customers can only choose an active area at checkout, and the delivery fee comes from that area. With no areas at all, checkout falls back to
          a free-text address and the flat fee.
        </span>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      <div className="two-col wide-left">
        <section>
          {loading && !data ? (
            <Loader />
          ) : error ? (
            <ErrorBox error={error} onRetry={reload} />
          ) : zones.length === 0 ? (
            <Empty title="No delivery areas yet.">Add them by hand or pick barangays from the PSGC list below.</Empty>
          ) : (
            <div className="stack">
              <Field label={`Search ${zones.length} areas`}>
                <input type="search" value={find} placeholder="Barangay or city, e.g. pob" onChange={(e) => setFind(e.target.value)} />
              </Field>
              {shownZones.length === 0 ? (
                <p className="muted">No area matches “{find}”.</p>
              ) : (
                <div className="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th>Barangay / area</th>
                        <th>City</th>
                        <th>Fee</th>
                        <th>Active</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {shownZones.map((z) => (
                        <tr key={z.id}>
                          <td>{z.name}</td>
                          <td>{z.city}</td>
                          <td>{peso(z.fee)}</td>
                          <td>
                            <Toggle checked={!!z.is_active} onChange={() => toggleActive(z)} />
                          </td>
                          <td className="right nowrap">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                setEditing(z.id)
                                setErrors({})
                                setForm({ name: z.name, city: z.city, fee: String(z.fee), is_active: !!z.is_active })
                              }}
                            >
                              Edit
                            </button>{' '}
                            ·{' '}
                            <button type="button" className="link-button danger" onClick={() => setToDelete(z)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
        <form className="card stack" onSubmit={submit} noValidate>
          <h3>{editing ? 'Edit area' : 'Add area by hand'}</h3>
          <Field label="Barangay or town" error={errors.name}>
            <input value={form.name} maxLength={100} placeholder="e.g. Poblacion" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="City or municipality" error={errors.city}>
            <input value={form.city} maxLength={100} placeholder="e.g. Calapan City" onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Delivery fee (₱)" error={errors.fee}>
            <input type="number" min="0" step="1" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
          </Field>
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="We deliver here" />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editing ? 'Save area' : 'Add area'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(null)
                  setErrors({})
                  setForm(BLANK)
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <PsgcPicker
        onAdded={(message) => {
          setNotice(message)
          reload()
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.name}?`}
        message="Customers will no longer be able to choose this area. Past orders keep their address. To stop deliveries for a while, switch Active off instead."
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function PsgcPicker({ onAdded }) {
  const [q, setQ] = useState('')
  const [cities, setCities] = useState(null)
  const [city, setCity] = useState(null)
  const [barangays, setBarangays] = useState(null)
  const [picked, setPicked] = useState({})
  const [allFee, setAllFee] = useState('')
  const [find, setFind] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const search = async (e) => {
    e.preventDefault()
    if (q.trim().length < 2) return
    setBusy(true)
    setError(null)
    try {
      setCities((await api('/admin/psgc/cities', { query: { q: q.trim() } })).data)
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  const chooseCity = async (c) => {
    setBusy(true)
    setError(null)
    setCity(c)
    setPicked({})
    setFind('')
    setBarangays(null)
    try {
      setBarangays([...(await api(`/admin/psgc/cities/${c.code}/barangays`)).data].sort(byName))
    } catch (err) {
      setError(err)
      setCity(null)
    }
    setBusy(false)
  }

  const toggle = (b, on) =>
    setPicked((p) => {
      const next = { ...p }
      if (on) next[b.code] = { name: b.name, psgc_code: b.code, fee: allFee }
      else delete next[b.code]
      return next
    })

  const applyAll = () => setPicked((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, fee: allFee }])))

  const chosen = Object.values(picked)
  const shownBarangays = (barangays || []).filter((b) => matchesPlace(b, find))
  const missingFee = chosen.some((z) => z.fee === '' || Number(z.fee) < 0)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api('/admin/delivery-zones/bulk', {
        method: 'POST',
        body: { city: city.name, zones: chosen.map((z) => ({ ...z, fee: Number(z.fee) })) },
      })
      onAdded(res.message)
      setPicked({})
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  return (
    <section className="card stack">
      <div>
        <h3>Add barangays from the PSGC list</h3>
        <span className="muted small">
          Uses the free Philippine Standard Geographic Code list. Pick a city, tick the barangays you deliver to, and set the fee.
        </span>
      </div>
      <ErrorBox error={error} />
      <form className="filter-bar" onSubmit={search}>
        <Field label="City or municipality" className="grow">
          <input type="search" value={q} placeholder="e.g. Calapan" onChange={(e) => setQ(e.target.value)} />
        </Field>
        <button type="submit" className="btn" disabled={busy || q.trim().length < 2}>
          Search
        </button>
      </form>
      {cities && !city && (
        cities.length === 0 ? (
          <p className="muted">No city or municipality matches “{q}”.</p>
        ) : (
          <div className="chips wrap">
            {[...cities].sort(byName).map((c) => (
              <button key={c.code} type="button" className="chip" disabled={busy} onClick={() => chooseCity(c)}>
                {c.name}
                {c.province ? `, ${c.province}` : ''}
              </button>
            ))}
          </div>
        )
      )}
      {city && (
        <div className="stack">
          <div className="row wrap">
            <strong>
              {city.name}
              {city.province ? `, ${city.province}` : ''}
            </strong>
            <button type="button" className="link-button" onClick={() => setCity(null)}>
              Choose another city
            </button>
          </div>
          {!barangays ? (
            <Loader text="Loading barangays…" />
          ) : (
            <>
              <div className="filter-bar">
                <Field label={`Search ${barangays.length} barangays`} className="grow">
                  <input type="search" value={find} placeholder="e.g. pob" onChange={(e) => setFind(e.target.value)} />
                </Field>
                <Field label="One fee for all ticked (₱)">
                  <input type="number" min="0" step="1" value={allFee} onChange={(e) => setAllFee(e.target.value)} />
                </Field>
                <button type="button" className="btn" disabled={!chosen.length || allFee === ''} onClick={applyAll}>
                  Apply to ticked
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!shownBarangays.length}
                  onClick={() =>
                    setPicked((p) => ({
                      ...p,
                      ...Object.fromEntries(shownBarangays.map((b) => [b.code, p[b.code] || { name: b.name, psgc_code: b.code, fee: allFee }])),
                    }))
                  }
                >
                  {find.trim() ? `Tick ${shownBarangays.length} shown` : `Tick all ${barangays.length}`}
                </button>
              </div>
              {shownBarangays.length === 0 && <p className="muted">No barangay matches “{find}”.</p>}
              <div className="barangay-grid">
                {shownBarangays.map((b) => (
                  <div key={b.code} className={`barangay ${picked[b.code] ? 'on' : ''}`}>
                    <label className="check">
                      <input type="checkbox" checked={!!picked[b.code]} onChange={(e) => toggle(b, e.target.checked)} />
                      {b.name}
                    </label>
                    {picked[b.code] && (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={`Fee for ${b.name}`}
                        placeholder="Fee"
                        value={picked[b.code].fee}
                        onChange={(e) => setPicked((p) => ({ ...p, [b.code]: { ...p[b.code], fee: e.target.value } }))}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="actions">
                <button type="button" className="btn btn-primary" disabled={busy || !chosen.length || missingFee} onClick={save}>
                  {busy ? 'Saving…' : `Add ${chosen.length} area${chosen.length === 1 ? '' : 's'}`}
                </button>
                {missingFee && <span className="muted small">Every ticked barangay needs a fee.</span>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
