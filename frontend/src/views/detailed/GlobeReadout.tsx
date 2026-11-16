import { dirToLatLon, formatLatLon } from '../../lib/coords'
import { formatDeg } from '../../lib/format'
import { phaseAngleDeg } from '../../lib/stats'
import { useCurrentSample } from '../../state/MissionContext'

/** Sun/Earth geometry at the selected moment, for the whole Moon (not the selected site). */
export function GlobeReadout() {
  const sample = useCurrentSample()
  if (!sample) return null
  const ss = dirToLatLon(sample.sun.dir)
  const se = dirToLatLon(sample.earth.dir)
  return (
    <section className="readout card" aria-label="Sun and Earth geometry">
      <dl>
        <dt><span className="dot-sm sun" aria-hidden /> Sub-solar point</dt>
        <dd className="mono">{formatLatLon(ss.lat, ss.lon)}</dd>
        <dt><span className="dot-sm earth" aria-hidden /> Sub-Earth point</dt>
        <dd className="mono">{formatLatLon(se.lat, se.lon)}</dd>
        <dt>Libration (lon, lat)</dt>
        <dd className="mono">{se.lon >= 0 ? '+' : ''}{se.lon.toFixed(2)}°, {se.lat >= 0 ? '+' : ''}{se.lat.toFixed(2)}°</dd>
        <dt>Sun–Moon–Earth angle</dt>
        <dd className="mono">{formatDeg(phaseAngleDeg(sample))}</dd>
      </dl>
    </section>
  )
}
