import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { EphemerisResponse, HorizonResponse } from '../api/types'
import { lunarDayRange } from '../lib/lunar'

/** One thing being compared: a place and a landing time. */
export interface Scenario {
  key: string
  label: string
  name: string
  lat: number
  lon: number
  /** Landing time (ISO UTC); the scenario's window is one lunar day from here. */
  start: string
  siteId?: string
  /** Set on "after slip" variants: the scenario this one was slipped from. */
  slippedFrom?: string
}

export interface ScenarioResult {
  data: EphemerisResponse | null
  horizon: HorizonResponse | null
  error: string | null
}

const STEP_MIN = 60
const dataKey = (s: Scenario) => `${s.lat},${s.lon}|${s.start}`
const horizonKey = (s: Scenario) => `${s.lat},${s.lon}`

/**
 * Ephemeris (one lunar day from each scenario's landing) and terrain horizon for every scenario.
 * Results are cached by place + time, so adding a card or moving the slip only fetches what's new.
 */
export function useScenarioData(scenarios: Scenario[]) {
  const [eph, setEph] = useState<Record<string, EphemerisResponse | { error: string }>>({})
  const [hor, setHor] = useState<Record<string, HorizonResponse | null>>({})

  const wantEph = [...new Set(scenarios.map(dataKey))].filter((k) => !(k in eph))
  const wantHor = [...new Set(scenarios.map(horizonKey))].filter((k) => !(k in hor))
  const pending = [...wantEph, ...wantHor].join(';')

  useEffect(() => {
    if (!pending) return
    const ctrl = new AbortController()
    for (const s of scenarios) {
      const dk = dataKey(s)
      if (wantEph.includes(dk)) {
        const w = lunarDayRange(s.start)
        api
          .ephemeris({ lat: s.lat, lon: s.lon, start: w.start, end: w.end, step_minutes: STEP_MIN }, ctrl.signal)
          .then((d) => setEph((m) => ({ ...m, [dk]: d })))
          .catch((e: Error) => !ctrl.signal.aborted && setEph((m) => ({ ...m, [dk]: { error: e.message } })))
      }
      const hk = horizonKey(s)
      if (wantHor.includes(hk)) {
        api
          .horizon({ lat: s.lat, lon: s.lon }, ctrl.signal)
          .then((h) => setHor((m) => ({ ...m, [hk]: h })))
          .catch(() => !ctrl.signal.aborted && setHor((m) => ({ ...m, [hk]: null })))
      }
    }
    return () => ctrl.abort()
    // `pending` lists exactly the keys that still need fetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  return (s: Scenario): ScenarioResult => {
    const e = eph[dataKey(s)]
    return {
      data: e && !('error' in e) ? e : null,
      horizon: hor[horizonKey(s)] ?? null,
      error: e && 'error' in e ? e.error : null,
    }
  }
}
