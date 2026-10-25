import { Link } from 'react-router-dom'
import { clock, peso, timeOnly, methodLabel } from '../../lib/format'
import { Empty, ErrorBox, Loader, StatusBadge, useApi } from '../../components/ui'

// A1 Dashboard
export default function Dashboard() {
  const { data, loading, error, reload } = useApi('/admin/dashboard')
  if (loading) return <Loader />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const { stats, sales_last_7_days: sales, due_today: due, recent_orders: recent } = data
  const max = Math.max(1, ...sales.map((s) => s.total))

  return (
    <div className="stack">
      <div>
        <h1>Dashboard</h1>
        <span className="muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div className="stat-row">
        <div className="card stat">
          <span className="muted small">Orders today</span>
          <strong>{stats.orders_today}</strong>
          <span className="muted small">{stats.waiting_payment} waiting for payment</span>
        </div>
        <div className="card stat">
          <span className="muted small">Sales today</span>
          <strong>{peso(stats.sales_today)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Sales this week</span>
          <strong>{peso(stats.sales_week)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">To prepare</span>
          <strong>{stats.to_prepare}</strong>
          <span className="muted small">paid + preparing</span>
        </div>
        <div className="card stat">
          <span className="muted small">Slots booked today</span>
          <strong>
            {stats.slots_booked_today} / {stats.slots_capacity_today}
          </strong>
        </div>
      </div>

      <div className="two-col wide-left">
        <section>
          <h3>Due today</h3>
          {due.length === 0 ? (
            <Empty title="Nothing scheduled for today." />
          ) : (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {due.map((o) => (
                    <tr key={o.id}>
                      <td>{clock(o.start_time)}</td>
                      <td>
                        <Link to={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                      </td>
                      <td>{o.customer_name}</td>
                      <td>{o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <h3>Sales, last 7 days</h3>
          <div className="bars" role="img" aria-label="Sales for the last 7 days">
            {sales.map((s) => (
              <div key={s.date} className="bar-col" title={`${s.date}: ${peso(s.total)}`}>
                <div className="bar" style={{ height: `${Math.max(2, (s.total / max) * 100)}%` }} />
                <span>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h3>Recent orders</h3>
        {recent.length === 0 ? (
          <Empty title="No orders yet." />
        ) : (
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                    </td>
                    <td>{timeOnly(o.created_at)}</td>
                    <td>{o.customer_name}</td>
                    <td>{peso(o.total)}</td>
                    <td>{methodLabel(o.payment_method)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
