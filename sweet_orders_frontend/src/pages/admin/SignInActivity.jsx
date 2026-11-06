import { useState } from 'react'
import { dateTime } from '../../lib/format'
import { Empty, ErrorBox, Field, Loader, Pagination, Segmented, useApi } from '../../components/ui'

const REASONS = {
  ok: 'Signed in',
  wrong_password: 'Wrong password',
  unknown_email: 'No such account',
  locked: 'Blocked (too many tries)',
  disabled: 'Account disabled',
}

function device(agent) {
  if (!agent) return '—'
  const os = /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iPhone/iPad' : /Windows/i.test(agent) ? 'Windows' : /Mac OS/i.test(agent) ? 'Mac' : /Linux/i.test(agent) ? 'Linux' : ''
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : ''
  return [browser, os].filter(Boolean).join(' on ') || agent.slice(0, 40)
}

export default function SignInActivity() {
  const [failed, setFailed] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApi('/admin/login-attempts', { failed, q, page })

  return (
    <div className="stack">
      <div>
        <h1>Sign-in activity</h1>
        <span className="muted">
          Every login attempt, newest first. After 5 wrong passwords in 15 minutes, that account is blocked from signing in for 15 minutes.
          {data ? ` Failed attempts in the last 24 hours: ${data.summary.failed_last_24h}.` : ''}
        </span>
      </div>
      <div className="filter-bar">
        <Field label="Search" className="grow">
          <input
            type="search"
            value={q}
            placeholder="Email or IP address"
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </Field>
        <div className="stack-tight">
          <span className="field-label">Show</span>
          <Segmented
            value={failed}
            onChange={(v) => {
              setFailed(v)
              setPage(1)
            }}
            options={[
              { value: '', label: 'All attempts' },
              { value: '1', label: 'Failed only' },
            ]}
          />
        </div>
      </div>
      {loading && !data ? (
        <Loader variant="table" />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No sign-in attempts found." />
      ) : (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Email</th>
                  <th>Result</th>
                  <th>IP address</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{dateTime(a.created_at)}</td>
                    <td>
                      {a.email}
                      {a.user_name && <div className="muted small">{a.user_name}{a.user_role !== 'customer' ? ` · ${a.user_role}` : ''}</div>}
                    </td>
                    <td>
                      <span className={`badge ${a.success ? 'badge-paid' : a.reason === 'locked' ? 'badge-cancelled' : 'badge-warning'}`}>{REASONS[a.reason] || a.reason}</span>
                    </td>
                    <td className="nowrap">{a.ip || '—'}</td>
                    <td className="small" title={a.user_agent || ''}>
                      {device(a.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={setPage} />
        </>
      )}
    </div>
  )
}
