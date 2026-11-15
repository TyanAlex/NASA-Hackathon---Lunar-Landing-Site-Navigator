import { useMemo } from 'react'
import type { Sample } from '../../api/types'
import type { Body } from '../../lib/crossings'
import { visibleRuns } from '../../lib/lunar'

interface Props {
  samples: Sample[]
  timeIndex: number
  rangeStart: string
  rangeEnd: string
}

const ROWS: { body: Body; label: string }[] = [
  { body: 'sun', label: 'Sun' },
  { body: 'earth', label: 'Earth' },
]

/** When the Sun and Earth are above the local (terrain) horizon across the window; the line is the selected moment. */
export function VisibilityBars({ samples, timeIndex, rangeStart, rangeEnd }: Props) {
  const n = samples.length
  const runs = useMemo(() => ({ sun: visibleRuns(samples, 'sun'), earth: visibleRuns(samples, 'earth') }), [samples])

  // Same mapping as the scrubber: sample i sits at i / (n - 1) of the width.
  const pos = (i: number) => (n > 1 ? (Math.min(Math.max(i, 0), n - 1) / (n - 1)) * 100 : 0)
  const spanDays = (Date.parse(rangeEnd) - Date.parse(rangeStart)) / 86_400_000
  const ticks = [0, 7, 14, 21, 28].filter((d) => d <= spanDays)

  if (!n) return <div className="vis-bars vis-empty muted small">Sun and Earth visibility appear once a site is selected.</div>

  return (
    <div className="vis-bars">
      {ROWS.map(({ body, label }) => {
        const visible = runs[body].reduce((t, [a, b]) => t + b - a + 1, 0)
        return (
          <div key={body} className="vis-row">
            <span className={`vis-label tone-${body}`}>{label}</span>
            <div className="vis-track" role="img" aria-label={`${label} above the horizon ${Math.round((visible / n) * 100)}% of this window`}>
              {runs[body].map(([a, b]) => (
                <div key={a} className={`vis-seg seg-${body}`} style={{ left: `${pos(a - 0.5)}%`, width: `${pos(b + 0.5) - pos(a - 0.5)}%` }} />
              ))}
              <div className="vis-marker" style={{ left: `${pos(timeIndex)}%` }} />
            </div>
          </div>
        )
      })}
      <div className="vis-row">
        <span className="vis-label" aria-hidden />
        <div className="vis-ticks" aria-hidden>
          {ticks.map((d) => <span key={d} style={{ left: `${(d / spanDays) * 100}%` }}>Day {d}</span>)}
        </div>
      </div>
      <p className="muted small vis-caption">Bars show when each body is above the local horizon, terrain included. The black line is the selected moment.</p>
    </div>
  )
}
