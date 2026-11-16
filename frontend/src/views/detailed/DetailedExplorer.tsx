import { Plus, Table2 } from 'lucide-react'
import { CustomSiteForm } from '../../components/sites/CustomSiteForm'
import { useMemo, useState } from 'react'
import type { Site } from '../../api/types'
import { MoonGlobe } from '../../components/globe/MoonGlobe'
import { LayerSwitcher } from '../../components/map/LayerSwitcher'
import { SearchBox } from '../../components/map/SearchBox'
import { MetricsPanel } from '../../components/metrics/MetricsPanel'
import { TimelineDock } from '../../components/time/TimelineDock'
import { useAllSitesEphemeris } from '../../hooks/useAllSitesEphemeris'
import { useSites } from '../../hooks/useSites'
import type { LayerId } from '../../lib/layers'
import type { Place } from '../../lib/places'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { AllSitesPanel } from './AllSitesPanel'
import { CompareTrayCard } from './CompareTrayCard'
import { GlobeReadout } from './GlobeReadout'

interface Props {
  tray: Place[]
  onToggleTray: (p: Place) => void
  customSites: Place[]
  onSaveCustom: (p: Place) => void
}

const asSite = (p: Place): Site => ({ ...p, program: 'Saved site', kind: 'candidate', approximate: false, notes: null })

/** Map-first explorer (QuickMap / Moon Trek style): full-screen globe with floating panels and a timeline dock. */
export function DetailedExplorer({ tray, onToggleTray, customSites, onSaveCustom }: Props) {
  const { data: sites } = useSites()
  const { location, setLocation, range, stepMinutes } = useMission()
  const sample = useCurrentSample()
  const [panelOpen, setPanelOpen] = useState(true)
  const [tableOpen, setTableOpen] = useState(false)
  const [layer, setLayer] = useState<LayerId>('wac')
  const [sunlight, setSunlight] = useState(true)
  const [overlays, setOverlays] = useState(true)
  const [terrain, setTerrain] = useState(true)
  const [grid, setGrid] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const globeSites = useMemo(() => [...(sites ?? []), ...customSites.map(asSite)], [sites, customSites])
  const places = useMemo<Place[]>(() => globeSites.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })), [globeSites])
  const allSites = useAllSitesEphemeris(places, range, stepMinutes)

  const select = (l: Parameters<typeof setLocation>[0]) => {
    setLocation(l)
    setPanelOpen(true)
  }
  const site = sites?.find((s) => s.id === location?.siteId)
  const isKnown = !!location?.siteId && places.some((p) => p.id === location.siteId)

  // Unsaved points (dropped pins, typed coordinates) get a stable id for the compare tray.
  const current: Place | null = location
    ? { id: location.siteId ?? `point-${location.lat.toFixed(4)},${location.lon.toFixed(4)}`, name: location.name, lat: location.lat, lon: location.lon }
    : null

  const saveCurrent = (name: string) => {
    if (!location) return
    const p: Place = { id: `custom-${Date.now()}`, name, lat: location.lat, lon: location.lon }
    onSaveCustom(p)
    setLocation({ name, lat: p.lat, lon: p.lon, siteId: p.id, source: 'map' })
  }

  return (
    <div className="app">
      <MoonGlobe
        sites={globeSites}
        location={location}
        sample={sample}
        layer={layer}
        sunlight={sunlight}
        overlays={overlays}
        terrain={terrain}
        grid={grid}
        onPick={select}
      />

      <div className="left-stack">
        <SearchBox sites={sites ?? []} saved={customSites} selected={location} onSelect={select} />
        {formOpen ? (
          <div className="card custom-card">
            <CustomSiteForm
              initial={location && !isKnown ? location : null}
              onCancel={() => setFormOpen(false)}
              onSave={(p) => {
                onSaveCustom(p)
                select({ name: p.name, lat: p.lat, lon: p.lon, siteId: p.id, source: 'search' })
                setFormOpen(false)
              }}
            />
          </div>
        ) : (
          <button type="button" className="pill-btn custom-open" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Custom coordinates
          </button>
        )}
        {panelOpen && current && (
          <MetricsPanel
            site={site}
            onClose={() => setPanelOpen(false)}
            inTray={tray.some((t) => t.id === current.id)}
            trayCount={tray.length}
            onToggleTray={() => onToggleTray(current)}
            onSave={isKnown ? undefined : saveCurrent}
          />
        )}
        <CompareTrayCard tray={tray} onRemove={onToggleTray} />
      </div>

      <div className="top-right">
        <div className="top-right-buttons">
          <button type="button" className="layers-toggle" aria-expanded={tableOpen} onClick={() => setTableOpen(!tableOpen)}>
            <Table2 size={18} /> All sites
          </button>
          <LayerSwitcher
            layer={layer}
            onLayer={setLayer}
            sunlight={sunlight}
            onSunlight={setSunlight}
            overlays={overlays}
            onOverlays={setOverlays}
            terrain={terrain}
            onTerrain={setTerrain}
            grid={grid}
            onGrid={setGrid}
          />
        </div>
        <GlobeReadout />
      </div>

      {tableOpen && (
        <AllSitesPanel
          places={places}
          results={allSites.results}
          errors={allSites.errors}
          running={allSites.running}
          progress={allSites.progress}
          onCalculate={allSites.run}
          tray={tray}
          onToggleTray={onToggleTray}
          onSelect={select}
          onClose={() => setTableOpen(false)}
        />
      )}

      <TimelineDock />
    </div>
  )
}
