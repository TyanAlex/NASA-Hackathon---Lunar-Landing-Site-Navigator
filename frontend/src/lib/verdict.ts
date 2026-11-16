import type { EphemerisResponse } from '../api/types'
import { nextCrossing } from './crossings'
import { formatCountdown } from './lunar'
import { formatHours, windowStats } from './stats'

export type MissionType = 'short' | 'lunarDay' | 'longTerm'

export const MISSION_TYPES: { key: MissionType; label: string; days: number; hint: string }[] = [
  { key: 'short', label: 'Short visit (~3 days)', days: 3, hint: 'Land in daylight, keep Sun and Earth up for the stay.' },
  { key: 'lunarDay', label: 'One lunar day (~14 days)', days: 14, hint: 'Sunlight and Earth contact for the whole two-week mission.' },
  { key: 'longTerm', label: 'Long-term base (months)', days: 30, hint: 'Survive the lunar night and keep in touch over every cycle. Based on one lunar day, so seasonal changes over the year aren’t included.' },
]

export type Tone = 'good' | 'ok' | 'warn' | 'bad'

export interface Verdict {
  tone: Tone
  headline: string
  checks: { ok: boolean; text: string }[]
}

/** Plain-language rules, shown in Detailed so the verdict is never a black box. */
export const VERDICT_RULES: Record<MissionType, string> = {
  short: 'Checks the first 3 days after landing: Sun up at touchdown, no sunset during the stay, Earth up at touchdown, Earth in view at least 80% of the stay.',
  lunarDay: 'Checks the first 14 days after landing: Sun up at touchdown, no sunset during the mission, Earth up at touchdown, Earth in view at least 80% of the mission.',
  longTerm: 'Checks one full lunar day from the landing date: longest night 3 days or less, sunlit at least 60%, Earth in view at least 50%. Seasonal changes over a year are not included.',
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Is this site and landing date a good fit for the chosen kind of mission? The data window starts at the
 * landing time (index 0), as set by the landing date controls.
 */
export function missionVerdict(data: EphemerisResponse, type: MissionType): Verdict {
  const { samples, step_minutes } = data
  if (type === 'longTerm') return longTermVerdict(data)

  const days = MISSION_TYPES.find((t) => t.key === type)!.days
  const m = Math.min(samples.length, Math.round((days * 24 * 60) / step_minutes))
  const stay = samples.slice(0, m)
  const land = samples[0]

  const sunUpAtLanding = land.sun.visible
  const sunsetIdx = sunUpAtLanding ? stay.findIndex((s) => !s.sun.visible) : -1
  const sunsetDay = sunsetIdx > 0 ? (sunsetIdx * step_minutes) / 60 / 24 : null
  const earthAtLanding = land.earth.visible
  const earthShare = stay.filter((s) => s.earth.visible).length / Math.max(stay.length, 1)
  const word = type === 'short' ? 'stay' : 'mission'

  const checks = [
    sunUpAtLanding
      ? { ok: true, text: 'Lands in daylight' }
      : (() => {
          const rise = nextCrossing(samples, 0, 'sun', 'rise')
          return { ok: false, text: rise ? `Lands in the dark (sunrise in ${formatCountdown(Date.parse(rise) - Date.parse(land.time))})` : 'Lands in the dark' }
        })(),
    sunUpAtLanding && sunsetDay === null
      ? { ok: true, text: `Sunlight for all ${days} days` }
      : { ok: false, text: sunsetDay !== null ? `Sun sets on day ${sunsetDay.toFixed(1)} of ${days}` : `No sunlight at the start of the ${word}` },
    { ok: earthAtLanding, text: earthAtLanding ? 'Earth in view at landing' : 'Earth below the horizon at landing (no contact on arrival)' },
    { ok: earthShare >= 0.8, text: `Earth in view ${pct(earthShare)} of the ${word}` },
  ]

  let tone: Tone = 'good'
  let headline = earthShare >= 0.999 ? `Good: Sun and Earth up for the whole ${word}` : `Good: sunlit all ${days} days, Earth in view ${pct(earthShare)}`
  if (!sunUpAtLanding) {
    tone = 'bad'
    headline = 'Landing in the dark: pick a date just after sunrise'
  } else if (sunsetDay !== null) {
    tone = 'warn'
    headline = `Sun sets on day ${sunsetDay.toFixed(1)} of ${days}: land earlier or plan for the night`
  } else if (!earthAtLanding || earthShare < 0.8) {
    tone = 'warn'
    headline = !earthAtLanding ? 'Sunlight is fine, but no Earth contact on arrival' : `Sunlight is fine, but Earth is in view only ${pct(earthShare)} of the ${word}`
  }
  return { tone, headline, checks }
}

function longTermVerdict(data: EphemerisResponse): Verdict {
  const st = windowStats(data)
  const shortNights = st.longestDarkHours <= 72
  const checks = [
    { ok: shortNights, text: `Longest night ${formatHours(st.longestDarkHours)}${shortNights ? '' : ' (more than 3 days)'}` },
    { ok: st.sunFraction >= 0.6, text: `Sunlit ${pct(st.sunFraction)} of the lunar day` },
    { ok: st.earthFraction >= 0.5, text: `Earth in view ${pct(st.earthFraction)}` },
  ]
  if (st.longestDarkHours >= 240) {
    return { tone: 'warn', headline: `Long nights: up to ${(st.longestDarkHours / 24).toFixed(0)} days of darkness, so a base needs heavy power storage`, checks }
  }
  if (checks.every((c) => c.ok)) return { tone: 'good', headline: 'Good base site: short nights and steady sunlight', checks }
  return { tone: 'ok', headline: `Workable base site: plan for nights of up to ${formatHours(st.longestDarkHours)}`, checks }
}
