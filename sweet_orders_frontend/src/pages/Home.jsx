import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBox, Loader, useApi } from '../components/ui'
import { Marquee, Parallax, Reveal, SpinBadge, Stripes } from '../components/Motion'
import Ingredients from '../components/Ingredients'
import { usePointerParallax, useScrollProgress } from '../lib/motion'
import { peso } from '../lib/format'
import heroImg from '../assets/hero.svg'

const PANEL_TONES = ['cherry', 'butter', 'berry', 'caramel', 'mint', 'pink']
const TILE_TONES = ['pink', 'butter', 'mint', 'caramel', 'cherry', 'berry']

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
  const howRef = useRef(null)
  useScrollProgress(heroRef)
  usePointerParallax(heroRef)
  useScrollProgress(howRef)

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
          <Loader />
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
        <Loader />
      ) : featured.error ? (
        <div className="container">
          <ErrorBox error={featured.error} onRetry={featured.reload} />
        </div>
      ) : featured.data?.data.length ? (
        <Showcase products={featured.data.data} />
      ) : null}

      <section ref={howRef} id="how" className="how">
        <Stripes className="how-stripes" />
        <div className="container how-inner">
          <Parallax speed={70}>
            <Reveal as="h2" className="display-lg">
              How ordering
              <br />
              works
            </Reveal>
          </Parallax>
          <Reveal className="sticker" delay={200}>
            Easy as pie
          </Reveal>
          <div className="steps">
            {['Pick and customize', 'Choose pickup or delivery slot', 'Pay with GCash or card', 'Get SMS and email updates'].map((t, i) => (
              <Reveal key={t} className="step" delay={i * 120}>
                <strong>0{i + 1}</strong>
                <span>{t}</span>
              </Reveal>
            ))}
          </div>
          <Link to="/menu" className="btn btn-primary btn-lg">
            Start your order
          </Link>
        </div>
      </section>

      <Marquee reverse tone="pink" items={['Birthdays', 'Weddings', 'Merienda', 'Just because', 'Celebrations']} />
    </div>
  )
}
