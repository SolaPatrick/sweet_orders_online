import { Link } from 'react-router-dom'
import { peso } from '../lib/format'
import { Photo, Stars } from './ui'

export default function ProductCard({ product }) {
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
        {product.is_available && product.sold_out_today ? <span className="badge badge-warning">Sold out today</span> : null}
      </div>
    </Link>
  )
}
