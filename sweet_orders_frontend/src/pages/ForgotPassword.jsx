import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { ErrorBox, Field, Notice } from '../components/ui'

export default function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErrors({})
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors({ email: 'Enter the email you used to register.' })
      return
    }
    setBusy(true)
    try {
      const res = await api('/auth/forgot', { method: 'POST', body: { email: email.trim() } })
      setSent(res.message)
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
    }
    setBusy(false)
  }

  return (
    <div className="container page narrow-sm">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Forgot password</h1>
        <p className="muted">Enter your account email and we will send you a link to choose a new password.</p>
        <ErrorBox error={errors.email ? null : error} />
        {sent ? (
          <Notice>{sent}</Notice>
        ) : (
          <>
            <Field label="Email" error={errors.email}>
              <input type="email" autoComplete="email" value={email} placeholder="you@email.com" onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}
        <p className="muted center small">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
