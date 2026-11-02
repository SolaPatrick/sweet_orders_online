import { useEffect, useRef, useState } from 'react'
import { clock, longDate } from '../lib/format'

const WEEK = 7
const STATUS_TEXT = { closed: 'Closed', full: 'Full', too_soon: 'Too soon' }
const NEXT_KEYS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function dayParts(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const f = (opts) => d.toLocaleDateString('en-US', opts)
  return {
    weekday: f({ weekday: 'short' }),
    weekdayLong: f({ weekday: 'long' }),
    day: d.getDate(),
    month: f({ month: 'short' }),
    monthLong: f({ month: 'long' }),
    year: d.getFullYear(),
  }
}

function hour12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`
}

function suffix(hhmm) {
  return Number(hhmm.split(':')[0]) >= 12 ? 'PM' : 'AM'
}

function slotRange(start, end) {
  const lead = suffix(start) === suffix(end) ? '' : ` ${suffix(start)}`
  return `${hour12(start)}${lead}–${hour12(end)} ${suffix(end)}`
}

function monthLabel(days) {
  if (!days.length) return ''
  const a = dayParts(days[0].date)
  const b = dayParts(days[days.length - 1].date)
  if (a.monthLong === b.monthLong && a.year === b.year) return `${a.monthLong} ${a.year}`
  if (a.year === b.year) return `${a.month} – ${b.month} ${b.year}`
  return `${a.month} ${a.year} – ${b.month} ${b.year}`
}

function slotNote(s) {
  if (s.is_blocked) return 'Closed'
  if (s.is_full) return 'Full'
  if (s.places_left <= 2) return `Only ${s.places_left} left`
  return ''
}

function useRovingFocus() {
  const ref = useRef(null)
  const pending = useRef(null)
  useEffect(() => {
    if (pending.current === null || !ref.current) return
    ref.current.querySelector(`[data-value="${pending.current}"]`)?.focus()
    pending.current = null
  })
  const handleKey = (e, values, current, select) => {
    if (!values.length) return
    let i = values.indexOf(current)
    if (e.key in NEXT_KEYS) i = i < 0 ? 0 : (i + NEXT_KEYS[e.key] + values.length) % values.length
    else if (e.key === 'Home') i = 0
    else if (e.key === 'End') i = values.length - 1
    else return
    e.preventDefault()
    pending.current = values[i]
    select(values[i])
  }
  return [ref, handleKey]
}

export default function SlotPicker({ days, date, onDate, slots, slotId, onSlot, fulfillment, note }) {
  const [page, setPage] = useState(null)
  const [dayRef, dayKey] = useRovingFocus()
  const [timeRef, timeKey] = useRovingFocus()

  const pages = Math.max(1, Math.ceil(days.length / WEEK))
  const selectedIndex = days.findIndex((d) => d.date === date)
  const shown = Math.min(page ?? Math.max(0, Math.floor(selectedIndex / WEEK)), pages - 1)
  const week = days.slice(shown * WEEK, shown * WEEK + WEEK)
  const openDates = days.filter((d) => d.status === 'open').map((d) => d.date)
  const dayTab = week.some((d) => d.date === date) ? date : week.find((d) => d.status === 'open')?.date

  const pickDay = (value) => {
    setPage(Math.floor(days.findIndex((d) => d.date === value) / WEEK))
    onDate(value)
  }

  const periods = [
    { name: 'Morning', slots: (slots || []).filter((s) => s.start_time < '12:00') },
    { name: 'Afternoon', slots: (slots || []).filter((s) => s.start_time >= '12:00') },
  ]
  const openSlots = (slots || []).filter((s) => s.available).map((s) => s.id)
  const timeTab = openSlots.includes(slotId) ? slotId : openSlots[0]
  const picked = (slots || []).find((s) => s.id === slotId)

  return (
    <div className="picker">
      <div className="pick-part">
        <div className="pick-bar">
          <span className="pick-title" id="pick-date-label">
            Pick a date
          </span>
          <div className="pick-nav">
            <button type="button" className="pick-arrow" aria-label="Previous week" disabled={shown === 0} onClick={() => setPage(shown - 1)}>
              ‹
            </button>
            <span className="pick-month" aria-live="polite">
              {monthLabel(week)}
            </span>
            <button type="button" className="pick-arrow" aria-label="Next week" disabled={shown >= pages - 1} onClick={() => setPage(shown + 1)}>
              ›
            </button>
          </div>
        </div>
        <div
          ref={dayRef}
          className="pick-days"
          role="radiogroup"
          aria-labelledby="pick-date-label"
          onKeyDown={(e) => dayKey(e, openDates, date, pickDay)}
        >
          {week.map((d) => {
            const p = dayParts(d.date)
            const open = d.status === 'open'
            const active = d.date === date
            return (
              <button
                key={d.date}
                type="button"
                role="radio"
                data-value={d.date}
                aria-checked={active}
                aria-label={`${p.weekdayLong} ${p.monthLong} ${p.day}${open ? '' : `, ${STATUS_TEXT[d.status]?.toLowerCase() || 'unavailable'}`}`}
                tabIndex={d.date === dayTab ? 0 : -1}
                disabled={!open}
                className={`pick-day ${active ? 'active' : ''}`}
                onClick={() => pickDay(d.date)}
              >
                <span className="pick-dow">{p.weekday}</span>
                <span className="pick-num">{p.day}</span>
                <span className="pick-mon">{p.month}</span>
                <span className="pick-tag">{open ? '' : STATUS_TEXT[d.status] || 'Closed'}</span>
              </button>
            )
          })}
        </div>
      </div>

      {date && (
        <div className="pick-part">
          <span className="pick-title" id="pick-time-label">
            Pick a time for {longDate(date)}
          </span>
          {slots === null ? (
            <p className="muted small">Loading times…</p>
          ) : !slots.length ? (
            <p className="muted small">No open times on this date. Please pick another date.</p>
          ) : (
            <div ref={timeRef} role="radiogroup" aria-labelledby="pick-time-label" className="pick-periods" onKeyDown={(e) => timeKey(e, openSlots, slotId, onSlot)}>
              {periods
                .filter((g) => g.slots.length)
                .map((g) => (
                  <div key={g.name} className="pick-period">
                    <span className="pick-period-name">{g.name}</span>
                    <div className="pick-times">
                      {g.slots.map((s) => {
                        const tag = slotNote(s)
                        const active = s.id === slotId
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            data-value={s.id}
                            aria-checked={active}
                            aria-label={`${g.name}, ${clock(s.start_time)} to ${clock(s.end_time)}${tag ? `, ${tag.toLowerCase()}` : ''}`}
                            tabIndex={s.id === timeTab ? 0 : -1}
                            disabled={!s.available}
                            className={`pick-time ${active ? 'active' : ''}`}
                            onClick={() => onSlot(s.id)}
                          >
                            <span>
                              {hour12(s.start_time)} – {hour12(s.end_time)}
                            </span>
                            {tag && <small>{tag}</small>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {note && <p className="pick-note">{note}</p>}
      <p className="pick-summary" aria-live="polite">
        {picked
          ? `${fulfillment === 'delivery' ? 'Delivery' : 'Pickup'} on ${longDate(date)}, ${slotRange(picked.start_time, picked.end_time)}`
          : date
            ? `Choose a time for ${longDate(date)}.`
            : 'Choose a date to see the times.'}
      </p>
    </div>
  )
}
