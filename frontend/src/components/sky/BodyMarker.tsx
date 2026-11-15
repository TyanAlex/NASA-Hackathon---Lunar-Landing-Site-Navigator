import { Html, Line } from '@react-three/drei'
import type { BodyPosition } from '../../api/types'
import { azelToVector } from '../../lib/azel'

interface Props {
  label: string
  color: string
  position: BodyPosition
  radius: number
}

export function BodyMarker({ label, color, position, radius }: Props) {
  const p = azelToVector(position.az, position.el, radius)
  const opacity = position.visible ? 1 : 0.25

  return (
    <group>
      <Line points={[[0, 0, 0], p]} color={color} transparent opacity={opacity * 0.5} dashed dashSize={0.3} gapSize={0.2} />
      <mesh position={p}>
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <Html position={p} center style={{ pointerEvents: 'none', transform: 'translateY(-20px)' }}>
        <span className="body-label" style={{ color }}>{label}</span>
      </Html>
    </group>
  )
}
