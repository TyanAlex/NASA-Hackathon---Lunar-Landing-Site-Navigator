import { useState } from 'react'
import { MoonGlobe } from '../../components/globe/MoonGlobe'
import { LayerSwitcher } from '../../components/map/LayerSwitcher'
import { SearchBox } from '../../components/map/SearchBox'
import { MetricsPanel } from '../../components/metrics/MetricsPanel'
import { TimelineDock } from '../../components/time/TimelineDock'
import { useSites } from '../../hooks/useSites'
import type { LayerId } from '../../lib/layers'
import { useCurrentSample, useMission } from '../../state/MissionContext'

/** The original full-screen explorer: globe with floating search, metrics panel, layers and timeline dock. */
export function DetailedExplorer() {
  const { data: sites } = useSites()
  const { location, setLocation } = useMission()
  const sample = useCurrentSample()
  const [panelOpen, setPanelOpen] = useState(true)
  const [layer, setLayer] = useState<LayerId>('wac')
  const [sunlight, setSunlight] = useState(true)
  const [overlays, setOverlays] = useState(true)
  const [terrain, setTerrain] = useState(true)

  const select = (l: Parameters<typeof setLocation>[0]) => {
    setLocation(l)
    setPanelOpen(true)
  }
  const site = sites?.find((s) => s.id === location?.siteId)

  return (
    <div className="app">
      <MoonGlobe
        sites={sites ?? []}
        location={location}
        sample={sample}
        layer={layer}
        sunlight={sunlight}
        overlays={overlays}
        terrain={terrain}
        onPick={select}
      />

      <div className="left-stack">
        <SearchBox sites={sites ?? []} selected={location} onSelect={select} />
        {panelOpen && <MetricsPanel site={site} onClose={() => setPanelOpen(false)} />}
      </div>

      <div className="top-right">
        <LayerSwitcher
          layer={layer}
          onLayer={setLayer}
          sunlight={sunlight}
          onSunlight={setSunlight}
          overlays={overlays}
          onOverlays={setOverlays}
          terrain={terrain}
          onTerrain={setTerrain}
        />
      </div>

      <TimelineDock />
    </div>
  )
}
