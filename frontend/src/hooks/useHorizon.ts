import { api } from '../api/client'
import { useFetch } from './useFetch'

export function useHorizon(at: { lat: number; lon: number } | null) {
  const key = at && `${at.lat},${at.lon}`
  return useFetch(key, (signal) => api.horizon({ lat: at!.lat, lon: at!.lon }, signal))
}
