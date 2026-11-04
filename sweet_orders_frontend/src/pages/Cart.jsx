import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { peso } from '../lib/format'
import { Empty, Photo, QuantityStepper } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { AllergenLine } from '../components/Allergens'
import LineExtras from '../components/LineExtras'

export default function Cart() {
  const { items, checkoutItems, checkoutCount, checkoutSubtotal, checkoutLeadHours, allSelected, setQuantity, setSelected, selectAll, remove } = useCart()
  const navigate = useNavigate()
  const { user } = useAuth()

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
          <label className="cart-select-all">
            <input type="checkbox" checked={allSelected} onChange={(e) => selectAll(e.target.checked)} />
            <span>
              Select all ({checkoutItems.length} of {items.length} selected)
            </span>
          </label>
          {items.map((i) => (
            <div key={i.key} className={`card cart-line${i.selected === false ? ' is-off' : ''}`}>
              <label className="cart-pick">
                <input
                  type="checkbox"
                  checked={i.selected !== false}
                  onChange={(e) => setSelected(i.key, e.target.checked)}
                  aria-label={`Include ${i.name} in checkout`}
                />
                <Photo src={i.image_url} alt={i.name} className="thumb" />
              </label>
              <div className="grow">
                <strong>{i.name}</strong>
                <div className="muted small">
                  {[...i.option_labels, i.cake_message && `"${i.cake_message}"`, i.notes && `Notes: ${i.notes}`].filter(Boolean).join(' · ')}
                </div>
                <LineExtras addons={i.addons} photoUrl={i.design_photo_url} />
                <AllergenLine allergens={i.allergens} mine={user?.allergies} />
                <div className="small">
                  <Link to={`/products/${i.product_id}`}>Edit</Link> ·{' '}
                  <button type="button" className="link-button" onClick={() => remove(i.key)}>
                    Remove
                  </button>
                </div>
              </div>
              <div className="cart-line-end">
                <QuantityStepper value={i.quantity} onChange={(q) => setQuantity(i.key, q)} max={i.max_qty ?? 50} />
                {i.max_qty !== undefined && i.max_qty < 50 && i.quantity >= i.max_qty && <span className="muted small">Only {i.max_qty} left</span>}
                <strong className="line-total">{peso(i.unit_price * i.quantity)}</strong>
              </div>
            </div>
          ))}
          <Link to="/menu">← Continue shopping</Link>
        </div>
        <aside className="card summary">
          <h3>Order summary</h3>
          <div className="kv">
            <span>Items selected</span>
            <span>{checkoutCount}</span>
          </div>
          <div className="kv">
            <span>Subtotal</span>
            <strong>{peso(checkoutSubtotal)}</strong>
          </div>
          <div className="kv">
            <span>Delivery fee</span>
            <span>at checkout</span>
          </div>
          <div className="kv total">
            <span>Total</span>
            <strong>{peso(checkoutSubtotal)}</strong>
          </div>
          {checkoutLeadHours > 0 && <p className="muted small">Your selected items need {checkoutLeadHours} hours of preparation, so earlier time slots are hidden at checkout.</p>}
          <button type="button" className="btn btn-primary btn-block" disabled={!checkoutItems.length} onClick={() => navigate('/checkout')}>
            {checkoutItems.length ? 'Proceed to checkout' : 'Select items to check out'}
          </button>
        </aside>
      </div>
    </div>
  )
}
