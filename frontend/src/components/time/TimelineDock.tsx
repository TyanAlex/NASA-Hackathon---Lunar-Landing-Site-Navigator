import { ChartLine, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Sample } from '../../api/types'
import { visibleRuns } from '../../lib/lunar'
import { missionSampleCount } from '../../lib/mission'
import { bothUp, nextStart } from '../../lib/stats'
import { useMission } from '../../state/MissionContext'
import { ElevationChart } from '../charts/ElevationChart'
import { StepSelect } from './DateRangePicker'
import { Timeline } from './Timeline'

const ROWS: { key: string; label: string; cls: string; pred: (s: Sample) => boolean }[] = [
  { key: 'sun', label: 'Sun', cls: 'seg-sun', pred: (s) => s.sun.visible },
  { key: 'earth', label: 'Earth', cls: 'seg-earth', pred: (s) => s.earth.visible },
  { key: 'both', label: 'Both', cls: 'seg-both', pred: bothUp },
]

const JUMPS: { label: string; pred: (s: Sample) => boolean }[] = [
  { label: 'Sunrise', pred: (s) => s.sun.visible },
  { label: 'Sunset', pred: (s) => !s.sun.visible },
  { label: 'Earthrise', pred: (s) => s.earth.visible },
  { label: 'Earthset', pred: (s) => !s.earth.visible },
  { label: 'Ops window', pred: bothUp },
]

export function TimelineDock() {
  const [chartOpen, setChartOpen] = useState(true)
  const { ephemeris, timeIndex, setTimeIndex, setPlaying, missionType } = useMission()
  const samples = useMemo(() => ephemeris.data?.samples ?? [], [ephemeris.data])
  const n = samples.length
  const missionEnd = ephemeris.data ? missionSampleCount(ephemeris.data, missionType) : 0
  const runs = useMemo(() => ROWS.map((r) => visibleRuns(samples, r.pred)), [samples])
  const pos = (i: number) => (n > 1 ? (Math.min(Math.max(i, 0), n - 1) / (n - 1)) * 100 : 0)

  const jump = (pred: (s: Sample) => boolean) => {
    const i = nextStart(samples, timeIndex, pred)
    if (i >= 0) {
      setPlaying(false)
      setTimeIndex(i)
    }
  }

  return (
    <section className="dock card" aria-label="Timeline">
      <div className="dock-bar">
        <Timeline />
        <button type="button" className="icon-btn" aria-expanded={chartOpen} onClick={() => setChartOpen(!chartOpen)} title="Elevation chart" aria-label="Elevation chart">
          {chartOpen ? <ChevronDown size={18} /> : <ChartLine size={18} />}
        </button>
      </div>

      {n > 0 && (
        <div className="dock-bars">
          {ROWS.map((r, k) => {
            const share = runs[k].reduce((t, [a, b]) => t + b - a + 1, 0) / n
            return (
              <div key={r.key} className="dock-bar-row">
                <span className={`dock-bar-label ${r.cls}-text`}>{r.label}</span>
                <div className="dock-track" role="img" aria-label={`${r.label} up ${Math.round(share * 100)}% of the window`}>
                  {runs[k].map(([a, b]) => (
                    <div key={a} className={`vis-seg ${r.cls}`} style={{ left: `${pos(a - 0.5)}%`, width: `${pos(b + 0.5) - pos(a - 0.5)}%` }} />
                  ))}
                  {missionEnd > 0 && missionEnd < n && <div className="vis-mission" title="Mission window" style={{ left: `${pos(-0.5)}%`, width: `${pos(missionEnd - 0.5) - pos(-0.5)}%` }} />}
                  <div className="dock-marker" style={{ left: `${pos(timeIndex)}%` }} />
                </div>
                <span className="dock-bar-pct mono">{Math.round(share * 100)}%</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="dock-tools">
        <span className="dock-tools-label">Jump to next</span>
        {JUMPS.map((j) => {
          const target = n ? nextStart(samples, timeIndex, j.pred) : -1
          return (
            <button key={j.label} type="button" className="pill-btn" disabled={target < 0} onClick={() => jump(j.pred)}>
              {j.label}
            </button>
          )
        })}
        <StepSelect className="dock-step" />
      </div>

      {chartOpen && (
        <div className="dock-chart">
          <ElevationChart />
        </div>
      )}
    </section>
  )
}
