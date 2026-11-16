import { X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { parseLatLon } from '../../lib/coords'
import type { Place } from '../../lib/places'
import type { Location } from '../../state/MissionContext'

/** Name + lat/lon form for saving a custom site. Prefills from `initial` (e.g. a dropped pin). */
export function CustomSiteForm({ initial, onSave, onCancel }: { initial: Location | null; onSave: (p: Place) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [lat, setLat] = useState(initial ? initial.lat.toFixed(4) : '')
  const [lon, setLon] = useState(initial ? initial.lon.toFixed(4) : '')
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseLatLon(`${lat} ${lon}`)
    if (!name.trim()) return setError('Give the site a name.')
    if (!parsed) return setError('Latitude must be −90 to 90 and longitude −180 to 360 (S/W allowed, e.g. 84.5S).')
    onSave({ id: `custom-${Date.now()}`, name: name.trim(), ...parsed })
  }

  return (
    <form className="custom-form" onSubmit={submit} aria-label="Save a custom site">
      <div className="custom-form-head">
        <strong>Save a custom site</strong>
        <button type="button" className="icon-only" aria-label="Cancel" onClick={onCancel}><X size={16} aria-hidden /></button>
      </div>
      {initial && <p className="muted small">Prefilled from the point you selected on the globe.</p>}
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ridge near Shackleton" autoFocus />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-lat`}>Latitude</label>
          <input id={`${id}-lat`} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-89.45" inputMode="decimal" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-lon`}>Longitude</label>
          <input id={`${id}-lon`} value={lon} onChange={(e) => setLon(e.target.value)} placeholder="222.7" inputMode="decimal" />
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary">Save site</button>
    </form>
  )
}
