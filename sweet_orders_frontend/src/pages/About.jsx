import { Link } from 'react-router-dom'
import cafePhoto from '../assets/cafe.jpg'
import { CAFE } from '../lib/policies'
import { Marquee, Reveal, SpinBadge } from '../components/Motion'
import { CafeMap, CopyAddress, OpenBadge } from '../components/CafeInfo'

const FACTS = [
  {
    title: 'Baked to order',
    text: 'Every cake starts when you order it, so it reaches you fresh, with the size, flavor and message you picked.',
    tone: 'butter',
  },
  {
    title: 'Pickup at the counter',
    text: 'Choose a time slot, then show your 4-digit claim code at the counter when you arrive.',
    tone: 'caramel',
  },
  {
    title: 'Delivery around Calapan',
    text: 'We deliver around Calapan City. The fee depends on your barangay and is shown at checkout.',
    tone: 'mint',
  },
]

export default function About() {
  return (
    <div className="about-page">
      <section className="page-hero tone-butter">
        <div className="container page-hero-inner">
          <div className="page-hero-copy">
            <p className="eyebrow rise" style={{ '--delay': '100ms' }}>
              About us
            </p>
            <h1 className="page-title">
              <span className="line">
                <span style={{ '--delay': '150ms' }}>Your neighborhood</span>
              </span>
              <span className="line">
                <span style={{ '--delay': '300ms' }}>cake shop</span>
              </span>
            </h1>
            <p className="page-lead rise" style={{ '--delay': '450ms' }}>
              Clayanna's Café is a small bakery in Calapan City making custom cakes and fresh pastries for birthdays, celebrations and everyday merienda.
            </p>
            <div className="actions rise" style={{ '--delay': '600ms' }}>
              <Link to="/menu" className="btn btn-primary btn-lg">
                See the menu
              </Link>
              <a href="#find-us" className="btn btn-light btn-lg">
                Find us
              </a>
            </div>
          </div>
          <div className="page-hero-media rise" style={{ '--delay': '300ms' }}>
            <div className="photo-frame">
              <img src={cafePhoto} alt="Front of Clayanna's Café on Roxas Drive at sunset, with outdoor tables" />
            </div>
            <div className="photo-badge">
              <SpinBadge text="Baked fresh daily">Made with love</SpinBadge>
            </div>
          </div>
        </div>
      </section>

      <Marquee items={['Custom cakes', 'Fresh pastries', 'Pickup or delivery', 'Open daily', 'Calapan City']} />

      <section className="container about-sec">
        <Reveal as="h2" className="display-md">
          What we do
        </Reveal>
        <div className="fact-grid">
          {FACTS.map((f, i) => (
            <Reveal key={f.title} className={`fact-card tone-${f.tone}`} delay={i * 100}>
              <span className="fact-num">0{i + 1}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="find-us" className="container about-sec">
        <Reveal as="h2" className="display-md">
          Find us
        </Reveal>
        <div className="find-layout">
          <Reveal>
            <CafeMap />
          </Reveal>
          <Reveal className="find-card" delay={120}>
            <OpenBadge />
            <div>
              <span className="find-label">Address</span>
              <p className="find-value">{CAFE.fullAddress}</p>
              <p className="muted small">{CAFE.landmark}.</p>
            </div>
            <div>
              <span className="find-label">Hours</span>
              <p className="find-value">{CAFE.hours}</p>
            </div>
            <div className="actions">
              <a href={CAFE.mapLink} target="_blank" rel="noreferrer" className="btn btn-primary">
                Get directions
              </a>
              <CopyAddress />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
