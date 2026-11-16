import { Download, Plus, RotateCcw, X } from 'lucide-react'
import { Fragment, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { EphemerisResponse, HorizonResponse } from '../../api/types'
import { navigate, pageHref } from '../../hooks/useHashRoute'
import { useScenarioData, type Scenario } from '../../hooks/useScenarioData'
import { useSites } from '../../hooks/useSites'
import { MAX_SLIP_DAYS, useSlipSeries } from '../../hooks/useSlipSeries'
import { labelPositions } from '../../lib/chartLabels'
import {
  buildScenarios,
  defaultLimits,
  downloadJson,
  LIMIT_TEXT,
  limitsVerdict,
  missionStats,
  missionWindowDays,
  missionWindowText,
  shiftDays,
  type CompareSettings,
  type Limits,
  type LimitTone,
} from '../../lib/compare'
import { formatLatLon } from '../../lib/coords'
import { downloadCsv } from '../../lib/csv'
import { formatUtc, toIsoMinute } from '../../lib/format'
import { lunarDayRange } from '../../lib/lunar'
import { MAX_COMPARE, type Place } from '../../lib/places'
import { formatHours, sampleStats, type WindowStats } from '../../lib/stats'
import { MISSION_TYPES, missionVerdict, type MissionType, type Verdict } from '../../lib/verdict'
import { windowCounts, type WindowCounts } from '../../lib/windows'
import { useMission } from '../../state/MissionContext'
import { SharedTimeline, VerdictLine } from '../simple/Compare'
import '../simple/simple.css'
import '../simple/siteDetail.css'
import '../simple/compare.css'
import './detailedPages.css'
import './compareDetailed.css'

// Validated categorical slots for sites (dark surface): violet, green, magenta. Shapes and direct labels
// are the secondary encoding, so sites never rely on color alone.
const SITE_COLORS = ['#9085e9', '#0ca30c', '#d55181']
const SHAPES = ['circle', 'square', 'triangle'] as const

interface Computed {
  s: Scenario
  data: EphemerisResponse | null
  horizon: HorizonResponse | null
  error: string | null
  stats: WindowStats | null
  counts: WindowCounts | null
  verdict: Verdict | null
  limits: { tone: LimitTone; why: string[] } | null
}

interface Props {
  tray: Place[]
  onToggleTray: (p: Place) => void
  customSites: Place[]
  settings: CompareSettings
}

/** Detailed Compare: user-set limits, full side-by-side table, 0–30-day slip chart, shared timeline, CSV/JSON. */
export function CompareDetailed({ tray, onToggleTray, customSites, settings }: Props) {
  const { location, setLocation, range, setRange, setTimeIndex, setPlaying, missionType, setMissionType } = useMission()
  const { data: sites } = useSites()
  const { mode, setMode, slip, setSlip, extraDates, setExtraDates } = settings
  const [limitsOverride, setLimitsOverride] = useState<Limits | null>(null)
  const id = useId()
  const landing = range.start
  const limits = limitsOverride ?? defaultLimits(missionType)
  const windowDays = missionWindowDays(missionType)
  const windowText = missionWindowText(missionType)

  const places = useMemo<Place[]>(
    () => [...(sites ?? []).map(({ id, name, lat, lon }) => ({ id, name, lat, lon })), ...customSites],
    [sites, customSites],
  )
  const { base, slipped } = useMemo(() => buildScenarios({ mode, slip, extraDates }, tray, location, landing), [mode, slip, extraDates, tray, location, landing])
  const all = useMemo(() => [...base, ...slipped], [base, slipped])
  const get = useScenarioData(all)

  const computed: Computed[] = all.map((s) => {
    const r = get(s)
    const stats = r.data ? missionStats(r.data, missionType) : null
    const slice = r.data && windowDays !== null ? r.data.samples.slice(0, Math.round((windowDays * 24 * 60) / r.data.step_minutes)) : r.data?.samples
    return {
      s,
      data: r.data,
      horizon: r.horizon,
      error: r.error,
      stats,
      counts: r.data && slice ? windowCounts(slice, r.data.step_minutes) : null,
      verdict: r.data ? missionVerdict(r.data, missionType) : null,
      limits: stats ? limitsVerdict(stats, limits) : null,
    }
  })
  const byKey = Object.fromEntries(computed.map((c) => [c.s.key, c]))
  const baseComputed = computed.filter((c) => !c.s.slippedFrom)

  const setStart = (date: string, time: string) => {
    const iso = `${date}T${time}:00Z`
    if (!date || !time || Number.isNaN(Date.parse(iso))) return
    setPlaying(false)
    setRange(lunarDayRange(toIsoMinute(new Date(iso))))
    setTimeIndex(0)
  }

  const openDetail = (s: Scenario) => {
    setPlaying(false)
    setLocation({ name: s.name, lat: s.lat, lon: s.lon, siteId: s.siteId, source: 'search' })
    if (s.start !== landing) setRange(lunarDayRange(s.start))
    navigate('detail')
  }

  const setLimit = (k: keyof Limits, v: string) => {
    const n = Number(v)
    if (v === '' || !Number.isFinite(n) || n < 0) return
    setLimitsOverride({ ...limits, [k]: n })
  }

  const canAdd = mode === 'sites' ? tray.length < MAX_COMPARE : !!location && base.length < MAX_COMPARE
  const notInTray = places.filter((p) => !tray.some((t) => t.id === p.id))

  const exportJson = () =>
    downloadJson(`lunar-lens-compare-${landing.slice(0, 10)}.json`, {
      generated: new Date().toISOString(),
      missionType,
      missionWindowDays: windowDays ?? 29.53,
      slipDays: slip,
      limits,
      scenarios: computed.map((c) => ({
        label: c.s.label, name: c.s.name, lat: c.s.lat, lon: c.s.lon, landingUtc: c.s.start, slippedFrom: c.s.slippedFrom ?? null,
        groundHeightM: c.horizon?.ground_height_m ?? null,
        missionVerdict: c.verdict, limitsVerdict: c.limits, stats: c.stats, counts: c.counts,
      })),
    })

  return (
    <div className="detail-page detailed-page compare-page compare-detailed">
      <div className="detail-head">
        <div>
          <h1 className="detail-title">Compare {mode === 'sites' ? 'sites' : 'landing dates'}</h1>
          <p className="summary-meta">Every number side by side, judged against limits you set, with what a later launch does over 30 days.</p>
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
          <label htmlFor={`${id}-date`}>{mode === 'sites' ? 'Planned landing (UTC)' : 'Date A (UTC)'}</label>
          <input id={`${id}-date`} type="date" value={landing.slice(0, 10)} onChange={(e) => setStart(e.target.value, landing.slice(11, 16))} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-time`}>Time</label>
          <input id={`${id}-time`} type="time" value={landing.slice(11, 16)} onChange={(e) => setStart(landing.slice(0, 10), e.target.value)} />
        </div>
        {mode === 'sites' && (
          <div className="field slip-field">
            <div className="scrub-label">
              <label htmlFor={`${id}-slip`}>Launch slips by</label>
              <span className="scrub-now">{slip === 0 ? 'no slip' : `${slip} day${slip > 1 ? 's' : ''}`}</span>
            </div>
            <input id={`${id}-slip`} type="range" className="scrub" min={0} max={MAX_SLIP_DAYS} step={1} value={slip} onChange={(e) => setSlip(Number(e.target.value))} aria-valuetext={`${slip} days`} />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-type`}>Mission type</label>
          <select id={`${id}-type`} value={missionType} onChange={(e) => setMissionType(e.target.value as MissionType)}>
            {MISSION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        {mode === 'sites' && slip > 0 && <button type="button" className="btn btn-outline" onClick={() => setSlip(0)}>Reset slip</button>}
      </section>

      <section className="s-card" aria-label="Viability limits">
        <div className="card-head">
          <h2>Viability limits (you set them)</h2>
          <button type="button" className="btn btn-outline btn-small" disabled={!limitsOverride} onClick={() => setLimitsOverride(null)}>
            <RotateCcw size={14} aria-hidden /> Use defaults for this mission type
          </button>
        </div>
        <div className="limits-grid">
          <LimitInput id={`${id}-l1`} label="Min sunlit (%)" value={limits.minSunPct} onChange={(v) => setLimit('minSunPct', v)} />
          <LimitInput id={`${id}-l2`} label="Max dark period (h)" value={limits.maxDarkH} onChange={(v) => setLimit('maxDarkH', v)} />
          <LimitInput id={`${id}-l3`} label="Min Earth visible (%)" value={limits.minEarthPct} onChange={(v) => setLimit('minEarthPct', v)} />
          <LimitInput id={`${id}-l4`} label="Max comms gap (h)" value={limits.maxGapH} onChange={(v) => setLimit('maxGapH', v)} />
          <LimitInput id={`${id}-l5`} label="Marginal band (% of limit)" value={limits.bandPct} onChange={(v) => setLimit('bandPct', v)} />
        </div>
        <p className="muted small">
          Checked over {windowText} after each landing. <span className="badge viable">Viable</span> every limit met ·{' '}
          <span className="badge marginal">Marginal</span> a limit missed, but within the band ·{' '}
          <span className="badge not-viable">Not viable</span> a limit missed by more than the band. The mission verdict above each card uses the fixed checks shown on Site detail.
        </p>
      </section>

      <div className="compare-grid">
        {baseComputed.map((c, i) => {
          const after = byKey[`${c.s.key}-slip`] as Computed | undefined
          return (
            <section key={c.s.key} className="s-card compare-card" aria-label={c.s.label}>
              <div className="compare-card-head">
                <div>
                  <div className="eyebrow site-eyebrow">
                    <SiteKey index={i} /> {c.s.label}
                  </div>
                  <h2 className="compare-name">{c.s.name}</h2>
                  <div className="summary-meta">{formatLatLon(c.s.lat, c.s.lon)}{mode === 'dates' ? ` · lands ${formatUtc(c.s.start)}` : ''}</div>
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
                    value={c.s.start.slice(0, 10)}
                    onChange={(e) => e.target.value && setExtraDates((d) => d.map((x, j) => (j === i - 1 ? `${e.target.value}T${landing.slice(11, 16)}:00Z` : x)))}
                  />
                </div>
              )}

              <div className="verdict-block">
                <span className="vb-title">Mission verdict</span>
                <VerdictLine verdict={c.verdict} error={c.error} />
              </div>
              <LimitsBlock title="Your limits" v={c.limits} />
              {after && (
                <div className="slip-block">
                  <span className="vb-title">After {slip}-day slip</span>
                  <VerdictLine verdict={after.verdict} error={after.error} compact />
                  <LimitsBlock title="Your limits" v={after.limits} compact />
                </div>
              )}
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

      {computed.some((c) => c.stats) && (
        <FullTable computed={computed} windowText={windowText} onCsv={() => exportTableCsv(computed, missionType, slip)} onJson={exportJson} />
      )}

      {base.length > 0 && <SlipChart base={base} limits={limits} missionType={missionType} slip={slip} onPickSlip={mode === 'sites' ? setSlip : undefined} />}

      {computed.some((c) => c.data) && (
        <SharedTimeline items={computed.map((c) => ({ s: c.s, samples: c.data?.samples ?? [] }))} origin={landing} windowDays={windowDays} />
      )}

      <p className="muted small compare-foot">
        “Up” means the center of the Sun’s or Earth’s disc is above the local terrain horizon. Stats cover {windowText} after each landing, at a 1-hour step, so durations are accurate to about an hour. Seasonal changes over the year aren’t included.
      </p>
    </div>
  )
}

function LimitInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function LimitsBlock({ title, v, compact = false }: { title: string; v: Computed['limits']; compact?: boolean }) {
  if (!v) return <p className="muted small">…</p>
  return (
    <div className={`limits-block${compact ? ' compact' : ''}`}>
      {!compact && <span className="vb-title">{title}</span>}
      <span className={`badge ${v.tone}`}>{compact ? `Limits: ${LIMIT_TEXT[v.tone]}` : LIMIT_TEXT[v.tone]}</span>
      {v.why.length > 0 && (
        <ul className="why-list">
          {v.why.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  )
}

/** Small colored shape matching the site's line in the slip chart. */
function SiteKey({ index }: { index: number }) {
  const c = SITE_COLORS[index % SITE_COLORS.length]
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="site-key">
      <Marker shape={SHAPES[index % SHAPES.length]} x={6} y={6} r={5} fill={c} />
    </svg>
  )
}

function Marker({ shape, x, y, r, fill, stroke }: { shape: (typeof SHAPES)[number]; x: number; y: number; r: number; fill: string; stroke?: string }) {
  if (shape === 'square') return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={fill} stroke={stroke} strokeWidth={stroke ? 2 : 0} />
  if (shape === 'triangle') return <path d={`M${x},${y - r * 1.15}L${x + r * 1.1},${y + r * 0.85}L${x - r * 1.1},${y + r * 0.85}Z`} fill={fill} stroke={stroke} strokeWidth={stroke ? 2 : 0} />
  return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={stroke ? 2 : 0} />
}

// ── Full comparison table ───────────────────────────────────────────────────

interface TRow {
  label: string
  value: (c: Computed) => number | null
  format: (v: number) => string
  delta?: (d: number) => string
  higherBetter?: boolean
}

const pctFmt = (v: number) => `${Math.round(v * 100)}%`
const ptsDelta = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))} pts`
const hDelta = (d: number) => `${d >= 0 ? '+' : '−'}${formatHours(Math.abs(d))}`
const nDelta = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d)}`
const degDelta = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}°`

const GROUPS: { title: string; rows: TRow[] }[] = [
  {
    title: 'Location',
    rows: [{ label: 'Ground elevation', value: (c) => c.horizon?.ground_height_m ?? null, format: (v) => `${Math.round(v).toLocaleString()} m`, delta: (d) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d)).toLocaleString()} m` }],
  },
  {
    title: 'Sun (power)',
    rows: [
      { label: 'Sunlit', value: (c) => c.stats?.sunFraction ?? null, format: pctFmt, delta: ptsDelta, higherBetter: true },
      { label: 'Sunlit hours', value: (c) => c.stats?.sunHours ?? null, format: formatHours, delta: hDelta, higherBetter: true },
      { label: 'Full Sun (whole disc)', value: (c) => c.stats?.fullSunHours ?? null, format: formatHours, delta: hDelta, higherBetter: true },
      { label: 'Longest dark period', value: (c) => c.stats?.longestDarkHours ?? null, format: formatHours, delta: hDelta, higherBetter: false },
      { label: 'Sunsets', value: (c) => c.counts?.sunsets ?? null, format: String, delta: nDelta, higherBetter: false },
      { label: 'Max Sun elevation', value: (c) => c.stats?.sunMaxEl ?? null, format: (v) => `${v.toFixed(1)}°`, delta: degDelta, higherBetter: true },
      { label: 'Min Sun elevation', value: (c) => c.stats?.sunMinEl ?? null, format: (v) => `${v.toFixed(1)}°`, delta: degDelta },
    ],
  },
  {
    title: 'Earth (comms)',
    rows: [
      { label: 'Earth visible', value: (c) => c.stats?.earthFraction ?? null, format: pctFmt, delta: ptsDelta, higherBetter: true },
      { label: 'Contact windows', value: (c) => c.counts?.earthWindows ?? null, format: String, delta: nDelta },
      { label: 'Longest contact window', value: (c) => c.counts?.longestEarthWindowHours ?? null, format: formatHours, delta: hDelta, higherBetter: true },
      { label: 'Longest comms gap', value: (c) => c.stats?.longestGapHours ?? null, format: formatHours, delta: hDelta, higherBetter: false },
    ],
  },
  {
    title: 'Operations (Sun and Earth both up)',
    rows: [
      { label: 'Total', value: (c) => c.stats?.bothHours ?? null, format: formatHours, delta: hDelta, higherBetter: true },
      { label: 'Longest window', value: (c) => c.counts?.longestOpsWindowHours ?? null, format: formatHours, delta: hDelta, higherBetter: true },
    ],
  },
]

function FullTable({ computed, windowText, onCsv, onJson }: { computed: Computed[]; windowText: string; onCsv: () => void; onJson: () => void }) {
  const base = computed.filter((c) => !c.s.slippedFrom)
  const ref = (c: Computed) => (c.s.slippedFrom ? computed.find((x) => x.s.key === c.s.slippedFrom) : base[0])

  const bestOf = (row: TRow) => {
    if (row.higherBetter === undefined) return null
    const vals = base.map((c) => ({ c, v: row.value(c) })).filter((x): x is { c: Computed; v: number } => x.v !== null)
    if (vals.length < 2) return null
    const top = vals.reduce((a, b) => ((row.higherBetter ? b.v > a.v : b.v < a.v) ? b : a))
    return vals.filter((x) => Math.abs(x.v - top.v) < 1e-9).length > 1 ? null : top.c
  }

  return (
    <section className="s-card" aria-label="Full comparison">
      <div className="card-head">
        <h2>Full comparison</h2>
        <button type="button" className="btn btn-outline btn-small" onClick={onCsv}><Download size={14} aria-hidden /> Table CSV</button>
        <button type="button" className="btn btn-outline btn-small" onClick={onJson}><Download size={14} aria-hidden /> Data JSON</button>
      </div>
      <p className="muted small">
        Over {windowText} after each landing. In brackets: change versus {base[0]?.s.label ?? 'the first card'} (slip columns: versus that card before the slip). The outlined cell is the best in its row.
      </p>
      <div className="table-scroll">
        <table className="data-table full-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {computed.map((c) => <th key={c.s.key} scope="col" className={`num${c.s.slippedFrom ? ' col-slip' : ''}`}>{c.s.label}</th>)}
              <th scope="col">Best</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">Latitude / longitude</th>{computed.map((c) => <td key={c.s.key} className="num mono">{formatLatLon(c.s.lat, c.s.lon)}</td>)}<td>—</td></tr>
            <tr><th scope="row">Landing (UTC)</th>{computed.map((c) => <td key={c.s.key} className="num mono">{formatUtc(c.s.start)}</td>)}<td>—</td></tr>
            {GROUPS.map((g) => {
              return (
                <Fragment key={g.title}>
                  <tr className="group-row"><th scope="rowgroup" colSpan={computed.length + 2}>{g.title}</th></tr>
                  {g.rows.map((row) => {
                    const best = bestOf(row)
                    return (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {computed.map((c) => {
                          const v = row.value(c)
                          const r = ref(c)
                          const rv = r && r !== c ? row.value(r) : null
                          return (
                            <td key={c.s.key} className={`num${best === c ? ' cell-best' : ''}${c.s.slippedFrom ? ' col-slip' : ''}`}>
                              {v === null ? '…' : row.format(v)}
                              {v !== null && rv !== null && row.delta && <span className="delta"> ({row.delta(v - rv)})</span>}
                            </td>
                          )
                        })}
                        <td>{best ? best.s.label : '—'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            <tr className="group-row"><th scope="rowgroup" colSpan={computed.length + 2}>Verdicts</th></tr>
            <tr>
              <th scope="row">Mission verdict</th>
              {computed.map((c) => <td key={c.s.key} className="num">{c.verdict ? <VerdictBadge verdict={c.verdict} /> : '…'}</td>)}
              <td>—</td>
            </tr>
            <tr>
              <th scope="row">Your limits</th>
              {computed.map((c) => <td key={c.s.key} className="num">{c.limits ? <span className={`badge ${c.limits.tone}`}>{LIMIT_TEXT[c.limits.tone]}</span> : '…'}</td>)}
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function VerdictBadge({ verdict }: { verdict: Verdict }): ReactNode {
  const map = { good: ['viable', 'Viable'], ok: ['marginal', 'Marginal'], warn: ['marginal', 'Marginal'], bad: ['not-viable', 'Not viable'] } as const
  const [cls, text] = map[verdict.tone]
  return <span className={`badge ${cls}`} title={verdict.headline}>{text}</span>
}

function exportTableCsv(computed: Computed[], missionType: MissionType, slip: number) {
  const rows: (string | number)[][] = [['metric', ...computed.map((c) => c.s.label)]]
  rows.push(['site', ...computed.map((c) => c.s.name)])
  rows.push(['lat', ...computed.map((c) => +c.s.lat.toFixed(5))])
  rows.push(['lon', ...computed.map((c) => +c.s.lon.toFixed(5))])
  rows.push(['landing_utc', ...computed.map((c) => c.s.start)])
  rows.push(['slip_days', ...computed.map((c) => (c.s.slippedFrom ? slip : 0))])
  rows.push(['mission_type', ...computed.map(() => missionType)])
  for (const g of GROUPS) {
    for (const r of g.rows) {
      rows.push([`${g.title}: ${r.label}`, ...computed.map((c) => {
        const v = r.value(c)
        return v === null ? '' : r.format === pctFmt ? +(v * 100).toFixed(1) : +v.toFixed(2)
      })])
    }
  }
  rows.push(['mission_verdict', ...computed.map((c) => c.verdict?.headline ?? '')])
  rows.push(['limits_verdict', ...computed.map((c) => (c.limits ? LIMIT_TEXT[c.limits.tone] : ''))])
  rows.push(['limits_missed', ...computed.map((c) => c.limits?.why.join('; ') ?? '')])
  downloadCsv(`lunar-lens-compare-table-${computed[0]?.s.start.slice(0, 10) ?? 'empty'}.csv`, rows)
}

// ── Slip chart ──────────────────────────────────────────────────────────────

type SlipMetric = 'sun' | 'earth' | 'ops' | 'dark'
const SLIP_METRICS: { key: SlipMetric; label: string; unit: 'pct' | 'h'; higherBetter: boolean }[] = [
  { key: 'sun', label: 'Sunlit %', unit: 'pct', higherBetter: true },
  { key: 'earth', label: 'Earth visible %', unit: 'pct', higherBetter: true },
  { key: 'ops', label: 'Ops hours (both up)', unit: 'h', higherBetter: true },
  { key: 'dark', label: 'Longest dark (h)', unit: 'h', higherBetter: false },
]

const W = 1000
const H = 280
const L = 52
const R = 90
const T = 14
const B = 30
const PW = W - L - R
const PH = H - T - B

function SlipChart({ base, limits, missionType, slip, onPickSlip }: { base: Scenario[]; limits: Limits; missionType: MissionType; slip: number; onPickSlip?: (d: number) => void }) {
  const windowDays = missionWindowDays(missionType) ?? 29.53
  const get = useSlipSeries(base, windowDays)
  const [metric, setMetric] = useState<SlipMetric>('sun')
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const id = useId()
  const m = SLIP_METRICS.find((x) => x.key === metric)!

  const series = base.map((s) => {
    const r = get(s)
    if (!r.data) return { s, error: r.error, points: null as null | { stats: WindowStats; tone: LimitTone }[] }
    const per = 60 / r.data.step_minutes // samples per hour
    const len = Math.round(windowDays * 24 * per)
    const points = Array.from({ length: MAX_SLIP_DAYS + 1 }, (_, d) => {
      const slice = r.data!.samples.slice(Math.round(d * 24 * per), Math.round(d * 24 * per) + len)
      const stats = sampleStats(slice, r.data!.step_minutes)
      return { stats, tone: limitsVerdict(stats, limits).tone }
    })
    return { s, error: r.error, points }
  })

  const val = (st: WindowStats) => (metric === 'sun' ? st.sunFraction * 100 : metric === 'earth' ? st.earthFraction * 100 : metric === 'ops' ? st.bothHours : st.longestDarkHours)
  const ready = series.filter((x) => x.points)
  const yMax = m.unit === 'pct' ? 100 : Math.max(24, ...ready.flatMap((x) => x.points!.map((p) => val(p.stats))), metric === 'dark' ? limits.maxDarkH : 0) * 1.08
  const x = (d: number) => L + (d / MAX_SLIP_DAYS) * PW
  const y = (v: number) => T + PH - (v / yMax) * PH
  const limitLine = metric === 'sun' ? limits.minSunPct : metric === 'earth' ? limits.minEarthPct : metric === 'dark' ? limits.maxDarkH : null
  const yTicks = m.unit === 'pct' ? [0, 25, 50, 75, 100] : Array.from({ length: 5 }, (_, k) => Math.round((yMax / 4) * k))

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(MAX_SLIP_DAYS, Math.round(((px - L) / PW) * MAX_SLIP_DAYS))))
  }

  // Site labels and the limit label share the right margin; spread them together so none overlap.
  const showLimit = limitLine !== null && limitLine <= yMax
  const placed = labelPositions([...ready.map((sr) => y(val(sr.points![MAX_SLIP_DAYS].stats))), ...(showLimit ? [y(limitLine!)] : [])])
  const lastYs = placed.slice(0, ready.length)
  const limitLabelY = showLimit ? placed[ready.length] : 0

  return (
    <section className="s-card" aria-label="What a later launch does">
      <div className="card-head">
        <h2>What a later launch does (0 to {MAX_SLIP_DAYS} days of slip)</h2>
        <div className="field inline-field">
          <label htmlFor={`${id}-metric`}>Show</label>
          <select id={`${id}-metric`} value={metric} onChange={(e) => setMetric(e.target.value as SlipMetric)}>
            {SLIP_METRICS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </div>
      </div>
      <p className="muted small">
        {m.label} over the mission window for every landing day from the planned date to {MAX_SLIP_DAYS} days late.
        {limitLine !== null && ' Dashed line: your limit.'} {onPickSlip ? 'Click a day to set the slip.' : ''}
      </p>

      <div className="landing-chart">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} by days of launch slip, one line per site. Details in the table below.`}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={L} x2={L + PW} y1={y(t)} y2={y(t)} className={t === 0 ? 'lc-base' : 'lc-grid'} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="lc-tick">{t}{m.unit === 'pct' ? '%' : ' h'}</text>
            </g>
          ))}
          {[0, 5, 10, 15, 20, 25, 30].map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor={d === 0 ? 'start' : d === MAX_SLIP_DAYS ? 'end' : 'middle'} className="lc-tick">{d} d</text>
          ))}
          {showLimit && (
            <g>
              <line x1={L} x2={L + PW} y1={y(limitLine!)} y2={y(limitLine!)} className="limit-line" />
              <text x={L + PW + 8} y={limitLabelY + 4} className="lc-tick">limit</text>
            </g>
          )}
          {slip > 0 && slip <= MAX_SLIP_DAYS && <line x1={x(slip)} x2={x(slip)} y1={T} y2={T + PH} className="lc-selected" />}
          {series.map((sr, i) => sr.points && (
            <g key={sr.s.key}>
              <path d={'M' + sr.points.map((p, d) => `${x(d).toFixed(1)},${y(val(p.stats)).toFixed(1)}`).join('L')} fill="none" stroke={SITE_COLORS[i]} strokeWidth={2} strokeLinejoin="round" />
              {sr.points.map((p, d) => (
                <Marker key={d} shape={SHAPES[i]} x={x(d)} y={y(val(p.stats))} r={hover === d ? 6 : 4} fill={SITE_COLORS[i]} stroke="#12141b" />
              ))}
            </g>
          ))}
          {ready.map((sr, k) => (
            <text key={sr.s.key} x={L + PW + 8} y={lastYs[k] + 4} className="lc-tick dl-label" fill={SITE_COLORS[series.indexOf(sr)]}>{sr.s.label}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + PH} className="lc-crosshair" />}
          <rect
            x={L}
            y={T}
            width={PW}
            height={PH}
            className="lc-hit"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onClick={() => hover !== null && onPickSlip?.(hover)}
          />
          {!ready.length && <text x={L + PW / 2} y={T + PH / 2} textAnchor="middle" className="lc-tick">Calculating…</text>}
        </svg>
        {hover !== null && ready.length > 0 && (
          <div className="lc-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <span>Slip {hover} day{hover === 1 ? '' : 's'}</span>
            {series.map((sr, i) => sr.points && (
              <span key={sr.s.key}>
                <strong>{m.unit === 'pct' ? `${Math.round(val(sr.points[hover].stats))}%` : formatHours(val(sr.points[hover].stats))}</strong> {sr.s.label} · {LIMIT_TEXT[sr.points[hover].tone]}
                <span className="sr-only"> (marker {SHAPES[i]})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <ul className="pano-legend">
        {series.map((sr, i) => (
          <li key={sr.s.key}><SiteKey index={i} /> {sr.s.label}: {sr.s.name}</li>
        ))}
        {limitLine !== null && <li><span className="key-limit" aria-hidden /> Your limit</li>}
      </ul>

      {ready.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">At the planned date</th>
                <th scope="col">Earliest slip that is Viable</th>
                <th scope="col">Best slip for {m.label.toLowerCase()}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((sr) => {
                if (!sr.points) return <tr key={sr.s.key}><th scope="row">{sr.s.label}</th><td colSpan={3}>{sr.error ?? 'Calculating…'}</td></tr>
                const first = sr.points.findIndex((p) => p.tone === 'viable')
                const bestD = sr.points.reduce((b, p, d) => ((m.higherBetter ? val(p.stats) > val(sr.points![b].stats) : val(p.stats) < val(sr.points![b].stats)) ? d : b), 0)
                const fmt = (v: number) => (m.unit === 'pct' ? `${Math.round(v)}%` : formatHours(v))
                return (
                  <tr key={sr.s.key}>
                    <th scope="row">{sr.s.label}</th>
                    <td><span className={`badge ${sr.points[0].tone}`}>{LIMIT_TEXT[sr.points[0].tone]}</span> {fmt(val(sr.points[0].stats))}</td>
                    <td>{first === 0 ? 'Already viable' : first > 0 ? `${first} day${first === 1 ? '' : 's'}` : `None within ${MAX_SLIP_DAYS} days`}</td>
                    <td>{bestD} day{bestD === 1 ? '' : 's'} ({fmt(val(sr.points[bestD].stats))})</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
