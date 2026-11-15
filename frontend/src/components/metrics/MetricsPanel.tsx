import { AlertTriangle, Earth, Sun, X } from 'lucide-react'
import { useMemo } from 'react'
import type { Sample, Site } from '../../api/types'
import { formatLatLon } from '../../lib/coords'
import { nextCrossing, type Body } from '../../lib/crossings'
import { formatDeg, formatPct } from '../../lib/format'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { SkyView } from '../sky/SkyView'
import { DateRangePicker } from '../time/DateRangePicker'
import { Countdown } from './Countdown'

interface Props {
  site: Site | undefined
  onClose: () => void
}

export function MetricsPanel({ site, onClose }: Props) {
  const { location, ephemeris, horizon, timeIndex } = useMission()
  const sample = useCurrentSample()
  const summary = ephemeris.data?.summary

  if (!location) return null

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
          </p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}><X size={18} /></button>
      </header>

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
            fractionLabel="Time lit (window)"
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
            fractionLabel="Time visible (window)"
            rise="Earthrise in"
            set="Earthset in"
          />
        </>
      )}

      <details className="window">
        <summary>Mission window</summary>
        <DateRangePicker />
      </details>
    </section>
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
        <dt>Max elevation</dt><dd>{formatDeg(maxEl)}</dd>
        <dt>{fractionLabel}</dt><dd>{formatPct(fraction)}</dd>
      </dl>
      <Countdown label={pos.visible ? set : rise} from={sample.time} to={next} />
    </div>
  )
}
