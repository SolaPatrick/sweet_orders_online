import { Link, useParams } from 'react-router-dom'
import { dateTime, label, methodLabel, optionText, pesoExact, slotLabel, STATUS_LABELS } from '../lib/format'
import { CAFE } from '../lib/policies'
import { ErrorBox, Loader, useApi } from '../components/ui'
import NotFound from './NotFound'

export default function Receipt({ admin = false }) {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(admin ? `/admin/orders/${id}` : `/orders/${id}`)
  const back = admin ? `/admin/orders/${id}` : `/orders/${id}`

  if (loading && !data) return <Loader />
  if (error?.status === 404) return <NotFound />
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>
  const order = data.data
  const paid = ['paid', 'refunded'].includes(order.payment_status)
  const payment = order.payments.find((p) => p.status === 'paid') || null
  const cancelled = order.status === 'cancelled'
  const refunded = order.payment_status === 'refunded'
  const title = paid ? 'Official receipt' : 'Order summary — not a receipt (unpaid)'

  return (
    <div className="receipt-page">
      <div className="receipt-tools no-print">
        <Link to={back}>← Back to the order</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      <article className="receipt">
        <header className="receipt-head">
          <div>
            <strong className="receipt-cafe">{CAFE.name}</strong>
            <div className="small">{CAFE.address}</div>
            <div className="small">
              {CAFE.phone} · {CAFE.email}
            </div>
          </div>
          <div className="receipt-title">
            <strong>{title}</strong>
            <div className="small">No. {order.order_number}</div>
            <div className="small">Ordered {dateTime(order.created_at)}</div>
          </div>
        </header>

        {(cancelled || refunded) && (
          <p className="receipt-flag">
            {refunded
              ? `Refunded ${pesoExact(order.refund_amount)} on ${dateTime(order.refunded_at)} (ref ${order.refund_reference}).`
              : 'Cancelled.'}
          </p>
        )}

        <section className="receipt-grid">
          <div>
            <span className="receipt-label">Customer</span>
            <div>{order.customer_name}</div>
            <div className="small">{order.contact_email || order.customer_email}</div>
            <div className="small">{order.contact_phone}</div>
          </div>
          <div>
            <span className="receipt-label">{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
            <div>{slotLabel(order)}</div>
            {order.fulfillment === 'delivery' && <div className="small">{order.delivery_address}</div>}
            {order.fulfillment === 'pickup' && order.pickup_name && <div className="small">Pickup by {order.pickup_name}</div>}
          </div>
        </section>

        <table className="receipt-lines">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.product_name}</strong>
                  {i.options.length > 0 && <div className="small">{optionText(i.options)}</div>}
                  {(i.addons || []).map((a) => (
                    <div key={`${a.name}-${a.addon_id}`} className="small">
                      + {a.name} ({pesoExact(a.price)}){a.text ? ` · “${a.text}”` : ''}
                    </div>
                  ))}
                  {i.cake_message && <div className="small">Message: “{i.cake_message}”</div>}
                </td>
                <td className="num">{i.quantity}</td>
                <td className="num">{pesoExact(i.unit_price)}</td>
                <td className="num">{pesoExact(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Subtotal</td>
              <td className="num">{pesoExact(order.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Delivery fee</td>
              <td className="num">{pesoExact(order.delivery_fee)}</td>
            </tr>
            <tr className="receipt-total">
              <td colSpan={3}>Total</td>
              <td className="num">{pesoExact(order.total)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="receipt-grid">
          <div>
            <span className="receipt-label">Payment</span>
            {payment ? (
              <>
                <div>
                  {methodLabel(payment.method)} · {pesoExact(payment.amount)}
                </div>
                <div className="small">Paid {dateTime(payment.paid_at)}</div>
                {payment.reference && <div className="small">Reference: {payment.reference}</div>}
                {payment.received_by_name && <div className="small">Cash received by {payment.received_by_name}</div>}
              </>
            ) : (
              <div>{order.payments.some((p) => p.provider === 'cash') ? 'To be paid in cash at the counter' : 'Not paid'}</div>
            )}
          </div>
          <div>
            <span className="receipt-label">Status</span>
            <div>{label(STATUS_LABELS, order.status)}</div>
            {order.claim_code && !cancelled && <div className="small">Claim code: {order.claim_code}</div>}
          </div>
        </section>

        <footer className="receipt-foot small">
          Thank you for ordering from {CAFE.name}. Keep this for your records.
          {!paid && ' This summary is not proof of payment.'}
        </footer>
      </article>
    </div>
  )
}
