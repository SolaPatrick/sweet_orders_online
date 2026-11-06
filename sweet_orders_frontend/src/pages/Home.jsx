import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBox, Loader, useApi } from '../components/ui'
import { Marquee, Parallax, Reveal, SpinBadge } from '../components/Motion'
import Ingredients from '../components/Ingredients'
import { prefersReducedMotion, usePointerParallax, useScrollProgress } from '../lib/motion'
import { peso } from '../lib/format'
import heroImg from '../assets/hero.svg'

const PANEL_TONES = ['cherry', 'butter', 'berry', 'caramel', 'mint', 'pink']
const TILE_TONES = ['pink', 'butter', 'mint', 'caramel', 'cherry', 'berry']

const STEPS = [
  {
    title: 'Pick and customize',
    text: 'Choose a cake or pastry, then set the size, flavor, message and add-ons you want.',
    tone: 'butter',
    icon: (
      <>
        <path d="M8 30h32v12H8z" />
        <path d="M11 30v-7h26v7" />
        <path d="M24 23v-7" />
        <path d="M24 9c2 2 2 4 0 6-2-2-2-4 0-6z" />
        <path d="M8 36c4 3 8 3 12 0s8-3 12 0 6 3 8 0" />
      </>
    ),
  },
  {
    title: 'Choose a pickup or delivery slot',
    text: 'Pick the date and time that works for you. Delivery fees depend on your barangay.',
    tone: 'caramel',
    icon: (
      <>
        <rect x="7" y="11" width="34" height="30" rx="4" />
        <path d="M7 20h34M16 7v8M32 7v8" />
        <path d="M17 30l5 5 9-10" />
      </>
    ),
  },
  {
    title: 'Pay with GCash or card',
    text: 'Pay safely online, or pay cash at the counter when you pick up your order.',
    tone: 'cherry',
    icon: (
      <>
        <rect x="6" y="12" width="36" height="24" rx="4" />
        <path d="M6 20h36M13 29h8" />
      </>
    ),
  },
  {
    title: 'Get SMS and email updates',
    text: 'We message you when your order is confirmed, ready, and on its way.',
    tone: 'berry',
    icon: (
      <>
        <path d="M8 10h32a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H20l-9 7v-7H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z" />
        <path d="M14 20h20M14 26h12" />
      </>
    ),
  },
]

function HowItWorks() {
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const [still] = useState(() => prefersReducedMotion())

  useEffect(() => {
    const el = ref.current
    if (!el || still) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const span = Math.max(1, r.height - window.innerHeight)
      const p = Math.max(0, Math.min(1, -r.top / span))
      const t = p * STEPS.length
      el.style.setProperty('--t', t.toFixed(4))
      setActive(Math.min(STEPS.length - 1, Math.floor(t)))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [still])

  return (
    <section ref={ref} id="how" className={`how ${still ? 'how-still' : ''}`} style={{ '--steps': STEPS.length }}>
      <div className="how-pin">
        <div className="container how-inner">
          <div className="how-copy">
            <Reveal as="h2" className="display-lg">
              How ordering
              <br />
              works
            </Reveal>
            <Reveal className="sticker" delay={200}>
              Easy as pie
            </Reveal>
            <ol className="how-progress" aria-label="Ordering steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className={i === active ? 'on' : i < active ? 'done' : ''}>
                  <span>0{i + 1}</span>
                  {s.title}
                </li>
              ))}
            </ol>
            <Link to="/menu" className="btn btn-primary btn-lg">
              Start your order
            </Link>
          </div>
        </div>
        <div className="how-panels">
          {STEPS.map((s, i) => (
            <article key={s.title} className={`how-panel tone-${s.tone}`} style={{ '--i': i }}>
              <div className="how-panel-inner">
                <span className="how-num">0{i + 1}</span>
                <svg className="how-icon" viewBox="0 0 48 48" aria-hidden="true">
                  {s.icon}
                </svg>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ShowPanel({ product, index, onActive }) {
  const ref = useRef(null)
  useScrollProgress(ref)
  usePointerParallax(ref)

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && onActive(index), { threshold: 0.55 })
    io.observe(el)
    return () => io.disconnect()
  }, [index, onActive])

  const word = product.name.split(' ').slice(-1)[0]
  return (
    <article ref={ref} className="show-panel">
      <div className="show-word" aria-hidden="true">
        {word} {word} {word}
      </div>
      <div className="container show-inner">
        <Reveal className="show-tag">
          <span>{product.category_name || 'Featured'}</span>
          <strong>{product.name}</strong>
        </Reveal>
        <Link to={`/products/${product.id}`} className="show-photo" aria-label={product.name}>
          {product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <img src={heroImg} alt="" />}
        </Link>
        <Link to={`/products/${product.id}`} className="show-cta">
          <SpinBadge text="View product">
            {product.is_customizable ? 'from ' : ''}
            {peso(product.base_price)}
          </SpinBadge>
          <span className="sr-only">View {product.name}</span>
        </Link>
      </div>
    </article>
  )
}

function Showcase({ products }) {
  const [active, setActive] = useState(0)
  const tone = PANEL_TONES[active % PANEL_TONES.length]
  return (
    <section className={`showcase bg-${tone}`}>
      <div className="container showcase-head">
        <Reveal as="h2" className="display-md">
          Fresh from the oven
        </Reveal>
        <Link to="/menu" className="btn btn-light">
          See full menu
        </Link>
      </div>
      {products.map((p, i) => (
        <ShowPanel key={p.id} product={p} index={i} onActive={setActive} />
      ))}
    </section>
  )
}

export default function Home() {
  const categories = useApi('/categories')
  const featured = useApi('/products', { featured: 1, per_page: 4 })
  const photos = (featured.data?.data || []).map((p) => p.image_url).filter(Boolean)
  const heroRef = useRef(null)
  useScrollProgress(heroRef)
  usePointerParallax(heroRef)

  return (
    <div className="home">
      <section ref={heroRef} className="hero-x">
        <div className="hero-floats" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`hero-float-wrap f${i}`}>
              <span className="hero-float">
                <img src={photos[i % (photos.length || 1)] || heroImg} alt="" />
              </span>
            </span>
          ))}
        </div>
        <Ingredients />
        <div className="container hero-x-inner">
          <p className="eyebrow rise" style={{ '--delay': '100ms' }}>
            Clayanna's Café · Baked to order
          </p>
          <h1 className="display">
            <span className="line">
              <span style={{ '--delay': '150ms' }}>Sweet things,</span>
            </span>
            <span className="line">
              <span style={{ '--delay': '300ms' }}>made for you</span>
            </span>
          </h1>
          <p className="lead rise" style={{ '--delay': '500ms' }}>
            Cakes and pastries made to order. Pick your size and flavor, then grab it at the counter or have it delivered.
          </p>
          <div className="actions center rise" style={{ '--delay': '650ms' }}>
            <Link to="/menu" className="btn btn-primary btn-lg">
              Order now
            </Link>
            <a href="#how" className="btn btn-light btn-lg">
              How it works
            </a>
          </div>
        </div>
      </section>

      <Marquee items={['Baked fresh daily', 'Pickup or delivery', 'Custom cakes', 'Pay with GCash or card', 'Made with love']} />

      <section className="container home-sec">
        <Parallax speed={50} className="section-head">
          <Reveal as="h2" className="display-md">
            Shop by category
          </Reveal>
        </Parallax>
        {categories.loading ? (
          <Loader variant="tiles" />
        ) : (
          <>
            <ErrorBox error={categories.error} onRetry={categories.reload} />
            <div className="category-row">
              {categories.data?.data.map((c, i) => (
                <Reveal key={c.id} delay={i * 70}>
                  <Link to={`/menu?category=${c.slug}`} className={`category-tile tone-${TILE_TONES[i % TILE_TONES.length]}`}>
                    <span>{c.name}</span>
                    <span className="tile-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </>
        )}
      </section>

      {featured.loading ? (
        <div className="container">
          <Loader variant="cards" count={4} />
        </div>
      ) : featured.error ? (
        <div className="container">
          <ErrorBox error={featured.error} onRetry={featured.reload} />
        </div>
      ) : featured.data?.data.length ? (
        <Showcase products={featured.data.data} />
      ) : null}

      <HowItWorks />

      <Marquee reverse tone="pink" items={['Birthdays', 'Weddings', 'Merienda', 'Just because', 'Celebrations']} />
    </div>
  )
}
