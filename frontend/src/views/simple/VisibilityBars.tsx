import { useMemo, type ReactNode } from 'react'
import type { Sample } from '../../api/types'
import { SUN_EARTH_ROWS, type BarRow } from '../../lib/barRows'
import { visibleRuns } from '../../lib/lunar'

interface Props {
  samples: Sample[]
  timeIndex: number
  /** Window start; tick labels count days from here. */
  rangeStart: string
  rows?: BarRow[]
  /** Sample index range to show, inclusive; defaults to the whole window. */
  view?: [number, number]
  caption?: ReactNode
  /** Sample count of the mission window (from index 0); outlined on every bar. */
  missionEnd?: number
}

/** When each body is above the local (terrain) horizon across the window; the line is the selected moment. */
export function VisibilityBars({ samples, timeIndex, rangeStart, rows = SUN_EARTH_ROWS, view, caption, missionEnd }: Props) {
  const n = samples.length
  const runs = useMemo(() => rows.map((r) => visibleRuns(samples, r.pred)), [samples, rows])
  if (!n) return <div className="vis-bars vis-empty muted small">Sun and Earth visibility appear once a site is selected.</div>

  const [i0, i1] = view ?? [0, n - 1]
  const span = Math.max(i1 - i0, 1)
  // Same mapping as the scrubber: sample i sits at (i - i0) / span of the width.
  const pos = (i: number) => Math.min(Math.max(((i - i0) / span) * 100, 0), 100)

  const day = (i: number) => (Date.parse(samples[i].time) - Date.parse(rangeStart)) / 86_400_000
  const d0 = day(i0)
  const d1 = day(i1)
  const step = d1 - d0 <= 4 ? 0.5 : d1 - d0 <= 10 ? 1 : 7
  const ticks: number[] = []
  for (let d = Math.ceil(d0 / step) * step; d <= d1 + 1e-9; d += step) ticks.push(d)

  return (
    <div className="vis-bars">
      {rows.map((r, k) => {
        const segs = runs[k].filter(([a, b]) => b >= i0 && a <= i1)
        const total = runs[k].reduce((t, [a, b]) => t + b - a + 1, 0)
        return (
          <div key={r.key} className="vis-row">
            <span className={`vis-label ${r.cls}-text`}>{r.label}</span>
            <div className="vis-track" role="img" aria-label={`${r.label} ${Math.round((total / n) * 100)}% of this lunar day`}>
              {segs.map(([a, b]) => (
                <div key={a} className={`vis-seg ${r.cls}`} style={{ left: `${pos(a - 0.5)}%`, width: `${pos(b + 0.5) - pos(a - 0.5)}%` }} />
              ))}
              {missionEnd !== undefined && missionEnd > i0 && (
                <div className="vis-mission" style={{ left: `${pos(-0.5)}%`, width: `${pos(missionEnd - 0.5) - pos(-0.5)}%` }} />
              )}
              {timeIndex >= i0 && timeIndex <= i1 && <div className="vis-marker" style={{ left: `${pos(timeIndex)}%` }} />}
            </div>
          </div>
        )
      })}
      <div className="vis-row">
        <span className="vis-label" aria-hidden />
        <div className="vis-ticks" aria-hidden>
          {ticks.map((d) => <span key={d} style={{ left: `${((d - d0) / Math.max(d1 - d0, 1e-9)) * 100}%` }}>Day {+d.toFixed(1)}</span>)}
        </div>
      </div>
      <p className="muted small vis-caption">
        {caption ?? 'Bars show when each body is above the local horizon, terrain included. The black line is the selected moment.'}
        {missionEnd !== undefined && ' The outlined part is the mission window.'}
      </p>
    </div>
  )
}
