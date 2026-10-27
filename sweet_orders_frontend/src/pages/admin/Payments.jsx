import { Link, useSearchParams } from 'react-router-dom'
import { dateTime, peso, methodLabel } from '../../lib/format'
import { Empty, ErrorBox, Field, Loader, Pagination, StatusBadge, useApi } from '../../components/ui'

const PAY_LABELS = { pending: 'Pending', paid: 'Paid', failed: 'Failed', expired: 'Expired' }

export default function Payments() {
  const [params, setParams] = useSearchParams()
  const filters = { q: params.get('q') || '', status: params.get('status') || '', method: params.get('method') || '', page: params.get('page') || 1 }
  const { data, loading, error, reload } = useApi('/admin/payments', filters)
  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const s = data?.summary

  return (
    <div className="stack">
      <div>
        <h1>Payments</h1>
        <span className="muted">PayMongo checkout payments</span>
      </div>
      {s && (
        <div className="stat-row">
          <div className="card stat">
            <span className="muted small">Collected</span>
            <strong>{peso(s.collected_this_week)}</strong>
            <span className="muted small">this week</span>
          </div>
          {Object.entries(PAY_LABELS).map(([k, v]) => (
            <div key={k} className="card stat">
              <span className="muted small">{v}</span>
              <strong>{s[k]}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="filter-bar">
        <Field label="Search" className="grow">
          <input type="search" placeholder="Order number or reference" defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} />
        </Field>
        <Field label="Status">
          <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All</option>
            {Object.entries(PAY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Method">
          <select value={filters.method} onChange={(e) => set('method', e.target.value)}>
            <option value="">GCash and card</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
          </select>
        </Field>
      </div>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No payments found." />
      ) : (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id}>
                    <td>{dateTime(p.paid_at || p.created_at)}</td>
                    <td>
                      <Link to={`/admin/orders/${p.order_id}`}>{p.order_number}</Link>
                    </td>
                    <td>{p.customer_name}</td>
                    <td>{methodLabel(p.method)}</td>
                    <td className="mono">{p.reference || p.checkout_session_id || '—'}</td>
                    <td>{peso(p.amount)}</td>
                    <td>
                      <StatusBadge status={p.status} map={PAY_LABELS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(p) => set('page', p)} />
        </>
      )}
      <p className="muted small">Payments are marked Paid by the PayMongo webhook. Each row links to its order.</p>
    </div>
  )
}
