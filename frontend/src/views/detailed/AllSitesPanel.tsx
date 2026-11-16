import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { EphemerisResponse } from '../../api/types'
import { formatUtc } from '../../lib/format'
import { MAX_COMPARE, type Place } from '../../lib/places'
import { windowStats } from '../../lib/stats'
import { useCurrentSample, useMission, type Location } from '../../state/MissionContext'

interface Props {
  places: Place[]
  results: Record<string, EphemerisResponse>
  errors: Record<string, string>
  running: boolean
  progress: { done: number; total: number } | null
  onCalculate: (skip: Set<string>) => void
  tray: Place[]
  onToggleTray: (p: Place) => void
  onSelect: (l: Location) => void
  onClose: () => void
}

type ColKey = 'name' | 'lat' | 'lon' | 'sunEl' | 'sunPct' | 'earthEl' | 'earthPct' | 'dark' | 'gap'

const COLS: { key: ColKey; label: string; num: boolean }[] = [
  { key: 'name', label: 'Site', num: false },
  { key: 'lat', label: 'Lat', num: true },
  { key: 'lon', label: 'Lon', num: true },
  { key: 'sunEl', label: 'Sun elev now', num: true },
  { key: 'sunPct', label: 'Sunlit %', num: true },
  { key: 'earthEl', label: 'Earth elev now', num: true },
  { key: 'earthPct', label: 'Earth visible %', num: true },
  { key: 'dark', label: 'Longest dark (h)', num: true },
  { key: 'gap', label: 'Longest comms gap (h)', num: true },
]

type Row = Place & Partial<Record<Exclude<ColKey, 'name' | 'lat' | 'lon'>, number>> & { error?: string }

export function AllSitesPanel({ places, results, errors, running, progress, onCalculate, tray, onToggleTray, onSelect, onClose }: Props) {
  const { location, ephemeris, timeIndex } = useMission()
  const sample = useCurrentSample()
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: 'sunPct', dir: -1 })

  const rows = useMemo<Row[]>(() => {
    return places.map((p) => {
      // The selected site's data is already loaded for the main view; reuse it.
      const data = results[p.id] ?? (location?.siteId === p.id ? ephemeris.data : null)
      if (!data) return { ...p, error: errors[p.id] }
      const s = data.samples[Math.min(timeIndex, data.samples.length - 1)]
      const st = windowStats(data)
      return {
        ...p,
        sunEl: s.sun.el,
        sunPct: st.sunFraction * 100,
        earthEl: s.earth.el,
        earthPct: st.earthFraction * 100,
        dark: st.longestDarkHours,
        gap: st.longestGapHours,
      }
    })
  }, [places, results, errors, location, ephemeris.data, timeIndex])

  const sorted = useMemo(() => {
    const val = (r: Row) => (sort.key === 'name' ? r.name : r[sort.key])
    return [...rows].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va === undefined) return 1 // rows without data always last
      if (vb === undefined) return -1
      return (typeof va === 'string' ? va.localeCompare(vb as string) : va - (vb as number)) * sort.dir
    })
  }, [rows, sort])

  const missing = rows.filter((r) => r.sunPct === undefined).length
  const skip = new Set(rows.filter((r) => r.sunPct !== undefined).map((r) => r.id))
  const inTray = (id: string) => tray.some((t) => t.id === id)
  const fmt = (v: number | undefined, digits = 1, unit = '') => (v === undefined ? '—' : `${v.toFixed(digits)}${unit}`)

  return (
    <section className="all-sites card" aria-label="All sites at the selected moment">
      <header className="all-sites-head">
        <div>
          <h2>All sites at the selected moment</h2>
          <p className="muted small-text">{sample ? formatUtc(sample.time) : '—'} · click a heading to sort · tick to add to compare</p>
        </div>
        <div className="all-sites-actions">
          {running && progress ? (
            <span className="mono small-text" role="status">Calculating {progress.done} of {progress.total}…</span>
          ) : (
            <button type="button" className="pill-btn on" disabled={missing === 0} onClick={() => onCalculate(skip)}>
              {missing === 0 ? 'All sites calculated' : `Calculate all sites (${missing})`}
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Close all-sites table" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="all-sites-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Compare</span></th>
              {COLS.map((c) => (
                <th key={c.key} scope="col" className={c.num ? 'num' : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.num ? -1 : 1 }))}>
                    {c.label}
                    {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const checked = inTray(r.id)
              return (
                <tr key={r.id} className={location?.siteId === r.id ? 'selected' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && tray.length >= MAX_COMPARE}
                      aria-label={`Add ${r.name} to compare`}
                      onChange={() => onToggleTray({ id: r.id, name: r.name, lat: r.lat, lon: r.lon })}
                    />
                  </td>
                  <td>
                    <button type="button" className="link-btn" onClick={() => onSelect({ name: r.name, lat: r.lat, lon: r.lon, siteId: r.id, source: 'search' })}>
                      {r.name}
                    </button>
                    {r.error && <span className="error small-text"> · {r.error}</span>}
                  </td>
                  <td className="num mono">{r.lat.toFixed(2)}</td>
                  <td className="num mono">{r.lon.toFixed(2)}</td>
                  <td className="num mono sun-text">{fmt(r.sunEl, 1, '°')}</td>
                  <td className="num mono">{fmt(r.sunPct, 0, '%')}</td>
                  <td className="num mono earth-text">{fmt(r.earthEl, 1, '°')}</td>
                  <td className="num mono">{fmt(r.earthPct, 0, '%')}</td>
                  <td className="num mono">{fmt(r.dark, 0)}</td>
                  <td className="num mono">{fmt(r.gap, 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small-text all-sites-foot">
        Sunlit and Earth visible count the time the center of each disc is above the local terrain horizon. Durations are accurate to about one sample step.
      </p>
    </section>
  )
}
