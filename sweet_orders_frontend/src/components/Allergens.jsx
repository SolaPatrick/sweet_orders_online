import { allergenNames } from '../lib/format'

export function AllergenLine({ allergens, mine }) {
  if (!allergens?.length) return null
  const hits = allergens.filter((a) => mine?.includes(a.id))
  return (
    <>
      <div className="contains small">Contains: {allergenNames(allergens)}</div>
      {hits.length > 0 && (
        <div className="allergy-warn small" role="note">
          Heads up: contains {allergenNames(hits)}, which {hits.length === 1 ? 'is' : 'are'} on your allergy list.
        </div>
      )}
    </>
  )
}

export function AllergenChecks({ all, value, onChange, label }) {
  return (
    <fieldset className="allergen-checks">
      {label && <legend className="field-label">{label}</legend>}
      {(all || []).map((a) => (
        <label key={a.id} className="check">
          <input
            type="checkbox"
            checked={value.includes(a.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, a.id].sort((x, y) => x - y) : value.filter((id) => id !== a.id))}
          />
          {a.name}
        </label>
      ))}
    </fieldset>
  )
}
