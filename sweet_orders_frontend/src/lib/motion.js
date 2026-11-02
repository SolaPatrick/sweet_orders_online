import { useEffect } from 'react'

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function hasFinePointer() {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
}

export function useScrollProgress(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      if (r.bottom < -200 || r.top > vh + 200) return
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)))
      el.style.setProperty('--progress', p.toFixed(4))
      el.style.setProperty('--sy', Math.max(0, Math.min(r.height, -r.top)).toFixed(1))
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
  }, [ref])
}

export function usePointerParallax(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !hasFinePointer()) return
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let frame = 0
    const loop = () => {
      x += (tx - x) * 0.08
      y += (ty - y) * 0.08
      el.style.setProperty('--mx', x.toFixed(4))
      el.style.setProperty('--my', y.toFixed(4))
      frame = Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005 ? requestAnimationFrame(loop) : 0
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(loop)
    }
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2))
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2))
      kick()
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      kick()
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
