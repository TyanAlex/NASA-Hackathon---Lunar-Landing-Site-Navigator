import { AlertTriangle, Bookmark, Check, Earth, Info, Plus, Sun, X } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import type { Sample, Site } from '../../api/types'
import { formatLatLon } from '../../lib/coords'
import { nextCrossing, type Body } from '../../lib/crossings'
import { formatDeg, formatPct } from '../../lib/format'
import { isLunarDayRange } from '../../lib/lunar'
import { MAX_COMPARE } from '../../lib/places'
import { discFraction, formatHours, windowStats } from '../../lib/stats'
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
  const { location, ephemeris, horizon, timeIndex, range } = useMission()
  const sample = useCurrentSample()
  const summary = ephemeris.data?.summary
  const stats = useMemo(() => (ephemeris.data ? windowStats(ephemeris.data) : null), [ephemeris.data])

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

      {stats && <WindowBlock stats={stats} windowName={windowName} stepMinutes={ephemeris.data!.step_minutes} />}

      <details className="window">
        <summary>Mission window</summary>
        <DateRangePicker />
      </details>
    </section>
  )
}

function WindowBlock({ stats, windowName, stepMinutes }: { stats: ReturnType<typeof windowStats>; windowName: string; stepMinutes: number }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  return (
    <div className="body-block">
      <h3>
        Over this {windowName}
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
      {infoOpen && <MethodNote id={infoId} stepMinutes={stepMinutes} />}
      <dl>
        <dt>Sunlit</dt><dd>{formatPct(stats.sunFraction)} · {formatHours(stats.sunHours)}</dd>
        <dt>Full Sun (whole disc clear)</dt><dd>{formatHours(stats.fullSunHours)}</dd>
        <dt>Longest dark period</dt><dd>{formatHours(stats.longestDarkHours)}</dd>
        <dt>Earth visible</dt><dd>{formatPct(stats.earthFraction)} · {formatHours(stats.earthHours)}</dd>
        <dt>Longest comms gap</dt><dd>{formatHours(stats.longestGapHours)}</dd>
        <dt>Ops window (both up)</dt><dd>{formatHours(stats.bothHours)}</dd>
        <dt>Sun elevation min / max</dt><dd>{formatDeg(stats.sunMinEl)} / {formatDeg(stats.sunMaxEl)}</dd>
      </dl>
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
