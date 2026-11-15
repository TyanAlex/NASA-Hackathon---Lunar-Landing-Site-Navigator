import { Html } from '@react-three/drei'
import { azelToVector } from '../../lib/azel'

const CARDINALS: [string, number][] = [['N', 0], ['E', 90], ['S', 180], ['W', 270]]

/** Flat ground disc + the 0° local-horizontal ring (the terrain horizon is drawn by TerrainSilhouette). */
export function HorizonRing({ radius }: { radius: number }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial color="#3a3a3f" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[radius * 0.99, radius, 128]} />
        <meshBasicMaterial color="#888" />
      </mesh>
      {CARDINALS.map(([label, az]) => (
        <Html key={label} position={azelToVector(az, 0, radius * 1.08)} center>
          <span className="cardinal">{label}</span>
        </Html>
      ))}
    </group>
  )
}
