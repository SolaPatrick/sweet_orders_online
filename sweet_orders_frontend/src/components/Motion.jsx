import { useEffect, useId, useRef, useState } from 'react'
import { prefersReducedMotion, useScrollProgress } from '../lib/motion'

export function Parallax({ speed = 60, className = '', children }) {
  const ref = useRef(null)
  useScrollProgress(ref)
  return (
    <div ref={ref} className={`parallax ${className}`} style={{ '--speed': speed }}>
      {children}
    </div>
  )
}

export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      el.classList.add('in')
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ '--delay': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}

export function Marquee({ items, reverse = false, tone = 'cocoa' }) {
  const row = items.map((t, i) => (
    <span key={i} className="marquee-item">
      {t}
      <span className="marquee-dot" aria-hidden="true">
        ✦
      </span>
    </span>
  ))
  return (
    <div className={`marquee marquee-${tone} ${reverse ? 'reverse' : ''}`}>
      <div className="marquee-track">
        <div className="marquee-group">{row}</div>
        <div className="marquee-group" aria-hidden="true">
          {row}
        </div>
      </div>
    </div>
  )
}

export function Stripes({ className = '' }) {
  return (
    <div className={`stripes ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

export function SpinBadge({ text, children }) {
  const id = `spin${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const label = `${text} • ${text} • `
  return (
    <span className="spin-badge" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <path id={id} d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
        </defs>
        <text>
          <textPath href={`#${id}`} textLength="222" lengthAdjust="spacing">{label.toUpperCase()}</textPath>
        </text>
      </svg>
      <span className="spin-badge-center">{children}</span>
    </span>
  )
}

function readSeen() {
  try {
    return sessionStorage.getItem('so_loaded') === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    sessionStorage.setItem('so_loaded', '1')
  } catch {
    return
  }
}

export function Preloader() {
  const [visible, setVisible] = useState(() => !readSeen() && !prefersReducedMotion())
  const [count, setCount] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    let frame
    let timer
    const start = performance.now()
    const duration = 1100
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      setCount(Math.round(100 * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
      else {
        setLeaving(true)
        markSeen()
        timer = setTimeout(() => setVisible(false), 650)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null
  return (
    <div className={`preloader ${leaving ? 'leaving' : ''}`} aria-hidden="true">
      <span className="pre-blob pre-a">🧁</span>
      <span className="pre-blob pre-b">🍰</span>
      <span className="pre-blob pre-c">🍩</span>
      <span className="pre-blob pre-d">🥐</span>
      <div className="pre-brand">
        <strong>Clayanna's</strong>
        <span>Café · Sweet Orders</span>
      </div>
      <div className="pre-count">{count}%</div>
    </div>
  )
}
