import { Link, useSearchParams } from 'react-router-dom'
import { clock, peso, shortDate } from '../lib/format'
import { Empty, ErrorBox, Loader, Segmented, StatusBadge, useApi } from '../components/ui'

export default function MyOrders() {
  const [params, setParams] = useSearchParams()
  const scope = params.get('scope') || 'all'
  const { data, loading, error, reload } = useApi('/orders', { scope })

  return (
    <div className="container page">
      <h1>My orders</h1>
      <Segmented
        value={scope}
        onChange={(v) => setParams(v === 'all' ? {} : { scope: v })}
        options={[
          { value: 'all', label: `All${data ? ` (${data.counts.all})` : ''}` },
          { value: 'active', label: `Active${data ? ` (${data.counts.active})` : ''}` },
          { value: 'past', label: `Past${data ? ` (${data.counts.past})` : ''}` },
        ]}
      />
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No orders here yet.">
          <Link to="/menu" className="btn btn-primary">
            Order something sweet
          </Link>
        </Empty>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Pickup / delivery</th>
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
                  <td>{shortDate(o.created_at)}</td>
                  <td>
                    {o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} · {shortDate(o.slot_date)}, {clock(o.start_time)}
                  </td>
                  <td>{o.item_count}</td>
                  <td>{peso(o.total)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="right">
                    <Link to={`/orders/${o.id}`}>{o.status === 'pending_payment' ? 'Pay now →' : 'View →'}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">An unpaid order shows Pay now until its 60-minute hold ends.</p>
    </div>
  )
}
