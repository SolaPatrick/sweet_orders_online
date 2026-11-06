import { useEffect, useState } from 'react'
import { CAFE } from '../lib/policies'

function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type)?.value
  return { day: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

function getOpenStatus() {
  const { day, minutes } = manilaNow()
  const close = CAFE.schedule.close[day] ?? CAFE.schedule.close.default
  const open = CAFE.schedule.open
  if (minutes >= open && minutes < close) return { open: true, label: `Open now until ${formatTime(close)}` }
  if (minutes < open) return { open: false, label: `Closed now, opens at ${formatTime(open)}` }
  return { open: false, label: `Closed now, opens tomorrow at ${formatTime(open)}` }
}

function useOpenStatus() {
  const [status, setStatus] = useState(getOpenStatus)
  useEffect(() => {
    const id = setInterval(() => setStatus(getOpenStatus()), 60000)
    return () => clearInterval(id)
  }, [])
  return status
}

export function OpenBadge() {
  const status = useOpenStatus()
  return (
    <span className={`open-badge ${status.open ? 'is-open' : 'is-closed'}`}>
      <span className="open-dot" aria-hidden="true" />
      {status.label}
    </span>
  )
}

export function CopyAddress({ className = 'btn' }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${CAFE.name}, ${CAFE.fullAddress}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? 'Address copied' : 'Copy address'}
    </button>
  )
}

export function CafeMap() {
  return (
    <div className="cafe-map">
      <iframe title="Map showing Clayanna's Café on Roxas Drive, Calapan City" loading="lazy" src={CAFE.mapEmbed} />
      <div className="cafe-map-label">
        <span className="cafe-map-pin" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
            <circle cx="12" cy="10" r="2.6" />
          </svg>
        </span>
        <span>
          <strong>{CAFE.name}</strong>
          <span className="small">{CAFE.address}</span>
        </span>
      </div>
    </div>
  )
}
