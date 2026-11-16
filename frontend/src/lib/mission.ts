import type { EphemerisResponse, Sample } from '../api/types'
import { sampleStats, windowStats, type WindowStats } from './stats'
import { MISSION_TYPES, type MissionType } from './verdict'
import { windowCounts, type WindowCounts } from './windows'

/**
 * The one definition of "the mission window" used everywhere a number judges a site:
 * from landing (the start of the data) for the mission's length. A long-term base uses the whole lunar day.
 */

/** Mission length in days, or null for "the whole lunar day" (long-term base). */
export function missionWindowDays(type: MissionType): number | null {
  return type === 'longTerm' ? null : MISSION_TYPES.find((t) => t.key === type)!.days
}

/** Days the window spans, for axes and labels (29.5 for the lunar day). */
export function missionSpanDays(type: MissionType): number {
  return missionWindowDays(type) ?? 29.5
}

/** "the 3-day stay" / "the 14-day mission" / "the lunar day" */
export function missionWindowText(type: MissionType): string {
  const d = missionWindowDays(type)
  return d === null ? 'the lunar day' : type === 'short' ? `the ${d}-day stay` : `the ${d}-day mission`
}

/** Section label: "Over the 3-day stay after landing". */
export function missionScopeLabel(type: MissionType): string {
  return type === 'longTerm' ? 'Over the lunar day after landing' : `Over ${missionWindowText(type)} after landing`
}

/** Short column header: "Mission (3 d)" / "Lunar day". */
export function missionColumnLabel(type: MissionType): string {
  const d = missionWindowDays(type)
  return d === null ? 'Lunar day' : `Mission (${d} d)`
}

/** Number of samples in the mission window for this data's step. */
export function missionSampleCount(data: EphemerisResponse, type: MissionType): number {
  const d = missionWindowDays(type)
  return d === null ? data.samples.length : Math.min(data.samples.length, Math.round((d * 24 * 60) / data.step_minutes))
}

export function missionSamples(data: EphemerisResponse, type: MissionType): Sample[] {
  return data.samples.slice(0, missionSampleCount(data, type))
}

/** Stats over the mission window (backend summary values for the whole lunar day, so they match exactly). */
export function missionStats(data: EphemerisResponse, type: MissionType): WindowStats {
  return missionWindowDays(type) === null ? windowStats(data) : sampleStats(missionSamples(data, type), data.step_minutes)
}

export function missionCounts(data: EphemerisResponse, type: MissionType): WindowCounts {
  return windowCounts(missionSamples(data, type), data.step_minutes)
}
