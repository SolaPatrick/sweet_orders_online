const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function byName(a, b) {
  return collator.compare(a.name, b.name)
}

export function byPlace(a, b) {
  return collator.compare(a.city || '', b.city || '') || collator.compare(a.name, b.name)
}

export function matchesPlace(item, query) {
  const q = fold(query)
  if (!q) return true
  const words = q.split(/\s+/)
  const hay = fold(`${item.name} ${item.city || ''}`)
  return words.every((w) => hay.includes(w))
}

export function groupByCity(items) {
  const groups = []
  items.forEach((z) => {
    const last = groups[groups.length - 1]
    if (last && last.city === z.city) last.items.push(z)
    else groups.push({ city: z.city, items: [z] })
  })
  return groups
}
