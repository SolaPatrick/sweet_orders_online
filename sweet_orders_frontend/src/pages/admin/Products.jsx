import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { peso } from '../../lib/format'
import { ConfirmDialog, Empty, ErrorBox, Field, Loader, Notice, Photo, Toggle, useApi } from '../../components/ui'

// A4 Products list
export default function Products() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const products = useApi('/admin/products', { q, category })
  const categories = useApi('/admin/categories')
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)

  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  // Quick availability switch: saves the product with is_available flipped.
  const toggleAvailable = async (p) => {
    setError(null)
    try {
      await api(`/admin/products/${p.id}`, {
        method: 'PUT',
        body: {
          name: p.name,
          category_id: p.category_id,
          base_price: p.base_price,
          lead_time_hours: p.lead_time_hours,
          description: p.description || '',
          is_featured: p.is_featured,
          is_customizable: p.is_customizable,
          is_available: !p.is_available,
        },
      })
      products.reload()
    } catch (err) {
      setError(err)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api(`/admin/products/${toDelete.id}`, { method: 'DELETE' })
      setNotice(res.message)
      products.reload()
    } catch (err) {
      setError(err)
    }
    setToDelete(null)
    setBusy(false)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <span className="muted">{products.data?.meta.total ?? 0} products</span>
        </div>
        <Link to="/admin/products/new" className="btn btn-primary">
          + Add product
        </Link>
      </div>
      <div className="filter-bar">
        <Field label="Search" className="grow">
          <input type="search" placeholder="Product name" defaultValue={q} onChange={(e) => set('q', e.target.value)} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => set('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={error} />
      {products.loading ? (
        <Loader />
      ) : products.error ? (
        <ErrorBox error={products.error} onRetry={products.reload} />
      ) : products.data.data.length === 0 ? (
        <Empty title="No products found." />
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Base price</th>
                <th>Lead time</th>
                <th>Featured</th>
                <th>Available</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.data.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="row">
                      <Photo src={p.image_url} alt="" className="mini" />
                      {p.name}
                    </div>
                  </td>
                  <td>{p.category_name}</td>
                  <td>{peso(p.base_price)}</td>
                  <td>{p.lead_time_hours} h</td>
                  <td>{p.is_featured ? 'Yes' : 'No'}</td>
                  <td>
                    <Toggle checked={!!p.is_available} onChange={() => toggleAvailable(p)} />
                  </td>
                  <td className="right nowrap">
                    <Link to={`/admin/products/${p.id}/edit`}>Edit</Link> ·{' '}
                    <button type="button" className="link-button danger" onClick={() => setToDelete(p)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Turning Available off marks the product as sold out on the menu instead of hiding it.</p>
      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.name}?`}
        message="The product and its options will be removed from the menu. Past orders keep their copy of the name and price. This cannot be undone."
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
