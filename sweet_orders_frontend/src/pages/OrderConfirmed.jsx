import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { peso, slotLabel, methodLabel } from '../lib/format'
import { ErrorBox, Loader } from '../components/ui'

export default function OrderConfirmed() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let timer
    api(`/orders/${id}`)
      .then((d) => {
        setOrder(d.data)
        if (d.data.payment_status !== 'paid' && d.data.status === 'pending_payment' && tries < 6) {
          timer = setTimeout(() => setTries((t) => t + 1), 3000)
        }
      })
      .catch(setError)
    return () => clearTimeout(timer)
  }, [id, tries])

  if (error) return <div className="container page"><ErrorBox error={error} /></div>
  if (!order) return <Loader />
  const paid = order.payment_status === 'paid'
  const method = order.payments.find((p) => p.status === 'paid')?.method

  return (
    <div className="container page narrow">
      <div className="card result">
        <div className="result-icon">{paid ? '✓' : '…'}</div>
        <h1>{paid ? 'Thank you! Your order is confirmed' : 'Waiting for payment confirmation'}</h1>
        <p className="muted">
          Order {order.order_number}
          {paid && method ? ` · Paid · ${methodLabel(method)}` : ''}
        </p>
        <div className="panel">
          <div className="kv">
            <span>{order.fulfillment === 'pickup' ? 'Pickup at the café' : 'Delivery'}</span>
            <span>{slotLabel(order)}</span>
          </div>
          <div className="kv">
            <span>Items</span>
            <span>{order.items.map((i) => `${i.product_name} × ${i.quantity}`).join(', ')}</span>
          </div>
          <div className="kv total">
            <span>{paid ? 'Total paid' : 'Total'}</span>
            <strong>{peso(order.total)}</strong>
          </div>
        </div>
        <p className="muted small">
          {paid
            ? 'We sent a confirmation by email and SMS. You will get another message when your order is ready.'
            : 'If you finished paying, this page updates in a few seconds. You can also open the order later from My orders.'}
        </p>
        <div className="actions center">
          <Link to={`/orders/${order.id}`} className="btn btn-primary">
            Track this order
          </Link>
          <Link to="/menu" className="btn">
            Back to menu
          </Link>
        </div>
      </div>
    </div>
  )
}
