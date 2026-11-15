// NASA Moon Trek WMTS layers (equirectangular, 2x1 tiles at level 0, CORS-enabled).
// Catalog: https://trek.nasa.gov/moon/ — max levels from each layer's WMTSCapabilities.xml.

export type LayerId = 'wac' | 'kaguya' | 'relief'

export interface LayerDef {
  id: LayerId
  label: string
  description: string
  product: string
  ext: 'jpg' | 'png'
  maxLevel: number
  credit: string
  /** Backend south polar cap image that replaces this layer's smeared pole (see backend polar_imagery.py). */
  polar: 'wac' | 'lola'
}

export const LAYERS: LayerDef[] = [
  {
    id: 'wac',
    label: 'Visible',
    description: 'LRO Wide Angle Camera mosaic · ~100 m/px',
    product: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    ext: 'jpg',
    maxLevel: 8,
    credit: 'LRO WAC mosaic — NASA/GSFC/ASU, via NASA Moon Trek',
    polar: 'wac',
  },
  {
    id: 'kaguya',
    label: 'High-res',
    description: 'Kaguya Terrain Camera ortho mosaic · ~20 m/px',
    product: 'Kaguya_TCortho_Mosaic_Global_4096ppd',
    ext: 'png',
    maxLevel: 10,
    credit: 'Kaguya TC ortho mosaic — JAXA/SELENE, via NASA Moon Trek',
    polar: 'wac',
  },
  {
    id: 'relief',
    label: 'Elevation',
    description: 'LOLA color shaded relief · ~120 m/px',
    product: 'LRO_LOLA_ClrShade_Global_256ppd_v06',
    ext: 'png',
    maxLevel: 6,
    credit: 'LRO LOLA color shaded relief — NASA/GSFC, via NASA Moon Trek',
    polar: 'lola',
  },
]

export const trekTileUrl = (l: LayerDef) =>
  `https://trek.nasa.gov/tiles/Moon/EQ/${l.product}/1.0.0/default/default028mm/{z}/{y}/{x}.${l.ext}`

export const POLAR_CREDIT: Record<LayerDef['polar'], string> = {
  wac: 'South pole: LROC WAC polar mosaic — NASA/GSFC/ASU',
  lola: 'South pole: LOLA 240 m DEM shaded relief — NASA/GSFC',
}
