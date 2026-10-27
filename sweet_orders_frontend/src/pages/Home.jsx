import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { ErrorBox, Loader, useApi } from '../components/ui'
import heroImg from '../assets/hero.svg'

export default function Home() {
  const categories = useApi('/categories')
  const featured = useApi('/products', { featured: 1, per_page: 4 })

  return (
    <div className="container page">
      <section className="hero">
        <div>
          <h1>Cakes and pastries, made to order</h1>
          <p className="muted">Order online, choose your size and flavor, and pick it up or have it delivered.</p>
          <div className="actions">
            <Link to="/menu" className="btn btn-primary">
              Order now
            </Link>
            <a href="#how" className="btn">
              How it works
            </a>
          </div>
        </div>
        <div className="hero-photo">
          <img src={heroImg} alt="" />
        </div>
      </section>

      <section>
        <h2>Shop by category</h2>
        {categories.loading ? (
          <Loader />
        ) : (
          <>
            <ErrorBox error={categories.error} onRetry={categories.reload} />
            <div className="category-row">
              {categories.data?.data.map((c) => (
                <Link key={c.id} to={`/menu?category=${c.slug}`} className="category-tile">
                  {c.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Featured</h2>
          <Link to="/menu">See full menu →</Link>
        </div>
        {featured.loading ? (
          <Loader />
        ) : (
          <>
            <ErrorBox error={featured.error} onRetry={featured.reload} />
            <div className="product-grid four">
              {featured.data?.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </section>

      <section id="how">
        <h2>How ordering works</h2>
        <div className="steps">
          {['Pick and customize', 'Choose pickup or delivery slot', 'Pay with GCash or card', 'Get SMS and email updates'].map((t, i) => (
            <div key={t} className="card step">
              <strong>{i + 1}</strong>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
