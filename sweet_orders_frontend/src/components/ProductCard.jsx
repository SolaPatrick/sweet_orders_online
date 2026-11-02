import { Link } from 'react-router-dom'
import { availability, peso } from '../lib/format'
import { Photo, Stars } from './ui'

export default function ProductCard({ product }) {
  const badge = availability(product)
  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <div className="product-card-media">
        <Photo src={product.image_url} alt={product.name} />
        <span className="price-sticker">
          {product.is_customizable ? <small>from</small> : null}
          {peso(product.base_price)}
        </span>
      </div>
      <div className="product-card-body">
        <strong>{product.name}</strong>
        {!product.is_available && <span className="muted">Sold out</span>}
        {product.rating_count > 0 && <Stars value={product.rating_avg} count={product.rating_count} small />}
        {badge && <span className={`badge badge-${badge.tone}`}>{badge.text}</span>}
      </div>
    </Link>
  )
}
