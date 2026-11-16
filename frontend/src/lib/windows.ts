import type { Sample } from '../api/types'
import { visibleRuns } from './lunar'
import { bothUp, discFraction } from './stats'

export type WindowType = 'sun' | 'earth' | 'both'

export interface VisWindow {
  type: WindowType
  start: string
  end: string
  hours: number
  /** Highest elevation reached during the window (Sun or Earth); null for "both up". */
  peakEl: number | null
  /** The window was already open at the start of the data / still open at the end. */
  openStart: boolean
  openEnd: boolean
}

const PRED: Record<WindowType, (s: Sample) => boolean> = {
  sun: (s) => s.sun.visible,
  earth: (s) => s.earth.visible,
  both: bothUp,
}

/** Every window when the Sun / Earth / both are up, in time order. Times are to the sample step. */
export function windowList(samples: Sample[], stepMinutes: number): VisWindow[] {
  const n = samples.length
  const stepMs = stepMinutes * 60_000
  const out: VisWindow[] = []
  for (const type of ['sun', 'earth', 'both'] as WindowType[]) {
    for (const [a, b] of visibleRuns(samples, PRED[type])) {
      const run = samples.slice(a, b + 1)
      out.push({
        type,
        start: samples[a].time,
        end: new Date(Date.parse(samples[b].time) + (b < n - 1 ? stepMs : 0)).toISOString(),
        hours: ((b - a + 1) * stepMinutes) / 60,
        peakEl: type === 'both' ? null : Math.max(...run.map((s) => s[type].el)),
        openStart: a === 0,
        openEnd: b === n - 1,
      })
    }
  }
  return out.sort((x, y) => Date.parse(x.start) - Date.parse(y.start))
}

export interface WindowCounts {
  sunsets: number
  shortestDarkHours: number | null
  earthWindows: number
  longestEarthWindowHours: number
  opsWindows: number
  longestOpsWindowHours: number
}

export function windowCounts(samples: Sample[], stepMinutes: number): WindowCounts {
  const step = stepMinutes / 60
  const n = samples.length
  const sunRuns = visibleRuns(samples, PRED.sun)
  const darkRuns = visibleRuns(samples, (s) => !s.sun.visible)
  // Dark periods cut off by the window edges aren't real lengths, so prefer complete ones for "shortest".
  const closedDark = darkRuns.filter(([a, b]) => a > 0 && b < n - 1)
  const darkLens = (closedDark.length ? closedDark : darkRuns).map(([a, b]) => (b - a + 1) * step)
  const earthRuns = visibleRuns(samples, PRED.earth)
  const opsRuns = visibleRuns(samples, PRED.both)
  const longest = (runs: [number, number][]) => Math.max(0, ...runs.map(([a, b]) => (b - a + 1) * step))
  return {
    sunsets: sunRuns.filter(([, b]) => b < n - 1).length,
    shortestDarkHours: darkLens.length ? Math.min(...darkLens) : null,
    earthWindows: earthRuns.length,
    longestEarthWindowHours: longest(earthRuns),
    opsWindows: opsRuns.length,
    longestOpsWindowHours: longest(opsRuns),
  }
}

/** Per-sample rows for CSV export of the time series. */
export function timeSeriesRows(samples: Sample[]): (string | number)[][] {
  const r = (v: number, d = 3) => +v.toFixed(d)
  return [
    ['time_utc', 'sun_az_deg', 'sun_el_deg', 'sun_horizon_el_deg', 'sun_up', 'sun_disc_visible', 'earth_az_deg', 'earth_el_deg', 'earth_horizon_el_deg', 'earth_up', 'earth_disc_visible', 'both_up'],
    ...samples.map((s) => [
      s.time,
      r(s.sun.az), r(s.sun.el), r(s.sun.horizon_el), s.sun.visible ? 1 : 0, r(discFraction('sun', s.sun)),
      r(s.earth.az), r(s.earth.el), r(s.earth.horizon_el), s.earth.visible ? 1 : 0, r(discFraction('earth', s.earth)),
      bothUp(s) ? 1 : 0,
    ]),
  ]
}
