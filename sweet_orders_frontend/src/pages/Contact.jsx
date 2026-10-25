import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ErrorBox, Field, Notice } from '../components/ui'

// C14 Contact
export default function Contact() {
  const { user } = useAuth()
  const blank = { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', message: '' }
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setError(null)
    setNotice('')
    try {
      const res = await api('/contact', { method: 'POST', body: form })
      setNotice(res.message)
      setForm({ ...blank, message: '' })
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
    }
    setBusy(false)
  }

  return (
    <div className="container page">
      <h1>Contact us</h1>
      <div className="contact-layout">
        <div className="stack">
          {[
            ['Call or text', '0917 000 0000'],
            ['Email', 'hello@clayannascafe.ph'],
            ['Visit', '123 Mabini St., Poblacion'],
            ['Hours', 'Tue to Sun, 8:00 AM to 7:00 PM'],
          ].map(([k, v]) => (
            <div key={k} className="card">
              <span className="muted small">{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <form className="card stack" onSubmit={submit} noValidate>
          <h3>Send us a message</h3>
          <Notice>{notice}</Notice>
          <ErrorBox error={Object.keys(errors).length ? null : error} />
          <div className="grid-2">
            <Field label="Name" error={errors.name}>
              <input value={form.name} placeholder="Ana Santos" onChange={set('name')} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} placeholder="ana@email.com" onChange={set('email')} />
            </Field>
          </div>
          <Field label="Mobile number (optional)" error={errors.phone}>
            <input value={form.phone} placeholder="0917 123 4567" onChange={set('phone')} />
          </Field>
          <Field label="Message" error={errors.message}>
            <textarea rows={4} value={form.message} placeholder="Ask about custom designs, bulk orders, or an existing order…" onChange={set('message')} />
          </Field>
          <div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
