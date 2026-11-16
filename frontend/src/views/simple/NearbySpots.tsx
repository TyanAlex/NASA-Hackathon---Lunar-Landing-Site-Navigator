import { Download } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useNearbySpots, type SpotResult } from '../../hooks/useNearbySpots'
import { downloadCsv, slug } from '../../lib/csv'
import { describeOffset } from '../../lib/landing'
import type { Place } from '../../lib/places'
import { missionStats, missionWindowText } from '../../lib/mission'
import { formatHours, type WindowStats } from '../../lib/stats'
import { useMission } from '../../state/MissionContext'

// Sequential ramps, one hue (the Sun's orange). Light theme: light → dark = less → more.
// Dark theme: its own steps, dark → bright = less → more.
const RAMP_LIGHT = ['#fdecd3', '#f9cf98', '#f0a956', '#d4801f', '#a65d10', '#7a420a']
const RAMP_DARK = ['#3b2a14', '#5e3f12', '#8a5a14', '#b77a1a', '#e2a12c', '#ffd166']

interface Metric {
  key: string
  label: string
  value: (s: WindowStats) => number
  format: (v: number) => string
  /** true when a higher value is better (decides "best" / "worst"). */
  higherBetter: boolean
}

const pct = (v: number) => `${Math.round(v * 100)}%`

const METRICS: Metric[] = [
  { key: 'sun', label: 'Sunlit %', value: (s) => s.sunFraction, format: pct, higherBetter: true },
  { key: 'earth', label: 'Earth visible %', value: (s) => s.earthFraction, format: pct, higherBetter: true },
  { key: 'ops', label: 'Ops hours (both up)', value: (s) => s.bothHours, format: formatHours, higherBetter: true },
  { key: 'full', label: 'Full-Sun hours', value: (s) => s.fullSunHours, format: formatHours, higherBetter: true },
  { key: 'dark', label: 'Longest dark', value: (s) => s.longestDarkHours, format: formatHours, higherBetter: false },
  { key: 'gap', label: 'Longest comms gap', value: (s) => s.longestGapHours, format: formatHours, higherBetter: false },
]

const COMPARE_ROWS: { label: string; value: (s: WindowStats) => number; format: (v: number) => string; delta: (v: number) => string }[] = [
  { label: 'Sunlit', value: (s) => s.sunFraction, format: pct, delta: (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} pts` },
  { label: 'Longest dark', value: (s) => s.longestDarkHours, format: formatHours, delta: (v) => `${v >= 0 ? '+' : '−'}${formatHours(Math.abs(v))}` },
  { label: 'Earth visible', value: (s) => s.earthFraction, format: pct, delta: (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} pts` },
  { label: 'Longest comms gap', value: (s) => s.longestGapHours, format: formatHours, delta: (v) => `${v >= 0 ? '+' : '−'}${formatHours(Math.abs(v))}` },
  { label: 'Ops hours (both up)', value: (s) => s.bothHours, format: formatHours, delta: (v) => `${v >= 0 ? '+' : '−'}${formatHours(Math.abs(v))}` },
]

/** Empty 5×5 grid (offsets in km) shown before the first check. */
const placeholders = (spacing: number): SpotResult[] =>
  Array.from({ length: 25 }, (_, i) => ({ dn: (2 - Math.floor(i / 5)) * spacing, de: ((i % 5) - 2) * spacing, lat: 0, lon: 0, data: null, stats: null }))

/**
 * "Is there a better spot nearby?": a 5×5 grid of window stats around the site.
 * Simple shows % sunlit. Detailed adds a metric picker, wider spacing, worst case, an
 * original-vs-picked table and CSV export.
 */
export function NearbySpots({ detailed = false, onCompare }: { detailed?: boolean; onCompare?: (places: Place[]) => boolean }) {
  const { location, setLocation, range, ephemeris, stepMinutes, missionType } = useMission()
  // Every cell is judged over the mission window from landing, like the rest of the page.
  const base = useMemo(() => (ephemeris.data ? missionStats(ephemeris.data, missionType) : null), [ephemeris.data, missionType])
  const { spacing, setSpacing, spots: rawSpots, running, progress, run } = useNearbySpots(location, range, stepMinutes, ephemeris.data)
  const spots = useMemo(() => rawSpots?.map((s) => ({ ...s, stats: s.data ? missionStats(s.data, missionType) : null })) ?? null, [rawSpots, missionType])
  const windowText = missionWindowText(missionType)
  const [picked, setPicked] = useState<number | null>(null)
  const [metricKey, setMetricKey] = useState('sun')
  const [compareMsg, setCompareMsg] = useState<string | null>(null)
  const id = useId()

  const metric = (detailed && METRICS.find((m) => m.key === metricKey)) || METRICS[0]
  const ramp = detailed ? RAMP_DARK : RAMP_LIGHT
  const spacings = detailed ? [0.5, 1, 2, 3] : [0.5, 1, 2]

  const done = spots?.filter((s): s is SpotResult & { stats: WindowStats } => s.stats !== null) ?? []
  const vals = done.map((s) => metric.value(s.stats))
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 1
  const better = (a: number, b: number) => (metric.higherBetter ? a > b : a < b)
  const best = done.reduce<(typeof done)[number] | null>((b, s) => (!b || better(metric.value(s.stats), metric.value(b.stats)) ? s : b), null)
  const worst = done.reduce<(typeof done)[number] | null>((w, s) => (!w || better(metric.value(w.stats), metric.value(s.stats)) ? s : w), null)
  const complete = !!spots && !running && done.length === spots.length
  const sel = spots && picked !== null ? spots[picked] : null
  const radius = spacing * 2
  const baseVal = base ? metric.value(base) : null

  const cellStyle = (v: number) => {
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5
    const i = Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)))
    const lightText = detailed ? i <= 2 : i >= 3
    return { background: ramp[i], color: lightText ? '#ffffff' : '#1b1f24' }
  }

  // The site itself (same id scheme as Site detail's "Add to compare") and a grid spot as compare-tray places.
  const sitePlace = (): Place | null =>
    location && { id: location.siteId ?? `point-${location.lat.toFixed(4)},${location.lon.toFixed(4)}`, name: location.name, lat: location.lat, lon: location.lon }
  const spotPlace = (s: SpotResult): Place =>
    s.dn === 0 && s.de === 0 && sitePlace()
      ? sitePlace()!
      : { id: `point-${s.lat.toFixed(4)},${s.lon.toFixed(4)}`, name: `${location?.name ?? 'Site'} (${describeOffset(s.dn, s.de)})`, lat: s.lat, lon: s.lon }
  const compare = (spots: SpotResult[]) => {
    const site = sitePlace()
    if (!onCompare || !site) return
    const ok = onCompare([site, ...spots.map(spotPlace)])
    setCompareMsg(ok ? null : 'The compare tray holds 3 places. Remove one on the Compare page, then try again.')
  }

  const goTo = (s: SpotResult) => {
    if (!location) return
    setLocation({ name: `${location.name} (${describeOffset(s.dn, s.de)})`, lat: s.lat, lon: s.lon, source: 'search' })
  }

  const exportCsv = () => {
    if (!spots || !location) return
    downloadCsv(`${slug(location.name)}-nearby-${spacing}km.csv`, [
      ['north_km', 'east_km', 'lat', 'lon', 'sunlit_pct', 'earth_visible_pct', 'ops_hours', 'full_sun_hours', 'longest_dark_hours', 'longest_comms_gap_hours'],
      ...spots.map((s) => [
        s.dn, s.de, +s.lat.toFixed(5), +s.lon.toFixed(5),
        ...(s.stats
          ? [+(s.stats.sunFraction * 100).toFixed(1), +(s.stats.earthFraction * 100).toFixed(1), +s.stats.bothHours.toFixed(1), +s.stats.fullSunHours.toFixed(1), +s.stats.longestDarkHours.toFixed(1), +s.stats.longestGapHours.toFixed(1)]
          : ['', '', '', '', '', '']),
      ]),
    ])
  }

  return (
    <section className="s-card" aria-label="Nearby spots">
      <div className="card-head">
        <h2>Is there a better spot nearby?</h2>
        {detailed && (
          <div className="field inline-field">
            <label htmlFor={`${id}-metric`}>Show</label>
            <select id={`${id}-metric`} value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
              {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        )}
        <div className="field inline-field">
          <label htmlFor={`${id}-spacing`}>Spacing</label>
          <select id={`${id}-spacing`} value={spacing} onChange={(e) => { setSpacing(Number(e.target.value)); setPicked(null) }}>
            {spacings.map((s) => <option key={s} value={s}>{s < 1 ? `${s * 1000} m` : `${s} km`}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={running || !base} onClick={() => { setPicked(null); run() }}>
          {running && progress ? `Checking ${progress.done} of ${progress.total}…` : spots ? 'Check again' : 'Check nearby spots'}
        </button>
        {detailed && complete && (
          <button type="button" className="btn btn-outline" onClick={exportCsv}><Download size={16} aria-hidden /> CSV</button>
        )}
      </div>
      <p className="muted small">
        {detailed
          ? `5×5 grid out to ${radius} km (north up), judged over ${windowText} after landing. Set the spacing so the grid covers your landing area; worst case matters as much as best.`
          : `Landers can touch down a kilometer or two off target, and near the poles a nearby ridge can decide whether a spot is lit. This checks % sunlit over ${windowText} after landing, on a grid out to ${radius} km around the site (north is up).`}
      </p>

      <div className="nearby">
        <div className="nearby-grid-wrap">
          <span className="compass-n" aria-hidden>N</span>
          <div className="nearby-grid" role="group" aria-label={`${metric.label} on a 5 by 5 grid around the site`}>
            {(spots ?? placeholders(spacing)).map((s, i) => {
              const center = s.dn === 0 && s.de === 0
              const v = s.stats ? metric.value(s.stats) : null
              return (
                <button
                  key={i}
                  type="button"
                  className={`cell${center ? ' cell-site' : ''}${picked === i ? ' cell-picked' : ''}`}
                  style={v !== null ? cellStyle(v) : undefined}
                  disabled={!spots || v === null}
                  aria-pressed={picked === i}
                  aria-label={`${center ? 'This site' : describeOffset(s.dn, s.de)}: ${v !== null ? `${metric.format(v)} ${metric.label.toLowerCase()}` : 'not checked yet'}`}
                  onClick={() => setPicked(i)}
                >
                  {v !== null ? metric.format(v) : s.error ? '!' : center ? 'Site' : ''}
                  {center && v !== null && <span className="cell-tag">Site</span>}
                </button>
              )
            })}
          </div>
          {done.length > 1 && (
            <div className="ramp-legend" aria-hidden>
              <span>{metric.format(lo)}</span>
              <span className="ramp-bar" style={{ background: `linear-gradient(90deg, ${ramp.join(',')})` }} />
              <span>{metric.format(hi)}</span>
              <span className="ramp-caption">{metric.label}</span>
            </div>
          )}
        </div>

        <div className="nearby-readout" aria-live="polite">
          {!spots && <p className="muted">Press <strong>Check nearby spots</strong> to compare 24 points around the site. It takes a few seconds.</p>}
          {complete && best && worst && baseVal !== null && (
            <>
              <p className="nearby-verdict">
                {metric.key === 'sun' && hi - lo <= 0.05
                  ? <>Forgiving site: sunlight barely changes within {radius} km ({pct(lo)} to {pct(hi)}).</>
                  : <>{metric.label} ranges from {metric.format(lo)} to {metric.format(hi)} within {radius} km{metric.key === 'sun' ? ', so landing accuracy matters' : ''}.</>}
              </p>
              {better(metric.value(best.stats), baseVal) ? (
                <div className="best-row">
                  <span><strong>Best nearby:</strong> {describeOffset(best.dn, best.de)}, {metric.format(metric.value(best.stats))} (this site: {metric.format(baseVal)})</span>
                  <span className="row-actions">
                    <button type="button" className="btn btn-outline" onClick={() => goTo(best)}>Go there</button>
                    {onCompare && <button type="button" className="btn btn-outline" onClick={() => compare([best])}>Compare with this site</button>}
                  </span>
                </div>
              ) : (
                <p>This site is already the best point checked for {metric.label.toLowerCase()}.</p>
              )}
              {detailed && (
                <p><strong>Worst case:</strong> {describeOffset(worst.dn, worst.de)}, {metric.format(metric.value(worst.stats))}</p>
              )}
              {detailed && onCompare && best !== worst && (
                <button type="button" className="btn btn-outline compare-range-btn" onClick={() => compare([best, worst])}>
                  Compare site with best and worst spots
                </button>
              )}
            </>
          )}
          {sel && sel.stats && !detailed && (
            <div className="best-row picked-row">
              <span>
                <strong>{sel.dn === 0 && sel.de === 0 ? 'This site' : describeOffset(sel.dn, sel.de)}:</strong> {pct(sel.stats.sunFraction)} sunlit, Earth in view {pct(sel.stats.earthFraction)}
              </span>
              {!(sel.dn === 0 && sel.de === 0) && (
                <span className="row-actions">
                  <button type="button" className="btn btn-outline" onClick={() => goTo(sel)}>Go there</button>
                  {onCompare && <button type="button" className="btn btn-outline" onClick={() => compare([sel])}>Compare with this site</button>}
                </span>
              )}
            </div>
          )}
          {sel && sel.stats && base && detailed && (
            <div className="picked-table">
              <div className="picked-head">
                <strong>{sel.dn === 0 && sel.de === 0 ? 'This site' : describeOffset(sel.dn, sel.de)}</strong>
                {!(sel.dn === 0 && sel.de === 0) && (
                  <span className="row-actions">
                    <button type="button" className="btn btn-outline" onClick={() => goTo(sel)}>Go there</button>
                    {onCompare && <button type="button" className="btn btn-outline" onClick={() => compare([sel])}>Compare with this site</button>}
                  </span>
                )}
              </div>
              <table className="data-table">
                <thead><tr><th scope="col">Metric</th><th scope="col" className="num">This site</th><th scope="col" className="num">Picked point</th><th scope="col" className="num">Change</th></tr></thead>
                <tbody>
                  {COMPARE_ROWS.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td className="num">{r.format(r.value(base))}</td>
                      <td className="num">{r.format(r.value(sel.stats!))}</td>
                      <td className="num">{r.delta(r.value(sel.stats!) - r.value(base))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {compareMsg && <p className="form-error" role="alert">{compareMsg}</p>}
          {detailed && complete && !sel && <p className="muted small">Click any cell to compare it with this site.</p>}
        </div>
      </div>
    </section>
  )
}
