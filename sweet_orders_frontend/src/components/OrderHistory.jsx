import { dateTime, label, STATUS_LABELS } from '../lib/format'

function who(h, staffView) {
  if (!h.changed_by) return 'System'
  if (staffView) return h.changed_by_name || 'Staff'
  return h.changed_by_role === 'customer' ? 'You' : "Clayanna's Café"
}

export default function OrderHistory({ history = [], staffView = false }) {
  if (!history.length) return <p className="muted small">No history recorded for this order.</p>
  return (
    <ol className="history">
      {history.map((h) => (
        <li key={h.id}>
          <span className="history-dot" aria-hidden="true" />
          <div>
            <strong>
              {h.from_status && h.from_status !== h.to_status
                ? `${label(STATUS_LABELS, h.from_status)} → ${label(STATUS_LABELS, h.to_status)}`
                : h.from_status
                  ? 'Update'
                  : `Placed · ${label(STATUS_LABELS, h.to_status)}`}
            </strong>
            <div className="muted small">
              {dateTime(h.created_at)} · {who(h, staffView)}
            </div>
            {h.note && <div className="small">{h.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
