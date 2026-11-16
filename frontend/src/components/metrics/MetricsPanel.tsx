import { AlertTriangle, Bookmark, Check, Earth, Info, Plus, Sun, X } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import type { EphemerisResponse, Sample, Site } from '../../api/types'
import { formatLatLon } from '../../lib/coords'
import { nextCrossing, type Body } from '../../lib/crossings'
import { formatDeg, formatPct } from '../../lib/format'
import { isLunarDayRange } from '../../lib/lunar'
import { MAX_COMPARE } from '../../lib/places'
import { discFraction, formatHours, windowStats, type WindowStats } from '../../lib/stats'
import { missionColumnLabel, missionStats, missionWindowDays } from '../../lib/mission'
import type { MissionType } from '../../lib/verdict'
import { MissionPicker } from '../../views/simple/MissionPicker'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { SkyView } from '../sky/SkyView'
import { DateRangePicker } from '../time/DateRangePicker'
import { Countdown } from './Countdown'
import { MethodNote } from './MethodNote'

interface Props {
  site: Site | undefined
  onClose: () => void
  inTray: boolean
  trayCount: number
  onToggleTray: () => void
  /** Present when the selection is an unsaved point (dropped pin / typed coordinates). */
  onSave?: (name: string) => void
}

export function MetricsPanel({ site, onClose, inTray, trayCount, onToggleTray, onSave }: Props) {
  const { location, ephemeris, horizon, timeIndex, range, missionType } = useMission()
  const sample = useCurrentSample()
  const summary = ephemeris.data?.summary

  if (!location) return null

  const dayNow = sample ? (Date.parse(sample.time) - Date.parse(range.start)) / 86_400_000 : null
  const spanDays = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000
  const windowName = isLunarDayRange(range) ? 'lunar day' : 'window'

  return (
    <section className="place card" aria-label="Selected location">
      <header className="place-header">
        <div>
          <h2>{location.name}</h2>
          <p className="place-sub">
            {site ? `${site.program} · ` : ''}
            <span className="mono">{formatLatLon(location.lat, location.lon)}</span>
            {horizon.data && (
              <span className="mono"> · {horizon.data.ground_height_m >= 0 ? '+' : ''}{Math.round(horizon.data.ground_height_m).toLocaleString()} m</span>
            )}
            {dayNow !== null && <> · day <span className="mono">{dayNow.toFixed(1)}</span> of {spanDays.toFixed(1)}</>}
          </p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}><X size={18} /></button>
      </header>

      <div className="place-actions">
        <button
          type="button"
          className={`pill-btn${inTray ? ' on' : ''}`}
          aria-pressed={inTray}
          disabled={!inTray && trayCount >= MAX_COMPARE}
          title={!inTray && trayCount >= MAX_COMPARE ? `Compare holds up to ${MAX_COMPARE} sites` : undefined}
          onClick={onToggleTray}
        >
          {inTray ? <Check size={14} /> : <Plus size={14} />} {inTray ? 'In compare' : 'Add to compare'}
        </button>
        {onSave && <SavePlace onSave={onSave} />}
      </div>

      {site?.approximate && (
        <p className="note warn"><AlertTriangle size={14} /> Approximate coordinates — verify in Quickmap before relying on them.</p>
      )}
      {site?.notes && <p className="note">{site.notes}</p>}

      {ephemeris.loading && <p className="muted">Computing ephemeris…</p>}
      {ephemeris.error && <p className="error">{ephemeris.error}</p>}

      {sample && (
        <div className="status-row">
          <StatusChip ok={sample.sun.visible} icon={<Sun size={14} />} on="Sunlit · power" off="In shadow" />
          <StatusChip ok={sample.earth.visible} icon={<Earth size={14} />} on="Earth in view · DTE" off="No direct-to-Earth" />
        </div>
      )}

      {/* Always mounted (see SkyView) */}
      <div className="sky-inset" aria-label="Sky as seen from the surface">
        <SkyView />
        <span className="sky-caption">View from surface</span>
      </div>

      {sample && summary && ephemeris.data && (
        <>
          <BodyBlock
            body="sun"
            title="Sun"
            icon={<Sun size={16} color="var(--sun)" />}
            sample={sample}
            samples={ephemeris.data.samples}
            timeIndex={timeIndex}
            maxEl={summary.sun_max_el}
            fraction={summary.sun_visible_fraction}
            fractionLabel={`Time lit (${windowName})`}
            rise="Sunrise in"
            set="Sunset in"
          />
          <BodyBlock
            body="earth"
            title="Earth"
            icon={<Earth size={16} color="var(--earth)" />}
            sample={sample}
            samples={ephemeris.data.samples}
            timeIndex={timeIndex}
            maxEl={summary.earth_max_el}
            fraction={summary.earth_visible_fraction}
            fractionLabel={`Time visible (${windowName})`}
            rise="Earthrise in"
            set="Earthset in"
          />
        </>
      )}

      {ephemeris.data && <WindowBlock data={ephemeris.data} windowName={windowName} missionType={missionType} />}

      <details className="window">
        <summary>Mission window</summary>
        <DateRangePicker />
      </details>
    </section>
  )
}

function WindowBlock({ data, windowName, missionType }: { data: EphemerisResponse; windowName: string; missionType: MissionType }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  // Mission window from the start of the date range, next to the whole range (usually one lunar day).
  const cols = useMemo(() => {
    const whole = { label: windowName === 'lunar day' ? 'Lunar day' : 'Window', st: windowStats(data) }
    return missionWindowDays(missionType) === null ? [whole] : [{ label: missionColumnLabel(missionType), st: missionStats(data, missionType) }, whole]
  }, [data, windowName, missionType])
  const rows: { label: string; v: (st: WindowStats) => string }[] = [
    { label: 'Sunlit', v: (st) => `${formatPct(st.sunFraction)} · ${formatHours(st.sunHours)}` },
    { label: 'Full Sun (whole disc)', v: (st) => formatHours(st.fullSunHours) },
    { label: 'Longest dark', v: (st) => formatHours(st.longestDarkHours) },
    { label: 'Earth visible', v: (st) => `${formatPct(st.earthFraction)} · ${formatHours(st.earthHours)}` },
    { label: 'Longest comms gap', v: (st) => formatHours(st.longestGapHours) },
    { label: 'Ops (both up)', v: (st) => formatHours(st.bothHours) },
    { label: 'Sun min / max', v: (st) => `${formatDeg(st.sunMinEl)} / ${formatDeg(st.sunMaxEl)}` },
  ]
  return (
    <div className="body-block">
      <h3>
        After landing
        <button
          type="button"
          className="info-btn"
          aria-label="How these numbers are calculated"
          aria-expanded={infoOpen}
          aria-controls={infoId}
          onClick={() => setInfoOpen(!infoOpen)}
        >
          <Info size={15} />
        </button>
      </h3>
      <MissionPicker className="panel-mission" />
      {infoOpen && <MethodNote id={infoId} stepMinutes={data.step_minutes} />}
      <table className="panel-cols">
        <thead>
          <tr><th scope="col"><span className="sr-only">Metric</span></th>{cols.map((c) => <th key={c.label} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}><th scope="row">{r.label}</th>{cols.map((c) => <td key={c.label}>{r.v(c.st)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SavePlace({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const id = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim())
    setOpen(false)
    setName('')
  }
  if (!open) {
    return (
      <button type="button" className="pill-btn" onClick={() => setOpen(true)}>
        <Bookmark size={14} /> Save this location
      </button>
    )
  }
  return (
    <form className="save-place" onSubmit={submit}>
      <label htmlFor={id} className="sr-only">Name for this location</label>
      <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this site" autoFocus />
      <button type="submit" className="pill-btn on" disabled={!name.trim()}>Save</button>
      <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => setOpen(false)}><X size={16} /></button>
    </form>
  )
}

function StatusChip({ ok, icon, on, off }: { ok: boolean; icon: React.ReactNode; on: string; off: string }) {
  return <span className={`chip ${ok ? 'ok' : 'bad'}`}>{icon}{ok ? on : off}</span>
}

interface BodyBlockProps {
  body: Body
  title: string
  icon: React.ReactNode
  sample: Sample
  samples: Sample[]
  timeIndex: number
  maxEl: number
  fraction: number
  fractionLabel: string
  rise: string
  set: string
}

function BodyBlock({ body, title, icon, sample, samples, timeIndex, maxEl, fraction, fractionLabel, rise, set }: BodyBlockProps) {
  const pos = sample[body]
  // Countdown to the next change of state from the scrubbed time.
  const next = useMemo(
    () => nextCrossing(samples, timeIndex, body, pos.visible ? 'set' : 'rise'),
    [samples, timeIndex, body, pos.visible],
  )

  return (
    <div className="body-block">
      <h3>{icon}{title}</h3>
      <dl>
        <dt>Elevation</dt><dd>{formatDeg(pos.el)}</dd>
        <dt>Azimuth</dt><dd>{formatDeg(pos.az)}</dd>
        <dt>Terrain horizon that way</dt><dd>{formatDeg(pos.horizon_el)}</dd>
        <dt>Disc visible now</dt><dd>{formatPct(discFraction(body, pos))}</dd>
        <dt>Max elevation</dt><dd>{formatDeg(maxEl)}</dd>
        <dt>{fractionLabel}</dt><dd>{formatPct(fraction)}</dd>
      </dl>
      <Countdown label={pos.visible ? set : rise} from={sample.time} to={next} />
    </div>
  )
}
