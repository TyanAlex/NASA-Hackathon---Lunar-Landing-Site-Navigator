import type { Sample } from '../api/types'
import type { Body } from './crossings'
import { dirToLatLon } from './coords'
import { toIsoMinute } from './format'

/** Synodic month: one full lunar day/night cycle at any site. */
export const LUNAR_DAY_DAYS = 29.530589
export const LUNAR_DAY_MS = LUNAR_DAY_DAYS * 86_400_000

/** A window of exactly one lunar day starting at `startIso`. */
export function lunarDayRange(startIso: string) {
  return { start: startIso, end: toIsoMinute(new Date(Date.parse(startIso) + LUNAR_DAY_MS)) }
}

/** True when a range already spans about one lunar day (within an hour). */
export function isLunarDayRange(r: { start: string; end: string }) {
  return Math.abs(Date.parse(r.end) - Date.parse(r.start) - LUNAR_DAY_MS) < 3_600_000
}

/**
 * Local solar time at `lon` as "HH:MM" on a 24-hour lunar clock: 12:00 when the Sun is due
 * north/south (over the site's meridian), 06:00 at sunrise on flat ground, 18:00 at sunset.
 */
export function localSolarTime(lon: number, sample: Sample): string {
  const sub = dirToLatLon(sample.sun.dir)
  const hours = (((12 + (lon - sub.lon) / 15) % 24) + 24) % 24
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Runs of consecutive samples where `body` is above the local terrain horizon, as [first, last] indices. */
export function visibleRuns(samples: Sample[], body: Body): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  samples.forEach((s, i) => {
    if (s[body].visible && start < 0) start = i
    if (!s[body].visible && start >= 0) {
      runs.push([start, i - 1])
      start = -1
    }
  })
  if (start >= 0) runs.push([start, samples.length - 1])
  return runs
}

/** "3 d 4 h" for long spans, "4 h 12 m" under a day. */
export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  return d > 0 ? `${d} d ${h} h` : `${h} h ${totalMin % 60} m`
}

/** Compact "84.8°S 29.2°E" for lists. */
export const shortLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`
