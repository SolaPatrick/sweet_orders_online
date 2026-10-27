import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { dateTime, EVENT_LABELS, label, optionText, peso, slotLabel, STATUS_LABELS, timeOnly, methodLabel } from '../../lib/format'
import { ConfirmDialog, ErrorBox, Loader, Notice, StatusBadge, useApi } from '../../components/ui'

const ACTION_TEXT = {
  preparing: 'Mark as Preparing',
  ready: 'Mark as Ready for pickup',
  out_for_delivery: 'Mark as Out for delivery',
  completed: 'Mark as Completed',
}

export default function OrderDetail() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(`/admin/orders/${id}`)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (loading && !data) return <Loader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const order = data.data
  const payment = order.payments.find((p) => p.status === 'paid') || order.payments[0]
  const next = order.next_statuses.filter(
    (s) => s !== 'cancelled' && !(order.fulfillment === 'pickup' && s === 'out_for_delivery') && !(order.fulfillment === 'delivery' && s === 'ready'),
  )

  const setStatus = async (status) => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await api(`/admin/orders/${order.id}/status`, { method: 'PUT', body: { status } })
      setNotice(res.message)
      setConfirmCancel(false)
      await reload()
    } catch (err) {
      setActionError(err)
      setConfirmCancel(false)
    }
    setBusy(false)
  }

  return (
    <div className="stack">
      <Link to="/admin/orders" className="small">
        ← Orders
      </Link>
      <div>
        <h1>Order {order.order_number}</h1>
        <span className="muted">
          Placed {dateTime(order.created_at)} · {order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} ·{' '}
          {order.payment_status === 'paid' ? `Paid${payment?.method ? ` · ${methodLabel(payment.method)}` : ''}` : 'Unpaid'}
        </span>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />

      <div className="card status-bar">
        <div>
          <strong>Status: {label(STATUS_LABELS, order.status)}</strong>
          <div className="muted small">
            {order.status === 'pending_payment'
              ? `Waiting for the customer to pay. The slot is held until ${timeOnly(order.hold_expires_at)}.`
              : next.length
                ? `Next: ${next.map((s) => label(STATUS_LABELS, s)).join(' or ')}. The customer gets an email and SMS at each step.`
                : 'No further steps.'}
          </div>
        </div>
        <div className="actions">
          {next.map((s) => (
            <button key={s} type="button" className="btn btn-primary" disabled={busy} onClick={() => setStatus(s)}>
              {ACTION_TEXT[s] || label(STATUS_LABELS, s)}
            </button>
          ))}
          {order.next_statuses.includes('cancelled') && (
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Cancel order
            </button>
          )}
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <h3>Items</h3>
          {order.items.map((i) => (
            <div key={i.id} className="kv item-line">
              <div>
                <strong>
                  {i.product_name} × {i.quantity}
                </strong>
                <div className="muted small">
                  {[optionText(i.options), i.cake_message && `Message: "${i.cake_message}"`, i.notes && `Notes: ${i.notes}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <strong>{peso(i.line_total)}</strong>
            </div>
          ))}
          <div className="kv">
            <span>Delivery fee</span>
            <span>{peso(order.delivery_fee)}</span>
          </div>
          <div className="kv total">
            <span>Total</span>
            <strong>{peso(order.total)}</strong>
          </div>
          {order.notes && <p className="muted small">Order notes: {order.notes}</p>}
        </section>
        <div className="stack">
          <section className="card">
            <h3>Customer</h3>
            <p>{order.customer_name}</p>
            <p className="muted">
              {order.contact_phone} · {order.customer_email}
            </p>
          </section>
          <section className="card">
            <h3>Schedule</h3>
            <p>
              {order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} · {slotLabel(order)}
            </p>
            {order.delivery_address && <p className="muted">{order.delivery_address}</p>}
          </section>
          <section className="card">
            <h3>Payment</h3>
            <div className="kv">
              <span>PayMongo</span>
              <span>
                {methodLabel(payment?.method)} · {payment ? label({}, payment.status) : 'none'}
              </span>
            </div>
            <div className="kv">
              <span>Reference</span>
              <span className="mono">{payment?.reference || payment?.checkout_session_id || '—'}</span>
            </div>
          </section>
        </div>
      </div>

      <section>
        <h3>Notifications sent</h3>
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Channel</th>
                <th>Event</th>
                <th>Recipient</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {order.notifications.map((n) => (
                <tr key={n.id}>
                  <td>{timeOnly(n.created_at)}</td>
                  <td>{n.channel === 'sms' ? 'SMS' : 'Email'}</td>
                  <td>{label(EVENT_LABELS, n.event)}</td>
                  <td>{n.recipient}</td>
                  <td>
                    <StatusBadge status={n.status} map={{ sent: 'Sent', failed: 'Failed', logged: 'Logged' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message={`Order ${order.order_number} will be cancelled, its time slot released, and the customer notified by email and SMS.${order.payment_status === 'paid' ? ' Refund the payment in the PayMongo dashboard.' : ''}`}
        confirmText="Cancel order"
        busy={busy}
        onConfirm={() => setStatus('cancelled')}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
