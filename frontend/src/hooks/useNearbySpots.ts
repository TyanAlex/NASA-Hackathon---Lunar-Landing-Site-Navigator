import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { nearbyGrid, type GridPoint } from '../lib/landing'
import { windowStats, type WindowStats } from '../lib/stats'
import type { Location, TimeRange } from '../state/MissionContext'

export interface SpotResult extends GridPoint {
  stats: WindowStats | null
  error?: string
}

const CONCURRENCY = 4

/**
 * Window stats (sunlit %, longest dark, ops hours, …) for a 5×5 grid around the site.
 * The center reuses the already-loaded `base`; the other 24 points are fetched when `run()` is called.
 * Results are dropped when the site, window or spacing changes.
 */
export function useNearbySpots(location: Location | null, range: TimeRange, stepMinutes: number, base: WindowStats | null) {
  const [spacing, setSpacing] = useState(1)
  const key = location ? `${location.lat},${location.lon}|${range.start}|${range.end}|${stepMinutes}|${spacing}` : null
  const [state, setState] = useState<{ key: string; spots: SpotResult[]; done: number; running: boolean } | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  useEffect(() => () => ctrlRef.current?.abort(), [key])

  const run = async () => {
    if (!location || !key || !base) return
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    const spots: SpotResult[] = nearbyGrid(location.lat, location.lon, spacing).map((p) => ({ ...p, stats: p.dn === 0 && p.de === 0 ? base : null }))
    setState({ key, spots, done: 0, running: true })

    const todo = spots.map((s, i) => [s, i] as const).filter(([s]) => s.stats === null)
    let next = 0
    const worker = async () => {
      while (next < todo.length && !ctrl.signal.aborted) {
        const [p, i] = todo[next++]
        try {
          const r = await api.ephemeris({ lat: p.lat, lon: p.lon, start: range.start, end: range.end, step_minutes: stepMinutes }, ctrl.signal)
          const stats = windowStats(r)
          setState((s) => (s && s.key === key ? { ...s, done: s.done + 1, spots: s.spots.map((x, j) => (j === i ? { ...x, stats } : x)) } : s))
        } catch (e) {
          if (ctrl.signal.aborted) return
          setState((s) => (s && s.key === key ? { ...s, done: s.done + 1, spots: s.spots.map((x, j) => (j === i ? { ...x, error: (e as Error).message } : x)) } : s))
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (!ctrl.signal.aborted) setState((s) => (s && s.key === key ? { ...s, running: false } : s))
  }

  const fresh = state?.key === key ? state : null
  return {
    spacing,
    setSpacing,
    spots: fresh?.spots ?? null,
    running: fresh?.running ?? false,
    progress: fresh ? { done: fresh.done, total: 24 } : null,
    run,
  }
}
