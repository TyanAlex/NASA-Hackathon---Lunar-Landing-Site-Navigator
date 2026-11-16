import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { api } from '../../api/client'
import { useFetch } from '../../hooks/useFetch'
import { formatUtc, toIsoMinute } from '../../lib/format'
import { landingOptions, missionOptions } from '../../lib/landing'
import { lunarDayRange } from '../../lib/lunar'
import { missionSpanDays, missionWindowText } from '../../lib/mission'
import { useMission } from '../../state/MissionContext'

const SPAN_DAYS = 30 // landing dates shown
const LOOKAHEAD_DAYS = 60 // data fetched: span + the longest mission window (29.5 d) fits
const STEP_MIN = 60

const W = 1000
const H = 260
const L = 48
const R = 12
const T = 14
const B = 30
const PW = W - L - R
const PH = H - T - B

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const days = (h: number) => (h / 24).toFixed(1)

interface Option {
  time: string
  /** Hours of sunlight within the mission window after landing at `time`. */
  stay: number
  /** Hours the Sun stays up after landing (until the first sunset): the margin. */
  margin: number
  capped: boolean
  earthUp: boolean
}

/** Best landing: a full sunlit stay with Earth in view, preferring the most margin; else the most sunlight. */
function bestOption(opts: Option[], fullH: number): Option | null {
  const pick = (list: Option[], by: (o: Option) => number) => list.reduce<Option | null>((b, o) => (!b || by(o) > by(b) ? o : b), null)
  const full = opts.filter((o) => o.stay >= fullH - 1 && o.earthUp)
  return pick(full, (o) => o.margin) ?? pick(opts.filter((o) => o.earthUp && o.stay > 0), (o) => o.stay) ?? pick(opts, (o) => o.stay)
}

/**
 * "What if the landing moves?": for every possible landing hour over the next 30 days, how much of the
 * mission window is sunlit, with the hours when Earth is below the horizon at touchdown hatched.
 */
export function LandingDateChart() {
  const { location, range, setRange, setTimeIndex, setPlaying, missionType } = useMission()
  const [anchor, setAnchor] = useState(() => range.start.slice(0, 10) + 'T00:00:00Z')
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const hatchId = useId()
  const missionDays = missionSpanDays(missionType)
  const fullH = missionDays * 24
  const windowText = missionWindowText(missionType)

  const end = toIsoMinute(new Date(Date.parse(anchor) + LOOKAHEAD_DAYS * 86_400_000))
  const key = location ? `landing|${location.lat},${location.lon}|${anchor}` : null
  const { data, loading, error } = useFetch(key, (signal) =>
    api.ephemeris({ lat: location!.lat, lon: location!.lon, start: anchor, end, step_minutes: STEP_MIN }, signal),
  )

  const opts = useMemo<Option[]>(() => {
    if (!data) return []
    const count = (SPAN_DAYS * 24 * 60) / STEP_MIN
    const stay = missionOptions(data.samples, STEP_MIN, count, missionDays)
    const margin = landingOptions(data.samples, STEP_MIN, count)
    return stay.map((o, i) => ({ time: o.time, stay: o.sunHours, margin: margin[i].sunHours, capped: margin[i].capped, earthUp: o.earthUp }))
  }, [data, missionDays])
  const best = useMemo(() => bestOption(opts, fullH), [opts, fullH])
  const n = opts.length
  const yMaxDays = missionDays <= 3 ? Math.ceil(missionDays) : Math.ceil(missionDays / 2) * 2
  const yStep = missionDays <= 3 ? 1 : missionDays <= 14 ? 2 : 5

  const x = (i: number) => L + (n > 1 ? i / (n - 1) : 0) * PW
  const y = (h: number) => T + PH - (h / 24 / yMaxDays) * PH

  const area = useMemo(() => {
    if (!n) return { fill: '', line: '' }
    const pts = opts.map((o, i) => `${x(i).toFixed(1)},${y(o.stay).toFixed(1)}`)
    return { line: `M${pts.join('L')}`, fill: `M${x(0)},${y(0)}L${pts.join('L')}L${x(n - 1)},${y(0)}Z` }
    // x/y depend only on n and yMaxDays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, yMaxDays])

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

  const selected = Math.round((Date.parse(range.start) - Date.parse(anchor)) / (STEP_MIN * 60_000))

  const land = (o: Option) => {
    setPlaying(false)
    setRange(lunarDayRange(toIsoMinute(new Date(o.time))))
    setTimeIndex(0)
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / PW) * (n - 1)))))
  }

  const shift = (d: number) => setAnchor(toIsoMinute(new Date(Date.parse(anchor) + d * 86_400_000)))
  const yTicks = Array.from({ length: Math.floor(yMaxDays / yStep) + 1 }, (_, k) => k * yStep)
  const xTicks = Array.from({ length: SPAN_DAYS / 5 + 1 }, (_, k) => k * 5)
  const h = hover !== null ? opts[hover] : null
  const marginText = (o: Option) => (o.margin ? `Sun stays up ${o.capped ? 'over ' : ''}${days(o.margin)} days after landing` : 'Dark at landing')

  // One row per day: the best landing hour that day.
  const daily = useMemo(() => {
    const out: Option[] = []
    for (let d = 0; d < n; d += 24) {
      const day = opts.slice(d, d + 24)
      out.push(bestOption(day, fullH) ?? day[0])
    }
    return out
  }, [opts, n, fullH])

  return (
    <section className="s-card" aria-label="Landing date">
      <div className="card-head">
        <h2>What if the landing moves?</h2>
        <div className="anchor-nav">
          <button type="button" className="icon-only" aria-label="Earlier 30 days" onClick={() => shift(-SPAN_DAYS)}><ChevronLeft size={18} aria-hidden /></button>
          <span>{dayFmt.format(new Date(anchor))} – {dayFmt.format(new Date(Date.parse(anchor) + SPAN_DAYS * 86_400_000))}</span>
          <button type="button" className="icon-only" aria-label="Later 30 days" onClick={() => shift(SPAN_DAYS)}><ChevronRight size={18} aria-hidden /></button>
        </div>
      </div>
      <p className="muted small">
        Days of sunlight during {windowText}, for every possible landing hour. Landing just before sunset cuts the stay short; just after sunrise gives the whole stay in daylight. Click the chart to pick that landing time.
      </p>

      {best && (
        <div className="best-row">
          <span>
            <strong>Best in this period:</strong> {formatUtc(best.time)}, {days(best.stay)} of {missionDays} days sunlit
            {best.earthUp ? ', Earth in view' : ', but Earth is below the horizon'} ({marginText(best).toLowerCase()})
          </span>
          <button type="button" className="btn btn-outline" onClick={() => land(best)}>Land then</button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="landing-chart">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={best ? `Chart of sunlight during ${windowText} by landing time over 30 days. Best: ${formatUtc(best.time)}.` : 'Chart of sunlight during the mission by landing time.'}
        >
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
              <line x1={L} x2={W - R} y1={y(d * 24)} y2={y(d * 24)} className={d === 0 ? 'lc-base' : 'lc-grid'} />
              <text x={L - 8} y={y(d * 24) + 4} textAnchor="end" className="lc-tick">{d} d</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(fullH)} y2={y(fullH)} className="lc-full" />
          {xTicks.map((d) => (
            <text key={d} x={L + (d / SPAN_DAYS) * PW} y={H - 8} textAnchor={d === 0 ? 'start' : d === SPAN_DAYS ? 'end' : 'middle'} className="lc-tick">
              {dayFmt.format(new Date(Date.parse(anchor) + d * 86_400_000))}
            </text>
          ))}
          <path d={area.fill} className="lc-area" />
          <path d={area.line} className="lc-line" />
          {selected >= 0 && selected < n && (
            <g>
              <line x1={x(selected)} x2={x(selected)} y1={T} y2={T + PH} className="lc-selected" />
              <text x={x(selected) + 6} y={T + PH - 8} className="lc-tick lc-selected-label">Your landing</text>
            </g>
          )}
          {h && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + PH} className="lc-crosshair" />
              <circle cx={x(hover)} cy={y(h.stay)} r={5} className="lc-dot" />
            </g>
          )}
          {n > 0 && (
            <rect
              x={L}
              y={T}
              width={PW}
              height={PH}
              className="lc-hit"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              onClick={() => hover !== null && land(opts[hover])}
            />
          )}
          {loading && <text x={L + PW / 2} y={T + PH / 2} textAnchor="middle" className="lc-tick">Calculating…</text>}
        </svg>
        {h && hover !== null && (
          <div className="lc-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <strong>{days(h.stay)} of {missionDays} days sunlit</strong>
            <span>Land {formatUtc(h.time)}</span>
            <span>{marginText(h)}</span>
            <span>{h.earthUp ? 'Earth in view at landing' : 'Earth below the horizon'}</span>
          </div>
        )}
      </div>

      <ul className="pano-legend">
        <li><span className="key-line" aria-hidden /> Days of sunlight during {windowText}</li>
        <li><span className="key-full" aria-hidden /> Full {missionDays}-day stay in sunlight</li>
        <li><span className="key-hatch" aria-hidden /> Earth below the horizon at landing (no radio contact on arrival)</li>
      </ul>

      {daily.length > 0 && (
        <details className="table-view">
          <summary>Show as a table</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Best landing time (UTC)</th>
                <th scope="col">Sunlit during the stay</th>
                <th scope="col">Sun stays up for</th>
                <th scope="col">Earth at landing</th>
                <th scope="col"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {daily.map((o) => (
                <tr key={o.time}>
                  <td>{dayFmt.format(new Date(o.time))}</td>
                  <td>{o.time.slice(11, 16)}</td>
                  <td>{days(o.stay)} of {missionDays} d</td>
                  <td>{o.margin ? `${o.capped ? 'over ' : ''}${days(o.margin)} d` : 'dark at landing'}</td>
                  <td>{o.earthUp ? 'In view' : 'Below horizon'}</td>
                  <td><button type="button" className="link-like" onClick={() => land(o)}>Land then</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  )
}
