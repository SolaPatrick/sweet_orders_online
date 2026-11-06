import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { CAFE } from '../lib/policies'
import { useAuth } from '../context/AuthContext'
import { ErrorBox, Field, Notice } from '../components/ui'
import { Reveal } from '../components/Motion'
import { OpenBadge } from '../components/CafeInfo'

const TOPICS = ['Custom cake', 'Bulk order', 'My order', 'Something else']

const HELP = [
  { to: '/orders', title: 'Track your order', text: 'See its status, claim code and receipt in My orders.' },
  { to: '/policies/cancellation', title: 'Cancel or move an order', text: 'Free up to 24 hours before your time slot.' },
  { to: '/menu', title: 'Browse cakes and prices', text: 'Sizes, flavors and add-ons are on each product.' },
]

const ICONS = {
  phone: <path d="M8 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L17 12l5 2v3a3 3 0 0 1-3 3A17 17 0 0 1 4 6a3 3 0 0 1 3-3z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}

const TILES = [
  { key: 'call', label: 'Call or text', value: CAFE.phone, href: `tel:${CAFE.phone.replace(/\s/g, '')}`, icon: 'phone', tone: 'butter' },
  { key: 'email', label: 'Email', value: CAFE.email, href: `mailto:${CAFE.email}`, icon: 'mail', tone: 'pink' },
  { key: 'visit', label: 'Visit', value: CAFE.address, href: CAFE.mapLink, icon: 'pin', tone: 'mint', external: true },
]

export default function Contact() {
  const { user } = useAuth()
  const blank = { name: user?.name || '', email: user?.email || '', phone: user?.phone || '', message: '' }
  const [form, setForm] = useState(blank)
  const [topic, setTopic] = useState('')
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
    const message = topic && form.message.trim() ? `Topic: ${topic}\n\n${form.message}` : form.message
    try {
      const res = await api('/contact', { method: 'POST', body: { ...form, message } })
      setNotice(res.message)
      setForm({ ...blank, message: '' })
      setTopic('')
    } catch (err) {
      setError(err)
      setErrors(err.errors || {})
    }
    setBusy(false)
  }

  return (
    <div className="contact-page">
      <section className="page-hero tone-mint">
        <div className="container page-hero-inner">
          <div className="page-hero-copy">
            <p className="eyebrow rise" style={{ '--delay': '100ms' }}>
              Contact us
            </p>
            <h1 className="page-title">
              <span className="line">
                <span style={{ '--delay': '150ms' }}>Let's talk</span>
              </span>
              <span className="line">
                <span style={{ '--delay': '300ms' }}>cake</span>
              </span>
            </h1>
            <p className="page-lead rise" style={{ '--delay': '450ms' }}>
              Planning a custom cake, a bulk order, or have a question about your order? Send us a message and we will reply by email.
            </p>
            <div className="rise" style={{ '--delay': '600ms' }}>
              <OpenBadge />
            </div>
          </div>
          <div className="chat-art" aria-hidden="true">
            <p className="bubble bubble-in rise" style={{ '--delay': '400ms' }}>
              Hi! Can I get a 2-layer chocolate cake with a name on top for Saturday?
            </p>
            <p className="bubble bubble-out rise" style={{ '--delay': '700ms' }}>
              Of course! Pick a Saturday slot at checkout and type the name in the message box.
            </p>
            <p className="bubble bubble-in short rise" style={{ '--delay': '1000ms' }}>
              Perfect, thank you!
            </p>
          </div>
        </div>
      </section>

      <section className="container contact-sec">
        <div className="contact-tiles">
          {TILES.map((t, i) => (
            <Reveal key={t.key} delay={i * 90}>
              <a href={t.href} className={`contact-tile tone-${t.tone}`} {...(t.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                <svg className="contact-icon" viewBox="0 0 24 24" aria-hidden="true">
                  {ICONS[t.icon]}
                </svg>
                <span className="contact-label">{t.label}</span>
                <strong>{t.value}</strong>
                <span className="tile-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </Reveal>
          ))}
          <Reveal delay={270}>
            <div className="contact-tile tone-caramel">
              <svg className="contact-icon" viewBox="0 0 24 24" aria-hidden="true">
                {ICONS.clock}
              </svg>
              <span className="contact-label">Hours</span>
              <strong>{CAFE.hours}</strong>
            </div>
          </Reveal>
        </div>

        <div className="contact-main">
          <Reveal>
            <form className="contact-form" onSubmit={submit} noValidate>
              <div className="contact-form-head">
                <h2 className="display-md">Send us a message</h2>
              </div>
              <Notice>{notice}</Notice>
              <ErrorBox error={Object.keys(errors).length ? null : error} />
              <div className="stack">
                <span className="field-label">What is it about?</span>
                <div className="chips" role="group" aria-label="Topic">
                  {TOPICS.map((t) => (
                    <button key={t} type="button" className={`chip ${topic === t ? 'active' : ''}`} aria-pressed={topic === t} onClick={() => setTopic(topic === t ? '' : t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
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
                <textarea rows={5} maxLength={1950} value={form.message} placeholder="Ask about custom designs, bulk orders, or an existing order…" onChange={set('message')} />
              </Field>
              <div>
                <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                  {busy ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          </Reveal>
          <Reveal className="help-card" delay={120}>
            <h3>Quick help</h3>
            {HELP.map((h) => (
              <Link key={h.to} to={h.to} className="help-link">
                <span>
                  <strong>{h.title}</strong>
                  <span className="muted small">{h.text}</span>
                </span>
                <span className="tile-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>
    </div>
  )
}
