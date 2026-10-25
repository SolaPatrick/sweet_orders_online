import { Link } from 'react-router-dom'
import { peso } from '../lib/format'
import { Photo } from './ui'

export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <Photo src={product.image_url} alt={product.name} />
      <div className="product-card-body">
        <strong>{product.name}</strong>
        <span className="muted">
          {product.is_customizable ? 'from ' : ''}
          {peso(product.base_price)}
          {!product.is_available && ' · Sold out'}
        </span>
      </div>
    </Link>
  )
}
