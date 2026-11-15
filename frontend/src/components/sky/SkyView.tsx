import { useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { BodyMarker } from './BodyMarker'
import { HorizonRing } from './HorizonRing'
import { TerrainSilhouette } from './TerrainSilhouette'

export const DOME_RADIUS = 10

export function SkyView() {
  const current = useCurrentSample()
  const { horizon } = useMission()
  // Hold the last sample while new data loads: unmounting drei <Html> labels mid-render breaks React.
  const [sample, setSample] = useState(current)
  if (current && current !== sample) setSample(current)

  return (
    <Canvas camera={{ position: [0, 14, 14], fov: 50 }} style={{ background: '#05060a' }}>
      <ambientLight intensity={0.3} />
      <HorizonRing radius={DOME_RADIUS} />
      {horizon.data && <TerrainSilhouette horizon={horizon.data} radius={DOME_RADIUS} />}
      {sample && (
        <>
          <BodyMarker label="Sun" color="#ffd54a" position={sample.sun} radius={DOME_RADIUS} />
          <BodyMarker label="Earth" color="#4aa8ff" position={sample.earth} radius={DOME_RADIUS} />
        </>
      )}
      <OrbitControls enablePan={false} />
    </Canvas>
  )
}
