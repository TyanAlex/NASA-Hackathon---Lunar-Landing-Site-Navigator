import { useEffect } from 'react'
import { useMission } from '../state/MissionContext'

/**
 * Advances the shared timeIndex at `speedHours` simulated hours per real second while `playing`,
 * stopping at `endIndex` (default: the last sample). Mount it in exactly one place per screen.
 */
export function usePlayback(speedHours: number, endIndex?: number) {
  const { playing, setPlaying, timeIndex, setTimeIndex, ephemeris } = useMission()
  const count = ephemeris.data?.samples.length ?? 0
  const stepMinutes = ephemeris.data?.step_minutes ?? 60
  const last = Math.min(endIndex ?? count - 1, count - 1)

  useEffect(() => {
    if (!playing || count === 0) return
    const perSec = (speedHours * 60) / stepMinutes
    const period = Math.max(40, 1000 / perSec)
    const stride = Math.max(1, Math.round((perSec * period) / 1000))
    const t = setTimeout(() => {
      const next = timeIndex + stride
      if (next >= last) {
        setTimeIndex(last)
        setPlaying(false)
      } else {
        setTimeIndex(next)
      }
    }, period)
    return () => clearTimeout(t)
  }, [playing, timeIndex, count, last, speedHours, stepMinutes, setTimeIndex, setPlaying])

  /** Play/pause; starting from the end jumps back to `restartAt` first. */
  const toggle = (restartAt = 0) => {
    if (!playing && timeIndex >= last) setTimeIndex(restartAt)
    setPlaying(!playing)
  }

  return { playing, toggle, count }
}
