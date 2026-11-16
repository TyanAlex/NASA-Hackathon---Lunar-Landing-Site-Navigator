import { useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { HorizonResponse, Sample } from '../../api/types'
import type { Body } from '../../lib/crossings'
import { angularRadiusDeg } from '../../lib/stats'

// Drawing space (scaled to the card width by the viewBox).
const W = 1000
const H = 380
const L = 44 // left gutter for degree labels
const R = 12
const T = 14
const B = 30 // compass band
const PW = W - L - R
const PH = H - T - B

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
const MIN_DISC_PX = 8 // the Sun is only ~0.5° wide; keep it readable

interface Props {
  samples: Sample[]
  timeIndex: number
  horizon: HorizonResponse | null
  showTracks?: boolean
  /**
   * readable: each disc at least MIN_DISC_PX (Simple). ratio: both scaled up together so the Sun is readable
   * and Earth stays ~3.6× wider. true: real angular size.
   */
  discMode?: 'readable' | 'ratio' | 'true'
  /** Show azimuth / elevation / terrain height under the cursor. */
  readout?: boolean
}

/**
 * 360° panorama from the site: terrain skyline (LOLA), the Sun's and Earth's paths over the window, and both
 * discs at the selected moment. Discs are drawn at true angular size on the vertical axis (with a small
 * minimum), and the terrain is drawn over them, so a body half-hidden by a ridge looks half-hidden.
 */
export function HorizonPanorama({ samples, timeIndex, horizon, showTracks = true, discMode = 'readable', readout = false }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState<{ px: number; py: number } | null>(null)
  const clipId = useId()
  const now = samples[timeIndex]

  const scale = useMemo(() => {
    const terrain = horizon?.el ?? [0]
    const lo = Math.min(...terrain)
    const hi = Math.max(...terrain)
    // Show the sky up to the highest point either body reaches (capped at the zenith), plus some headroom.
    const peak = Math.max(...samples.flatMap((s) => [s.sun.el, s.earth.el]), hi)
    const ymin = Math.floor(Math.min(lo, 0) - 2)
    const ymax = Math.min(90, Math.ceil(Math.max(peak, hi + 4) + 3))
    const span = ymax - ymin
    const gridStep = span <= 16 ? 2 : span <= 40 ? 5 : 15
    return { ymin, ymax, gridStep }
  }, [samples, horizon])

  const x = (az: number) => L + (az / 360) * PW
  const y = (el: number) => T + ((scale.ymax - el) / (scale.ymax - scale.ymin)) * PH
  const pxPerDeg = PH / (scale.ymax - scale.ymin)

  const tracks = useMemo(() => {
    const path = (body: Body) => {
      let d = ''
      samples.forEach((s, i) => {
        const p = s[body]
        // Start a new segment where the path wraps around north (azimuth jumps 360→0).
        const wrap = i > 0 && Math.abs(p.az - samples[i - 1][body].az) > 180
        d += `${i === 0 || wrap ? 'M' : 'L'}${x(p.az).toFixed(1)},${y(p.el).toFixed(1)}`
      })
      return d
    }
    return { sun: path('sun'), earth: path('earth') }
    // x/y only depend on scale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, scale])

  const terrainPath = useMemo(() => {
    if (!horizon) return ''
    const pts = horizon.az.map((az, i) => `L${x(az).toFixed(1)},${y(horizon.el[i]).toFixed(1)}`).join('')
    return `M${x(0)},${H - B}${pts}L${x(360)},${y(horizon.el[0]).toFixed(1)}L${x(360)},${H - B}Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, scale])

  const gridLines: number[] = []
  for (let g = Math.ceil(scale.ymin / scale.gridStep) * scale.gridStep; g <= scale.ymax; g += scale.gridStep) gridLines.push(g)

  // In ratio mode, one factor scales both discs so the Sun reaches MIN_DISC_PX.
  const ratioK = now ? Math.max(1, MIN_DISC_PX / (angularRadiusDeg('sun', now.sun) * pxPerDeg)) : 1
  const disc = (body: Body) => {
    if (!now) return null
    const p = now[body]
    const trueR = angularRadiusDeg(body, p) * pxPerDeg
    const r = discMode === 'true' ? Math.max(1.5, trueR) : discMode === 'ratio' ? trueR * ratioK : Math.max(MIN_DISC_PX, trueR)
    return { cx: x(p.az), cy: y(p.el), r, p }
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = svgRef.current!.getBoundingClientRect()
    setCursor({ px: ((e.clientX - box.left) / box.width) * W, py: ((e.clientY - box.top) / box.height) * H })
  }
  const cur = cursor && {
    az: ((cursor.px - L) / PW) * 360,
    el: scale.ymax - ((cursor.py - T) / PH) * (scale.ymax - scale.ymin),
  }
  const terrainAt = (az: number) => {
    if (!horizon) return null
    const step = horizon.az[1] - horizon.az[0]
    return horizon.el[Math.round(((az % 360) + 360) % 360 / step) % horizon.el.length]
  }
  const sun = disc('sun')
  const earth = disc('earth')

  const describe = now
    ? `Sun ${now.sun.visible ? 'above' : 'below'} the horizon at azimuth ${Math.round(now.sun.az)}°, Earth ${now.earth.visible ? 'above' : 'below'} the horizon at azimuth ${Math.round(now.earth.az)}°.`
    : 'Loading.'

  return (
    <svg ref={svgRef} className="panorama" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Panorama of the horizon from the site. ${describe}`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={L} y={T} width={PW} height={PH} />
        </clipPath>
      </defs>

      <rect x={L} y={T} width={PW} height={PH} className="pano-sky" />
      {gridLines.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className={g === 0 ? 'pano-zero' : 'pano-grid'} />
          <text x={L - 6} y={y(g) + 4} className="pano-tick" textAnchor="end">{g}°</text>
        </g>
      ))}

      <g clipPath={`url(#${clipId})`}>
        {showTracks && <path d={tracks.earth} className="pano-track track-earth" />}
        {showTracks && <path d={tracks.sun} className="pano-track track-sun" />}
        {earth && <circle cx={earth.cx} cy={earth.cy} r={earth.r} className="pano-disc disc-earth" />}
        {sun && <circle cx={sun.cx} cy={sun.cy} r={sun.r} className="pano-disc disc-sun" />}
        {/* Terrain over the discs: whatever is behind the ridge is hidden, as it would be from the site. */}
        {terrainPath && <path d={terrainPath} className="pano-terrain" />}
        {/* Outlines on top so a hidden body's position is still visible; the dot marks the disc center. */}
        {[earth, sun].map((d, k) => d && (
          <g key={k} className={k ? 'mark-sun' : 'mark-earth'}>
            <circle cx={d.cx} cy={d.cy} r={d.r} className="pano-outline" />
            <circle cx={d.cx} cy={d.cy} r={1.8} className="pano-center" />
          </g>
        ))}
      </g>

      <rect x={L} y={H - B} width={PW} height={B} className="pano-band" />
      {COMPASS.map((c, i) => (
        <text key={i} x={x(i * 45)} y={H - B / 2 + 4} className="pano-compass" textAnchor={i === 0 ? 'start' : i === 8 ? 'end' : 'middle'}>{c}</text>
      ))}
      {readout && cur && (
        <g className="pano-readout" pointerEvents="none">
          <line x1={cursor!.px} x2={cursor!.px} y1={T} y2={T + PH} className="pano-cross" />
          <line x1={L} x2={W - R} y1={cursor!.py} y2={cursor!.py} className="pano-cross" />
          <rect x={L + 8} y={T + 8} width={330} height={24} rx={4} className="pano-readout-bg" />
          <text x={L + 16} y={T + 25} className="pano-readout-text">
            Az {cur.az.toFixed(1)}° · El {cur.el.toFixed(2)}° · terrain that way {terrainAt(cur.az)?.toFixed(2) ?? '—'}°
          </text>
        </g>
      )}
      {readout && (
        <rect x={L} y={T} width={PW} height={PH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setCursor(null)} />
      )}
      {!horizon && <text x={L + PW / 2} y={T + PH / 2} className="pano-tick" textAnchor="middle">Loading terrain…</text>}
    </svg>
  )
}
