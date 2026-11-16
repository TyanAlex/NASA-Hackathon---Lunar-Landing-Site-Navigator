import { Check, Pause, Play, Plus, ZoomIn, ZoomOut } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { EphemerisResponse, Sample } from '../../api/types'
import { pageHref } from '../../hooks/useHashRoute'
import { usePlayback } from '../../hooks/usePlayback'
import { useSites } from '../../hooks/useSites'
import { nextCrossing, type Body } from '../../lib/crossings'
import { formatDeg, formatPct, formatUtc } from '../../lib/format'
import { formatCountdown, LUNAR_DAY_DAYS, lunarDayRange, shortLatLon } from '../../lib/lunar'
import { MAX_COMPARE, type Place } from '../../lib/places'
import { formatHours, windowStats } from '../../lib/stats'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { HorizonPanorama } from './HorizonPanorama'
import { LandingDateChart } from './LandingDateChart'
import { MissionVerdict } from './MissionVerdict'
import { NearbySpots } from './NearbySpots'
import { OPS_ROW, type BarRow } from '../../lib/barRows'
import { VisibilityBars } from './VisibilityBars'
import './simple.css'
import './siteDetail.css'

const DETAIL_ROWS: BarRow[] = [
  { key: 'sun', label: 'Sun above horizon', cls: 'seg-sun', pred: (s) => s.sun.visible },
  { key: 'earth', label: 'Earth above horizon', cls: 'seg-earth', pred: (s) => s.earth.visible },
  { ...OPS_ROW, label: 'Both up (ops)' },
]

const ZOOM_DAYS = 3

function regionName(lat: number, lon: number) {
  if (lat <= -75) return 'South polar region'
  if (lat >= 75) return 'North polar region'
  return Math.abs(lon) <= 90 ? 'Near side (faces Earth)' : 'Far side'
}

interface Props {
  tray: Place[]
  onToggleTray: (p: Place) => void
}

/** Simple Site detail: horizon panorama, key metrics, lunar-day timeline, and how sensitive the site is to small changes. */
export function SiteDetail({ tray, onToggleTray }: Props) {
  const { location, ephemeris, horizon, range, setRange, timeIndex, setTimeIndex, setPlaying } = useMission()
  const sample = useCurrentSample()
  const { data: sites } = useSites()
  const data = ephemeris.data
  const samples = useMemo(() => data?.samples ?? [], [data])
  const stats = useMemo(() => (data ? windowStats(data) : null), [data])
  const id = useId()

  // Zoom is tied to the dataset it was set on; new data (new site or date) resets it.
  const [zoomState, setZoomState] = useState<{ data: EphemerisResponse; view: [number, number] } | null>(null)
  const view = zoomState && zoomState.data === data ? zoomState.view : null
  const { playing, toggle } = usePlayback(view ? 3 : 24, view?.[1])

  if (!location) {
    return (
      <div className="detail-page">
        <div className="s-card">
          <h1 className="detail-title">Site detail</h1>
          <p className="muted">No site selected yet. <a href={pageHref('explore')}>Pick one on the Explore screen.</a></p>
        </div>
      </div>
    )
  }

  const site = sites?.find((s) => s.id === location.siteId)
  const place: Place = {
    id: location.siteId ?? `point-${location.lat.toFixed(4)},${location.lon.toFixed(4)}`,
    name: location.name,
    lat: location.lat,
    lon: location.lon,
  }
  const inTray = tray.some((t) => t.id === place.id)
  const dayNow = sample ? (Date.parse(sample.time) - Date.parse(range.start)) / 86_400_000 : null

  const setDate = (date: string) => {
    const iso = `${date}T${range.start.slice(11, 16)}:00Z`
    const year = Number(date.slice(0, 4))
    if (!date || Number.isNaN(Date.parse(iso)) || year < 1900 || year > 2200) return
    setPlaying(false)
    setRange(lunarDayRange(iso))
    setTimeIndex(0)
  }

  const toggleZoom = () => {
    if (!data) return
    if (view) return setZoomState(null)
    const n = samples.length
    const width = Math.round((ZOOM_DAYS * 24 * 60) / data.step_minutes)
    const i0 = Math.max(0, Math.min(timeIndex - Math.round(width / 2), n - 1 - width))
    setZoomState({ data, view: [i0, Math.min(n - 1, i0 + width)] })
  }

  const [lo, hi] = view ?? [0, Math.max(samples.length - 1, 0)]

  return (
    <div className="detail-page">
      <div className="detail-head">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href={pageHref('explore')}>Explorer</a> / <span aria-current="page">{location.name}</span>
          </nav>
          <h1 className="detail-title">{location.name}</h1>
          <p className="summary-meta">
            {shortLatLon(location.lat, location.lon)} · {regionName(location.lat, location.lon)}
            {site && <> · {site.program}</>}
            {dayNow !== null && <> · lunar day {dayNow.toFixed(1)} of {LUNAR_DAY_DAYS.toFixed(1)}</>}
          </p>
        </div>
        <div className="detail-head-actions">
          <div className="field">
            <label htmlFor={`${id}-date`}>Landing date (UTC)</label>
            <input id={`${id}-date`} type="date" value={range.start.slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button
            type="button"
            className={`btn ${inTray ? 'btn-outline' : 'btn-primary'}`}
            aria-pressed={inTray}
            disabled={!inTray && tray.length >= MAX_COMPARE}
            onClick={() => onToggleTray(place)}
          >
            {inTray ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
            {inTray ? 'In compare' : 'Add to compare'}
          </button>
        </div>
      </div>

      {ephemeris.error && <p className="form-error" role="alert">Couldn’t compute Sun/Earth positions: {ephemeris.error}</p>}

      <div className="detail-top">
        <section className="s-card detail-horizon" aria-label="Sun and Earth over the horizon">
          <div className="card-head">
            <h2>Horizon view: Sun and Earth</h2>
            {sample && <CountdownChip body="sun" samples={samples} timeIndex={timeIndex} now={sample} />}
            {sample && <CountdownChip body="earth" samples={samples} timeIndex={timeIndex} now={sample} />}
          </div>
          <HorizonPanorama samples={samples} timeIndex={timeIndex} horizon={horizon.data} />
          <ul className="pano-legend">
            <li><span className="key-disc key-sun" aria-hidden /> Sun now, and its path this lunar day</li>
            <li><span className="key-disc key-earth" aria-hidden /> Earth now, and its path</li>
            <li><span className="key-terrain" aria-hidden /> Terrain on the skyline (LRO LOLA)</li>
          </ul>
          <p className="muted small">
            {sample ? `${formatUtc(sample.time)}. ` : ''}
            The skyline is the real terrain around the site. When a path dips behind it, that body is hidden, which is why moving a site a few km can change its light and comms.
          </p>
        </section>

        <aside className="detail-metrics" aria-label="Key metrics">
          <div className="metric detail-metric">
            <div className="metric-label">Sun height in the sky</div>
            <div className="metric-row">
              <span className="metric-value tone-sun">{sample ? formatDeg(sample.sun.el) : '…'}</span>
              {data && <span className="metric-aside">now · max {formatDeg(data.summary.sun_max_el)}</span>}
            </div>
            <div className="metric-sub">A low Sun means long shadows and weaker light on flat panels.</div>
          </div>
          <div className="metric detail-metric">
            <div className="metric-label">Sunlit this lunar day</div>
            <div className="metric-row">
              <span className="metric-value">{stats ? `${(stats.sunHours / 24).toFixed(1)} d` : '…'}</span>
              {stats && <span className="metric-aside">of {LUNAR_DAY_DAYS.toFixed(1)} · {formatPct(stats.sunFraction)}</span>}
            </div>
            {stats && <div className="metric-sub">Longest dark stretch: {formatHours(stats.longestDarkHours)}</div>}
          </div>
          <div className="metric detail-metric">
            <div className="metric-label">Earth in view (direct radio contact)</div>
            <div className="metric-row">
              <span className="metric-value tone-earth">{stats ? `${(stats.earthHours / 24).toFixed(1)} d` : '…'}</span>
              {stats && <span className="metric-aside">of {LUNAR_DAY_DAYS.toFixed(1)} · {formatPct(stats.earthFraction)}</span>}
            </div>
            {stats && <div className="metric-sub">Longest comms gap: {formatHours(stats.longestGapHours)}</div>}
          </div>
          <div className="metric detail-metric metric-strong">
            <div className="metric-label">Operations window (Sun and Earth both up)</div>
            <div className="metric-row">
              <span className="metric-value">{stats ? `${(stats.bothHours / 24).toFixed(1)} d` : '…'}</span>
              {stats && <span className="metric-aside">{formatPct(stats.bothHours / stats.totalHours)} of the lunar day</span>}
            </div>
            <MissionVerdict />
          </div>
        </aside>
      </div>

      <section className="s-card" aria-label="Lunar day timeline">
        <div className="card-head">
          <h2>Timeline across the lunar day</h2>
          <button type="button" className="btn btn-outline" disabled={!samples.length} onClick={() => toggle(lo)}>
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? 'Pause' : 'Play animation'}
          </button>
          <button type="button" className="btn btn-outline" aria-pressed={!!view} disabled={!samples.length} onClick={toggleZoom}>
            {view ? <ZoomOut size={16} aria-hidden /> : <ZoomIn size={16} aria-hidden />}
            {view ? 'Show whole lunar day' : `Zoom to ${ZOOM_DAYS} days`}
          </button>
        </div>
        <div className="detail-bars">
          <VisibilityBars
            samples={samples}
            timeIndex={timeIndex}
            rangeStart={range.start}
            rows={DETAIL_ROWS}
            view={view ?? undefined}
            caption="The black line is the selected moment. Drag the slider or press Play to move it; the horizon view follows."
          />
          <div className="vis-row">
            <span className="vis-label" aria-hidden />
            <input
              type="range"
              className="scrub"
              aria-label="Selected moment"
              min={lo}
              max={hi}
              value={Math.min(Math.max(timeIndex, lo), hi)}
              disabled={!samples.length}
              onChange={(e) => setTimeIndex(Number(e.target.value))}
              aria-valuetext={sample ? formatUtc(sample.time) : undefined}
            />
          </div>
        </div>
      </section>

      <LandingDateChart />
      <NearbySpots />
    </div>
  )
}

export function CountdownChip({ body, samples, timeIndex, now }: { body: Body; samples: Sample[]; timeIndex: number; now: Sample }) {
  const up = now[body].visible
  const next = nextCrossing(samples, timeIndex, body, up ? 'set' : 'rise')
  const name = body === 'sun' ? (up ? 'Sunset' : 'Sunrise') : up ? 'Earthset' : 'Earthrise'
  return (
    <span className={`count-chip chip-${body}`}>
      {next ? `${name} in ${formatCountdown(Date.parse(next) - Date.parse(now.time))}` : `No ${name.toLowerCase()} this lunar day`}
    </span>
  )
}
