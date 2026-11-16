import { AlertTriangle } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import type { Site } from '../../api/types'
import { pageHref } from '../../hooks/useHashRoute'
import { nextCrossing, type Body } from '../../lib/crossings'
import { formatDeg, formatPct, formatUtc } from '../../lib/format'
import { formatCountdown, localSolarTime, shortLatLon } from '../../lib/lunar'
import { missionStats, missionWindowText } from '../../lib/mission'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { MissionPicker } from './MissionPicker'

/** "Selected site" card: name, moment, and the five quick metrics from the wireframe. */
export function QuickMetrics({ site }: { site: Site | undefined }) {
  const { location, ephemeris, timeIndex, missionType } = useMission()
  const sample = useCurrentSample()
  const data = ephemeris.data

  // Judging numbers cover the mission window from landing (the start of the date range).
  const stats = useMemo(() => (data ? missionStats(data, missionType) : null), [data, missionType])
  const windowText = missionWindowText(missionType)

  const nextSet = useMemo(() => {
    if (!data) return { sun: null, earth: null }
    const find = (b: Body) => nextCrossing(data.samples, timeIndex, b, 'set')
    return { sun: find('sun'), earth: find('earth') }
  }, [data, timeIndex])

  if (!location) {
    return (
      <section className="s-card" aria-label="Selected site">
        <p className="muted">Pick a site from the list or click the globe to see its metrics.</p>
      </section>
    )
  }

  const pending = ephemeris.loading ? '…' : '—'
  const until = (iso: string | null) => (sample && iso ? formatCountdown(Date.parse(iso) - Date.parse(sample.time)) : null)
  const sunset = until(nextSet.sun)
  const earthset = until(nextSet.earth)

  return (
    <section className="s-card" aria-label="Selected site">
      <div className="summary-head">
        <div>
          <div className="eyebrow">Selected site</div>
          <h2 className="site-title">{location.name}</h2>
          <p className="summary-meta">
            {shortLatLon(location.lat, location.lon)}
            {sample && <> · {formatUtc(sample.time)} · local solar time {localSolarTime(location.lon, sample)}</>}
          </p>
        </div>
        <a className="btn btn-primary" href={pageHref('detail')}>Open site detail</a>
      </div>
      <div className="mission-row">
        <MissionPicker />
        <span className="muted small">Sunlit and Earth visible cover {windowText} after landing.</span>
      </div>

      {site?.approximate && (
        <p className="s-note"><AlertTriangle size={14} aria-hidden /> Approximate coordinates. Verify in Quickmap before relying on them.</p>
      )}
      {ephemeris.error && <p className="form-error" role="alert">Couldn’t compute Sun/Earth positions: {ephemeris.error}</p>}

      <div className="metric-grid">
        <Metric
          label="Sun elevation now"
          tone="sun"
          value={sample ? formatDeg(sample.sun.el) : pending}
          sub={sample && (sample.sun.visible ? 'Above the horizon' : sample.sun.el > 0 ? 'Hidden by terrain' : 'Below the horizon')}
        />
        <Metric label="Sunlit" value={stats ? formatPct(stats.sunFraction) : pending} sub={stats && `Of ${windowText} after landing`} />
        <Metric label="Earth visible" tone="earth" value={stats ? formatPct(stats.earthFraction) : pending} sub={stats && `Of ${windowText}: direct radio contact`} />
        <Metric
          label="Next sunset in"
          value={sample ? (sunset ?? 'None') : pending}
          sub={sample && (sunset ? (sample.sun.visible ? 'Sun is up now' : 'Sun is down now') : 'No sunset left this lunar day')}
        />
        <Metric
          label="Next Earthset in"
          value={sample ? (earthset ?? 'None') : pending}
          sub={sample && (earthset ? (sample.earth.visible ? 'Earth is up now' : 'Earth is down now') : 'No Earthset left this lunar day')}
        />
      </div>
    </section>
  )
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: 'sun' | 'earth' }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-value${tone ? ` tone-${tone}` : ''}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  )
}
