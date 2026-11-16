import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { api } from '../../api/client'
import { useFetch } from '../../hooks/useFetch'
import { downloadCsv, slug } from '../../lib/csv'
import { formatUtc, toIsoMinute } from '../../lib/format'
import { bestMissionWindows, missionOptions, type MissionOption } from '../../lib/landing'
import { lunarDayRange } from '../../lib/lunar'
import { MISSION_TYPES } from '../../lib/verdict'
import { useMission } from '../../state/MissionContext'

const SPANS = [30, 60, 90]
const MAX_SAMPLES = 2000

const W = 1000
const H = 300
const L = 48
const R = 70 // room for direct line labels
const T = 14
const B = 30
const PW = W - L - R
const PH = H - T - B

const SERIES = [
  { key: 'sunHours', label: 'Sunlight', cls: 'dl-sun' },
  { key: 'earthHours', label: 'Earth contact', cls: 'dl-earth' },
  { key: 'opsHours', label: 'Both up (ops)', cls: 'dl-ops' },
] as const

/** Nudge end-of-line labels apart so they never overlap (min 14 px), keeping their order. */
function labelPositions(ys: number[]): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + 14)
  const out = new Array<number>(ys.length)
  order.forEach((o) => (out[o.i] = o.y))
  return out
}

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const days = (h: number) => (h / 24).toFixed(1)

/**
 * Detailed "what if the landing moves?": for every landing time in the span, how many of the first
 * `mission` days have the Sun up, Earth up, and both up. One request covers span + mission length.
 */
export function DetailedLandingChart() {
  const { location, range, setRange, setTimeIndex, setPlaying, missionType } = useMission()
  const typeDays = MISSION_TYPES.find((t) => t.key === missionType)!.days
  const [anchor, setAnchor] = useState(() => range.start.slice(0, 10) + 'T00:00:00Z')
  const [span, setSpan] = useState(30)
  const [mission, setMission] = useState(typeDays)
  const [missionInput, setMissionInput] = useState(String(typeDays))
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const hatchId = useId()
  const id = useId()

  const totalDays = span + mission
  const step = (totalDays * 24 * 60) / 60 <= MAX_SAMPLES ? 60 : 120
  const end = toIsoMinute(new Date(Date.parse(anchor) + totalDays * 86_400_000))
  const key = location ? `mission|${location.lat},${location.lon}|${anchor}|${totalDays}|${step}` : null
  const { data, loading, error } = useFetch(key, (signal) =>
    api.ephemeris({ lat: location!.lat, lon: location!.lon, start: anchor, end, step_minutes: step }, signal),
  )

  const opts = useMemo(() => (data ? missionOptions(data.samples, step, (span * 24 * 60) / step, mission) : []), [data, step, span, mission])
  const top = useMemo(() => bestMissionWindows(opts, 5, 48), [opts])
  const n = opts.length
  const yMax = Math.max(1, Math.ceil(mission / 2) * 2) // days

  const x = (i: number) => L + (n > 1 ? i / (n - 1) : 0) * PW
  const y = (h: number) => T + PH - (h / 24 / yMax) * PH

  const lines = useMemo(
    () => Object.fromEntries(SERIES.map((s) => [s.key, n ? 'M' + opts.map((o, i) => `${x(i).toFixed(1)},${y(o[s.key]).toFixed(1)}`).join('L') : ''])),
    // x/y depend only on n and yMax
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts, yMax],
  )

  const earthDown = useMemo(() => {
    const runs: [number, number][] = []
    let s = -1
    opts.forEach((o, i) => {
      if (!o.earthUp && s < 0) s = i
      if (o.earthUp && s >= 0) {
        runs.push([s, i - 1])
        s = -1
      }
    })
    if (s >= 0) runs.push([s, n - 1])
    return runs
  }, [opts, n])

  const selected = Math.round((Date.parse(range.start) - Date.parse(anchor)) / (step * 60_000))

  const land = (o: MissionOption) => {
    setPlaying(false)
    setRange(lunarDayRange(toIsoMinute(new Date(o.time))))
    setTimeIndex(0)
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / PW) * (n - 1)))))
  }

  const commitMission = (v: string) => {
    const d = Math.round(Number(v))
    if (Number.isFinite(d) && d >= 1 && d <= 30) setMission(d)
    else setMissionInput(String(mission))
  }

  const exportCsv = () => {
    if (!location) return
    downloadCsv(`${slug(location.name)}-landing-options-${mission}d-mission.csv`, [
      ['landing_time_utc', `sun_hours_first_${mission}d`, `earth_hours_first_${mission}d`, `both_up_hours_first_${mission}d`, 'sun_up_at_landing', 'earth_up_at_landing'],
      ...opts.map((o) => [o.time, o.sunHours, o.earthHours, o.opsHours, o.sunUp ? 1 : 0, o.earthUp ? 1 : 0]),
    ])
  }

  const yTicks = Array.from({ length: yMax / 2 + 1 }, (_, k) => k * 2)
  const xStep = span <= 30 ? 5 : 10
  const xTicks = Array.from({ length: span / xStep + 1 }, (_, k) => k * xStep)
  const h = hover !== null ? opts[hover] : null
  const last = n ? opts[n - 1] : null

  return (
    <section className="s-card" aria-label="Landing date options">
      <div className="card-head">
        <h2>What if the landing moves?</h2>
        <div className="anchor-nav">
          <button type="button" className="icon-only" aria-label={`Earlier ${span} days`} onClick={() => setAnchor(toIsoMinute(new Date(Date.parse(anchor) - span * 86_400_000)))}><ChevronLeft size={18} aria-hidden /></button>
          <span>{dayFmt.format(new Date(anchor))} – {dayFmt.format(new Date(Date.parse(anchor) + span * 86_400_000))}</span>
          <button type="button" className="icon-only" aria-label={`Later ${span} days`} onClick={() => setAnchor(toIsoMinute(new Date(Date.parse(anchor) + span * 86_400_000)))}><ChevronRight size={18} aria-hidden /></button>
        </div>
        <div className="field inline-field">
          <label htmlFor={`${id}-span`}>Span</label>
          <select id={`${id}-span`} value={span} onChange={(e) => setSpan(Number(e.target.value))}>
            {SPANS.map((s) => <option key={s} value={s}>{s} days</option>)}
          </select>
        </div>
        <div className="field inline-field">
          <label htmlFor={`${id}-mission`}>Mission length (days)</label>
          <input
            id={`${id}-mission`}
            type="number"
            min={1}
            max={30}
            className="num-input"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
            onBlur={(e) => commitMission(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitMission((e.target as HTMLInputElement).value)}
          />
        </div>
        <button type="button" className="btn btn-outline" disabled={!n} onClick={exportCsv}><Download size={16} aria-hidden /> CSV</button>
      </div>
      <p className="muted small">
        For each landing hour, how many of the first {mission} days on the surface have sunlight, Earth contact, and both. Hatched: Earth below the horizon at touchdown. Data step {step} min. Click the chart to pick that landing time.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="landing-chart">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Days of sunlight, Earth contact and both within a ${mission}-day mission, by landing time over ${span} days.`}>
          <defs>
            <pattern id={hatchId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" className="lc-hatch-bg" />
              <line x1="0" y1="0" x2="0" y2="8" className="lc-hatch-line" />
            </pattern>
          </defs>
          {earthDown.map(([a, b]) => (
            <rect key={a} x={x(a)} y={T} width={Math.max(x(b) - x(a), 1)} height={PH} fill={`url(#${hatchId})`} />
          ))}
          {yTicks.map((d) => (
            <g key={d}>
              <line x1={L} x2={L + PW} y1={y(d * 24)} y2={y(d * 24)} className={d === 0 ? 'lc-base' : 'lc-grid'} />
              <text x={L - 8} y={y(d * 24) + 4} textAnchor="end" className="lc-tick">{d} d</text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text key={d} x={L + (d / span) * PW} y={H - 8} textAnchor={d === 0 ? 'start' : d === span ? 'end' : 'middle'} className="lc-tick">
              {dayFmt.format(new Date(Date.parse(anchor) + d * 86_400_000))}
            </text>
          ))}
          {SERIES.map((s) => <path key={s.key} d={lines[s.key]} className={`dl-line ${s.cls}`} />)}
          {last && labelPositions(SERIES.map((s) => y(last[s.key]))).map((ly, k) => (
            <text key={SERIES[k].key} x={L + PW + 6} y={ly + 4} className={`lc-tick dl-label ${SERIES[k].cls}-text`}>{SERIES[k].label.split(' ')[0]}</text>
          ))}
          {selected >= 0 && selected < n && (
            <g>
              <line x1={x(selected)} x2={x(selected)} y1={T} y2={T + PH} className="lc-selected" />
              <text x={x(selected) + 6} y={T + 12} className="lc-tick lc-selected-label">Your landing</text>
            </g>
          )}
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + PH} className="lc-crosshair" />
              {SERIES.map((s) => <circle key={s.key} cx={x(hover)} cy={y(h[s.key])} r={4.5} className={`dl-dot ${s.cls}`} />)}
            </g>
          )}
          {n > 0 && (
            <rect x={L} y={T} width={PW} height={PH} className="lc-hit" onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => hover !== null && land(opts[hover])} />
          )}
          {loading && <text x={L + PW / 2} y={T + PH / 2} textAnchor="middle" className="lc-tick">Calculating…</text>}
        </svg>
        {h && hover !== null && (
          <div className="lc-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <span>Land {formatUtc(h.time)}</span>
            {SERIES.map((s) => <span key={s.key}><strong>{days(h[s.key])} d</strong> {s.label.toLowerCase()}</span>)}
            <span>{h.earthUp ? 'Earth in view at landing' : 'Earth below the horizon at landing'}</span>
          </div>
        )}
      </div>

      <ul className="pano-legend">
        {SERIES.map((s) => <li key={s.key}><span className={`key-line ${s.cls}-key`} aria-hidden /> {s.label} (days of first {mission})</li>)}
        <li><span className="key-hatch" aria-hidden /> Earth below the horizon at landing</li>
      </ul>

      {top.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <caption>Best landing windows in this span (by ops time, at least 2 days apart)</caption>
            <thead>
              <tr>
                <th scope="col">Landing time (UTC)</th>
                <th scope="col" className="num">Sunlight</th>
                <th scope="col" className="num">Earth contact</th>
                <th scope="col" className="num">Both up</th>
                <th scope="col">Earth at landing</th>
                <th scope="col"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {top.map((o) => (
                <tr key={o.time}>
                  <td className="mono">{formatUtc(o.time)}</td>
                  <td className="num">{days(o.sunHours)} d</td>
                  <td className="num">{days(o.earthHours)} d</td>
                  <td className="num">{days(o.opsHours)} d</td>
                  <td>{o.earthUp ? 'In view' : 'Below horizon'}</td>
                  <td><button type="button" className="link-like" onClick={() => land(o)}>Land then</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
