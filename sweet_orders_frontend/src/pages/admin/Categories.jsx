import { useState } from 'react'
import { api } from '../../api/client'
import { ConfirmDialog, Empty, ErrorBox, Field, Loader, Notice, useApi } from '../../components/ui'

// A6 Categories: add, rename/reorder, delete
export default function Categories() {
  const { data, loading, error, reload } = useApi('/admin/categories')
  const [form, setForm] = useState({ name: '', sort_order: '' })
  const [editing, setEditing] = useState(null)
  const [errors, setErrors] = useState({})
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setActionError(null)
    try {
      const body = { name: form.name, sort_order: form.sort_order === '' ? 0 : form.sort_order }
      const res = editing
        ? await api(`/admin/categories/${editing}`, { method: 'PUT', body })
        : await api('/admin/categories', { method: 'POST', body })
      setNotice(res.message)
      setForm({ name: '', sort_order: '' })
      setEditing(null)
      reload()
    } catch (err) {
      setErrors(err.errors || {})
      if (!err.errors || !Object.keys(err.errors).length) setActionError(err)
    }
    setBusy(false)
  }

  const remove = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await api(`/admin/categories/${toDelete.id}`, { method: 'DELETE' })
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
        <h1>Categories</h1>
        <span className="muted">The order here is the order on the Menu page.</span>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      <div className="two-col wide-left">
        <section>
          {loading ? (
            <Loader />
          ) : error ? (
            <ErrorBox error={error} onRetry={reload} />
          ) : data.data.length === 0 ? (
            <Empty title="No categories yet." />
          ) : (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Products</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((c) => (
                    <tr key={c.id}>
                      <td>{c.sort_order}</td>
                      <td>{c.name}</td>
                      <td className="mono">{c.slug}</td>
                      <td>{c.product_count}</td>
                      <td className="right nowrap">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            setEditing(c.id)
                            setErrors({})
                            setForm({ name: c.name, sort_order: String(c.sort_order) })
                          }}
                        >
                          Edit
                        </button>{' '}
                        ·{' '}
                        <button type="button" className="link-button danger" onClick={() => setToDelete(c)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">A category that still has products cannot be deleted. Move or delete its products first.</p>
        </section>
        <form className="card stack" onSubmit={submit} noValidate>
          <h3>{editing ? 'Edit category' : 'Add category'}</h3>
          <Field label="Name" error={errors.name}>
            <input value={form.name} placeholder="e.g. Pies" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Display order" error={errors.sort_order}>
            <input type="number" min="0" value={form.sort_order} placeholder="6" onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </Field>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {editing ? 'Save category' : 'Add category'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(null)
                  setErrors({})
                  setForm({ name: '', sort_order: '' })
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.name}?`}
        message="This category will be removed from the menu. This cannot be undone."
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
