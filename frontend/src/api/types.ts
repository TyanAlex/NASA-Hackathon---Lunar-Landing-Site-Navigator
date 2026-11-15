// Mirrors backend/app/models.py — keep in sync.

export type SiteKind = 'historical' | 'recent' | 'candidate'

export interface Site {
  id: string
  name: string
  lat: number // degrees, north positive
  lon: number // degrees, east positive
  program: string
  kind: SiteKind
  approximate: boolean
  notes: string | null
}

export interface BodyPosition {
  az: number // degrees clockwise from north
  el: number // degrees above the local horizontal plane
  range_km: number
  horizon_el: number // local horizon elevation at this azimuth, degrees
  visible: boolean // el above horizon_el
  dir: [number, number, number] // unit vector Moon center -> body, MOON_ME frame
}

export interface Sample {
  time: string // ISO 8601 UTC
  sun: BodyPosition
  earth: BodyPosition
}

export interface Summary {
  sun_visible_fraction: number
  earth_visible_fraction: number
  sun_max_el: number
  earth_max_el: number
  next_sunrise: string | null
  next_sunset: string | null
  next_earthrise: string | null
  next_earthset: string | null
}

export interface EphemerisResponse {
  lat: number
  lon: number
  start: string
  end: string
  step_minutes: number
  samples: Sample[]
  summary: Summary
}

export interface EphemerisQuery {
  lat: number
  lon: number
  start: string
  end: string
  step_minutes?: number
}

export interface HorizonResponse {
  lat: number
  lon: number
  ground_height_m: number // terrain height above the 1737.4 km reference sphere
  observer_height_m: number
  az: number[] // degrees clockwise from north
  el: number[] // terrain horizon elevation, degrees
}
