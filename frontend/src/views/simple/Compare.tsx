import { Download, Plus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Sample } from '../../api/types'
import { navigate, pageHref } from '../../hooks/useHashRoute'
import { useScenarioData, type Scenario, type ScenarioResult } from '../../hooks/useScenarioData'
import { useSites } from '../../hooks/useSites'
import { downloadCsv } from '../../lib/csv'
import { BADGE, buildScenarios, missionStats, missionWindowDays, missionWindowText, shiftDays, type CompareSettings } from '../../lib/compare'
import { formatDeg, formatUtc } from '../../lib/format'
import { lunarDayRange, shortLatLon, visibleRuns } from '../../lib/lunar'
import { MAX_COMPARE, type Place } from '../../lib/places'
import { formatHours, type WindowStats } from '../../lib/stats'
import { MISSION_TYPES, missionVerdict, type MissionType, type Verdict } from '../../lib/verdict'
import { useMission } from '../../state/MissionContext'
import { HorizonPanorama } from './HorizonPanorama'
import './simple.css'
import './siteDetail.css'
import './compare.css'

const MAX_SLIP = 14
const DAY = 86_400_000

interface Row {
  key: string
  label: string
  value: (st: WindowStats) => number
  format: (v: number) => string
  higherBetter: boolean
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const ROWS: Row[] = [
  { key: 'sun', label: 'Sunlit', value: (st) => st.sunFraction, format: pct, higherBetter: true },
  { key: 'dark', label: 'Longest dark period', value: (st) => st.longestDarkHours, format: formatHours, higherBetter: false },
  { key: 'earth', label: 'Earth visible', value: (st) => st.earthFraction, format: pct, higherBetter: true },
  { key: 'gap', label: 'Longest comms gap', value: (st) => st.longestGapHours, format: formatHours, higherBetter: false },
  { key: 'maxel', label: 'Max Sun elevation', value: (st) => st.sunMaxEl, format: formatDeg, higherBetter: true },
]

const dateOnly = (iso: string) => iso.slice(0, 10)

interface Props {
  tray: Place[]
  onToggleTray: (p: Place) => void
  customSites: Place[]
  settings: CompareSettings
}

/** Simple Compare: up to three sites (or three landing dates for one site) side by side, with a launch-slip slider. */
export function Compare({ tray, onToggleTray, customSites, settings }: Props) {
  const { location, setLocation, range, setRange, setTimeIndex, setPlaying, missionType, setMissionType } = useMission()
  const { data: sites } = useSites()
  const { mode, setMode, slip, setSlip, extraDates, setExtraDates } = settings
  const id = useId()
  const landing = range.start

  const places = useMemo<Place[]>(
    () => [...(sites ?? []).map(({ id, name, lat, lon }) => ({ id, name, lat, lon })), ...customSites],
    [sites, customSites],
  )

  const { base, slipped } = useMemo(() => buildScenarios({ mode, slip, extraDates }, tray, location, landing), [mode, slip, extraDates, tray, location, landing])
  const all = useMemo(() => [...base, ...slipped], [base, slipped])
  const get = useScenarioData(all)

  // Stats cover the mission itself: the first N days after landing (whole lunar day for a long-term base).
  const windowDays = missionWindowDays(missionType)
  const windowText = missionWindowText(missionType)
  const statsFor = (d: NonNullable<ScenarioResult['data']>) => missionStats(d, missionType)

  const computed = all.map((s) => {
    const r = get(s)
    return { s, r, stats: r.data ? statsFor(r.data) : null, verdict: r.data ? missionVerdict(r.data, missionType) : null }
  })
  const byKey = Object.fromEntries(computed.map((c) => [c.s.key, c]))
  const baseComputed = computed.filter((c) => !c.s.slippedFrom)

  // "best" per metric, only when at least two scenarios have data.
  const ready = baseComputed.filter((c) => c.stats && c.r.data)
  const best: Record<string, string | null> = Object.fromEntries(
    ROWS.map((row) => {
      if (ready.length < 2) return [row.key, null]
      const vals = ready.map((c) => ({ k: c.s.key, v: row.value(c.stats!) }))
      const top = vals.reduce((a, b) => ((row.higherBetter ? b.v > a.v : b.v < a.v) ? b : a))
      const tie = vals.filter((x) => Math.abs(x.v - top.v) < 1e-9).length > 1
      return [row.key, tie ? null : top.k]
    }),
  )

  const setLandingDate = (date: string) => {
    if (!date || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return
    setPlaying(false)
    setRange(lunarDayRange(`${date}T${landing.slice(11, 16)}:00Z`))
    setTimeIndex(0)
  }

  const openDetail = (s: Scenario) => {
    setPlaying(false)
    setLocation({ name: s.name, lat: s.lat, lon: s.lon, siteId: s.siteId, source: 'search' })
    if (s.start !== landing) setRange(lunarDayRange(s.start))
    navigate('detail')
  }

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['scenario', 'site', 'lat', 'lon', 'landing_utc', 'slip_days', 'mission_type', 'window_days', 'verdict', 'verdict_detail', 'sunlit_pct', 'longest_dark_h', 'earth_visible_pct', 'longest_comms_gap_h', 'max_sun_el_deg', 'ops_hours'],
    ]
    for (const c of computed) {
      const slipDays = c.s.slippedFrom ? slip : 0
      rows.push([
        c.s.label, c.s.name, +c.s.lat.toFixed(5), +c.s.lon.toFixed(5), c.s.start, slipDays, missionType, windowDays ?? 29.5,
        c.verdict ? BADGE[c.verdict.tone].text : '', c.verdict?.headline ?? '',
        ...(c.stats
          ? [+(c.stats.sunFraction * 100).toFixed(1), +c.stats.longestDarkHours.toFixed(1), +(c.stats.earthFraction * 100).toFixed(1), +c.stats.longestGapHours.toFixed(1), +c.stats.sunMaxEl.toFixed(2), +c.stats.bothHours.toFixed(1)]
          : ['', '', '', '', '', '']),
      ])
    }
    downloadCsv(`lunar-lens-compare-${dateOnly(landing)}.csv`, rows)
  }

  const canAdd = mode === 'sites' ? tray.length < MAX_COMPARE : !!location && base.length < MAX_COMPARE
  const notInTray = places.filter((p) => !tray.some((t) => t.id === p.id))

  return (
    <div className="detail-page compare-page">
      <div className="detail-head">
        <div>
          <h1 className="detail-title">Compare {mode === 'sites' ? 'sites' : 'landing dates'}</h1>
          <p className="summary-meta">
            {mode === 'sites'
              ? 'Up to three sites side by side for the same landing date. Tick sites on the Explore screen or add them here.'
              : `${location?.name ?? 'No site selected'}: up to three landing dates side by side.`}
          </p>
        </div>
      </div>

      <section className="s-card compare-controls" aria-label="Comparison settings">
        <div className="field">
          <span className="field-label" id={`${id}-mode`}>Compare</span>
          <div className="segmented" role="group" aria-labelledby={`${id}-mode`}>
            <button type="button" aria-pressed={mode === 'sites'} onClick={() => setMode('sites')}>Different sites</button>
            <button type="button" aria-pressed={mode === 'dates'} onClick={() => setMode('dates')}>Same site, different dates</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-date`}>{mode === 'sites' ? 'Planned landing date (UTC)' : 'Date A (UTC)'}</label>
          <input id={`${id}-date`} type="date" value={dateOnly(landing)} onChange={(e) => setLandingDate(e.target.value)} />
        </div>
        {mode === 'sites' && (
          <div className="field slip-field">
            <div className="scrub-label">
              <label htmlFor={`${id}-slip`}>Launch slips by</label>
              <span className="scrub-now">{slip === 0 ? 'no slip' : `${slip} day${slip > 1 ? 's' : ''}`}</span>
            </div>
            <input id={`${id}-slip`} type="range" className="scrub" min={0} max={MAX_SLIP} step={1} value={slip} onChange={(e) => setSlip(Number(e.target.value))} aria-valuetext={`${slip} days`} />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-type`}>Mission type</label>
          <select id={`${id}-type`} value={missionType} onChange={(e) => setMissionType(e.target.value as MissionType)}>
            {MISSION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        {mode === 'sites' && slip > 0 && <button type="button" className="btn btn-outline" onClick={() => setSlip(0)}>Reset slip</button>}
        <button type="button" className="btn btn-outline" disabled={!ready.length} onClick={exportCsv}><Download size={16} aria-hidden /> Download CSV</button>
      </section>

      <div className="verdict-key" aria-label="Verdict key">
        <span className="verdict-key-title">Verdict key:</span>
        <span className="badge viable">Viable</span>
        <span className="badge marginal">Marginal</span>
        <span className="badge not-viable">Not viable</span>
        <span className="muted">Judged for a {MISSION_TYPES.find((t) => t.key === missionType)!.label.toLowerCase()} landing on each card’s date.</span>
      </div>

      <div className="compare-grid">
        {baseComputed.map((c, i) => {
          const after = byKey[`${c.s.key}-slip`]
          return (
            <section key={c.s.key} className="s-card compare-card" aria-label={c.s.label}>
              <div className="compare-card-head">
                <div>
                  <div className="eyebrow">{c.s.label}</div>
                  <h2 className="compare-name">{c.s.name}</h2>
                  <div className="summary-meta">{shortLatLon(c.s.lat, c.s.lon)}{mode === 'dates' ? ` · lands ${formatUtc(c.s.start)}` : ''}</div>
                </div>
                {(mode === 'sites' || i > 0) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    aria-label={`Remove ${c.s.label}`}
                    onClick={() => (mode === 'sites' ? onToggleTray(tray[i]) : setExtraDates((d) => d.filter((_, j) => j !== i - 1)))}
                  >
                    <X size={14} aria-hidden /> Remove
                  </button>
                )}
              </div>

              {mode === 'dates' && i > 0 && (
                <div className="field">
                  <label htmlFor={`${id}-d${i}`}>Landing date (UTC)</label>
                  <input
                    id={`${id}-d${i}`}
                    type="date"
                    value={dateOnly(c.s.start)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v) return
                      setExtraDates((d) => d.map((x, j) => (j === i - 1 ? `${v}T${landing.slice(11, 16)}:00Z` : x)))
                    }}
                  />
                </div>
              )}

              <VerdictLine verdict={c.verdict} error={c.r.error} />
              {after && (
                <div className="slip-line">
                  <span className="muted">After {slip}-day slip:</span> <VerdictLine verdict={after.verdict} error={after.r.error} compact />
                </div>
              )}

              <CardHorizon planned={c.r} afterSlip={after?.r ?? null} slip={slip} />

              <p className="table-window">Over {windowText} after landing{after ? ' · planned → after slip' : ''}</p>
              <table className="compare-table">
                <tbody>
                  {ROWS.map((row) => {
                    const v = c.stats ? row.value(c.stats) : null
                    const va = after?.stats ? row.value(after.stats) : null
                    return (
                      <tr key={row.key}>
                        <th scope="row">{row.label}</th>
                        <td>
                          {best[row.key] === c.s.key && <span className="best-badge">best</span>}
                          {v === null ? '…' : row.format(v)}
                          {after && <span className="after-val"> → {va === null ? '…' : row.format(va)}</span>}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="row-soon">
                    <th scope="row">Terrain slope</th>
                    <td>coming soon</td>
                  </tr>
                </tbody>
              </table>

              <button type="button" className="btn btn-outline" onClick={() => openDetail(c.s)}>Open site detail</button>
            </section>
          )
        })}

        {canAdd && (
          <section className="compare-add" aria-label="Add to the comparison">
            {mode === 'sites' ? (
              <>
                <p className="muted">{tray.length ? 'Add another site' : 'No sites to compare yet. Pick up to three.'}</p>
                <label htmlFor={`${id}-add`} className="sr-only">Add a site</label>
                <select
                  id={`${id}-add`}
                  value=""
                  onChange={(e) => {
                    const p = notInTray.find((x) => x.id === e.target.value)
                    if (p) onToggleTray(p)
                  }}
                >
                  <option value="">+ Pick from site list</option>
                  {notInTray.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <p className="muted">Add another landing date for this site</p>
                <button type="button" className="btn btn-outline" onClick={() => setExtraDates((d) => [...d, shiftDays(d.length ? d[d.length - 1] : landing, 7)])}>
                  <Plus size={16} aria-hidden /> Add a date (+7 days)
                </button>
              </>
            )}
          </section>
        )}
      </div>

      {mode === 'dates' && !location && (
        <div className="s-card"><p className="muted">No site selected. <a href={pageHref('explore')}>Pick one on the Explore screen.</a></p></div>
      )}

      {computed.some((c) => c.r.data) && <SharedTimeline items={computed.map((c) => ({ s: c.s, samples: c.r.data?.samples ?? [] }))} origin={landing} windowDays={windowDays} />}

      <p className="muted small compare-foot">
        Sunlit and Earth visible count the time the center of each disc is above the local terrain horizon, over the mission window from each card’s landing date (the whole lunar day, about 29.5 Earth days, for a long-term base). Seasonal changes over the year aren’t included.
      </p>
    </div>
  )
}

/**
 * Mini horizon at the landing moment. With a slip set it follows the slipped landing by default,
 * with a switch back to the planned one so the two can be compared on the same card.
 */
function CardHorizon({ planned, afterSlip, slip }: { planned: ScenarioResult; afterSlip: ScenarioResult | null; slip: number }) {
  const [showPlanned, setShowPlanned] = useState(false)
  const usingSlip = !!afterSlip && !showPlanned
  const r = usingSlip ? afterSlip : planned
  return (
    <div className="card-horizon">
      {afterSlip && (
        <div className="segmented mini-seg" role="group" aria-label="Which landing to show">
          <button type="button" aria-pressed={!usingSlip} onClick={() => setShowPlanned(true)}>Planned</button>
          <button type="button" aria-pressed={usingSlip} onClick={() => setShowPlanned(false)}>After {slip}-day slip</button>
        </div>
      )}
      <div className="mini-pano" aria-hidden={!r.data}>
        {r.data ? (
          <HorizonPanorama samples={r.data.samples} timeIndex={0} horizon={r.horizon} compact />
        ) : (
          <div className="mini-pano-loading muted small">{r.error ? 'Couldn’t load' : 'Loading…'}</div>
        )}
      </div>
      <p className="muted small">
        Horizon at {usingSlip ? `the landing after a ${slip}-day slip` : 'the planned landing'}: Sun and Earth over the local terrain.
      </p>
    </div>
  )
}

export function VerdictLine({ verdict, error, compact = false }: { verdict: Verdict | null; error: string | null; compact?: boolean }) {
  if (error) return <span className="form-error">Couldn’t compute: {error}</span>
  if (!verdict) return <span className="muted small">Calculating…</span>
  const b = BADGE[verdict.tone]
  return (
    <div className={`verdict-line${compact ? ' compact' : ''}`}>
      <span className={`badge ${b.cls}`}>{b.text}</span>
      <span className="verdict-text">{verdict.headline}</span>
    </div>
  )
}

/** Every scenario's Sun and Earth bars on one shared time axis (days from the planned landing). */
export function SharedTimeline({ items, origin, windowDays }: { items: { s: Scenario; samples: Sample[] }[]; origin: string; windowDays: number | null }) {
  const t0 = Date.parse(origin)
  const ends = items.filter((i) => i.samples.length).map((i) => Date.parse(i.samples[i.samples.length - 1].time))
  const starts = items.filter((i) => i.samples.length).map((i) => Date.parse(i.samples[0].time))
  const lo = Math.min(t0, ...starts)
  const hi = Math.max(...ends)
  const pos = (t: number) => ((t - lo) / Math.max(hi - lo, 1)) * 100
  const spanDays = (hi - lo) / DAY
  const ticks: number[] = []
  for (let d = Math.ceil((lo - t0) / DAY / 7) * 7; d <= (hi - t0) / DAY; d += 7) ticks.push(d)

  const segs = (samples: Sample[], body: 'sun' | 'earth') => {
    if (!samples.length) return []
    const step = samples.length > 1 ? Date.parse(samples[1].time) - Date.parse(samples[0].time) : 0
    return visibleRuns(samples, (x) => x[body].visible).map(([a, b]) => {
      const left = pos(Date.parse(samples[a].time))
      const end = new Date(Date.parse(samples[b].time) + step).toISOString()
      return { key: a, left, width: pos(Date.parse(end)) - left, title: `${body === 'sun' ? 'Sun' : 'Earth'} up ${formatUtc(samples[a].time)} → ${formatUtc(end)}` }
    })
  }

  return (
    <section className="s-card" aria-label="All scenarios on one timeline">
      <h2 className="card-title">All on one timeline</h2>
      <p className="muted small">Days from the planned landing ({formatUtc(origin)}). Each row starts at that card’s own landing.</p>
      <div className="shared-tl">
        {items.map(({ s, samples }) => (
          <div key={s.key} className={`stl-row${s.slippedFrom ? ' stl-slip' : ''}`}>
            <span className="stl-label">{s.label}</span>
            <div className="stl-tracks">
              {(['sun', 'earth'] as const).map((b) => (
                <div key={b} className="stl-track" role="img" aria-label={`${s.label}: ${b === 'sun' ? 'Sun' : 'Earth'} above the horizon`}>
                  {segs(samples, b).map((g) => <div key={g.key} className={`vis-seg seg-${b}`} title={g.title} style={{ left: `${g.left}%`, width: `${g.width}%` }} />)}
                  {samples.length > 0 && windowDays !== null && (
                    <div
                      className="stl-mission"
                      style={{ left: `${pos(Date.parse(samples[0].time))}%`, width: `${pos(Date.parse(samples[0].time) + windowDays * DAY) - pos(Date.parse(samples[0].time))}%` }}
                    />
                  )}
                  {samples.length > 0 && <div className="stl-start" style={{ left: `${pos(Date.parse(samples[0].time))}%` }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="stl-row">
          <span className="stl-label" aria-hidden />
          <div className="vis-ticks" aria-hidden>
            {ticks.map((d) => <span key={d} style={{ left: `${pos(t0 + d * DAY)}%` }}>Day {d}</span>)}
          </div>
        </div>
      </div>
      <ul className="pano-legend">
        <li><span className="key-swatch seg-sun" aria-hidden /> Sun up</li>
        <li><span className="key-swatch seg-earth" aria-hidden /> Earth up</li>
        <li><span className="key-start" aria-hidden /> Landing</li>
        {windowDays !== null && <li><span className="key-mission" aria-hidden /> Mission ({windowDays} days)</li>}
        {spanDays > 31 && <li className="muted">Rows marked “after slip” land later, so they extend further right.</li>}
      </ul>
    </section>
  )
}
