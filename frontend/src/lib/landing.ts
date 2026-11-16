import type { Sample } from '../api/types'
import { destinationPoint } from './coords'

// ── Landing date options ────────────────────────────────────────────────────

export interface LandingOption {
  time: string
  /** Hours of sunlight left after touching down at `time` (0 if landing in the dark). */
  sunHours: number
  /** True when the Sun is still up at the end of the data, so the real value is at least `sunHours`. */
  capped: boolean
  earthUp: boolean
}

/**
 * For each of the first `count` samples, how long the Sun stays up after a landing at that moment.
 * One backward pass: a lit sample's remaining sunlight is the next sample's plus one step.
 */
export function landingOptions(samples: Sample[], stepMinutes: number, count: number): LandingOption[] {
  const n = samples.length
  const step = stepMinutes / 60
  const hours = new Array<number>(n).fill(0)
  const capped = new Array<boolean>(n).fill(false)
  for (let i = n - 1; i >= 0; i--) {
    if (!samples[i].sun.visible) continue
    if (i === n - 1) {
      hours[i] = step
      capped[i] = true
    } else {
      hours[i] = step + hours[i + 1]
      capped[i] = samples[i + 1].sun.visible ? capped[i + 1] : false
    }
  }
  return samples.slice(0, Math.min(count, n)).map((s, i) => ({ time: s.time, sunHours: hours[i], capped: capped[i], earthUp: s.earth.visible }))
}

export interface MissionOption {
  time: string
  /** Hours within the first `missionDays` after landing that the Sun / Earth / both are up. */
  sunHours: number
  earthHours: number
  opsHours: number
  earthUp: boolean
  sunUp: boolean
}

/**
 * For each of the first `count` landing samples, how much of a `missionDays`-long surface stay has the
 * Sun up, Earth up, and both up. Prefix sums keep it O(n). The data must extend `missionDays` past the last candidate.
 */
export function missionOptions(samples: Sample[], stepMinutes: number, count: number, missionDays: number): MissionOption[] {
  const n = samples.length
  const step = stepMinutes / 60
  const m = Math.round((missionDays * 24 * 60) / stepMinutes)
  const pre = (pred: (s: Sample) => boolean) => {
    const p = new Array<number>(n + 1).fill(0)
    samples.forEach((s, i) => (p[i + 1] = p[i] + (pred(s) ? 1 : 0)))
    return p
  }
  const ps = pre((s) => s.sun.visible)
  const pe = pre((s) => s.earth.visible)
  const pb = pre((s) => s.sun.visible && s.earth.visible)
  const out: MissionOption[] = []
  for (let i = 0; i < Math.min(count, n); i++) {
    const j = Math.min(n, i + m)
    out.push({
      time: samples[i].time,
      sunHours: (ps[j] - ps[i]) * step,
      earthHours: (pe[j] - pe[i]) * step,
      opsHours: (pb[j] - pb[i]) * step,
      earthUp: samples[i].earth.visible,
      sunUp: samples[i].sun.visible,
    })
  }
  return out
}

/** Top `k` landing times by ops hours, at least `gapHours` apart so they're distinct options. */
export function bestMissionWindows(opts: MissionOption[], k: number, gapHours = 24): MissionOption[] {
  const picked: MissionOption[] = []
  for (const o of [...opts].sort((a, b) => b.opsHours - a.opsHours || b.sunHours - a.sunHours)) {
    if (picked.every((p) => Math.abs(Date.parse(p.time) - Date.parse(o.time)) >= gapHours * 3_600_000)) picked.push(o)
    if (picked.length === k) break
  }
  return picked.sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
}

/** Best landing moment: most sunlight with Earth in view at touchdown; falls back to most sunlight overall. */
export function bestLanding(opts: LandingOption[]): LandingOption | null {
  const pick = (list: LandingOption[]) => list.reduce<LandingOption | null>((b, o) => (!b || o.sunHours > b.sunHours ? o : b), null)
  return pick(opts.filter((o) => o.earthUp && o.sunHours > 0)) ?? pick(opts)
}

// ── Nearby spots grid ───────────────────────────────────────────────────────

export interface GridPoint {
  /** Offsets from the site in km: north positive, east positive. */
  dn: number
  de: number
  lat: number
  lon: number
}

/** size×size grid centered on the site (size odd), north up, east right, `spacingKm` apart. */
export function nearbyGrid(lat: number, lon: number, spacingKm: number, size = 5): GridPoint[] {
  const half = (size - 1) / 2
  const pts: GridPoint[] = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const dn = (half - r) * spacingKm
      const de = (c - half) * spacingKm
      const a = dn === 0 ? { lat, lon } : destinationPoint(lat, lon, Math.abs(dn), dn > 0 ? 0 : 180)
      const b = de === 0 ? a : destinationPoint(a.lat, a.lon, Math.abs(de), de > 0 ? 90 : 270)
      pts.push({ dn, de, lat: b.lat, lon: b.lon })
    }
  }
  return pts
}

/** "2 km N, 1 km E" (or "this site"). */
export function describeOffset(dn: number, de: number): string {
  const part = (v: number, pos: string, neg: string) => (v === 0 ? null : `${+Math.abs(v).toFixed(1)} km ${v > 0 ? pos : neg}`)
  const parts = [part(dn, 'N', 'S'), part(de, 'E', 'W')].filter(Boolean)
  return parts.length ? parts.join(', ') : 'this site'
}
