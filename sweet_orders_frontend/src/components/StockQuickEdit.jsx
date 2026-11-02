import { useState } from 'react'
import { api } from '../api/client'

export default function StockQuickEdit({ product, onSaved }) {
  const [value, setValue] = useState(String(product.stock_qty ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const changed = value !== String(product.stock_qty ?? 0)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const res = await api(`/admin/products/${product.id}/stock`, { method: 'PUT', body: { stock_qty: value === '' ? '' : Number(value) } })
      setSaved(true)
      onSaved?.(res.data, res.message)
    } catch (err) {
      setError(err.errors?.stock_qty || err.message)
    }
    setBusy(false)
  }

  return (
    <form className="stock-edit" onSubmit={save} noValidate>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        aria-label={`Stock for ${product.name}`}
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
      />
      <button type="submit" className="btn btn-small" disabled={busy || !changed}>
        {busy ? 'Saving…' : 'Update stock'}
      </button>
      {saved && !changed && <span className="muted small">Saved</span>}
      {error && <span className="field-error">{error}</span>}
    </form>
  )
}
