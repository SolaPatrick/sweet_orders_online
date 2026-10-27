import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { peso, timeOnly } from '../lib/format'
import { ErrorBox, Loader, useApi } from '../components/ui'

export default function PaymentFailed() {
  const { id } = useParams()
  const { data, loading, error } = useApi(`/orders/${id}`)
  const [busy, setBusy] = useState(false)
  const [payError, setPayError] = useState(null)

  if (loading) return <Loader />
  if (error) return <div className="container page"><ErrorBox error={error} /></div>
  const order = data.data

  const retry = async () => {
    setBusy(true)
    setPayError(null)
    try {
      const res = await api(`/orders/${order.id}/pay`, { method: 'POST', body: {} })
      if (res.payment.error) throw new Error(res.payment.error)
      window.location.assign(res.payment.checkout_url)
    } catch (err) {
      setPayError(err)
      setBusy(false)
    }
  }

  const canPay = order.status === 'pending_payment' && order.payment_status !== 'paid'

  return (
    <div className="container page narrow">
      <div className="card result">
        <div className="result-icon">!</div>
        <h1>Payment did not go through</h1>
        <p className="muted">
          {canPay
            ? `Order ${order.order_number} is saved but unpaid. Your time slot is held until ${timeOnly(order.hold_expires_at)}. You were not charged.`
            : order.payment_status === 'paid'
              ? `Good news: order ${order.order_number} is already paid.`
              : `Order ${order.order_number} is ${order.status.replace(/_/g, ' ')}. Please place a new order.`}
        </p>
        <div className="panel">
          <div className="kv total">
            <span>Amount due</span>
            <strong>{peso(order.total)}</strong>
          </div>
          {canPay && (
            <div className="kv">
              <span>Slot held until</span>
              <span>{timeOnly(order.hold_expires_at)}</span>
            </div>
          )}
        </div>
        <ErrorBox error={payError} />
        <div className="actions center">
          {canPay && (
            <button type="button" className="btn btn-primary" onClick={retry} disabled={busy}>
              {busy ? 'Opening…' : 'Try again'}
            </button>
          )}
          <Link to={`/orders/${order.id}`} className="btn">
            View order
          </Link>
          <Link to="/contact" className="btn">
            Contact us
          </Link>
        </div>
      </div>
    </div>
  )
}
