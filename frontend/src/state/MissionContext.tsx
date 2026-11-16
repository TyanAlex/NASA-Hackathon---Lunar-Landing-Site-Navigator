import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { EphemerisResponse, HorizonResponse } from '../api/types'
import { useEphemeris } from '../hooks/useEphemeris'
import { useHorizon } from '../hooks/useHorizon'
import type { FetchState } from '../hooks/useFetch'
import { toIsoMinute } from '../lib/format'
import { lunarDayRange } from '../lib/lunar'
import type { MissionType } from '../lib/verdict'

export interface Location {
  name: string
  lat: number
  lon: number
  siteId?: string
  /** 'search' flies the camera to the location; 'map' (a click on the globe) leaves it put. */
  source?: 'search' | 'map'
}

export interface TimeRange {
  start: string // ISO 8601 UTC
  end: string
}

interface MissionState {
  location: Location | null
  setLocation: (l: Location) => void
  range: TimeRange
  setRange: (r: TimeRange) => void
  stepMinutes: number
  setStepMinutes: (m: number) => void
  timeIndex: number
  setTimeIndex: (i: number) => void
  playing: boolean
  setPlaying: (p: boolean) => void
  ephemeris: FetchState<EphemerisResponse>
  /** Terrain horizon profile at the selected location (LOLA DEM). */
  horizon: FetchState<HorizonResponse>
  /** Kind of mission the site verdicts are judged against. */
  missionType: MissionType
  setMissionType: (t: MissionType) => void
}

const MissionContext = createContext<MissionState | null>(null)

// One lunar day from now: the Simple view's "this lunar day" metrics read straight off this window.
const DEFAULT_RANGE: TimeRange = lunarDayRange(toIsoMinute(new Date()))
// Start on a south-pole site so the globe is lit and the panel has data on first load.
const DEFAULT_LOCATION: Location = { name: 'IM-2 Athena – Mons Mouton', lat: -84.79, lon: 29.2, siteId: 'im-2', source: 'search' }

export function MissionProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<Location | null>(DEFAULT_LOCATION)
  const [range, setRange] = useState(DEFAULT_RANGE)
  const [stepMinutes, setStepMinutes] = useState(60)
  const [timeIndex, setTimeIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [missionType, setMissionType] = useState<MissionType>('short')

  const query = useMemo(
    () => location && { lat: location.lat, lon: location.lon, start: range.start, end: range.end, step_minutes: stepMinutes },
    [location, range, stepMinutes],
  )
  const ephemeris = useEphemeris(query)
  const horizon = useHorizon(location)

  const setLocation = (l: Location) => {
    setLocationState(l)
    setTimeIndex(0)
  }

  return (
    <MissionContext.Provider
      value={{
        location, setLocation,
        range, setRange,
        stepMinutes, setStepMinutes,
        timeIndex, setTimeIndex,
        playing, setPlaying,
        ephemeris,
        horizon,
        missionType, setMissionType,
      }}
    >
      {children}
    </MissionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMission() {
  const ctx = useContext(MissionContext)
  if (!ctx) throw new Error('useMission must be used inside <MissionProvider>')
  return ctx
}

/** The sample at the current timeline position, or null before data loads. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentSample() {
  const { ephemeris, timeIndex } = useMission()
  return ephemeris.data?.samples[timeIndex] ?? null
}
