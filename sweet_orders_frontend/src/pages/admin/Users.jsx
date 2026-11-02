import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { dateTime, label, ROLE_LABELS } from '../../lib/format'
import { ConfirmDialog, Empty, ErrorBox, Field, Loader, Notice, Pagination, Segmented, StatusBadge, useApi } from '../../components/ui'

export default function Users() {
  const { user: me } = useAuth()
  const [params, setParams] = useSearchParams()
  const filters = { q: params.get('q') || '', role: params.get('role') || '', page: params.get('page') || 1 }
  const { data, loading, error, reload } = useApi('/admin/users', filters)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState(null)

  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const counts = data?.counts || {}

  const apply = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await api(`/admin/users/${pending.user.id}`, { method: 'PUT', body: pending.body })
      setNotice(res.message)
      reload()
    } catch (err) {
      setActionError(new Error(Object.values(err.errors || {})[0] || err.message))
    }
    setPending(null)
    setBusy(false)
  }

  const confirmText = () => {
    if (!pending) return ''
    if ('role' in pending.body) {
      return `${pending.user.name} will become ${label(ROLE_LABELS, pending.body.role).toLowerCase()}.${
        pending.body.role === 'admin' ? ' Admins can change products, prices, payments and users.' : pending.body.role === 'staff' ? ' Staff can view orders and change their status.' : ' They lose access to the admin panel.'
      }`
    }
    return pending.body.is_active
      ? `${pending.user.name} will be able to log in again.`
      : `${pending.user.name} will be logged out and cannot log in until you enable the account again.`
  }

  return (
    <div className="stack">
      <div>
        <h1>Users</h1>
        <span className="muted">Give café staff access and disable accounts.</span>
      </div>
      <Segmented
        className="wrap"
        value={filters.role}
        onChange={(v) => set('role', v)}
        options={[
          { value: '', label: `All (${counts.all ?? 0})` },
          ...Object.entries(ROLE_LABELS).map(([value, text]) => ({ value, label: `${text} (${counts[value] ?? 0})` })),
        ]}
      />
      <div className="filter-bar">
        <Field label="Search" className="grow">
          <input type="search" placeholder="Name, email or mobile" defaultValue={filters.q} onChange={(e) => set('q', e.target.value)} />
        </Field>
      </div>
      <Notice onClose={() => setNotice('')}>{notice}</Notice>
      <ErrorBox error={actionError} />
      {loading && !data ? (
        <Loader />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.data.length === 0 ? (
        <Empty title="No users match these filters." />
      ) : (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Orders</th>
                  <th>Joined</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.map((u) => {
                  const self = u.id === me?.id
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.name}
                        {self && <span className="muted small"> (you)</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone || '—'}</td>
                      <td>{u.order_count}</td>
                      <td>{dateTime(u.created_at)}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={self || busy}
                          aria-label={`Role of ${u.name}`}
                          onChange={(e) => setPending({ user: u, body: { role: e.target.value } })}
                        >
                          {Object.entries(ROLE_LABELS).map(([value, text]) => (
                            <option key={value} value={value}>
                              {text}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <StatusBadge status={u.is_active ? 'paid' : 'cancelled'} map={{ paid: 'Active', cancelled: 'Disabled' }} />
                      </td>
                      <td className="right nowrap">
                        {!self && (
                          <button
                            type="button"
                            className={`link-button ${u.is_active ? 'danger' : ''}`}
                            onClick={() => setPending({ user: u, body: { is_active: !u.is_active } })}
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(p) => set('page', p)} />
        </>
      )}
      <p className="muted small">You cannot change your own role or disable your own account.</p>
      <ConfirmDialog
        open={!!pending}
        title={pending && 'role' in pending.body ? 'Change role?' : pending?.body.is_active ? 'Enable account?' : 'Disable account?'}
        message={confirmText()}
        confirmText={pending && 'role' in pending.body ? 'Change role' : pending?.body.is_active ? 'Enable' : 'Disable'}
        danger={pending ? pending.body.is_active === false : false}
        busy={busy}
        onConfirm={apply}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
