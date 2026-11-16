import { Layers } from 'lucide-react'
import { useState } from 'react'
import { LAYERS, type LayerId } from '../../lib/layers'

interface Props {
  layer: LayerId
  onLayer: (l: LayerId) => void
  sunlight: boolean
  onSunlight: (v: boolean) => void
  overlays: boolean
  onOverlays: (v: boolean) => void
  terrain: boolean
  onTerrain: (v: boolean) => void
  grid: boolean
  onGrid: (v: boolean) => void
}

export function LayerSwitcher({ layer, onLayer, sunlight, onSunlight, overlays, onOverlays, terrain, onTerrain, grid, onGrid }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="layers">
      <button type="button" className="layers-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Layers size={18} /> Layers
      </button>
      {open && (
        <div className="layers-menu card">
          <fieldset>
            <legend>Base map</legend>
            {LAYERS.map((l) => (
              <label key={l.id} className="layer-option">
                <input type="radio" name="layer" checked={layer === l.id} onChange={() => onLayer(l.id)} />
                <span>
                  <strong>{l.label}</strong>
                  <small>{l.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Terrain</legend>
            <label className="layer-option">
              <input type="checkbox" checked={terrain} onChange={(e) => onTerrain(e.target.checked)} />
              <span>
                <strong>3D relief</strong>
                <small>LRO LOLA elevation · 240 m near the south pole, 1.9 km elsewhere</small>
              </span>
            </label>
          </fieldset>
          <fieldset>
            <legend>Overlays</legend>
            <label className="layer-option">
              <input type="checkbox" checked={sunlight} onChange={(e) => onSunlight(e.target.checked)} />
              <span><strong>Sunlight shading</strong><small>Day/night at the selected time</small></span>
            </label>
            <label className="layer-option">
              <input type="checkbox" checked={overlays} onChange={(e) => onOverlays(e.target.checked)} />
              <span><strong>Terminator &amp; Earth limit</strong><small>Sunlit edge, and where Earth is above the horizon</small></span>
            </label>
            <label className="layer-option">
              <input type="checkbox" checked={grid} onChange={(e) => onGrid(e.target.checked)} />
              <span><strong>Lat/lon grid</strong><small>Gridlines that tighten as you zoom in</small></span>
            </label>
          </fieldset>
        </div>
      )}
    </div>
  )
}
