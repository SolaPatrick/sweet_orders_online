import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { peso } from '../lib/format'
import { byPlace, groupByCity, matchesPlace } from '../lib/places'

export default function ZoneCombobox({ zones, value, onChange, label, hint, error }) {
  const id = useId()
  const listRef = useRef(null)
  const sorted = useMemo(() => [...zones].sort(byPlace), [zones])
  const selected = sorted.find((z) => String(z.id) === String(value))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(null)
  const [active, setActive] = useState(-1)

  const shown = query === null ? sorted : sorted.filter((z) => matchesPlace(z, query))
  const groups = groupByCity(shown)
  const text = query ?? (selected ? `${selected.name}, ${selected.city}` : '')
  const optionId = (z) => `${id}-opt-${z.id}`
  const current = open ? shown[active] : null

  useEffect(() => {
    if (!current) return
    listRef.current?.querySelector(`[id="${optionId(current)}"]`)?.scrollIntoView({ block: 'nearest' })
  })

  const openList = () => {
    setOpen(true)
    setActive(
      Math.max(
        0,
        shown.findIndex((z) => z === selected),
      ),
    )
  }
  const close = () => {
    setOpen(false)
    setQuery(null)
    setActive(-1)
  }
  const pick = (z) => {
    onChange(String(z.id))
    close()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openList()
      else setActive((i) => Math.min(shown.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) openList()
      else setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home' && open) {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End' && open) {
      e.preventDefault()
      setActive(shown.length - 1)
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (current) pick(current)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      close()
    }
  }

  return (
    <div className={`field combo ${error ? 'has-error' : ''}`}>
      <label className="field-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className="combo-box">
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={current ? optionId(current) : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={text}
          placeholder="Type your barangay or city"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={(e) => e.target.select()}
          onClick={() => !open && openList()}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        <span className="combo-caret" aria-hidden="true">
          ▾
        </span>
        {open && (
          <div className="combo-pop" onMouseDown={(e) => e.preventDefault()}>
            {shown.length ? (
              <div className="combo-list" id={`${id}-list`} role="listbox" aria-label={label} ref={listRef}>
                {groups.map((g, gi) => (
                  <div key={g.city} role="group" aria-labelledby={`${id}-g${gi}`}>
                    <div className="combo-group" id={`${id}-g${gi}`}>
                      {g.city}
                    </div>
                    {g.items.map((z) => {
                      const i = shown.indexOf(z)
                      return (
                        <div
                          key={z.id}
                          id={optionId(z)}
                          role="option"
                          aria-selected={z === selected}
                          className={`combo-option ${i === active ? 'active' : ''} ${z === selected ? 'selected' : ''}`}
                          onMouseMove={() => i !== active && setActive(i)}
                          onClick={() => pick(z)}
                        >
                          <span>{z.name}</span>
                          <span className="combo-fee">{peso(z.fee)}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <p className="combo-empty" id={`${id}-list`} role="status">
                No area matches “{query}”. We may not deliver there yet.
              </p>
            )}
          </div>
        )}
      </div>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
