import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { EphemerisResponse } from '../api/types'
import type { Place } from '../lib/places'
import type { TimeRange } from '../state/MissionContext'

const CONCURRENCY = 3

interface State {
  key: string
  results: Record<string, EphemerisResponse>
  errors: Record<string, string>
  running: boolean
  done: number
  total: number
}

/**
 * Ephemeris for many sites over the current window, fetched only when `run()` is called (it's ~1 request
 * per site). Results are dropped when the window or step changes, since they'd no longer line up.
 */
export function useAllSitesEphemeris(places: Place[], range: TimeRange, stepMinutes: number) {
  const key = `${range.start}|${range.end}|${stepMinutes}`
  const [state, setState] = useState<State | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  // Abort an in-flight batch when the window changes or the component unmounts.
  useEffect(() => () => ctrlRef.current?.abort(), [key])

  const fresh = state?.key === key ? state : null

  const run = async (skip: Set<string>) => {
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    const todo = places.filter((p) => !skip.has(p.id))
    setState({ key, results: {}, errors: {}, running: true, done: 0, total: todo.length })

    let next = 0
    const worker = async () => {
      while (next < todo.length && !ctrl.signal.aborted) {
        const p = todo[next++]
        try {
          const data = await api.ephemeris({ lat: p.lat, lon: p.lon, start: range.start, end: range.end, step_minutes: stepMinutes }, ctrl.signal)
          setState((s) => s && s.key === key ? { ...s, results: { ...s.results, [p.id]: data }, done: s.done + 1 } : s)
        } catch (e) {
          if (ctrl.signal.aborted) return
          setState((s) => s && s.key === key ? { ...s, errors: { ...s.errors, [p.id]: (e as Error).message }, done: s.done + 1 } : s)
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (!ctrl.signal.aborted) setState((s) => (s && s.key === key ? { ...s, running: false } : s))
  }

  return {
    results: fresh?.results ?? {},
    errors: fresh?.errors ?? {},
    running: fresh?.running ?? false,
    progress: fresh ? { done: fresh.done, total: fresh.total } : null,
    run,
  }
}
