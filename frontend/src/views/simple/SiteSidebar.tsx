import { Crosshair, Plus, Trash2, X } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import type { Site, SiteKind } from '../../api/types'
import { pageHref } from '../../hooks/useHashRoute'
import { parseLatLon } from '../../lib/coords'
import { shortLatLon } from '../../lib/lunar'
import { MAX_COMPARE, type Place } from '../../lib/places'
import type { Location } from '../../state/MissionContext'

const GROUPS: { kind: SiteKind; label: string }[] = [
  { kind: 'historical', label: 'Apollo era' },
  { kind: 'recent', label: 'Recent landings' },
  { kind: 'candidate', label: 'South pole targets' },
]

interface Props {
  sites: Site[]
  customSites: Place[]
  location: Location | null
  onSelect: (l: Location) => void
  tray: Place[]
  onToggleTray: (p: Place) => void
  onSaveCustom: (p: Place) => void
  onDeleteCustom: (id: string) => void
}

export function SiteSidebar({ sites, customSites, location, onSelect, tray, onToggleTray, onSaveCustom, onDeleteCustom }: Props) {
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const searchId = useId()

  const coords = parseLatLon(query)
  const q = query.trim().toLowerCase()
  const match = (text: string) => !q || coords !== null || text.toLowerCase().includes(q)

  const groups = useMemo(
    () => [
      ...GROUPS.map((g) => ({
        label: g.label,
        custom: false,
        places: sites.filter((s) => s.kind === g.kind).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, search: `${s.name} ${s.program}` })),
      })),
      { label: 'My saved sites', custom: true, places: customSites.map((p) => ({ ...p, search: p.name })) },
    ],
    [sites, customSites],
  )

  const select = (p: Place) => onSelect({ name: p.name, lat: p.lat, lon: p.lon, siteId: p.id, source: 'search' })
  const inTray = (id: string) => tray.some((t) => t.id === id)
  const trayFull = tray.length >= MAX_COMPARE

  const goToCoords = () => {
    if (!coords) return
    onSelect({ name: `Custom point ${shortLatLon(coords.lat, coords.lon)}`, ...coords, source: 'search' })
    setQuery('')
  }

  return (
    <aside className="s-sidebar" aria-label="Sites">
      <div className="field">
        <label htmlFor={searchId}>Find a site</label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder="Search name, or enter lat, lon"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && goToCoords()}
        />
      </div>

      {coords && (
        <button type="button" className="btn btn-outline go-coords" onClick={goToCoords}>
          <Crosshair size={16} aria-hidden /> Go to {shortLatLon(coords.lat, coords.lon)}
        </button>
      )}

      {groups.map((g) => {
        const places = g.places.filter((p) => match(p.search))
        if (!places.length && !(g.custom && !q)) return null
        return (
          <section key={g.label} className="site-group" aria-label={g.label}>
            <h2 className="eyebrow">{g.label}</h2>
            {!places.length && <p className="muted small">Sites you save appear here.</p>}
            <ul>
              {places.map((p) => {
                const selected = location?.siteId === p.id
                const checked = inTray(p.id)
                return (
                  <li key={p.id} className={`site-row${selected ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && trayFull}
                      onChange={() => onToggleTray({ id: p.id, name: p.name, lat: p.lat, lon: p.lon })}
                      aria-label={`Add ${p.name} to compare`}
                      title={!checked && trayFull ? `Compare holds up to ${MAX_COMPARE} sites` : 'Add to compare'}
                    />
                    <button type="button" className="site-pick" aria-current={selected ? 'true' : undefined} onClick={() => select(p)}>
                      <span className="site-name">{p.name}</span>
                      <span className="site-coords">{shortLatLon(p.lat, p.lon)}</span>
                    </button>
                    {g.custom && (
                      <button type="button" className="icon-only" aria-label={`Delete ${p.name}`} onClick={() => onDeleteCustom(p.id)}>
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {formOpen ? (
        <CustomSiteForm
          initial={location && !location.siteId ? location : null}
          onCancel={() => setFormOpen(false)}
          onSave={(p) => {
            onSaveCustom(p)
            select(p)
            setFormOpen(false)
          }}
        />
      ) : (
        <button type="button" className="btn btn-dashed" onClick={() => setFormOpen(true)}>
          <Plus size={16} aria-hidden /> Custom coordinates
        </button>
      )}

      <CompareTray tray={tray} onRemove={onToggleTray} />
    </aside>
  )
}

function CustomSiteForm({ initial, onSave, onCancel }: { initial: Location | null; onSave: (p: Place) => void; onCancel: () => void }) {
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

function CompareTray({ tray, onRemove }: { tray: Place[]; onRemove: (p: Place) => void }) {
  const ready = tray.length >= 2
  return (
    <section className="compare-tray" aria-label="Compare tray">
      <h2>Compare tray ({tray.length} of {MAX_COMPARE})</h2>
      {tray.length ? (
        <ul className="chips">
          {tray.map((p) => (
            <li key={p.id} className="chip-pill">
              <span>{p.name}</span>
              <button type="button" aria-label={`Remove ${p.name} from compare`} onClick={() => onRemove(p)}><X size={14} aria-hidden /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Tick up to {MAX_COMPARE} sites to compare them side by side.</p>
      )}
      {ready ? (
        <a className="btn btn-primary" href={pageHref('compare')}>Compare sites</a>
      ) : (
        <button type="button" className="btn btn-primary" disabled>Compare sites</button>
      )}
    </section>
  )
}
