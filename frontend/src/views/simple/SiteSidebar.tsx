import { Crosshair, Plus, Trash2, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Site, SiteKind } from '../../api/types'
import { pageHref } from '../../hooks/useHashRoute'
import { parseLatLon } from '../../lib/coords'
import { shortLatLon } from '../../lib/lunar'
import { MAX_COMPARE, type Place } from '../../lib/places'
import type { Location } from '../../state/MissionContext'
import { CustomSiteForm } from '../../components/sites/CustomSiteForm'

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
