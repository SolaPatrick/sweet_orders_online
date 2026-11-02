import { useState } from 'react'
import { api } from '../api/client'
import { ErrorBox, Notice, StarInput, Stars } from './ui'

const EDIT_DAYS = 7

function editable(review) {
  return Date.now() - new Date(String(review.created_at).replace(' ', 'T')).getTime() < EDIT_DAYS * 86400000
}

export default function RateOrder({ order, onSaved }) {
  const products = []
  order.items.forEach((i) => {
    if (i.product_id && !products.some((p) => p.product_id === i.product_id)) products.push(i)
  })
  const byProduct = Object.fromEntries((order.reviews || []).map((r) => [r.product_id, r]))
  const [drafts, setDrafts] = useState({})
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  if (!products.length) return null
  const pending = products.filter((p) => !byProduct[p.product_id])
  const draft = (id) => drafts[id] || { rating: 0, comment: '' }
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...draft(id), ...patch } }))

  const submitNew = async () => {
    const list = pending.filter((p) => draft(p.product_id).rating > 0).map((p) => ({ product_id: p.product_id, ...draft(p.product_id) }))
    if (!list.length) {
      setError(new Error('Tap the stars to rate at least one item.'))
      return
    }
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      const res = await api(`/orders/${order.id}/reviews`, { method: 'POST', body: list })
      setNotice(res.message)
      setDrafts({})
      await onSaved()
    } catch (err) {
      setError(err)
      const mapped = {}
      Object.entries(err.errors || {}).forEach(([k, v]) => {
        const idx = Number(k.split('.')[1])
        if (list[idx]) mapped[list[idx].product_id] = v
      })
      setErrors(mapped)
    }
    setBusy(false)
  }

  const saveEdit = async (review) => {
    const d = draft(review.product_id)
    setBusy(true)
    setError(null)
    try {
      const res = await api(`/reviews/${review.id}`, { method: 'PUT', body: { rating: d.rating, comment: d.comment } })
      setNotice(res.message)
      setEditing(null)
      await onSaved()
    } catch (err) {
      setError(err)
    }
    setBusy(false)
  }

  return (
    <section className="card stack">
      <h3>Rate your order</h3>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={error} />
      {products.map((p) => {
        const review = byProduct[p.product_id]
        const d = draft(p.product_id)
        if (review && editing !== review.id) {
          return (
            <div key={p.product_id} className="review-line">
              <strong>{p.product_name}</strong>
              <div className="row wrap">
                <Stars value={review.rating} small />
                {!review.is_visible && <span className="badge badge-cancelled">Hidden by the café</span>}
                {editable(review) && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setEditing(review.id)
                      setDraft(p.product_id, { rating: review.rating, comment: review.comment || '' })
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {review.comment && <p className="muted small">{review.comment}</p>}
            </div>
          )
        }
        return (
          <div key={p.product_id} className="review-line">
            <strong>{p.product_name}</strong>
            <StarInput value={d.rating} onChange={(v) => setDraft(p.product_id, { rating: v })} disabled={busy} />
            <textarea
              rows={2}
              maxLength={1000}
              value={d.comment}
              placeholder="What did you think? (optional)"
              onChange={(e) => setDraft(p.product_id, { comment: e.target.value })}
            />
            {errors[p.product_id] && <span className="field-error">{errors[p.product_id]}</span>}
            {review && (
              <div className="actions">
                <button type="button" className="btn btn-primary btn-small" disabled={busy || !d.rating} onClick={() => saveEdit(review)}>
                  Save review
                </button>
                <button type="button" className="btn btn-small" disabled={busy} onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
      {pending.length > 0 && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submitNew}>
          {busy ? 'Sending…' : 'Send my review'}
        </button>
      )}
      <p className="muted small">You can edit a review within {EDIT_DAYS} days.</p>
    </section>
  )
}
