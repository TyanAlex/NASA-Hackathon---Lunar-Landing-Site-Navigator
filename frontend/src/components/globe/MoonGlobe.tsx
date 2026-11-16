import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { Minus, Plus, LocateFixed } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, polarCapUrl } from '../../api/client'
import type { Sample, Site } from '../../api/types'
import { dirToLatLon, formatLatLon } from '../../lib/coords'
import { LAYERS, POLAR_CREDIT, trekTileUrl, type LayerId } from '../../lib/layers'
import type { Location } from '../../state/MissionContext'
import './MoonGlobe.css'

// Everything Cesium creates (positions, tiling schemes, cameras) defaults to the Moon.
const MOON = Cesium.Ellipsoid.MOON
Cesium.Ellipsoid.default = MOON

const KIND_COLORS: Record<Site['kind'], string> = {
  historical: '#c9d1dc',
  recent: '#7cc4ff',
  candidate: '#ffb547',
}

const PIN_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#ff5a4e" stroke="#7a1a14" stroke-width="1.5"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>',
)}`

const SITE_VIEW_RANGE_M = 180_000
const SITE_VIEW_PITCH = Cesium.Math.toRadians(-40) // tilted so relief reads in 3D
const OVERVIEW = Cesium.Cartesian3.fromDegrees(10, -60, 5_500_000)
const OVERLAY_HEIGHT_M = 11_000 // above the highest lunar peak (~10.8 km) so lines aren't buried in terrain
const GROUND = Cesium.HeightReference.CLAMP_TO_GROUND

// LOLA heightmap tiles from our backend. Finest useful level: ~170 m grid spacing over the 240 m polar
// DEM, ~1.3 km over the 1.9 km global DEM; Cesium upsamples beyond that.
const TERRAIN_TILE_SIZE = 65
const POLAR_MAX_LEVEL = 9
const GLOBAL_MAX_LEVEL = 6
const POLAR_DEM_NORTH = Cesium.Math.toRadians(-60.5)

function makeLolaTerrain() {
  const tilingScheme = new Cesium.GeographicTilingScheme({ ellipsoid: MOON })
  return new Cesium.CustomHeightmapTerrainProvider({
    width: TERRAIN_TILE_SIZE,
    height: TERRAIN_TILE_SIZE,
    tilingScheme,
    ellipsoid: MOON,
    credit: 'Elevation: LRO LOLA (NASA/GSFC)',
    callback: (x, y, level) => {
      const maxLevel = tilingScheme.tileXYToRectangle(x, y, level).north < POLAR_DEM_NORTH ? POLAR_MAX_LEVEL : GLOBAL_MAX_LEVEL
      if (level > maxLevel) return undefined
      return api.terrainTile(level, x, y).then((buf) => new Float32Array(buf))
    },
  })
}

interface Props {
  sites: Site[]
  location: Location | null
  sample: Sample | null
  layer: LayerId
  sunlight: boolean
  overlays: boolean
  terrain: boolean
  /** Lat/lon gridlines over the imagery. */
  grid?: boolean
  onPick: (l: Location) => void
  /** Camera preset request; `n` changes on every click so the same preset can be re-applied. */
  view?: { preset: CameraPreset; n: number }
}

export type CameraPreset = 'globe' | 'pole'

const SOUTH_POLE_VIEW = Cesium.Cartesian3.fromDegrees(0, -89.999, 900_000)

function makeLayer(id: LayerId) {
  const def = LAYERS.find((l) => l.id === id)!
  return new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: trekTileUrl(def),
      tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid: MOON }),
      maximumLevel: def.maxLevel,
      credit: new Cesium.Credit(def.credit),
    }),
  )
}

// South polar cap. Global equirectangular mosaics smear into wedges near the pole, and Cesium renders
// any geographic-tiled imagery there with radial streaks (tiles converge on one point). Instead, a globe
// material samples one polar stereographic image from the backend per fragment; it fades in from
// 75°S to 80°S over the regular imagery. Geometry must match backend app/core/polar_imagery.py.
const MOON_RADIUS_M = 1_737_400
const CAP_EDGE_LAT = -75
const CAP_FULL_LAT = -80
const CAP_RADIUS_M = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + Cesium.Math.toRadians(CAP_EDGE_LAT) / 2)

const POLAR_CAP_GLSL = /* glsl */ `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material m = czm_getDefaultMaterial(materialInput);
  m.alpha = 0.0;
  vec3 p = (czm_inverseView * vec4(-materialInput.positionToEyeEC, 1.0)).xyz; // fragment, body-fixed
  float lat = asin(p.z / length(p));
  float fade = clamp((edgeLat - lat) / (edgeLat - fullLat), 0.0, 1.0);
  if (fade <= 0.0) return m;
  // Spherical south polar stereographic, as in the PDS products (center lon 0°).
  float lon = atan(p.y, p.x);
  float t = 2.0 * moonRadius * tan(czm_piOverFour + 0.5 * lat);
  vec2 uv = 0.5 + vec2(t * sin(lon), t * cos(lon)) / (2.0 * capRadius);
  m.diffuse = texture(image, uv).rgb;
  m.alpha = fade;
  return m;
}`

function makePolarCapMaterial(id: LayerId) {
  const { polar } = LAYERS.find((l) => l.id === id)!
  return new Cesium.Material({
    fabric: {
      uniforms: {
        image: polarCapUrl(polar),
        moonRadius: MOON_RADIUS_M,
        capRadius: CAP_RADIUS_M,
        edgeLat: Cesium.Math.toRadians(CAP_EDGE_LAT),
        fullLat: Cesium.Math.toRadians(CAP_FULL_LAT),
      },
      source: POLAR_CAP_GLSL,
    },
    // Material doesn't generate mipmaps for image uniforms, so a *_MIPMAP_* filter samples black.
    minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
  })
}

/** Great circle 90° from `dir`: the terminator for the Sun, the Earth-visibility limit for Earth. */
function limbCircle(dir: readonly [number, number, number], heightM = OVERLAY_HEIGHT_M): Cesium.Cartesian3[] {
  const n = Cesium.Cartesian3.normalize(new Cesium.Cartesian3(...dir), new Cesium.Cartesian3())
  const helper = Math.abs(n.z) < 0.9 ? Cesium.Cartesian3.UNIT_Z : Cesium.Cartesian3.UNIT_X
  const e1 = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(n, helper, new Cesium.Cartesian3()), new Cesium.Cartesian3())
  const e2 = Cesium.Cartesian3.cross(n, e1, new Cesium.Cartesian3())
  const r = MOON.maximumRadius + heightM
  const pts: Cesium.Cartesian3[] = []
  for (let i = 0; i <= 360; i += 2) {
    const t = Cesium.Math.toRadians(i)
    const p = Cesium.Cartesian3.add(
      Cesium.Cartesian3.multiplyByScalar(e1, Math.cos(t), new Cesium.Cartesian3()),
      Cesium.Cartesian3.multiplyByScalar(e2, Math.sin(t), new Cesium.Cartesian3()),
      new Cesium.Cartesian3(),
    )
    pts.push(Cesium.Cartesian3.multiplyByScalar(p, r, p))
  }
  return pts
}

export function MoonGlobe({ sites, location, sample, layer, sunlight, overlays, terrain, grid = false, onPick, view }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const pinRef = useRef<Cesium.Entity | null>(null)
  const geometryRef = useRef<Record<string, Cesium.Entity>>({})
  // Latest terminator / Earth-limit points, read every frame by the polylines' CallbackProperty.
  const linesRef = useRef<{ terminator: Cesium.Cartesian3[]; earthLimit: Cesium.Cartesian3[] }>({ terminator: [], earthLimit: [] })
  const onPickRef = useRef(onPick)
  const [cursor, setCursor] = useState<string | null>(null)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  // ── Create the viewer once ────────────────────────────────────────────────
  useEffect(() => {
    const viewer = new Cesium.Viewer(containerRef.current!, {
      globe: new Cesium.Globe(MOON),
      mapProjection: new Cesium.GeographicProjection(MOON),
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      skyAtmosphere: false,
    })
    const { scene } = viewer
    const globe = scene.globe
    globe.baseColor = Cesium.Color.fromCssColorString('#15161a')
    globe.showGroundAtmosphere = false
    globe.dynamicAtmosphereLighting = false
    globe.maximumScreenSpaceError = 1.5 // sharper tiles
    globe.depthTestAgainstTerrain = true // markers and lines hide behind ridges
    // Cesium fades lighting out when zoomed in (tuned for Earth). Keep sun shading at every distance.
    globe.lightingFadeOutDistance = 0
    globe.lightingFadeInDistance = 1
    scene.fog.enabled = false
    if (scene.sun) scene.sun.show = false // Cesium's Sun is Earth-centric; we light from SPICE instead
    if (scene.moon) scene.moon.show = false
    scene.screenSpaceCameraController.minimumZoomDistance = 2_000
    scene.screenSpaceCameraController.maximumZoomDistance = 30_000_000
    viewer.camera.setView({ destination: OVERVIEW })

    // Sun / Earth geometry entities, updated per sample.
    // Line positions are CallbackProperty (non-constant) so Cesium redraws them synchronously each frame.
    // With ConstantProperty, every update triggers an async worker rebuild; during playback (an update
    // every 50 ms) the rebuild never finishes and the lines disappear.
    const ents = viewer.entities
    const lines = linesRef.current
    geometryRef.current = {
      terminator: ents.add({
        polyline: { positions: new Cesium.CallbackProperty(() => lines.terminator, false), width: 1.5, arcType: Cesium.ArcType.NONE, material: Cesium.Color.fromCssColorString('#ffcf4a').withAlpha(0.55) },
      }),
      earthLimit: ents.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => lines.earthLimit, false),
          width: 2,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.fromCssColorString('#4aa8ff').withAlpha(0.8), dashLength: 12 }),
        },
      }),
      subSolar: ents.add({
        point: { heightReference: GROUND, pixelSize: 10, color: Cesium.Color.fromCssColorString('#ffcf4a'), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
        label: labelStyle('Sub-solar point', '#ffcf4a'),
      }),
      subEarth: ents.add({
        point: { heightReference: GROUND, pixelSize: 10, color: Cesium.Color.fromCssColorString('#4aa8ff'), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
        label: labelStyle('Sub-Earth point', '#4aa8ff'),
      }),
    }

    pinRef.current = ents.add({
      show: false,
      billboard: { image: PIN_SVG, heightReference: GROUND, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, scale: 0.9, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    })

    // ── Interaction: click site marker → select site; click ground → drop pin ──
    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas)
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = scene.pick(e.position)
      const site = picked?.id instanceof Cesium.Entity ? (picked.id.properties?.site?.getValue() as Site | undefined) : undefined
      if (site) {
        onPickRef.current({ name: site.name, lat: site.lat, lon: site.lon, siteId: site.id, source: 'search' })
        return
      }
      const c = pickGround(viewer, e.position)
      if (!c) return
      onPickRef.current({ name: 'Dropped pin', lat: Cesium.Math.toDegrees(c.latitude), lon: Cesium.Math.toDegrees(c.longitude), source: 'map' })
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    let raf = 0
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const c = pickGround(viewer, e.endPosition)
        if (!c) return setCursor(null)
        const hasTerrain = !(viewer.scene.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)
        const h = hasTerrain ? `  ${Math.round(c.height).toLocaleString()} m` : ''
        setCursor(formatLatLon(Cesium.Math.toDegrees(c.latitude), Cesium.Math.toDegrees(c.longitude)) + h)
      })
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    viewerRef.current = viewer
    return () => {
      cancelAnimationFrame(raf)
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  // ── 3D relief from LOLA heightmap tiles (same DEM as the horizon calculation) ──
  useEffect(() => {
    viewerRef.current!.scene.terrainProvider = terrain ? makeLolaTerrain() : new Cesium.EllipsoidTerrainProvider({ ellipsoid: MOON })
  }, [terrain])

  // ── Imagery layer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const layers = viewerRef.current!.imageryLayers
    layers.removeAll()
    layers.add(makeLayer(layer))
    const viewer = viewerRef.current!
    viewer.scene.globe.material = makePolarCapMaterial(layer)
    const polarCredit = new Cesium.Credit(POLAR_CREDIT[LAYERS.find((l) => l.id === layer)!.polar])
    viewer.creditDisplay.addStaticCredit(polarCredit)
    return () => {
      // The viewer-creation effect's cleanup may already have destroyed the viewer (unmount order).
      if (!viewer.isDestroyed()) viewer.creditDisplay.removeStaticCredit(polarCredit)
    }
  }, [layer])

  // ── Lat/lon grid above the base imagery (spacing tightens as you zoom) ─────
  useEffect(() => {
    if (!grid) return
    const viewer = viewerRef.current!
    const gridLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.GridImageryProvider({
        tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid: MOON }),
        cells: 2,
        color: Cesium.Color.WHITE.withAlpha(0.35),
        glowColor: Cesium.Color.TRANSPARENT,
        backgroundColor: Cesium.Color.TRANSPARENT,
      }),
    )
    return () => {
      if (!viewer.isDestroyed()) viewer.imageryLayers.remove(gridLayer)
    }
  }, [grid, layer])

  // ── Site markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const ents = viewerRef.current!.entities
    const added = sites.map((s) =>
      ents.add({
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat),
        properties: { site: s },
        point: {
          heightReference: GROUND,
          pixelSize: 9,
          color: Cesium.Color.fromCssColorString(KIND_COLORS[s.kind]),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1.5,
        },
        label: {
          ...labelStyle(s.name, '#eef1f6'),
          heightReference: GROUND,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3_500_000),
        },
      }),
    )
    return () => added.forEach((e) => ents.remove(e))
  }, [sites])

  // ── Selected location: pin + camera ───────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current!
    const pin = pinRef.current!
    if (!location) {
      pin.show = false
      return
    }
    pin.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(location.lon, location.lat))
    pin.show = true
    if (location.source === 'search') flyToSite(viewer, location, 2)
  }, [location])

  // ── Sun lighting + Sun/Earth geometry for the current time ────────────────
  useEffect(() => {
    const viewer = viewerRef.current!
    const g = geometryRef.current
    viewer.scene.globe.enableLighting = sunlight && !!sample
    if (!sample) return
    const sun = new Cesium.Cartesian3(...sample.sun.dir)
    viewer.scene.light = new Cesium.DirectionalLight({ direction: Cesium.Cartesian3.negate(sun, new Cesium.Cartesian3()), intensity: 1.0 })

    for (const e of Object.values(g)) e.show = overlays
    if (!overlays) return
    const ss = dirToLatLon(sample.sun.dir)
    const se = dirToLatLon(sample.earth.dir)
    g.subSolar.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(ss.lon, ss.lat))
    g.subEarth.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(se.lon, se.lat))
    linesRef.current.terminator = limbCircle(sample.sun.dir)
    linesRef.current.earthLimit = limbCircle(sample.earth.dir)
  }, [sample, sunlight, overlays])

  // ── Camera presets (Simple view's Globe / South pole buttons) ─────────────
  useEffect(() => {
    if (!view) return
    const camera = viewerRef.current!.camera
    if (view.preset === 'pole') {
      camera.flyTo({ destination: SOUTH_POLE_VIEW, orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 }, duration: 1.5 })
    } else {
      camera.flyTo({ destination: OVERVIEW, duration: 1.5 })
    }
  }, [view])

  const zoom = (factor: number) => {
    const camera = viewerRef.current!.camera
    const h = MOON.cartesianToCartographic(camera.position).height
    if (factor > 1) camera.zoomOut(h * (factor - 1))
    else camera.zoomIn(h * (1 - factor))
  }

  const recenter = () => {
    const camera = viewerRef.current!.camera
    if (location) flyToSite(viewerRef.current!, location, 1.2)
    else camera.flyTo({ destination: OVERVIEW, duration: 1.2 })
  }

  return (
    <div className="globe">
      <div ref={containerRef} className="globe-canvas" />
      <div className="globe-controls">
        <button type="button" onClick={recenter} aria-label="Center on selected location" title="Center on selection"><LocateFixed size={18} /></button>
        <div className="zoom-group">
          <button type="button" onClick={() => zoom(0.5)} aria-label="Zoom in"><Plus size={18} /></button>
          <button type="button" onClick={() => zoom(2)} aria-label="Zoom out"><Minus size={18} /></button>
        </div>
      </div>
      {cursor && <div className="cursor-readout">{cursor}</div>}
    </div>
  )
}

function flyToSite(viewer: Cesium.Viewer, l: Location, duration: number) {
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(l.lon, l.lat), 5_000), {
    offset: new Cesium.HeadingPitchRange(0, SITE_VIEW_PITCH, SITE_VIEW_RANGE_M),
    duration,
  })
}

/** Lat/lon/height under a screen point: terrain if loaded, else the ellipsoid. */
/** Lat/lon/height under a screen point: terrain if loaded, else the ellipsoid. */
function pickGround(viewer: Cesium.Viewer, pos: Cesium.Cartesian2): Cesium.Cartographic | undefined {
  const ray = viewer.camera.getPickRay(pos)
  const hit = (ray && viewer.scene.globe.pick(ray, viewer.scene)) ?? viewer.camera.pickEllipsoid(pos, MOON)
  return hit ? MOON.cartesianToCartographic(hit) : undefined
}

function labelStyle(text: string, color: string): Cesium.LabelGraphics.ConstructorOptions {
  return {
    text,
    font: '600 12px system-ui, sans-serif',
    fillColor: Cesium.Color.fromCssColorString(color),
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, -16),
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
  }
}
