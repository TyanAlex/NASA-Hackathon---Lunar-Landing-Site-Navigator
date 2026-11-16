import { X } from 'lucide-react'
import { pageHref } from '../../hooks/useHashRoute'
import { MAX_COMPARE, type Place } from '../../lib/places'

export function CompareTrayCard({ tray, onRemove }: { tray: Place[]; onRemove: (p: Place) => void }) {
  if (!tray.length) return null
  return (
    <section className="tray card" aria-label="Compare tray">
      <div className="tray-head">
        <strong>Compare ({tray.length} of {MAX_COMPARE})</strong>
        {tray.length >= 2 ? (
          <a className="pill-btn on" href={pageHref('compare')}>Compare sites</a>
        ) : (
          <span className="muted small-text">Add one more site</span>
        )}
      </div>
      <ul className="tray-chips">
        {tray.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${p.name} from compare`} onClick={() => onRemove(p)}><X size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
