/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { label, STATUS_LABELS } from '../lib/format'

export function useApi(path, query) {
  const queryKey = JSON.stringify(query || {})
  const key = `${path}?${queryKey}`
  const [state, setState] = useState({ key: null, data: null, error: null, loading: false })

  const fetchData = useCallback(() => api(path, { query: JSON.parse(queryKey) }), [path, queryKey])

  useEffect(() => {
    if (!path) return
    let alive = true
    fetchData()
      .then((data) => alive && setState({ key, data, error: null, loading: false }))
      .catch((error) => alive && setState({ key, data: null, error, loading: false }))
    return () => {
      alive = false
    }
  }, [path, key, fetchData])

  const reload = useCallback(() => {
    if (!path) return Promise.resolve()
    setState((s) => ({ ...s, loading: true, error: null }))
    return fetchData()
      .then((data) => setState({ key, data, error: null, loading: false }))
      .catch((error) => setState({ key, data: null, error, loading: false }))
  }, [path, key, fetchData])

  const stale = state.key !== key
  return { data: state.data, error: stale ? null : state.error, loading: stale || state.loading, reload }
}

export function Field({ label: text, error, hint, children, className = '' }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className}`}>
      {text && <span className="field-label">{text}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function StatusBadge({ status, map = STATUS_LABELS }) {
  return <span className={`badge badge-${status}`}>{label(map, status)}</span>
}

export function Loader({ text = 'Loading…' }) {
  return (
    <div className="state-box" role="status">
      <span className="spinner" aria-hidden="true" /> {text}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="alert alert-error" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Notice({ children, type = 'success', onClose }) {
  if (!children) return null
  return (
    <div className={`alert alert-${type}`} role="status">
      <span>{children}</span>
      {onClose && (
        <button type="button" className="link-button" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }) {
  return (
    <div className="state-box empty">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  )
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.total <= meta.per_page) return null
  const pages = Math.ceil(meta.total / meta.per_page)
  const from = (meta.page - 1) * meta.per_page + 1
  const to = Math.min(meta.total, meta.page * meta.per_page)
  return (
    <div className="pagination">
      <span className="muted">
        Showing {from}–{to} of {meta.total}
      </span>
      <div className="pager">
        <button type="button" className="btn btn-small" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          ‹ Prev
        </button>
        <span className="muted">
          Page {meta.page} of {pages}
        </span>
        <button type="button" className="btn btn-small" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>
          Next ›
        </button>
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmText = 'Delete', danger = true, busy, onConfirm, onCancel }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel() }}>
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Keep it
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmText}
        </button>
      </div>
    </dialog>
  )
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`chips ${className}`} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip ${value === o.value ? 'active' : ''}`}
          aria-pressed={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label: text, disabled }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      {text && <span>{text}</span>}
    </label>
  )
}

export function QuantityStepper({ value, onChange, min = 1, max = 50 }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">
        −
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Increase">
        +
      </button>
    </div>
  )
}

export function Photo({ src, alt, className = '' }) {
  return src ? <img src={src} alt={alt} className={`photo ${className}`} /> : <div className={`photo placeholder ${className}`}>Photo</div>
}
