import { peso } from '../lib/format'

export default function LineExtras({ addons, photoUrl }) {
  if (!addons?.length && !photoUrl) return null
  return (
    <div className="line-extras">
      {addons?.length > 0 && (
        <ul className="addon-list small">
          {addons.map((a) => (
            <li key={a.id ?? a.addon_id ?? a.name}>
              {a.name} +{peso(a.price)}
              {a.text && <span className="addon-text"> · “{a.text}”</span>}
            </li>
          ))}
        </ul>
      )}
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noreferrer" className="design-thumb" title="Open the design photo">
          <img src={photoUrl} alt="Design reference" loading="lazy" />
          <span className="small">Design photo</span>
        </a>
      )}
    </div>
  )
}
