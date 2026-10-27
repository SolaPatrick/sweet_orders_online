import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ErrorBox, Field } from '../components/ui'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', password_confirm: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const local = {}
    if (form.password.length < 8) local.password = 'Password must be at least 8 characters.'
    if (form.password !== form.password_confirm) local.password_confirm = 'Passwords do not match.'
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      await register(form)
      const next = params.get('next')
      navigate(next && next.startsWith('/') ? next : '/', { replace: true })
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
      setBusy(false)
    }
  }

  return (
    <div className="container page narrow-sm">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Create an account</h1>
        <p className="muted">Track orders and get SMS updates.</p>
        <ErrorBox error={error} />
        <Field label="Full name" error={errors.name}>
          <input value={form.name} autoComplete="name" placeholder="Ana Santos" onChange={set('name')} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" value={form.email} placeholder="ana@email.com" onChange={set('email')} />
        </Field>
        <Field label="Mobile number" error={errors.phone}>
          <input value={form.phone} autoComplete="tel" placeholder="0917 123 4567" onChange={set('phone')} />
        </Field>
        <Field label="Password (at least 8 characters)" error={errors.password}>
          <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password" error={errors.password_confirm}>
          <input type="password" autoComplete="new-password" value={form.password_confirm} onChange={set('password_confirm')} />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted center small">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
