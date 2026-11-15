import { Crosshair, MapPin, Search, X } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Site, SiteKind } from '../../api/types'
import { formatLatLon, parseLatLon } from '../../lib/coords'
import type { Location } from '../../state/MissionContext'

const KIND_LABEL: Record<SiteKind, string> = {
  historical: 'Apollo era',
  recent: 'Recent landings',
  candidate: 'Candidate regions',
}

interface Result {
  key: string
  title: string
  subtitle: string
  location: Location
  group: string
}

interface Props {
  sites: Site[]
  selected: Location | null
  onSelect: (l: Location) => void
}

export function SearchBox({ sites, selected, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const out: Result[] = []
    const coords = parseLatLon(query)
    if (coords) {
      out.push({
        key: 'coords',
        title: `Go to ${formatLatLon(coords.lat, coords.lon)}`,
        subtitle: 'Custom coordinates',
        location: { name: formatLatLon(coords.lat, coords.lon), ...coords, source: 'search' },
        group: 'Coordinates',
      })
    }
    for (const s of sites) {
      if (q && !coords && !`${s.name} ${s.program}`.toLowerCase().includes(q)) continue
      if (coords) continue
      out.push({
        key: s.id,
        title: s.name,
        subtitle: `${s.program} · ${formatLatLon(s.lat, s.lon)}`,
        location: { name: s.name, lat: s.lat, lon: s.lon, siteId: s.id, source: 'search' },
        group: KIND_LABEL[s.kind],
      })
    }
    return out
  }, [query, sites])

  const choose = (r: Result) => {
    onSelect(r.location)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="search-field">
        <Search size={18} aria-hidden />
        <input
          ref={inputRef}
          value={query}
          placeholder="Search sites or enter lat, lon (e.g. 89.5S 45E)"
          aria-label="Search landing sites or coordinates"
          aria-expanded={open}
          aria-controls="search-results"
          role="combobox"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={16} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul id="search-results" className="search-results" role="listbox">
          {results.map((r, i) => (
            <li key={r.key} role="presentation">
              {(i === 0 || results[i - 1].group !== r.group) && <div className="search-group">{r.group}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
              >
                {r.key === 'coords' ? <Crosshair size={16} /> : <MapPin size={16} />}
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.subtitle}</small>
                </span>
                {selected?.siteId === r.key && <em>Selected</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
