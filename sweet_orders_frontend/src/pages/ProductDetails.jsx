import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { dateTime, peso } from '../lib/format'
import { Empty, ErrorBox, Field, Loader, Pagination, Photo, QuantityStepper, Segmented, Stars, useApi } from '../components/ui'
import NotFound from './NotFound'

const GROUPS = ['size', 'flavor', 'frosting']

export default function ProductDetails() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(`/products/${id}`)
  if (loading) return <Loader />
  if (error?.status === 404) return <NotFound />
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>
  return <ProductView product={data.data} />
}

function ProductView({ product }) {
  const { add } = useCart()
  const navigate = useNavigate()
  const groups = useMemo(
    () => GROUPS.map((g) => ({ group: g, options: product.options.filter((o) => o.option_group === g) })).filter((g) => g.options.length),
    [product],
  )
  const [chosen, setChosen] = useState(() => Object.fromEntries(groups.map((g) => [g.group, g.options[0].id])))
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const selected = groups.map((g) => g.options.find((o) => o.id === chosen[g.group])).filter(Boolean)
  const unitPrice = product.base_price + selected.reduce((n, o) => n + o.price_add, 0)

  const addToCart = () => {
    add({
      product_id: product.id,
      name: product.name,
      image_url: product.image_url,
      unit_price: unitPrice,
      option_ids: selected.map((o) => o.id),
      option_labels: selected.map((o) => o.name),
      cake_message: product.is_customizable ? message.trim() : '',
      notes: notes.trim(),
      quantity,
      lead_time_hours: product.lead_time_hours,
    })
    setAdded(true)
  }

  return (
    <div className="container page">
      <nav className="breadcrumb">
        <Link to="/menu">Menu</Link> / <Link to={`/menu?category=${product.category_slug}`}>{product.category_name}</Link> / {product.name}
      </nav>
      <div className="product-detail">
        <Photo src={product.image_url} alt={product.name} className="large" />
        <div className="stack">
          <h1>{product.name}</h1>
          <a href="#reviews" className="plain-link">
            <Stars value={product.rating_avg} count={product.rating_count} />
          </a>
          <div className="price">{peso(unitPrice)}</div>
          {product.is_available && product.sold_out_today ? (
            <div className="alert alert-warning">Sold out today. You can still order it for another day.</div>
          ) : null}
          <p className="muted">
            {product.description}
            {product.lead_time_hours > 0 && ` Needs ${product.lead_time_hours} hours of preparation.`}
          </p>
          {groups.map((g) => (
            <div key={g.group} className="option-group">
              <span className="field-label">{g.group[0].toUpperCase() + g.group.slice(1)}</span>
              <Segmented
                value={chosen[g.group]}
                onChange={(v) => setChosen((c) => ({ ...c, [g.group]: v }))}
                options={g.options.map((o) => ({ value: o.id, label: o.price_add ? `${o.name} +${peso(o.price_add)}` : o.name }))}
              />
            </div>
          ))}
          {product.is_customizable ? (
            <Field label="Cake message (optional, 100 characters)">
              <input maxLength={100} value={message} placeholder="Happy Birthday, Ana!" onChange={(e) => setMessage(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Notes for the baker">
            <input maxLength={255} value={notes} placeholder="e.g. less sweet" onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="row">
            <span className="field-label">Quantity</span>
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </div>
          {product.is_available ? (
            <button type="button" className="btn btn-primary btn-block" onClick={addToCart}>
              Add to cart · {peso(unitPrice * quantity)}
            </button>
          ) : (
            <button type="button" className="btn btn-block" disabled>
              Sold out
            </button>
          )}
          {added && (
            <div className="alert alert-success">
              Added to your cart.
              <button type="button" className="btn btn-small" onClick={() => navigate('/cart')}>
                Go to cart
              </button>
            </div>
          )}
        </div>
      </div>
      <ProductReviews productId={product.id} />
    </div>
  )
}

function ProductReviews({ productId }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApi(`/products/${productId}/reviews`, { page, per_page: 5 })
  return (
    <section id="reviews" className="stack reviews">
      <h2>Reviews</h2>
      {loading && !data ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No reviews yet.">Customers can rate this after their order is completed.</Empty>
      ) : (
        <>
          <Stars value={data.summary.rating_avg} count={data.summary.rating_count} />
          {data.data.map((r) => (
            <article key={r.id} className="card review">
              <div className="row wrap">
                <Stars value={r.rating} small />
                <strong>{r.author}</strong>
                <span className="muted small">{dateTime(r.created_at)}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
            </article>
          ))}
          <Pagination meta={data.meta} onPage={setPage} />
        </>
      )}
    </section>
  )
}
