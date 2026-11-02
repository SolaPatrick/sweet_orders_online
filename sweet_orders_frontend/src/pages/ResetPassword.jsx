import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErrorBox, Field, Notice } from '../components/ui'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ new_password: '', new_password_confirm: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const local = {}
    if (form.new_password.length < 8) local.new_password = 'Password must be at least 8 characters.'
    else if (form.new_password.length > 72) local.new_password = 'Password must be 72 characters or fewer.'
    if (form.new_password !== form.new_password_confirm) local.new_password_confirm = 'Passwords do not match.'
    setError(null)
    setErrors(local)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      const res = await api('/auth/reset', { method: 'POST', body: { token, ...form } })
      setDone(res.message)
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
    }
    setBusy(false)
  }

  if (!token) {
    return (
      <div className="container page narrow-sm">
        <div className="card auth-card">
          <h1>Reset password</h1>
          <p className="muted">This page needs the link from your email.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-block">
            Ask for a new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page narrow-sm">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Choose a new password</h1>
        {done ? (
          <>
            <Notice>{done}</Notice>
            <Link to="/login" className="btn btn-primary btn-block">
              Log in
            </Link>
          </>
        ) : (
          <>
            <ErrorBox error={errors.new_password || errors.new_password_confirm ? null : error} />
            {error?.status === 400 && (
              <p className="small">
                <Link to="/forgot-password">Send me a new link</Link>
              </p>
            )}
            <Field label="New password (8 to 72 characters)" error={errors.new_password}>
              <input type="password" autoComplete="new-password" value={form.new_password} onChange={set('new_password')} />
            </Field>
            <Field label="Confirm new password" error={errors.new_password_confirm}>
              <input type="password" autoComplete="new-password" value={form.new_password_confirm} onChange={set('new_password_confirm')} />
            </Field>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
