import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SOURCE_LABELS, STATUS_LABELS, dateTime, label, methodLabel, peso, pesoExact, shortDate } from '../../lib/format'
import { downloadCsv } from '../../lib/csv'
import { Empty, ErrorBox, Field, Loader, Segmented, SourceBadge, StatusBadge, useApi } from '../../components/ui'

const MAX_DAILY_BARS = 62
const FULFILLMENT = { pickup: 'Pickup', delivery: 'Delivery' }

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
]

function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

function iso(y, m, d) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
}

function presetRange(preset) {
  const today = manilaToday()
  const [y, m, d] = today.split('-').map(Number)
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    return { from: iso(y, m - 1, d - ((weekday + 6) % 7)), to: today }
  }
  if (preset === 'last_month') return { from: iso(y, m - 2, 1), to: iso(y, m - 1, 0) }
  return { from: iso(y, m - 1, 1), to: today }
}

function fullDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function periodLabel(from, to) {
  return from === to ? fullDate(from) : `${fullDate(from)} – ${fullDate(to)}`
}

function money(value) {
  return Number(value || 0).toFixed(2)
}

function chartBars(days) {
  if (days.length <= MAX_DAILY_BARS) {
    return days.map((d) => ({ key: d.date, label: shortDate(d.date), gross: d.gross }))
  }
  const months = new Map()
  days.forEach((d) => {
    const key = d.date.slice(0, 7)
    months.set(key, (months.get(key) || 0) + d.gross)
  })
  return [...months].map(([key, gross]) => ({
    key,
    label: new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    gross,
  }))
}

function reportRows(data) {
  const t = data.totals
  return [
    ['Sales report', data.from, data.to],
    [],
    ['Summary'],
    ['Gross paid', money(t.gross_paid)],
    ['Refunds', money(t.refunds)],
    ['Net', money(t.net)],
    ['Paid orders', t.paid_orders],
    ['Average order value', money(t.average_order_value)],
    ['Items sold', t.items_sold],
    ['Delivery fees', money(t.delivery_fees)],
    ['Add-ons (included in subtotals)', money(t.addons_total)],
    [],
    ['By payment method'],
    ['Method', 'Payments', 'Total'],
    ...data.by_method.map((m) => [methodLabel(m.method), m.payments, money(m.total)]),
    [],
    ['By fulfillment'],
    ['Type', 'Orders', 'Total'],
    ...data.by_fulfillment.map((f) => [FULFILLMENT[f.fulfillment], f.orders, money(f.total)]),
    [],
    ['By order source'],
    ['Source', 'Orders', 'Total'],
    ...data.by_source.map((x) => [SOURCE_LABELS[x.source], x.orders, money(x.total)]),
    [],
    ['Per day'],
    ['Date', 'Orders', 'Gross paid', 'Refunds', 'Net'],
    ...data.days.map((d) => [d.date, d.orders, money(d.gross), money(d.refunds), money(d.net)]),
    [],
    ['Top products by quantity'],
    ['Product', 'Quantity', 'Revenue'],
    ...data.top_by_quantity.map((p) => [p.name, p.quantity, money(p.revenue)]),
    [],
    ['Top products by revenue'],
    ['Product', 'Quantity', 'Revenue'],
    ...data.top_by_revenue.map((p) => [p.name, p.quantity, money(p.revenue)]),
    [],
    ['Orders'],
    ['Order', 'Paid date', 'Customer', 'Source', 'Entered by', 'Type', 'Items', 'Subtotal', 'Add-ons', 'Delivery fee', 'Total', 'Payment method', 'Reference', 'Status', 'Refunded', 'Refund date', 'Paid in this period', 'Refunded in this period'],
    ...data.orders.map((o) => [
      o.order_number,
      o.paid_at,
      o.customer_name,
      SOURCE_LABELS[o.source],
      o.entered_by,
      FULFILLMENT[o.fulfillment],
      o.items_count,
      money(o.subtotal),
      money(o.addons_total),
      money(o.delivery_fee),
      money(o.total),
      methodLabel(o.payment_method),
      o.reference,
      label(STATUS_LABELS, o.status),
      money(o.refund_amount),
      o.refunded_at,
      money(o.paid_in_period),
      money(o.refunded_in_period),
    ]),
  ]
}

function DayChart({ days }) {
  const bars = chartBars(days)
  const max = Math.max(...bars.map((b) => b.gross))
  const daily = days.length <= MAX_DAILY_BARS
  if (max === 0) return <p className="muted">No payments in this period.</p>
  const best = bars.find((b) => b.gross === max)
  return (
    <>
      <div className="report-bars" role="img" aria-label={`Gross paid per ${daily ? 'day' : 'month'}. Highest was ${peso(max)} on ${best.label}.`}>
        {bars.map((b) => (
          <div key={b.key} className="report-bar-col" title={`${b.label}: ${pesoExact(b.gross)}`}>
            <div className="report-bar" style={{ height: `${(b.gross / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="report-axis muted small">
        <span>{bars[0].label}</span>
        <span>Highest: {peso(max)}</span>
        <span>{bars[bars.length - 1].label}</span>
      </div>
    </>
  )
}

function TopTable({ title, rows }) {
  return (
    <section className="card stack report-section">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">Nothing sold in this period.</p>
      ) : (
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Qty</th>
                <th className="num">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="num">{p.quantity}</td>
                  <td className="num">{pesoExact(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Report({ data }) {
  const t = data.totals
  return (
    <>
      <div className="stat-row">
        <div className="card stat">
          <span className="muted small">Gross paid</span>
          <strong>{peso(t.gross_paid)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Refunds</span>
          <strong>{peso(t.refunds)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Net</span>
          <strong>{peso(t.net)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Paid orders</span>
          <strong>{t.paid_orders}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Average order</span>
          <strong>{peso(t.average_order_value)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Items sold</span>
          <strong>{t.items_sold}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Delivery fees</span>
          <strong>{peso(t.delivery_fees)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Add-ons</span>
          <strong>{peso(t.addons_total)}</strong>
        </div>
      </div>

      <section className="card stack report-section">
        <h3>Gross paid per {data.days.length <= MAX_DAILY_BARS ? 'day' : 'month'}</h3>
        <DayChart days={data.days} />
      </section>

      <div className="report-grid">
        <section className="card stack report-section">
          <h3>By payment method</h3>
          {data.by_method.length === 0 ? (
            <p className="muted">No payments in this period.</p>
          ) : (
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="num">Payments</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_method.map((m) => (
                    <tr key={m.method}>
                      <td>{methodLabel(m.method)}</td>
                      <td className="num">{m.payments}</td>
                      <td className="num">{pesoExact(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card stack report-section">
          <h3>By fulfillment</h3>
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="num">Orders</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.by_fulfillment.map((f) => (
                  <tr key={f.fulfillment}>
                    <td>{FULFILLMENT[f.fulfillment]}</td>
                    <td className="num">{f.orders}</td>
                    <td className="num">{pesoExact(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card stack report-section">
          <h3>By order source</h3>
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="num">Orders</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.by_source.map((x) => (
                  <tr key={x.source}>
                    <td>{SOURCE_LABELS[x.source]}</td>
                    <td className="num">{x.orders}</td>
                    <td className="num">{pesoExact(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <TopTable title="Top products by quantity" rows={data.top_by_quantity} />
        <TopTable title="Top products by revenue" rows={data.top_by_revenue} />
      </div>

      <section className="stack report-section">
        <h3>Orders</h3>
        {data.orders.length === 0 ? (
          <Empty title="No paid orders or refunds in this period." />
        ) : (
          <div className="table-wrap card">
            <table className="report-table report-orders">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Paid</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th className="num">Items</th>
                  <th className="num">Subtotal</th>
                  <th className="num">Add-ons</th>
                  <th className="num">Delivery</th>
                  <th className="num">Total</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th className="num">Refunded</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="nowrap">
                      <Link to={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                    </td>
                    <td className="nowrap">
                      {dateTime(o.paid_at)}
                      {o.paid_in_period === 0 && <div className="muted small">Paid before this period</div>}
                    </td>
                    <td>
                      {o.customer_name} <SourceBadge source={o.source} />
                      {o.entered_by && <div className="muted small">Entered by {o.entered_by}</div>}
                    </td>
                    <td>{FULFILLMENT[o.fulfillment]}</td>
                    <td className="num">{o.items_count}</td>
                    <td className="num">{pesoExact(o.subtotal)}</td>
                    <td className="num">{pesoExact(o.addons_total)}</td>
                    <td className="num">{pesoExact(o.delivery_fee)}</td>
                    <td className="num">{pesoExact(o.total)}</td>
                    <td>{methodLabel(o.payment_method)}</td>
                    <td>{o.reference || '—'}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="num">
                      {o.refund_amount > 0 ? pesoExact(o.refund_amount) : '—'}
                      {o.refund_amount > 0 && o.refunded_in_period === 0 && <div className="muted small">After this period</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default function SalesReport() {
  const [preset, setPreset] = useState('month')
  const [custom, setCustom] = useState(() => presetRange('month'))
  const customValid = custom.from && custom.to && custom.to >= custom.from
  const range = preset !== 'custom' ? presetRange(preset) : customValid ? custom : null
  const { data, loading, error, reload } = useApi(range ? '/admin/reports/sales' : null, range)
  const ready = range && !loading && !error && data

  function choose(next) {
    if (next === 'custom' && range) setCustom(range)
    setPreset(next)
  }

  return (
    <div className="stack report-page">
      <div className="report-head">
        <div>
          <h1>Sales report</h1>
          <span className="muted">{range ? periodLabel(range.from, range.to) : 'Pick a date range'}</span>
        </div>
        <div className="row no-print">
          <button
            type="button"
            className="btn btn-light btn-small"
            disabled={!ready}
            onClick={() => downloadCsv(`sales_${data.from}_to_${data.to}.csv`, reportRows(data))}
          >
            Download CSV
          </button>
          <button type="button" className="btn btn-light btn-small" disabled={!ready} onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <div className="filter-bar no-print">
        <Segmented value={preset} onChange={choose} options={PRESETS} />
        {preset === 'custom' && (
          <>
            <Field label="From">
              <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </Field>
            <Field label="To" error={custom.from && custom.to && !customValid ? 'Cannot be before the start date.' : null}>
              <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      <p className="muted small">
        Sales count on the day the payment was recorded, and refunds on the day the refund was recorded (Philippine time). Add-ons are already inside each subtotal. A cancelled order stays in gross paid until its refund is recorded.
      </p>

      {!range ? null : loading ? <Loader /> : error ? <ErrorBox error={error} onRetry={reload} /> : <Report data={data} />}
    </div>
  )
}
