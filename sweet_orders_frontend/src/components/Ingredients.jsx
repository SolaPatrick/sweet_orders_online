const INK = '#2e211b'
const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }

const SHAPES = {
  strawberry: (
    <>
      <path d="M32 58C16 48 8 33 13 24c5-8 33-8 38 0 5 9-3 24-19 34z" fill="#d7323c" {...line} />
      <path d="M19 21l7-9 6 7 6-7 7 9c-8 4-18 4-26 0z" fill="#9fd6c2" {...line} />
      <g fill="#f3c23b">
        <ellipse cx="24" cy="31" rx="1.6" ry="2.4" />
        <ellipse cx="34" cy="29" rx="1.6" ry="2.4" />
        <ellipse cx="42" cy="34" rx="1.6" ry="2.4" />
        <ellipse cx="28" cy="40" rx="1.6" ry="2.4" />
        <ellipse cx="37" cy="44" rx="1.6" ry="2.4" />
        <ellipse cx="22" cy="44" rx="1.4" ry="2" />
      </g>
    </>
  ),
  cherry: (
    <>
      <path d="M22 40C24 24 32 12 46 6M42 40c-2-12 0-24 4-34" fill="none" {...line} />
      <path d="M46 6c4 6 2 10-6 10" fill="#9fd6c2" {...line} />
      <circle cx="21" cy="46" r="11" fill="#d7323c" {...line} />
      <circle cx="43" cy="46" r="11" fill="#8e2431" {...line} />
      <path d="M16 42a5 5 0 0 1 5-4M38 42a5 5 0 0 1 5-4" fill="none" stroke="#fffaf4" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  chocolate: (
    <>
      <rect x="8" y="12" width="48" height="40" rx="6" fill="#6b3b26" {...line} />
      <path d="M24 12v40M40 12v40M8 32h48" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M13 17h6M29 17h6M45 17h6M13 37h6M29 37h6M45 37h6" stroke="#9a5a3c" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  lemon: (
    <>
      <circle cx="32" cy="32" r="24" fill="#f3c23b" {...line} />
      <circle cx="32" cy="32" r="17" fill="#fbe58a" stroke="#fffaf4" strokeWidth="3" />
      <path d="M32 15v34M15 32h34M20 20l24 24M44 20 20 44" stroke="#fffaf4" strokeWidth="2.5" />
    </>
  ),
  blueberry: (
    <>
      <circle cx="32" cy="34" r="20" fill="#4b5fa8" {...line} />
      <path d="M26 20l6-6 6 6-6 4z" fill="#2e3a6e" {...line} />
      <path d="M22 30a10 10 0 0 1 8-6" fill="none" stroke="#b9c4ee" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  leaf: (
    <>
      <path d="M8 52C10 26 28 10 56 8c-2 28-18 46-48 44z" fill="#9fd6c2" {...line} />
      <path d="M10 50C24 36 36 24 52 12M26 36l-2-10M36 26l8 2" fill="none" {...line} />
    </>
  ),
  sprinkle: <rect x="24" y="6" width="16" height="52" rx="8" fill="currentColor" {...line} />,
  macaron: (
    <>
      <path d="M10 28c0-12 10-18 22-18s22 6 22 18z" fill="#f0a6a0" {...line} />
      <rect x="9" y="28" width="46" height="8" rx="4" fill="#fffaf4" {...line} />
      <path d="M10 36h44c0 12-10 18-22 18S10 48 10 36z" fill="#f0a6a0" {...line} />
    </>
  ),
}

const ITEMS = [
  { s: 'strawberry', x: 22, y: 27, size: 93, d: 46, r: -14 },
  { s: 'cherry', x: 77, y: 24, size: 88, d: 58, r: 10 },
  { s: 'chocolate', x: 30, y: 80, size: 78, d: -32, r: 18 },
  { s: 'lemon', x: 70, y: 82, size: 83, d: -40, r: -8 },
  { s: 'blueberry', x: 36, y: 15, size: 48, d: 24, r: 0 },
  { s: 'leaf', x: 62, y: 13, size: 55, d: -20, r: 24 },
  { s: 'macaron', x: 92, y: 54, size: 70, d: 70, r: -12 },
  { s: 'blueberry', x: 6, y: 56, size: 35, d: 82, r: 0 },
  { s: 'sprinkle', x: 40, y: 84, size: 35, d: 36, r: 40, c: '#f3c23b' },
  { s: 'sprinkle', x: 58, y: 88, size: 30, d: -54, r: -30, c: '#9fd6c2' },
  { s: 'sprinkle', x: 72, y: 46, size: 28, d: 90, r: 70, c: '#fffaf4' },
  { s: 'sprinkle', x: 26, y: 50, size: 28, d: -70, r: -60, c: '#d7323c' },
  { s: 'sprinkle', x: 50, y: 10, size: 25, d: 60, r: 15, c: '#f0a6a0' },
  { s: 'leaf', x: 48, y: 92, size: 50, d: -26, r: -40 },
]

export default function Ingredients() {
  return (
    <div className="ingredients" aria-hidden="true">
      {ITEMS.map((it, i) => (
        <span
          key={i}
          className={`ing ${it.size < 34 ? 'ing-sm' : ''}`}
          style={{ '--x': `${it.x}%`, '--y': `${it.y}%`, '--s': `${it.size}px`, '--d': it.d, '--r': `${it.r}deg`, '--i': i, color: it.c }}
        >
          <span className="ing-move">
            <span className="ing-bob">
              <svg viewBox="0 0 64 64">{SHAPES[it.s]}</svg>
            </span>
          </span>
        </span>
      ))}
    </div>
  )
}
