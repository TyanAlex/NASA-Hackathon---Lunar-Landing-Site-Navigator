import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMission } from '../../state/MissionContext'

export function ElevationChart() {
  const { ephemeris, timeIndex } = useMission()

  const rows = useMemo(
    () =>
      ephemeris.data?.samples.map((s, i) => ({
        i,
        time: s.time.slice(5, 16).replace('T', ' '),
        sun: s.sun.el,
        earth: s.earth.el,
        terrain: s.sun.horizon_el,
      })) ?? [],
    [ephemeris.data],
  )

  if (ephemeris.loading) return <p>Computing ephemeris…</p>
  if (ephemeris.error) return <p className="error">{ephemeris.error}</p>
  if (!rows.length) return <p>Select a site to see Sun / Earth elevation.</p>

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeOpacity={0.15} />
        <XAxis dataKey="time" minTickGap={40} fontSize={11} />
        <YAxis unit="°" fontSize={11} />
        <Tooltip />
        <ReferenceLine y={0} stroke="#888" />
        <ReferenceLine x={rows[timeIndex]?.time} stroke="#fff" strokeDasharray="3 3" />
        <Line dataKey="terrain" name="terrain (toward Sun)" stroke="#8a8f99" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        <Line dataKey="sun" stroke="#ffd54a" dot={false} isAnimationActive={false} />
        <Line dataKey="earth" stroke="#4aa8ff" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
