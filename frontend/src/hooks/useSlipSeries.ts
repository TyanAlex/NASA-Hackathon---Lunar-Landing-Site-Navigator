import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { EphemerisResponse } from '../api/types'
import { shiftDays } from '../lib/compare'
import type { Scenario } from './useScenarioData'

export const MAX_SLIP_DAYS = 30
const STEP_MIN = 60

/**
 * One long ephemeris per scenario, covering every landing from 0 to MAX_SLIP_DAYS late plus the mission
 * window after the latest one. `windowDays` = mission length (29.5 for a long-term base).
 * (30 + 29.5) days × 24 = 1428 samples, under the backend's 2000 limit.
 */
export function useSlipSeries(scenarios: Scenario[], windowDays: number) {
  const [cache, setCache] = useState<Record<string, EphemerisResponse | { error: string }>>({})
  const days = MAX_SLIP_DAYS + Math.ceil(windowDays)
  const keyOf = (s: Scenario) => `${s.lat},${s.lon}|${s.start}|${days}`
  const want = [...new Set(scenarios.map(keyOf))].filter((k) => !(k in cache))
  const pending = want.join(';')

  useEffect(() => {
    if (!pending) return
    const ctrl = new AbortController()
    for (const s of scenarios) {
      const k = keyOf(s)
      if (!want.includes(k)) continue
      api
        .ephemeris({ lat: s.lat, lon: s.lon, start: s.start, end: shiftDays(s.start, days), step_minutes: STEP_MIN }, ctrl.signal)
        .then((d) => setCache((m) => ({ ...m, [k]: d })))
        .catch((e: Error) => !ctrl.signal.aborted && setCache((m) => ({ ...m, [k]: { error: e.message } })))
    }
    return () => ctrl.abort()
    // `pending` lists exactly the keys that still need fetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  return (s: Scenario): { data: EphemerisResponse | null; error: string | null } => {
    const v = cache[keyOf(s)]
    return { data: v && !('error' in v) ? v : null, error: v && 'error' in v ? v.error : null }
  }
}
