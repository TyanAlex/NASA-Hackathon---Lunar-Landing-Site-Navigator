/** A named point on the Moon: a user-saved custom site, or an entry in the compare tray. */
export interface Place {
  id: string
  name: string
  lat: number
  lon: number
}

export const MAX_COMPARE = 3

export type ViewMode = 'simple' | 'detailed'
