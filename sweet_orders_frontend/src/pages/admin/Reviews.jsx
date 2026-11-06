import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { dateTime } from '../../lib/format'
import { Empty, ErrorBox, Field, Loader, Notice, Pagination, Stars, Toggle, useApi } from '../../components/ui'

export default function Reviews() {
  const [params, setParams] = useSearchParams()
  const filters = {
    q: params.get('q') || '',
    rating: params.get('rating') || '',
    visible: params.get('visible') || '',
    page: params.get('page') || 1,
  }
  const { data, loading, error, reload } = useApi('/admin/reviews', filters)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const toggle = async (r) => {
    setBusyId(r.id)
    setActionError(null)
    try {
      const res = await api(`/admin/reviews/${r.id}`, { method: 'PUT', body: { is_visible: !r.is_visible } })
      setNotice(res.message)
      await reload()
    } catch (err) {
      setActionError(err)
    }
    setBusyId(null)
  }

  return (
    <div className="stack">
      <div>
        <h1>Reviews</h1>
        <span className="muted">Customers can review items from completed orders. Hide a review to remove it from the menu and the star average.</span>
      </div>
      <div className="filter-bar">
        <Field label="Search" className="grow">
          <input type="search" placeholder="Product, customer, comment or order" defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} />
        </Field>
        <Field label="Rating">
          <select value={filters.rating} onChange={(e) => set('rating', e.target.value)}>
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shown">
          <select value={filters.visible} onChange={(e) => set('visible', e.target.value)}>
            <option value="">Visible and hidden</option>
            <option value="1">Visible</option>
            <option value="0">Hidden</option>
          </select>
        </Field>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      {loading && !data ? (
        <Loader variant="table" />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No reviews match these filters." />
      ) : (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Visible</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{dateTime(r.created_at)}</td>
                    <td>{r.product_name}</td>
                    <td>
                      <Stars value={r.rating} small />
                    </td>
                    <td>{r.comment || <span className="muted">—</span>}</td>
                    <td>{r.customer_name}</td>
                    <td>
                      <Link to={`/admin/orders/${r.order_id}`}>{r.order_number}</Link>
                    </td>
                    <td>
                      <Toggle checked={!!r.is_visible} disabled={busyId === r.id} onChange={() => toggle(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(p) => set('page', p)} />
        </>
      )}
    </div>
  )
}
