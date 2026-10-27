import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { dateTime, EVENT_LABELS, label } from '../../lib/format'
import { Empty, ErrorBox, Loader, Notice, Pagination, Segmented, StatusBadge, useApi } from '../../components/ui'

const STATUS = { sent: 'Sent', failed: 'Failed', logged: 'Logged' }

export default function Notifications() {
  const [params, setParams] = useSearchParams()
  const filters = { channel: params.get('channel') || '', status: params.get('status') || '', page: params.get('page') || 1 }
  const { data, loading, error, reload } = useApi('/admin/notifications', filters)
  const [open, setOpen] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)
  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const resend = async (n) => {
    setActionError(null)
    try {
      const res = await api(`/admin/notifications/${n.id}/resend`, { method: 'POST', body: {} })
      setNotice(res.message)
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Notification log</h1>
        <span className="muted">Every email and SMS sent for order events</span>
      </div>
      <div className="row wrap">
        <Segmented value={filters.channel} onChange={(v) => set('channel', v)} options={[{ value: '', label: 'All' }, { value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }]} />
        <Segmented value={filters.status} onChange={(v) => set('status', v)} options={[{ value: '', label: 'Any status' }, ...Object.entries(STATUS).map(([value, l]) => ({ value, label: l }))]} />
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No messages yet." />
      ) : (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Channel</th>
                  <th>Event</th>
                  <th>Order</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.map((n) => (
                  <Fragment key={n.id}>
                    <tr>
                      <td>{dateTime(n.created_at)}</td>
                      <td>{n.channel === 'sms' ? 'SMS' : 'Email'}</td>
                      <td>{label(EVENT_LABELS, n.event)}</td>
                      <td>{n.order_number || '—'}</td>
                      <td>{n.recipient}</td>
                      <td>
                        <StatusBadge status={n.status} map={STATUS} />
                      </td>
                      <td className="right nowrap">
                        <button type="button" className="link-button" onClick={() => setOpen(open === n.id ? null : n.id)}>
                          {open === n.id ? 'Hide' : 'View'}
                        </button>
                        {n.status === 'failed' && (
                          <>
                            {' · '}
                            <button type="button" className="link-button" onClick={() => resend(n)}>
                              Resend
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {open === n.id && (
                      <tr className="detail-row">
                        <td colSpan={7}>
                          {n.subject && <strong>{n.subject}</strong>}
                          <pre>{n.message}</pre>
                          {n.error && <p className="field-error">{n.error}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(p) => set('page', p)} />
        </>
      )}
      <p className="muted small">Logged means the message was saved but not sent because no email or SMS account is set up (test mode). Failed messages can be resent.</p>
    </div>
  )
}
