import { useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import type { HorizonResponse } from '../../api/types'
import { azelToVector } from '../../lib/azel'

/** Terrain horizon from the LOLA profile, drawn as a band on the sky dome. */
export function TerrainSilhouette({ horizon, radius }: { horizon: HorizonResponse; radius: number }) {
  const geometry = useMemo(() => {
    const base = Math.min(...horizon.el, 0) - 1
    const pos: number[] = []
    const idx: number[] = []
    const n = horizon.az.length
    for (let i = 0; i <= n; i++) {
      const k = i % n
      const top = azelToVector(horizon.az[k], horizon.el[k], radius * 0.995)
      const bottom = azelToVector(horizon.az[k], base, radius * 0.995)
      pos.push(top.x, top.y, top.z, bottom.x, bottom.y, bottom.z)
      if (i < n) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    return g
  }, [horizon, radius])

  const ridge = useMemo(
    () => new BufferGeometry().setFromPoints([...horizon.az, horizon.az[0]].map((az, i) => azelToVector(az, horizon.el[i % horizon.el.length], radius * 0.996))),
    [horizon, radius],
  )

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#4a4d55" side={DoubleSide} />
      </mesh>
      <line>
        <primitive object={ridge} attach="geometry" />
        <lineBasicMaterial color="#c9ced8" />
      </line>
    </group>
  )
}
