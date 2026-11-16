import type { Scenario } from '../hooks/useScenarioData'
import { toIsoMinute } from './format'
import type { Place } from './places'
import { formatHours, type WindowStats } from './stats'
import type { MissionType, Tone } from './verdict'

export type CompareMode = 'sites' | 'dates'

/** Compare-page settings, kept at app level so switching Simple ↔ Detailed keeps them. */
export interface CompareSettings {
  mode: CompareMode
  setMode: (m: CompareMode) => void
  slip: number
  setSlip: (d: number) => void
  extraDates: string[]
  setExtraDates: (f: (d: string[]) => string[]) => void
}

export const LETTERS = ['A', 'B', 'C']
const DAY = 86_400_000
export const shiftDays = (iso: string, days: number) => toIsoMinute(new Date(Date.parse(iso) + days * DAY))

/** The cards being compared, and their "after slip" variants. */
export function buildScenarios(
  s: Pick<CompareSettings, 'mode' | 'slip' | 'extraDates'>,
  tray: Place[],
  location: { name: string; lat: number; lon: number; siteId?: string } | null,
  landing: string,
): { base: Scenario[]; slipped: Scenario[] } {
  let base: Scenario[] = []
  if (s.mode === 'sites') {
    base = tray.map((p, i) => ({ key: `site-${p.id}`, label: `Site ${LETTERS[i]}`, name: p.name, lat: p.lat, lon: p.lon, start: landing, siteId: p.id }))
  } else if (location) {
    base = [landing, ...s.extraDates].map((d, i) => ({
      key: `date-${i}`, label: `Date ${LETTERS[i]}`, name: location.name, lat: location.lat, lon: location.lon, start: d, siteId: location.siteId,
    }))
  }
  const slipped =
    s.mode === 'sites' && s.slip > 0
      ? base.map((b) => ({ ...b, key: `${b.key}-slip`, label: `${b.label} after slip`, start: shiftDays(b.start, s.slip), slippedFrom: b.key }))
      : []
  return { base, slipped }
}

// Mission window helpers live in ./mission; re-exported here for the Compare pages.
export { missionStats, missionWindowDays, missionWindowText } from './mission'

/** Mission-verdict tones as Compare badges. */
export const BADGE: Record<Tone, { text: string; cls: string }> = {
  good: { text: 'Viable', cls: 'viable' },
  ok: { text: 'Marginal', cls: 'marginal' },
  warn: { text: 'Marginal', cls: 'marginal' },
  bad: { text: 'Not viable', cls: 'not-viable' },
}

// ── User-set viability limits (Detailed Compare) ────────────────────────────

export interface Limits {
  minSunPct: number
  maxDarkH: number
  minEarthPct: number
  maxGapH: number
  /** A miss within this % of the limit is "Marginal" rather than "Not viable". */
  bandPct: number
}

/** Defaults per mission type, over that mission's window. Rules of thumb, meant to be edited. */
export function defaultLimits(type: MissionType): Limits {
  if (type === 'longTerm') return { minSunPct: 60, maxDarkH: 72, minEarthPct: 50, maxGapH: 72, bandPct: 20 }
  return { minSunPct: 90, maxDarkH: 12, minEarthPct: 80, maxGapH: 24, bandPct: 20 }
}

export type LimitTone = 'viable' | 'marginal' | 'not-viable'

/** Checks stats against limits; `why` names every limit that was missed and by how much. */
export function limitsVerdict(st: WindowStats, l: Limits): { tone: LimitTone; why: string[] } {
  const band = l.bandPct / 100
  const why: string[] = []
  let worst: LimitTone = 'viable'
  const check = (missed: boolean, within: boolean, text: string) => {
    if (!missed) return
    why.push(text)
    const t: LimitTone = within ? 'marginal' : 'not-viable'
    if (t === 'not-viable' || worst === 'viable') worst = t
  }
  const sun = st.sunFraction * 100
  const earth = st.earthFraction * 100
  check(sun < l.minSunPct, sun >= l.minSunPct * (1 - band), `Sunlit ${Math.round(sun)}%, under the ${l.minSunPct}% limit`)
  // For "max" limits, a 0 h limit gets a small absolute band so 1 h over isn't automatically "Not viable".
  const over = (v: number, lim: number) => v <= lim + Math.max(lim * band, band * 12)
  check(st.longestDarkHours > l.maxDarkH, over(st.longestDarkHours, l.maxDarkH), `Longest dark ${formatHours(st.longestDarkHours)}, over the ${l.maxDarkH} h limit`)
  check(earth < l.minEarthPct, earth >= l.minEarthPct * (1 - band), `Earth visible ${Math.round(earth)}%, under the ${l.minEarthPct}% limit`)
  check(st.longestGapHours > l.maxGapH, over(st.longestGapHours, l.maxGapH), `Longest comms gap ${formatHours(st.longestGapHours)}, over the ${l.maxGapH} h limit`)
  return { tone: worst, why }
}

export const LIMIT_TEXT: Record<LimitTone, string> = { viable: 'Viable', marginal: 'Marginal', 'not-viable': 'Not viable' }

/** Save any JSON-serializable value as a .json file. */
export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
