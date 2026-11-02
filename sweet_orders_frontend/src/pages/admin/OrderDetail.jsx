import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  dateTime,
  EVENT_LABELS,
  label,
  occasionLabel,
  optionText,
  PAYMENT_LABELS,
  peso,
  pesoExact,
  slotLabel,
  STATUS_LABELS,
  timeOnly,
  methodLabel,
} from '../../lib/format'
import { ErrorBox, Field, FormDialog, Loader, Notice, StatusBadge, Toggle, useApi } from '../../components/ui'
import OrderHistory from '../../components/OrderHistory'
import { AllergenLine } from '../../components/Allergens'
import LineExtras from '../../components/LineExtras'

const ACTION_TEXT = {
  preparing: 'Mark as Preparing',
  ready: 'Mark as Ready for pickup',
  out_for_delivery: 'Mark as Out for delivery',
  completed: 'Mark as Completed',
}

export default function OrderDetail() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const { data, loading, error, reload } = useApi(`/admin/orders/${id}`)
  const team = useApi(isAdmin ? '/admin/users' : null, { role: 'team', active: 1, per_page: 1 })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})

  if (loading && !data) return <Loader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const order = data.data
  const payment = order.payments.find((p) => p.status === 'paid') || order.payments[0]
  const next = order.next_statuses.filter(
    (s) =>
      s !== 'cancelled' &&
      !(order.fulfillment === 'pickup' && s === 'out_for_delivery') &&
      !(order.fulfillment === 'delivery' && s === 'ready') &&
      !(s === 'completed' && order.payment_status !== 'paid'),
  )
  const needsCode = order.fulfillment === 'pickup' && Boolean(order.claim_code)
  const canRefund = isAdmin && order.status === 'cancelled' && order.payment_status === 'paid'
  const cashDue = order.payments.some((p) => p.provider === 'cash' && p.status === 'pending') && order.payment_status !== 'paid' && order.status !== 'cancelled'

  const open = (name, initial = {}) => {
    setForm(initial)
    setFormErrors({})
    setActionError(null)
    setDialog(name)
  }
  const close = () => setDialog(null)
  const field = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const run = async (request) => {
    setBusy(true)
    setActionError(null)
    setFormErrors({})
    try {
      const res = await request()
      setNotice(res.message)
      setDialog(null)
      await reload()
    } catch (err) {
      setFormErrors(err.errors || {})
      if (!dialog || !Object.keys(err.errors || {}).length) {
        setActionError(err)
        setDialog(null)
      }
    }
    setBusy(false)
  }

  const setStatus = (status, extra = {}) => run(() => api(`/admin/orders/${order.id}/status`, { method: 'PUT', body: { status, ...extra } }))

  const onAction = (s) => {
    if (s === 'completed' && needsCode) open('complete', { claim_code: '', override: false, note: '' })
    else setStatus(s)
  }

  return (
    <div className="stack">
      <Link to="/admin/orders" className="small">
        ← Orders
      </Link>
      <div>
        <h1>
          Order {order.order_number} {order.needs_new_slot && <span className="badge badge-warning">Needs a new slot</span>}
          {order.stock_short && <span className="badge badge-warning">Short on stock</span>}
        </h1>
        <span className="muted">
          Placed {dateTime(order.created_at)} · {order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} ·{' '}
          {order.payment_status === 'paid'
            ? `Paid${payment?.method ? ` · ${methodLabel(payment.method)}` : ''}`
            : cashDue
              ? 'Cash due at the counter'
              : label(PAYMENT_LABELS, order.payment_status)}
        </span>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      {order.allergy_note && (
        <div className="alert alert-error allergy-note" role="note">
          <strong>Allergy note from the customer:</strong> {order.allergy_note}
        </div>
      )}
      {cashDue && (
        <div className="alert alert-warning cash-due">
          <span>
            <strong>Pay at the counter:</strong> collect {pesoExact(order.total)} in cash when the customer picks up, then record it here. Prepare the order as usual.
          </span>
          <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => open('cash', { amount: String(order.total), reference: '' })}>
            Record cash payment
          </button>
        </div>
      )}
      {order.stock_short && (
        <div className="alert alert-warning">
          This order was paid, but a ready-made item had already sold out, so no stock was taken. Call the customer to agree on a later date, a swap or a refund.
        </div>
      )}
      {order.needs_new_slot && (
        <div className="alert alert-warning">
          This order was paid after its payment hold ended, and its time slot had filled up. Call the customer to agree on a new time.
        </div>
      )}

      <div className="card status-bar">
        <div>
          <strong>Status: {label(STATUS_LABELS, order.status)}</strong>
          <div className="muted small">
            {order.status === 'pending_payment'
              ? `Waiting for the customer to pay. The slot is held until ${timeOnly(order.hold_expires_at)}.`
              : cashDue && order.status === 'ready'
                ? 'Waiting for the customer to pick up and pay in cash. Record the cash payment, then mark it completed.'
              : next.length
                ? `Next: ${next.map((s) => label(STATUS_LABELS, s)).join(' or ')}. The customer gets an email and SMS at each step.`
                : 'No further steps.'}
          </div>
        </div>
        <div className="actions">
          {next.map((s) => (
            <button key={s} type="button" className="btn btn-primary" disabled={busy} onClick={() => onAction(s)}>
              {ACTION_TEXT[s] || label(STATUS_LABELS, s)}
            </button>
          ))}
          {order.next_statuses.includes('cancelled') && (
            <button type="button" className="btn" disabled={busy} onClick={() => open('cancel', { cancel_reason: '' })}>
              Cancel order
            </button>
          )}
          {canRefund && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => open('refund', { refund_amount: String(order.total), refund_reference: '' })}>
              Record refund
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
                <LineExtras addons={i.addons} photoUrl={i.design_photo_url} />
                <AllergenLine allergens={i.allergens} />
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
            {order.contact_email && order.contact_email !== order.customer_email && (
              <p className="small">Order updates go to: {order.contact_email}</p>
            )}
            <p className="muted small">
              {order.policy_accepted_at
                ? `Agreed to the policies (version ${order.policy_version}) on ${dateTime(order.policy_accepted_at)}`
                : 'Placed before the consent checkbox existed.'}
            </p>
          </section>
          {(order.recipient_name || order.occasion) && (
            <section className="card">
              <h3>Recipient</h3>
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
            <h3>Schedule</h3>
            <p>
              {order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} · {slotLabel(order)}
            </p>
            {order.delivery_address && <p className="muted">{order.delivery_address}</p>}
            {order.fulfillment === 'pickup' && (
              <>
                <div className="kv">
                  <span>Pickup person</span>
                  <span>
                    {order.pickup_name || order.customer_name}
                    {order.pickup_phone ? ` · ${order.pickup_phone}` : ''}
                  </span>
                </div>
                {order.claim_code && (
                  <div className="kv">
                    <span>Claim code</span>
                    <strong className="mono">{order.claim_code}</strong>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="card">
            <h3>Preparation</h3>
            <div className="kv">
              <span>Prepared by</span>
              <span>{order.prepared_by_name || 'Not started'}</span>
            </div>
            {order.prepared_at && (
              <div className="kv">
                <span>Started</span>
                <span>{dateTime(order.prepared_at)}</span>
              </div>
            )}
            {isAdmin && team.data && (
              <Field label="Change preparer">
                <select
                  value={order.prepared_by || ''}
                  disabled={busy}
                  onChange={(e) =>
                    e.target.value && run(() => api(`/admin/orders/${order.id}/preparer`, { method: 'PUT', body: { prepared_by: Number(e.target.value) } }))
                  }
                >
                  <option value="">Choose…</option>
                  {team.data.team.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </Field>
            )}
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
            <div className="kv">
              <span>Status</span>
              <StatusBadge status={order.payment_status} map={PAYMENT_LABELS} />
            </div>
            {order.cancel_reason && <p className="muted small">Cancel reason: {order.cancel_reason}</p>}
            {order.payment_status === 'refunded' && (
              <p className="small">
                Refunded {pesoExact(order.refund_amount)} on {dateTime(order.refunded_at)} · Ref <span className="mono">{order.refund_reference}</span>
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="card">
        <h3>Status history</h3>
        <OrderHistory history={order.history} staffView />
      </section>

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

      <FormDialog
        open={dialog === 'cancel'}
        title="Cancel this order?"
        confirmText="Cancel order"
        danger
        busy={busy}
        onConfirm={() => setStatus('cancelled', { cancel_reason: form.cancel_reason })}
        onCancel={close}
      >
        <p className="muted">
          Order {order.order_number} will be cancelled, its time slot released, and the customer notified by email and SMS.
          {order.payment_status === 'paid' ? ' After you refund the customer by GCash, record the refund here.' : ''}
        </p>
        <Field label={order.payment_status === 'paid' ? 'Reason (required for paid orders)' : 'Reason (optional)'} error={formErrors.cancel_reason}>
          <input value={form.cancel_reason || ''} maxLength={255} onChange={field('cancel_reason')} />
        </Field>
      </FormDialog>

      <FormDialog
        open={dialog === 'complete'}
        title="Hand over the order"
        confirmText="Mark as Completed"
        busy={busy}
        onConfirm={() => setStatus('completed', form.override ? { override: true, note: form.note } : { claim_code: form.claim_code })}
        onCancel={close}
      >
        <p className="muted">
          Ask {order.pickup_name || order.customer_name} for the 4-digit claim code before handing over the order.
        </p>
        {!form.override && (
          <Field label="Claim code" error={formErrors.claim_code}>
            <input value={form.claim_code || ''} inputMode="numeric" maxLength={4} autoFocus onChange={field('claim_code')} />
          </Field>
        )}
        {isAdmin && <Toggle checked={!!form.override} onChange={(v) => setForm((f) => ({ ...f, override: v }))} label="Skip the code (admin)" />}
        {form.override && (
          <Field label="Why is the code skipped?" error={formErrors.note}>
            <input value={form.note || ''} maxLength={200} placeholder="e.g. ID checked, customer lost the SMS" onChange={field('note')} />
          </Field>
        )}
      </FormDialog>

      <FormDialog
        open={dialog === 'cash'}
        title="Record cash payment"
        confirmText="Save payment"
        busy={busy}
        onConfirm={() => run(() => api(`/admin/orders/${order.id}/cash`, { method: 'POST', body: form }))}
        onCancel={close}
      >
        <p className="muted">Order total: {pesoExact(order.total)}. Enter the cash you received; any change to give back is shown after saving.</p>
        <Field label="Cash received (₱)" error={formErrors.amount}>
          <input type="number" min="0" step="0.01" value={form.amount || ''} onChange={field('amount')} />
        </Field>
        <Field label="Receipt no. (optional)" error={formErrors.reference}>
          <input value={form.reference || ''} maxLength={100} onChange={field('reference')} />
        </Field>
      </FormDialog>

      <FormDialog
        open={dialog === 'refund'}
        title="Record refund"
        confirmText="Save refund"
        busy={busy}
        onConfirm={() => run(() => api(`/admin/orders/${order.id}/refund`, { method: 'POST', body: form }))}
        onCancel={close}
      >
        <p className="muted">Send the money back by GCash first, then record it here. The customer is notified and the payment leaves the sales totals.</p>
        <Field label={`Amount (max ${pesoExact(order.total)})`} error={formErrors.refund_amount}>
          <input type="number" min="0.01" step="0.01" max={order.total} value={form.refund_amount || ''} onChange={field('refund_amount')} />
        </Field>
        <Field label="GCash or bank reference" error={formErrors.refund_reference}>
          <input value={form.refund_reference || ''} maxLength={100} onChange={field('refund_reference')} />
        </Field>
      </FormDialog>
    </div>
  )
}
