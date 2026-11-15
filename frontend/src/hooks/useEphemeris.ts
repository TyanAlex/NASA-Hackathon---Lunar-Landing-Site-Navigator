import { api } from '../api/client'
import type { EphemerisQuery } from '../api/types'
import { useFetch } from './useFetch'

export function useEphemeris(query: EphemerisQuery | null) {
  const key = query && JSON.stringify(query)
  return useFetch(key, (signal) => api.ephemeris(query!, signal))
}
