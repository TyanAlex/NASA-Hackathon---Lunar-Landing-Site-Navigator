import { Vector3 } from 'three'

const DEG = Math.PI / 180

/**
 * Az/el → point on a sky dome of given radius.
 * Scene convention: +Y up, -Z north, +X east (az measured clockwise from north).
 */
export function azelToVector(azDeg: number, elDeg: number, radius = 1): Vector3 {
  const az = azDeg * DEG
  const el = elDeg * DEG
  return new Vector3(
    radius * Math.cos(el) * Math.sin(az),
    radius * Math.sin(el),
    -radius * Math.cos(el) * Math.cos(az),
  )
}
