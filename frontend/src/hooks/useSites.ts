import { api } from '../api/client'
import { useFetch } from './useFetch'

export function useSites() {
  return useFetch('sites', api.sites)
}
