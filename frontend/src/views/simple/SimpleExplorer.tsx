import { useMemo, useState } from 'react'
import type { Site } from '../../api/types'
import { MoonGlobe, type CameraPreset } from '../../components/globe/MoonGlobe'
import { useSites } from '../../hooks/useSites'
import type { Place } from '../../lib/places'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { QuickMetrics } from './QuickMetrics'
import { SiteSidebar } from './SiteSidebar'
import { TimeControls } from './TimeControls'
import './simple.css'

interface Props {
  tray: Place[]
  onToggleTray: (p: Place) => void
  customSites: Place[]
  onSaveCustom: (p: Place) => void
  onDeleteCustom: (id: string) => void
}

const asSite = (p: Place): Site => ({ ...p, program: 'Saved site', kind: 'candidate', approximate: false, notes: null })

/** Simple Explorer: site list + compare tray, rotatable 3D globe, quick metrics, and lunar-day time controls. */
export function SimpleExplorer({ tray, onToggleTray, customSites, onSaveCustom, onDeleteCustom }: Props) {
  const { data: sites } = useSites()
  const { location, setLocation } = useMission()
  const sample = useCurrentSample()
  const [shadow, setShadow] = useState(true)
  const [view, setView] = useState<{ preset: CameraPreset; n: number }>()

  const globeSites = useMemo(() => [...(sites ?? []), ...customSites.map(asSite)], [sites, customSites])
  const site = sites?.find((s) => s.id === location?.siteId)
  const fly = (preset: CameraPreset) => setView((v) => ({ preset, n: (v?.n ?? 0) + 1 }))

  return (
    <div className="simple-layout">
      <SiteSidebar
        sites={sites ?? []}
        customSites={customSites}
        location={location}
        onSelect={setLocation}
        tray={tray}
        onToggleTray={onToggleTray}
        onSaveCustom={onSaveCustom}
        onDeleteCustom={onDeleteCustom}
      />

      <main className="s-main">
        <section className="s-globe" aria-label="3D Moon globe">
          <MoonGlobe
            sites={globeSites}
            location={location}
            sample={sample}
            layer="wac"
            sunlight={shadow}
            overlays
            terrain
            onPick={setLocation}
            view={view}
          />
          <ul className="globe-legend" aria-label="Globe legend">
            <li><span className="dot dot-sun" aria-hidden /> Sun overhead point</li>
            <li><span className="dot dot-earth" aria-hidden /> Earth overhead point</li>
            <li><span className="line line-sun" aria-hidden /> Day / night line</li>
            <li><span className="line line-earth" aria-hidden /> Edge of Earth visibility</li>
          </ul>
          <div className="globe-presets">
            <button type="button" onClick={() => fly('globe')}>Globe</button>
            <button type="button" onClick={() => fly('pole')}>South pole view</button>
            <button type="button" aria-pressed={shadow} onClick={() => setShadow(!shadow)}>Shadow overlay</button>
          </div>
          <p className="globe-hint">Drag to rotate · scroll to zoom · click a marker to select, or anywhere to drop a pin</p>
        </section>

        <QuickMetrics site={site} />
        <TimeControls />
      </main>
    </div>
  )
}
