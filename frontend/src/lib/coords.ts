/** Unit vector (MOON_ME) → selenographic lat/lon in degrees. */
export function dirToLatLon([x, y, z]: readonly [number, number, number]) {
  return { lat: (Math.asin(z) * 180) / Math.PI, lon: (Math.atan2(y, x) * 180) / Math.PI }
}

/**
 * Parses "-89.5, 45", "89.5S 45E", "-89.5 222.7" → { lat, lon } with lon in [-180, 180].
 * Returns null if the text isn't a coordinate pair.
 */
export function parseLatLon(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i)
  if (!m) return null
  let lat = Number(m[1])
  let lon = Number(m[3])
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat)
  if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon)
  if (lon > 180) lon -= 360
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

export const formatLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(3)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(3)}°${lon < 0 ? 'W' : 'E'}`

const MOON_RADIUS_KM = 1737.4

/** Point `km` away from (lat, lon) along compass `bearingDeg` on the lunar sphere; handles crossing a pole. */
export function destinationPoint(lat: number, lon: number, km: number, bearingDeg: number) {
  const r = Math.PI / 180
  const d = km / MOON_RADIUS_KM
  const p1 = lat * r
  const t = bearingDeg * r
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t))
  const l2 = lon * r + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2))
  const lonDeg = ((((l2 / r + 180) % 360) + 360) % 360) - 180
  return { lat: p2 / r, lon: lonDeg }
}
