import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ErrorBox, Field, Notice } from '../components/ui'

// C12 Profile: details and password
export default function Profile() {
  const { user, setUser } = useAuth()
  const [details, setDetails] = useState({ name: user.name, phone: user.phone || '' })
  const [pw, setPw] = useState({ current_password: '', new_password: '', new_password_confirm: '' })
  const [state, setState] = useState({ details: {}, pw: {} })

  const save = async (which, body, after) => {
    setState((s) => ({ ...s, [which]: { busy: true } }))
    try {
      const res = await api('/auth/me', { method: 'PUT', body })
      after?.(res)
      setState((s) => ({ ...s, [which]: { notice: res.message } }))
    } catch (err) {
      setState((s) => ({ ...s, [which]: { error: err, errors: err.errors || {} } }))
    }
  }

  const d = state.details
  const p = state.pw
  return (
    <div className="container page narrow">
      <h1>Profile</h1>
      <form
        className="card stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save('details', details, (res) => setUser(res.user))
        }}
      >
        <h3>Your details</h3>
        <Notice>{d.notice}</Notice>
        <ErrorBox error={d.errors && Object.keys(d.errors).length ? null : d.error} />
        <Field label="Full name" error={d.errors?.name}>
          <input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
        </Field>
        <Field label="Email (cannot be changed)">
          <input value={user.email} disabled />
        </Field>
        <Field label="Mobile number for SMS updates" error={d.errors?.phone}>
          <input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
        </Field>
        <div>
          <button type="submit" className="btn btn-primary" disabled={d.busy}>
            {d.busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <form
        className="card stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save('pw', pw, () => setPw({ current_password: '', new_password: '', new_password_confirm: '' }))
        }}
      >
        <h3>Change password</h3>
        <Notice>{p.notice}</Notice>
        <ErrorBox error={p.errors && Object.keys(p.errors).length ? null : p.error} />
        <Field label="Current password" error={p.errors?.current_password}>
          <input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="New password" error={p.errors?.new_password}>
            <input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </Field>
          <Field label="Confirm new password" error={p.errors?.new_password_confirm}>
            <input type="password" autoComplete="new-password" value={pw.new_password_confirm} onChange={(e) => setPw({ ...pw, new_password_confirm: e.target.value })} />
          </Field>
        </div>
        <div>
          <button type="submit" className="btn" disabled={p.busy}>
            {p.busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )
}
