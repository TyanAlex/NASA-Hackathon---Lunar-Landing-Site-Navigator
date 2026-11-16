import type { BodyPosition, EphemerisResponse, Sample } from '../api/types'
import type { Body } from './crossings'

const RAD = 180 / Math.PI
const BODY_RADIUS_KM: Record<Body, number> = { sun: 696_000, earth: 6_371 }

/** Apparent angular radius of the body's disc from the site, in degrees (Sun ≈ 0.27°, Earth ≈ 0.95°). */
export function angularRadiusDeg(body: Body, pos: BodyPosition): number {
  return Math.asin(Math.min(1, BODY_RADIUS_KM[body] / pos.range_km)) * RAD
}

/**
 * Share of the body's disc above the terrain horizon, 0–1. The horizon is treated as a straight line
 * across the disc (fine at these sizes). Center on the horizon → 0.5, which is where "up" switches.
 */
export function discFraction(body: Body, pos: BodyPosition): number {
  const r = angularRadiusDeg(body, pos)
  const h = pos.el - pos.horizon_el // center height above the horizon line
  if (h >= r) return 1
  if (h <= -r) return 0
  const d = -h / r // horizon line position, in disc radii from the center
  return (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI
}

/** Angle at the Moon between the Sun and Earth directions, in degrees. ~0° near full Moon (Earth looks "new" from the Moon), ~180° near new Moon (full Earth). */
export function phaseAngleDeg(s: Sample): number {
  const [a, b] = [s.sun.dir, s.earth.dir]
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.max(-1, Math.min(1, dot))) * RAD
}

export const bothUp = (s: Sample) => s.sun.visible && s.earth.visible
export const fullSun = (s: Sample) => discFraction('sun', s.sun) >= 0.999

/** Longest run of consecutive samples where `pred` holds, in samples. */
function longestRun(samples: Sample[], pred: (s: Sample) => boolean): number {
  let best = 0
  let cur = 0
  for (const s of samples) {
    cur = pred(s) ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

export interface WindowStats {
  totalHours: number
  stepHours: number
  sunFraction: number
  sunHours: number
  earthFraction: number
  earthHours: number
  bothHours: number
  fullSunHours: number
  longestDarkHours: number
  longestGapHours: number
  sunMinEl: number
  sunMaxEl: number
}

/**
 * Totals over the whole window. Percentages come from the backend summary so they match the Simple view
 * exactly; durations are sample counts × step, so they're accurate to about one step.
 */
export function windowStats(data: EphemerisResponse): WindowStats {
  const { samples, summary, step_minutes } = data
  const stepHours = step_minutes / 60
  const totalHours = (Date.parse(data.end) - Date.parse(data.start)) / 3_600_000
  const count = (pred: (s: Sample) => boolean) => samples.filter(pred).length * stepHours
  const els = samples.map((s) => s.sun.el)
  return {
    totalHours,
    stepHours,
    sunFraction: summary.sun_visible_fraction,
    sunHours: summary.sun_visible_fraction * totalHours,
    earthFraction: summary.earth_visible_fraction,
    earthHours: summary.earth_visible_fraction * totalHours,
    bothHours: count(bothUp),
    fullSunHours: count(fullSun),
    longestDarkHours: longestRun(samples, (s) => !s.sun.visible) * stepHours,
    longestGapHours: longestRun(samples, (s) => !s.earth.visible) * stepHours,
    sunMinEl: Math.min(...els),
    sunMaxEl: Math.max(...els),
  }
}

/** First sample after `from` where `pred` becomes true (it was false on the sample before). -1 if none. */
export function nextStart(samples: Sample[], from: number, pred: (s: Sample) => boolean): number {
  for (let i = Math.max(from + 1, 1); i < samples.length; i++) {
    if (pred(samples[i]) && !pred(samples[i - 1])) return i
  }
  return -1
}

/** "123 h" under a week, "12.3 d" above; durations here are only accurate to a sample step anyway. */
export function formatHours(h: number): string {
  return h >= 168 ? `${(h / 24).toFixed(1)} d` : `${Math.round(h)} h`
}

/**
 * Same totals as windowStats, but computed from the samples themselves, so it works on any slice
 * (e.g. the first 3 days after landing). Fractions are of the slice's duration.
 */
export function sampleStats(samples: Sample[], stepMinutes: number): WindowStats {
  const stepHours = stepMinutes / 60
  const n = samples.length
  const totalHours = n * stepHours
  const count = (pred: (s: Sample) => boolean) => samples.filter(pred).length * stepHours
  const sunHours = count((s) => s.sun.visible)
  const earthHours = count((s) => s.earth.visible)
  const els = samples.map((s) => s.sun.el)
  return {
    totalHours,
    stepHours,
    sunFraction: n ? sunHours / totalHours : 0,
    sunHours,
    earthFraction: n ? earthHours / totalHours : 0,
    earthHours,
    bothHours: count(bothUp),
    fullSunHours: count(fullSun),
    longestDarkHours: longestRun(samples, (s) => !s.sun.visible) * stepHours,
    longestGapHours: longestRun(samples, (s) => !s.earth.visible) * stepHours,
    sunMinEl: n ? Math.min(...els) : 0,
    sunMaxEl: n ? Math.max(...els) : 0,
  }
}
