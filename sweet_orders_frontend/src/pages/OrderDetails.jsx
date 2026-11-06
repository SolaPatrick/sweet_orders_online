import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { dateTime, dayTime, isCashOrder, occasionLabel, optionText, PAYMENT_LABELS, peso, pesoExact, slotLabel, timeOnly, methodLabel } from '../lib/format'
import { ErrorBox, Field, FormDialog, Loader, Notice, StatusBadge, useApi } from '../components/ui'
import RescheduleOrder from '../components/RescheduleOrder'
import { CAFE } from '../lib/policies'
import OrderHistory from '../components/OrderHistory'
import { AllergenLine } from '../components/Allergens'
import LineExtras from '../components/LineExtras'
import RateOrder from '../components/RateOrder'
import NotFound from './NotFound'

function steps(order) {
  const last = order.fulfillment === 'pickup' ? ['ready', 'Ready for pickup'] : ['out_for_delivery', 'Out for delivery']
  if (isCashOrder(order)) {
    return [['awaiting_cash', 'Order placed'], ['preparing', 'Preparing'], last, ['completed', 'Paid and picked up']]
  }
  return [
    ['pending_payment', 'Order placed'],
    ['paid', 'Paid'],
    ['preparing', 'Preparing'],
    last,
    ['completed', 'Completed'],
  ]
}

export default function OrderDetails() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(`/orders/${id}`)
  const [confirm, setConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const [moving, setMoving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState('')

  if (loading && !data)
    return (
      <div className="container page">
        <Loader variant="detail" />
      </div>
    )
  if (error?.status === 404) return <NotFound />
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>
  const order = data.data
  const flow = steps(order)
  const reached = order.status === 'cancelled' ? -1 : isCashOrder(order) && order.status === 'paid' ? 0 : flow.findIndex(([s]) => s === order.status)
  const payment = order.payments.find((p) => p.status === 'paid') || order.payments[0]
  const canPay = order.status === 'pending_payment' && order.payment_status !== 'paid'
  const cashDue = isCashOrder(order) && order.payment_status !== 'paid' && order.status !== 'cancelled'
  const canCancel = canPay || order.can_self_cancel
  const canMove = order.can_self_reschedule
  const contactInstead = !order.can_self_cancel && ['paid', 'awaiting_cash', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)

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
      const res = await api(`/orders/${order.id}/cancel`, { method: 'POST', body: { reason } })
      setConfirm(false)
      setNotice(res.message)
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
          <Link to={`/orders/${order.id}/receipt`} className="btn">
            {order.payment_status === 'unpaid' ? 'Order summary' : 'View receipt'}
          </Link>
          {canPay && (
            <button type="button" className="btn btn-primary" onClick={pay} disabled={busy}>
              Pay now
            </button>
          )}
          {canMove && !moving && (
            <button type="button" className="btn" onClick={() => setMoving(true)} disabled={busy}>
              Change date/time
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn" onClick={() => setConfirm(true)} disabled={busy}>
              Cancel order
            </button>
          )}
        </div>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      {canPay && <div className="alert alert-warning">This order is unpaid. Your slot is held until {timeOnly(order.hold_expires_at)}.</div>}
      {order.can_self_cancel && (
        <div className="alert alert-success change-window">
          Free changes until <strong>{dayTime(order.change_deadline)}</strong>: you can cancel{canMove ? ' or move this order to another time once' : ''}.
          {!canMove && order.reschedule_count > 0 && ' You already moved this order once.'}
        </div>
      )}
      {contactInstead && (
        <div className="alert alert-warning">
          {['paid', 'awaiting_cash'].includes(order.status)
            ? `Free changes ended on ${dayTime(order.change_deadline)}.`
            : 'Your order is already being prepared.'}{' '}
          To change or cancel it, contact the café: <a href={`tel:${CAFE.phone.replace(/\s/g, '')}`}>{CAFE.phone}</a> ·{' '}
          <a href={`mailto:${CAFE.email}`}>{CAFE.email}</a>
        </div>
      )}
      {order.status === 'cancelled' && order.payment_status === 'paid' && (
        <div className="alert alert-warning">The café will send your refund of {peso(order.total)} back through your original payment method.</div>
      )}
      {moving && (
        <RescheduleOrder
          order={order}
          onClose={() => setMoving(false)}
          onDone={async (message) => {
            setMoving(false)
            setNotice(message)
            await reload()
          }}
        />
      )}
      {cashDue && (
        <div className="alert alert-warning">
          Pay {peso(order.total)} in cash at the counter when you pick it up{order.claim_code ? ` and show your claim code ${order.claim_code}` : ''}.
        </div>
      )}

      {order.fulfillment === 'pickup' && order.claim_code && !['cancelled', 'completed'].includes(order.status) && (
        <div className="card claim">
          <div>
            <span className="muted small">Claim code</span>
            <strong className="claim-code">{order.claim_code}</strong>
          </div>
          <p className="muted small">
            Show this code at the counter.
            {order.pickup_name && order.pickup_name !== order.customer_name ? ` Share it with ${order.pickup_name}, who will pick up the order.` : ''}
          </p>
        </div>
      )}

      {order.status === 'cancelled' ? (
        <div className="card center stack">
          <div>
            <StatusBadge status="cancelled" /> This order was cancelled.
          </div>
          {order.cancel_reason && <p className="muted">Reason: {order.cancel_reason}</p>}
          {order.payment_status === 'refunded' && (
            <p>
              We refunded {pesoExact(order.refund_amount)} on {dateTime(order.refunded_at)}. Reference: <span className="mono">{order.refund_reference}</span>
            </p>
          )}
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
                <LineExtras addons={i.addons} photoUrl={i.design_photo_url} />
                <AllergenLine allergens={i.allergens} />
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
            <p className="muted">{order.fulfillment === 'pickup' ? "Clayanna's Café, " + CAFE.address : order.delivery_address}</p>
            {order.fulfillment === 'pickup' && order.pickup_name && (
              <p className="small">
                Picked up by: {order.pickup_name}
                {order.pickup_phone ? ` · ${order.pickup_phone}` : ''}
              </p>
            )}
          </section>
          {(order.recipient_name || order.occasion) && (
            <section className="card">
              <h3>For</h3>
              {order.recipient_name && (
                <p>
                  {order.recipient_name}
                  {order.recipient_phone ? ` · ${order.recipient_phone}` : ''}
                </p>
              )}
              {order.occasion && <p className="muted">Occasion: {occasionLabel(order.occasion)}</p>}
            </section>
          )}
          <section className="card">
            <h3>Payment</h3>
            <div className="kv">
              <span>Method</span>
              <span>{methodLabel(payment?.method)}</span>
            </div>
            <div className="kv">
              <span>Status</span>
              <StatusBadge status={order.payment_status} map={PAYMENT_LABELS} />
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
            {order.allergy_note && <p className="allergy-warn">Allergy note: {order.allergy_note}</p>}
            {order.contact_email && <p className="muted small">Order updates are sent to {order.contact_email}.</p>}
          </section>
        </div>
      </div>

      {order.status === 'completed' && <RateOrder order={order} onSaved={reload} />}

      <section className="card">
        <h3>Order history</h3>
        <OrderHistory history={order.history} />
      </section>

      <FormDialog open={confirm} title="Cancel this order?" confirmText="Cancel order" danger busy={busy} onConfirm={cancel} onCancel={() => setConfirm(false)}>
        <p className="muted">
          Order {order.order_number} will be cancelled and its time slot released. This cannot be undone.
          {order.payment_status === 'paid' && ` The café will send your refund of ${peso(order.total)} back through your original payment method.`}
        </p>
        {!canPay && (
          <Field label="Reason (optional)">
            <textarea rows={2} maxLength={200} value={reason} placeholder="e.g. The party was moved" onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </FormDialog>
    </div>
  )
}
