import { Link, useParams } from 'react-router-dom'
import { CAFE, POLICIES, POLICY_VERSION } from '../lib/policies'
import NotFound from './NotFound'

export default function Policies() {
  const { slug = 'terms' } = useParams()
  const policy = POLICIES.find((p) => p.slug === slug)
  if (!policy) return <NotFound />

  return (
    <div className="container page narrow">
      <nav className="policy-tabs" aria-label="Policies">
        {POLICIES.map((p) => (
          <Link key={p.slug} to={`/policies/${p.slug}`} className={`chip ${p.slug === slug ? 'active' : ''}`} aria-current={p.slug === slug ? 'page' : undefined}>
            {p.title}
          </Link>
        ))}
      </nav>
      <article className="card policy">
        <h1>{policy.title}</h1>
        <p className="muted small">Version {POLICY_VERSION}</p>
        {policy.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            <ul>
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>
            {CAFE.name}, {CAFE.address}
            <br />
            Email: <a href={`mailto:${CAFE.email}`}>{CAFE.email}</a> · Call or text: {CAFE.phone}
          </p>
        </section>
      </article>
    </div>
  )
}
