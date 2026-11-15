import type { EphemerisQuery, EphemerisResponse, HorizonResponse, Site } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

async function get<T>(path: string, params?: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const query = params
    ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    : ''
  const res = await fetch(`${BASE_URL}${path}${query}`, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** South polar stereographic cap image (75°S to the pole) used by the globe's polar shader. */
export const polarCapUrl = (source: 'wac' | 'lola') => `${BASE_URL}/api/imagery/south/${source}/cap.jpg`

export const api = {
  sites: (signal?: AbortSignal) => get<Site[]>('/api/sites', undefined, signal),
  ephemeris: ({ step_minutes = 60, ...q }: EphemerisQuery, signal?: AbortSignal) =>
    get<EphemerisResponse>('/api/ephemeris', { ...q, step_minutes }, signal),
  horizon: (q: { lat: number; lon: number }, signal?: AbortSignal) => get<HorizonResponse>('/api/horizon', q, signal),
  /** LOLA heightmap tile: 65x65 float32 heights (m above 1737.4 km), row-major from the north-west corner. */
  terrainTile: async (z: number, x: number, y: number): Promise<ArrayBuffer> => {
    const res = await fetch(`${BASE_URL}/api/terrain/${z}/${x}/${y}`)
    if (!res.ok) throw new Error(`terrain tile ${z}/${x}/${y}: ${res.status}`)
    return res.arrayBuffer()
  },
}
