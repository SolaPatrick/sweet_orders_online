import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { peso } from '../lib/format'
import { Empty, Photo, QuantityStepper } from '../components/ui'

export default function Cart() {
  const { items, subtotal, leadHours, setQuantity, remove } = useCart()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div className="container page">
        <h1>Your cart</h1>
        <Empty title="Your cart is empty.">
          <Link to="/menu" className="btn btn-primary">
            Browse the menu
          </Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="container page">
      <h1>Your cart</h1>
      <div className="two-col">
        <div className="stack">
          {items.map((i) => (
            <div key={i.key} className="card cart-line">
              <Photo src={i.image_url} alt={i.name} className="thumb" />
              <div className="grow">
                <strong>{i.name}</strong>
                <div className="muted small">
                  {[...i.option_labels, i.cake_message && `"${i.cake_message}"`, i.notes && `Notes: ${i.notes}`].filter(Boolean).join(' · ')}
                </div>
                <div className="small">
                  <Link to={`/products/${i.product_id}`}>Edit</Link> ·{' '}
                  <button type="button" className="link-button" onClick={() => remove(i.key)}>
                    Remove
                  </button>
                </div>
              </div>
              <QuantityStepper value={i.quantity} onChange={(q) => setQuantity(i.key, q)} />
              <strong className="line-total">{peso(i.unit_price * i.quantity)}</strong>
            </div>
          ))}
          <Link to="/menu">← Continue shopping</Link>
        </div>
        <aside className="card summary">
          <h3>Order summary</h3>
          <div className="kv">
            <span>Subtotal</span>
            <strong>{peso(subtotal)}</strong>
          </div>
          <div className="kv">
            <span>Delivery fee</span>
            <span>at checkout</span>
          </div>
          <div className="kv total">
            <span>Total</span>
            <strong>{peso(subtotal)}</strong>
          </div>
          {leadHours > 0 && <p className="muted small">Your cart needs {leadHours} hours of preparation, so earlier time slots are hidden at checkout.</p>}
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
        </aside>
      </div>
    </div>
  )
}
