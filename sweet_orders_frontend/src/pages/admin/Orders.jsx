import { Link, useSearchParams } from 'react-router-dom'
import { clock, peso, shortDate, STATUS_LABELS } from '../../lib/format'
import { Empty, ErrorBox, Field, Loader, Pagination, Segmented, StatusBadge, useApi } from '../../components/ui'

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const filters = {
    status: params.get('status') || '',
    q: params.get('q') || '',
    date: params.get('date') || '',
    fulfillment: params.get('fulfillment') || '',
    page: params.get('page') || 1,
  }
  const { data, loading, error, reload } = useApi('/admin/orders', filters)
  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const counts = data?.counts || {}

  return (
    <div className="stack">
      <div>
        <h1>Orders</h1>
        <span className="muted">{counts.all ?? 0} orders</span>
      </div>
      <Segmented
        className="wrap"
        value={filters.status}
        onChange={(v) => set('status', v)}
        options={[{ value: '', label: 'All' }, ...Object.entries(STATUS_LABELS).map(([value, text]) => ({ value, label: `${text}${counts[value] ? ` (${counts[value]})` : ''}` }))]}
      />
      <div className="filter-bar">
        <Field label="Search" className="grow">
          <input type="search" placeholder="Order number, name, phone" defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} />
        </Field>
        <Field label="Slot date">
          <input type="date" value={filters.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Type">
          <select value={filters.fulfillment} onChange={(e) => set('fulfillment', e.target.value)}>
            <option value="">Pickup and delivery</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </Field>
      </div>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No orders match these filters." />
      ) : (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Slot</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.map((o) => (
                  <tr key={o.id}>
                    <td>{o.order_number}</td>
                    <td>
                      {shortDate(o.slot_date)} · {clock(o.start_time)}
                    </td>
                    <td>{o.customer_name}</td>
                    <td>{o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</td>
                    <td>{o.item_count}</td>
                    <td>{peso(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="right">
                      <Link to={`/admin/orders/${o.id}`}>Open →</Link>
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
