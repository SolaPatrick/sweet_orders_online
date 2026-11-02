import { useState } from 'react'
import { api } from '../../api/client'
import { peso } from '../../lib/format'
import { Empty, ErrorBox, Field, Loader, Notice, Toggle, useApi } from '../../components/ui'

const BLANK = { name: '', price: '', has_text: false, is_active: true, sort_order: '' }

export default function Addons() {
  const { data, loading, error, reload } = useApi('/admin/addons')
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setActionError(null)
    try {
      const body = { ...form, price: form.price === '' ? '' : Number(form.price) }
      const res = editing ? await api(`/admin/addons/${editing}`, { method: 'PUT', body }) : await api('/admin/addons', { method: 'POST', body })
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

  const toggleActive = async (a) => {
    setActionError(null)
    try {
      await api(`/admin/addons/${a.id}`, { method: 'PUT', body: { name: a.name, price: a.price, is_active: !a.is_active } })
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Cake add-ons</h1>
        <span className="muted">
          Extras customers can add to custom cakes (made to order). The price is added for each cake. Switch Active off to stop offering one; past orders keep it.
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
          ) : data.data.length === 0 ? (
            <Empty title="No add-ons yet." />
          ) : (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Price</th>
                    <th>Message box</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{peso(a.price)}</td>
                      <td>{a.has_text ? 'Yes' : 'No'}</td>
                      <td>
                        <Toggle checked={!!a.is_active} onChange={() => toggleActive(a)} />
                      </td>
                      <td className="right">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            setEditing(a.id)
                            setErrors({})
                            setForm({ name: a.name, price: String(a.price), has_text: !!a.has_text, is_active: !!a.is_active, sort_order: String(a.sort_order) })
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <form className="card stack" onSubmit={submit} noValidate>
          <h3>{editing ? 'Edit add-on' : 'Add an add-on'}</h3>
          <Field label="Name" error={errors.name}>
            <input value={form.name} maxLength={60} placeholder="e.g. Sparkler candle" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid-2">
            <Field label="Price (₱)" error={errors.price}>
              <input type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="Order in list" error={errors.sort_order}>
              <input type="number" min="0" step="1" value={form.sort_order} placeholder="0" onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </Field>
          </div>
          <Toggle checked={form.has_text} onChange={(v) => setForm({ ...form, has_text: v })} label="Ask the customer for a short message (e.g. greeting card)" />
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Active" />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editing ? 'Save add-on' : 'Add add-on'}
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
    </div>
  )
}
