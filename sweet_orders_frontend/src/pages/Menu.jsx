import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { Empty, ErrorBox, Loader, Pagination, useApi } from '../components/ui'

export default function Menu() {
  const [params, setParams] = useSearchParams()
  const filters = {
    category: params.get('category') || '',
    q: params.get('q') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    available: params.get('available') || '',
    sort: params.get('sort') || 'featured',
    exclude_allergens: params.get('exclude_allergens') || '',
    page: params.get('page') || 1,
  }
  const [moreOpen, setMoreOpen] = useState(false)
  const categories = useApi('/categories')
  const allergens = useApi('/allergens')
  const hidden = filters.exclude_allergens ? filters.exclude_allergens.split(',').map(Number) : []
  const products = useApi('/products', { ...filters, per_page: 12 })

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === null || value === false) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Menu</h1>
          <span className="muted">{products.data ? `${products.data.meta.total} products` : ''}</span>
        </div>
        <div className="toolbar">
          <label className="field">
            <span className="field-label">Search</span>
            <input type="search" placeholder="Search cakes, pastries…" defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Sort by</span>
            <select value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="featured">Featured</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </div>

      <div className="menu-layout">
        <aside className={`card filters ${moreOpen ? 'open' : ''}`}>
          <strong className="filter-title">Categories</strong>
          <div className="filter-cats">
            <button type="button" className={`filter-link ${!filters.category ? 'active' : ''}`} onClick={() => set('category', '')}>
              All
            </button>
            {categories.data?.data.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`filter-link ${filters.category === c.slug ? 'active' : ''}`}
                onClick={() => set('category', c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <button type="button" className="filter-more-toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
            <span>Price, availability and allergens</span>
            <span aria-hidden="true">{moreOpen ? '−' : '+'}</span>
          </button>
          <div className="filter-more">
            <strong className="filter-title">Price</strong>
            <div className="filter-price">
              <label className="field">
                <span className="field-label">Min</span>
                <input type="number" min="0" placeholder="₱0" defaultValue={filters.min} onChange={(e) => set('min', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Max</span>
                <input type="number" min="0" placeholder="₱3,000" defaultValue={filters.max} onChange={(e) => set('max', e.target.value)} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={filters.available === '1'} onChange={(e) => set('available', e.target.checked ? '1' : '')} />
              Available only
            </label>
            <strong className="filter-title">Hide items with</strong>
            <div className="allergen-filter">
              {allergens.data?.data.map((a) => (
                <label key={a.id} className="check">
                  <input
                    type="checkbox"
                    checked={hidden.includes(a.id)}
                    onChange={(e) =>
                      set(
                        'exclude_allergens',
                        (e.target.checked ? [...hidden, a.id] : hidden.filter((id) => id !== a.id)).sort((x, y) => x - y).join(','),
                      )
                    }
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <section>
          {products.loading ? (
            <Loader variant="cards" />
          ) : products.error ? (
            <ErrorBox error={products.error} onRetry={products.reload} />
          ) : products.data.data.length === 0 ? (
            <Empty title="No products match your filters.">Try another search or category.</Empty>
          ) : (
            <>
              <div className="product-grid">
                {products.data.data.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <Pagination meta={products.data.meta} onPage={(p) => set('page', p)} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
