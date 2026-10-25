import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { dateTime, optionText, peso, slotLabel, timeOnly, methodLabel } from '../lib/format'
import { ConfirmDialog, ErrorBox, Loader, Notice, StatusBadge, useApi } from '../components/ui'
import NotFound from './NotFound'

function steps(order) {
  const last = order.fulfillment === 'pickup' ? ['ready', 'Ready for pickup'] : ['out_for_delivery', 'Out for delivery']
  return [
    ['pending_payment', 'Order placed'],
    ['paid', 'Paid'],
    ['preparing', 'Preparing'],
    last,
    ['completed', 'Completed'],
  ]
}

// C11 Order details with status timeline
export default function OrderDetails() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(`/orders/${id}`)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState('')

  if (loading && !data) return <Loader />
  if (error?.status === 404) return <NotFound />
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>
  const order = data.data
  const flow = steps(order)
  const reached = order.status === 'cancelled' ? -1 : flow.findIndex(([s]) => s === order.status)
  const payment = order.payments.find((p) => p.status === 'paid') || order.payments[0]
  const canPay = order.status === 'pending_payment' && order.payment_status !== 'paid'

  const pay = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await api(`/orders/${order.id}/pay`, { method: 'POST', body: {} })
      if (res.payment.error) throw new Error(res.payment.error)
      if (res.payment.mode === 'simulate') {
        await reload()
        setBusy(false)
      } else window.location.assign(res.payment.checkout_url)
    } catch (err) {
      setActionError(err)
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST', body: {} })
      setConfirm(false)
      setNotice('Your order was cancelled and the time slot was released.')
      await reload()
    } catch (err) {
      setActionError(err)
      setConfirm(false)
    }
    setBusy(false)
  }

  return (
    <div className="container page">
      <Link to="/orders" className="small">
        ← My orders
      </Link>
      <div className="page-head">
        <div>
          <h1>Order {order.order_number}</h1>
          <span className="muted">Placed {dateTime(order.created_at)}</span>
        </div>
        <div className="actions">
          {canPay && (
            <button type="button" className="btn btn-primary" onClick={pay} disabled={busy}>
              Pay now
            </button>
          )}
          {canPay && (
            <button type="button" className="btn" onClick={() => setConfirm(true)} disabled={busy}>
              Cancel order
            </button>
          )}
        </div>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      {canPay && <div className="alert alert-warning">This order is unpaid. Your slot is held until {timeOnly(order.hold_expires_at)}.</div>}

      {order.status === 'cancelled' ? (
        <div className="card center">
          <StatusBadge status="cancelled" /> This order was cancelled.
        </div>
      ) : (
        <ol className="card timeline">
          {flow.map(([s, text], i) => (
            <li key={s} className={i <= reached ? 'done' : ''}>
              <span className="dot">{i <= reached ? '✓' : i + 1}</span>
              {text}
            </li>
          ))}
        </ol>
      )}

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
            <span>Subtotal</span>
            <span>{peso(order.subtotal)}</span>
          </div>
          <div className="kv">
            <span>Delivery fee</span>
            <span>{peso(order.delivery_fee)}</span>
          </div>
          <div className="kv total">
            <span>Total</span>
            <strong>{peso(order.total)}</strong>
          </div>
        </section>
        <div className="stack">
          <section className="card">
            <h3>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</h3>
            <p>{slotLabel(order)}</p>
            <p className="muted">{order.fulfillment === 'pickup' ? "Clayanna's Café, 123 Mabini St." : order.delivery_address}</p>
          </section>
          <section className="card">
            <h3>Payment</h3>
            <div className="kv">
              <span>Method</span>
              <span>{methodLabel(payment?.method)}</span>
            </div>
            <div className="kv">
              <span>Status</span>
              <StatusBadge status={order.payment_status} map={{ unpaid: 'Unpaid', paid: 'Paid', failed: 'Failed', refunded: 'Refunded' }} />
            </div>
            <div className="kv">
              <span>Reference</span>
              <span className="mono">{payment?.reference || '—'}</span>
            </div>
          </section>
          <section className="card">
            <h3>Contact</h3>
            <p>
              {order.contact_phone} · {order.customer_email}
            </p>
            {order.notes && <p className="muted">Notes: {order.notes}</p>}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Cancel this order?"
        message={`Order ${order.order_number} will be cancelled and its time slot released. This cannot be undone.`}
        confirmText="Cancel order"
        busy={busy}
        onConfirm={cancel}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
