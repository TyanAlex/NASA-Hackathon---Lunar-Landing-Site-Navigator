import { Check, Download, Info, Pause, Play, Plus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { EphemerisResponse } from '../../api/types'
import { MethodNote } from '../../components/metrics/MethodNote'
import { pageHref } from '../../hooks/useHashRoute'
import { usePlayback } from '../../hooks/usePlayback'
import { useSites } from '../../hooks/useSites'
import { OPS_ROW, type BarRow } from '../../lib/barRows'
import { formatLatLon } from '../../lib/coords'
import { downloadCsv, slug } from '../../lib/csv'
import { formatDeg, formatPct, formatUtc, toIsoMinute } from '../../lib/format'
import { lunarDayRange } from '../../lib/lunar'
import { missionColumnLabel, missionCounts, missionSampleCount, missionScopeLabel, missionStats, missionWindowDays } from '../../lib/mission'
import { MAX_COMPARE, type Place } from '../../lib/places'
import { discFraction, formatHours, fullSun, windowStats, type WindowStats } from '../../lib/stats'
import { timeSeriesRows, windowCounts, windowList, type WindowCounts, type WindowType } from '../../lib/windows'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { HorizonPanorama } from '../simple/HorizonPanorama'
import { NearbySpots } from '../simple/NearbySpots'
import { CountdownChip } from '../simple/SiteDetail'
import { MissionPicker } from '../simple/MissionPicker'
import { MissionVerdict } from '../simple/MissionVerdict'
import { VisibilityBars } from '../simple/VisibilityBars'
import { DetailedLandingChart } from './DetailedLandingChart'
import '../simple/simple.css'
import '../simple/siteDetail.css'
import './detailedPages.css'

const ROWS: BarRow[] = [
  { key: 'sun', label: 'Sun above horizon', cls: 'seg-sun', pred: (s) => s.sun.visible },
  { key: 'earth', label: 'Earth above horizon', cls: 'seg-earth', pred: (s) => s.earth.visible },
  { ...OPS_ROW, label: 'Both up (ops)' },
]

const ZOOMS = [
  { key: 'all', label: '29.5 days', days: 0, speed: 24 },
  { key: '3d', label: '3 days', days: 3, speed: 3 },
  { key: '24h', label: '24 hours', days: 1, speed: 1 },
] as const
type ZoomKey = (typeof ZOOMS)[number]['key']

const TYPE_LABEL: Record<WindowType, string> = { sun: 'Sun up', earth: 'Earth up', both: 'Both up' }

function regionName(lat: number, lon: number) {
  if (lat <= -75) return 'South polar region'
  if (lat >= 75) return 'North polar region'
  return Math.abs(lon) <= 90 ? 'Near side' : 'Far side'
}

interface Props {
  tray: Place[]
  onToggleTray: (p: Place) => void
  /** Add places to the compare tray and open Compare; false if the tray is too full. */
  onCompare: (places: Place[]) => boolean
}

/** Detailed Site detail: every number behind the Simple page, with exact times, exports and adjustable views. */
export function SiteDetailDetailed({ tray, onToggleTray, onCompare }: Props) {
  const { location, ephemeris, horizon, range, setRange, timeIndex, setTimeIndex, setPlaying, missionType } = useMission()
  const sample = useCurrentSample()
  const { data: sites } = useSites()
  const data = ephemeris.data
  const samples = useMemo(() => data?.samples ?? [], [data])
  // Two scopes: the mission window from landing (judging numbers) and the whole lunar day (context).
  const cols = useMemo(() => {
    if (!data) return null
    const lunar = { label: 'Lunar day', stats: windowStats(data), counts: windowCounts(data.samples, data.step_minutes) }
    if (missionWindowDays(missionType) === null) return [lunar]
    return [{ label: missionColumnLabel(missionType), stats: missionStats(data, missionType), counts: missionCounts(data, missionType) }, lunar]
  }, [data, missionType])
  const sameScope = missionWindowDays(missionType) === null
  const colLabel = missionColumnLabel(missionType)
  const windows = useMemo(() => (data ? windowList(data.samples, data.step_minutes) : []), [data])
  const [showTracks, setShowTracks] = useState(true)
  const [trueScale, setTrueScale] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [windowFilter, setWindowFilter] = useState<WindowType | 'all'>('all')
  const [zoomState, setZoomState] = useState<{ data: EphemerisResponse; key: ZoomKey; view: [number, number] } | null>(null)
  const id = useId()

  const zoom = zoomState && zoomState.data === data ? zoomState : null
  const zoomDef = ZOOMS.find((z) => z.key === (zoom?.key ?? 'all'))!
  const view = zoom?.view ?? null
  const { playing, toggle } = usePlayback(zoomDef.speed, view?.[1])

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
  const place: Place = { id: location.siteId ?? `point-${location.lat.toFixed(4)},${location.lon.toFixed(4)}`, name: location.name, lat: location.lat, lon: location.lon }
  const inTray = tray.some((t) => t.id === place.id)
  const spanDays = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000
  const dayNow = sample ? (Date.parse(sample.time) - Date.parse(range.start)) / 86_400_000 : null

  const setStart = (date: string, time: string) => {
    const iso = `${date}T${time}:00Z`
    const year = Number(date.slice(0, 4))
    if (!date || !time || Number.isNaN(Date.parse(iso)) || year < 1900 || year > 2200) return
    setPlaying(false)
    setRange(lunarDayRange(toIsoMinute(new Date(iso))))
    setTimeIndex(0)
  }

  const setZoom = (key: ZoomKey) => {
    if (!data || key === 'all') return setZoomState(null)
    const n = samples.length
    const width = Math.round((ZOOMS.find((z) => z.key === key)!.days * 24 * 60) / data.step_minutes)
    const i0 = Math.max(0, Math.min(timeIndex - Math.round(width / 2), n - 1 - width))
    setZoomState({ data, key, view: [i0, Math.min(n - 1, i0 + width)] })
  }

  const [lo, hi] = view ?? [0, Math.max(samples.length - 1, 0)]
  const shownWindows = windowFilter === 'all' ? windows : windows.filter((w) => w.type === windowFilter)

  const exportSeries = () =>
    data && downloadCsv(`${slug(location.name)}-${range.start.slice(0, 10)}-timeseries.csv`, timeSeriesRows(data.samples))
  const exportWindows = () =>
    downloadCsv(`${slug(location.name)}-${range.start.slice(0, 10)}-windows.csv`, [
      ['type', 'start_utc', 'end_utc', 'hours', 'peak_elevation_deg', 'open_at_start', 'open_at_end'],
      ...windows.map((w) => [w.type, w.start, w.end, w.hours, w.peakEl === null ? '' : +w.peakEl.toFixed(2), w.openStart ? 1 : 0, w.openEnd ? 1 : 0]),
    ])

  return (
    <div className="detail-page detailed-page">
      <div className="detail-head">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href={pageHref('explore')}>Explorer</a> / <span aria-current="page">{location.name}</span>
          </nav>
          <h1 className="detail-title">{location.name}</h1>
          <p className="summary-meta mono-ish">
            {formatLatLon(location.lat, location.lon)} · {regionName(location.lat, location.lon)}
            {horizon.data && <> · ground {horizon.data.ground_height_m >= 0 ? '+' : ''}{Math.round(horizon.data.ground_height_m).toLocaleString()} m</>}
            {site && <> · {site.program}</>}
            {dayNow !== null && <> · day {dayNow.toFixed(2)} of {spanDays.toFixed(1)}</>}
          </p>
        </div>
        <div className="detail-head-actions">
          <div className="field">
            <label htmlFor={`${id}-date`}>Start date (UTC)</label>
            <input id={`${id}-date`} type="date" value={range.start.slice(0, 10)} onChange={(e) => setStart(e.target.value, range.start.slice(11, 16))} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-time`}>Time (UTC)</label>
            <input id={`${id}-time`} type="time" value={range.start.slice(11, 16)} onChange={(e) => setStart(range.start.slice(0, 10), e.target.value)} />
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
            <label className="check"><input type="checkbox" checked={showTracks} onChange={(e) => setShowTracks(e.target.checked)} /> Paths</label>
            <label className="check"><input type="checkbox" checked={trueScale} onChange={(e) => setTrueScale(e.target.checked)} /> True disc size</label>
            {sample && <CountdownChip body="sun" samples={samples} timeIndex={timeIndex} now={sample} />}
            {sample && <CountdownChip body="earth" samples={samples} timeIndex={timeIndex} now={sample} />}
            <button type="button" className="info-btn" aria-label="How these numbers are calculated" aria-expanded={infoOpen} aria-controls={`${id}-method`} onClick={() => setInfoOpen(!infoOpen)}>
              <Info size={16} />
            </button>
          </div>
          {infoOpen && data && <MethodNote id={`${id}-method`} stepMinutes={data.step_minutes} />}
          <HorizonPanorama samples={samples} timeIndex={timeIndex} horizon={horizon.data} showTracks={showTracks} discMode={trueScale ? 'true' : 'ratio'} readout />
          <ul className="pano-legend">
            <li><span className="key-disc key-sun" aria-hidden /> Sun (about 0.53° wide)</li>
            <li><span className="key-disc key-earth" aria-hidden /> Earth (about 1.9° wide)</li>
            <li><span className="key-terrain" aria-hidden /> Terrain horizon (LRO LOLA)</li>
          </ul>
          <p className="muted small">
            {trueScale ? 'Discs at true angular size.' : 'Discs enlarged for visibility; Earth stays about 3.6 times wider than the Sun.'} The dot marks each disc’s center. Hover to read azimuth and elevation.
          </p>

          {sample && (
            <div className="table-scroll">
              <table className="data-table">
                <caption>At the selected moment · {formatUtc(sample.time)}</caption>
                <thead>
                  <tr>
                    <th scope="col">Body</th>
                    <th scope="col" className="num">Azimuth</th>
                    <th scope="col" className="num">Elevation (center)</th>
                    <th scope="col" className="num">Terrain horizon that way</th>
                    <th scope="col" className="num">Margin</th>
                    <th scope="col" className="num">Disc visible</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(['sun', 'earth'] as const).map((b) => {
                    const p = sample[b]
                    const margin = p.el - p.horizon_el
                    return (
                      <tr key={b}>
                        <th scope="row" className={`seg-${b}-text`}>{b === 'sun' ? 'Sun' : 'Earth'}</th>
                        <td className="num">{formatDeg(p.az)}</td>
                        <td className="num">{p.el.toFixed(2)}°</td>
                        <td className="num">{p.horizon_el.toFixed(2)}°</td>
                        <td className="num">{margin >= 0 ? '+' : ''}{margin.toFixed(2)}°</td>
                        <td className="num">{formatPct(discFraction(b, p))}</td>
                        <td><span className={`status-pill ${p.visible ? 'up' : 'down'}`}>{p.visible ? 'Up' : 'Down'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="detail-metrics" aria-label="Metrics">
          <div className="scope-head">
            <MissionPicker />
            <span className="muted small">{sameScope ? 'Over the lunar day after landing.' : `${colLabel} = ${missionScopeLabel(missionType).replace(/^Over /, '')}. Lunar day = the whole cycle, for context.`}</span>
          </div>
          <MetricGroup
            title="Sun (power)"
            tone="sun"
            cols={cols}
            now={sample ? formatDeg(sample.sun.el) : null}
            rows={[
              { label: 'Sunlit', v: (st) => `${formatHours(st.sunHours)} (${formatPct(st.sunFraction)})` },
              { label: 'Full Sun (whole disc)', v: (st) => formatHours(st.fullSunHours) },
              { label: 'Max / min elevation', v: (st) => `${formatDeg(st.sunMaxEl)} / ${formatDeg(st.sunMinEl)}` },
              { label: 'Sunsets', v: (_, c) => String(c.sunsets) },
              { label: 'Longest dark', v: (st) => formatHours(st.longestDarkHours) },
              { label: 'Shortest dark', v: (_, c) => (c.shortestDarkHours === null ? '—' : formatHours(c.shortestDarkHours)) },
            ]}
          />
          <MetricGroup
            title="Earth (comms)"
            tone="earth"
            cols={cols}
            now={sample ? formatDeg(sample.earth.el) : null}
            rows={[
              { label: 'Visible', v: (st) => `${formatHours(st.earthHours)} (${formatPct(st.earthFraction)})` },
              { label: 'Contact windows', v: (_, c) => String(c.earthWindows) },
              { label: 'Longest window', v: (_, c) => formatHours(c.longestEarthWindowHours) },
              { label: 'Longest comms gap', v: (st) => formatHours(st.longestGapHours) },
            ]}
          />
          <div className="metric detail-metric metric-strong">
            <MetricGroup
              bare
              title="Operations (both up)"
              cols={cols}
              rows={[
                { label: 'Total', v: (st) => `${formatHours(st.bothHours)} (${formatPct(st.bothHours / Math.max(st.totalHours, 1))})` },
                { label: 'Windows', v: (_, c) => String(c.opsWindows) },
                { label: 'Longest window', v: (_, c) => formatHours(c.longestOpsWindowHours) },
              ]}
            />
            <MissionVerdict showRules hidePicker />
          </div>
        </aside>
      </div>

      <section className="s-card" aria-label="Lunar day timeline">
        <div className="card-head">
          <h2>Timeline across the lunar day</h2>
          <div className="segmented" role="group" aria-label="Time span shown">
            {ZOOMS.map((z) => (
              <button key={z.key} type="button" aria-pressed={zoomDef.key === z.key} disabled={!samples.length} onClick={() => setZoom(z.key)}>{z.label}</button>
            ))}
          </div>
          <button type="button" className="btn btn-outline" disabled={!samples.length} onClick={() => toggle(lo)}>
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="btn btn-outline" disabled={!data} onClick={exportSeries}><Download size={16} aria-hidden /> Time series CSV</button>
        </div>
        <div className="detail-bars">
          <VisibilityBars
            samples={samples}
            timeIndex={timeIndex}
            rangeStart={range.start}
            rows={ROWS}
            view={view ?? undefined}
            missionEnd={data ? missionSampleCount(data, missionType) : undefined}
            caption={sample ? `Selected moment: ${formatUtc(sample.time)}${fullSun(sample) ? ' · full Sun' : ''}. Exact start and end times are in the window list below.` : undefined}
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

      <section className="s-card" aria-label="Window list">
        <div className="card-head">
          <h2>Window list for this lunar day</h2>
          <div className="segmented" role="group" aria-label="Filter windows">
            {(['all', 'sun', 'earth', 'both'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={windowFilter === f} onClick={() => setWindowFilter(f)}>{f === 'all' ? 'All' : TYPE_LABEL[f]}</button>
            ))}
          </div>
          <button type="button" className="btn btn-outline" disabled={!windows.length} onClick={exportWindows}><Download size={16} aria-hidden /> CSV</button>
        </div>
        <div className="table-scroll window-table">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Start (UTC)</th>
                <th scope="col">End (UTC)</th>
                <th scope="col" className="num">Duration</th>
                <th scope="col" className="num">Peak elevation</th>
                <th scope="col"><span className="sr-only">Jump</span></th>
              </tr>
            </thead>
            <tbody>
              {shownWindows.map((w) => (
                <tr key={`${w.type}-${w.start}`}>
                  <th scope="row" className={w.type === 'both' ? undefined : `seg-${w.type}-text`}>{TYPE_LABEL[w.type]}</th>
                  <td className="mono">{w.openStart ? 'before window' : formatUtc(w.start)}</td>
                  <td className="mono">{w.openEnd ? 'after window' : formatUtc(w.end)}</td>
                  <td className="num">{w.openStart || w.openEnd ? '≥ ' : ''}{formatHours(w.hours)}</td>
                  <td className="num">{w.peakEl === null ? '—' : `${w.peakEl.toFixed(1)}°`}</td>
                  <td>
                    <button
                      type="button"
                      className="link-like"
                      onClick={() => {
                        setPlaying(false)
                        setZoomState(null)
                        setTimeIndex(Math.max(0, samples.findIndex((s) => s.time >= w.start)))
                      }}
                    >
                      Jump to start
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shownWindows.length && <p className="muted small">{data ? 'No windows of this type in this lunar day.' : 'Loading…'}</p>}
        </div>
        <p className="muted small">Times are to the {data?.step_minutes ?? 60}-minute sample step. Windows touching the edge of the lunar day are cut off there (≥).</p>
      </section>

      {/* Remount on mission-type change so the chart's mission length follows it. */}
      <DetailedLandingChart key={missionType} />
      <NearbySpots detailed onCompare={onCompare} />
    </div>
  )
}

interface GroupRow {
  label: string
  v: (st: WindowStats, c: WindowCounts) => string
}

/** A metric group as a small table: one value column per scope (mission window, lunar day). */
function MetricGroup({ title, tone, cols, rows, now, bare = false }: {
  title: string
  tone?: 'sun' | 'earth'
  cols: { label: string; stats: WindowStats; counts: WindowCounts }[] | null
  rows: GroupRow[]
  now?: string | null
  bare?: boolean
}) {
  const body = (
    <>
      <h3 className={`group-title${tone ? ` tone-${tone}` : ''}`}>{title}</h3>
      {now !== undefined && <p className="kv-now">Elevation now <strong>{now ?? '…'}</strong></p>}
      {cols ? (
        <table className="kv-table">
          {cols.length > 1 && (
            <thead><tr><th scope="col"><span className="sr-only">Metric</span></th>{cols.map((c) => <th key={c.label} scope="col">{c.label}</th>)}</tr></thead>
          )}
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {cols.map((c) => <td key={c.label}>{r.v(c.stats, c.counts)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">…</p>}
    </>
  )
  return bare ? body : <div className="metric detail-metric">{body}</div>
}
