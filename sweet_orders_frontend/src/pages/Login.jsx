import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ErrorBox, Field } from '../components/ui'

// C8 Login. Admins go straight to the admin panel.
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      const user = await login(form.email, form.password)
      const next = params.get('next')
      navigate(next && next.startsWith('/') ? next : user.role === 'admin' ? '/admin' : '/', { replace: true })
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
      setBusy(false)
    }
  }

  return (
    <div className="container page narrow-sm">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Log in</h1>
        <p className="muted">For customers and café staff. Admins go straight to the admin panel.</p>
        <ErrorBox error={errors.email || errors.password ? null : error} />
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" value={form.email} placeholder="you@email.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="muted center small">
          No account yet? <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`}>Register</Link>
        </p>
      </form>
    </div>
  )
}
