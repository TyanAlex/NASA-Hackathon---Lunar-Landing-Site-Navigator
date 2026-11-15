export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000)
}

/** ISO 8601 UTC truncated to minutes, e.g. 2026-11-14T09:30:00Z */
export function toIsoMinute(d: Date): string {
  return d.toISOString().slice(0, 16) + ':00Z'
}

export function formatUtc(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

/** "3d 4h 12m" from milliseconds; negative → "—" */
export function formatDuration(ms: number): string {
  if (ms < 0) return '—'
  const m = Math.floor(ms / 60_000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return [d && `${d}d`, (d || h) && `${h}h`, `${m % 60}m`].filter(Boolean).join(' ')
}

export const formatDeg = (v: number) => `${v.toFixed(1)}°`
export const formatPct = (v: number) => `${Math.round(v * 100)}%`
