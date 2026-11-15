"""South-polar cap images in polar stereographic projection, for the globe's polar shader.

Global equirectangular mosaics smear into wedges near the pole, and Cesium renders any
geographic-tiled imagery there with radial streaks (tiles converge on one point). Instead, the
frontend samples one polar stereographic image per source in a globe material shader. The cap
covers CAP_EDGE_LAT to the pole; the shader fades it in between CAP_EDGE_LAT and 80°S.

Sources:
- "wac":  LROC WAC south polar mosaic, 128 px/deg (~237 m/px), reflectance (I/F)
- "lola": LOLA 240 m DEM rendered as color shaded relief
"""

import io
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
from PIL import Image

from app.core import dem
from app.core.raster import MOON_RADIUS_M, bilinear, south_polar_stereo_px

CAP_SIZE_PX = 4096
CAP_EDGE_LAT = -75.0
# Stereographic radius of the cap edge; the image spans ±CAP_RADIUS_M in x and y.
CAP_RADIUS_M = 2 * MOON_RADIUS_M * np.tan(np.pi / 4 + np.radians(CAP_EDGE_LAT) / 2)  # ≈ 457.5 km
CAP_M_PER_PX = 2 * CAP_RADIUS_M / CAP_SIZE_PX  # ≈ 223 m

IMAGERY_DIR = Path(__file__).resolve().parents[2] / "data" / "imagery"
WAC_FILE = IMAGERY_DIR / "wac_p900s0000_128p.img"
WAC_SIZE = 7861
WAC_HEADER_BYTES = 31444  # one attached PDS3 label record
WAC_OFFSET_PX = 3930.5
WAC_M_PER_PX = 236.90117518866998
WAC_WHITE = 0.18  # I/F mapped to white (~p99.5 of the mosaic)

Source = Literal["wac", "lola"]


def _wac() -> np.ndarray:
    return np.memmap(WAC_FILE, dtype="<f4", mode="r", offset=WAC_HEADER_BYTES, shape=(WAC_SIZE, WAC_SIZE))


def check_files() -> None:
    if not WAC_FILE.exists():
        raise RuntimeError(f"Missing LROC WAC polar mosaic {WAC_FILE.name}. Run: python scripts/download_data.py")


def _cap_latlon() -> tuple[np.ndarray, np.ndarray]:
    """Lat/lon (deg) at each cap pixel center. Row 0 is +y (toward lon 0°), column 0 is -x (lon -90°)."""
    c = (np.arange(CAP_SIZE_PX) + 0.5 - CAP_SIZE_PX / 2) * CAP_M_PER_PX
    x, y = np.meshgrid(c, -c)
    t = np.hypot(x, y)
    lat = np.degrees(2 * np.arctan(t / (2 * MOON_RADIUS_M)) - np.pi / 2)
    lon = np.degrees(np.arctan2(x, y))
    return lat, lon


def _render_wac() -> np.ndarray:
    lat, lon = _cap_latlon()
    line, sample = south_polar_stereo_px(lat, lon, WAC_OFFSET_PX, WAC_M_PER_PX)
    v = bilinear(_wac(), line, sample)
    v = np.where(np.isfinite(v) & (v > -1.0), v, 0.0)  # no-data sentinel → black
    gray = (np.clip(v / WAC_WHITE, 0, 1) * 255).astype(np.uint8)
    return np.repeat(gray[..., None], 3, axis=-1)


# LOLA-style elevation ramp (m): deep blue lows → green → yellow → red → white highs.
_RAMP_H = np.array([-6000, -3000, -1000, 1000, 3000, 6000], dtype=float)
_RAMP_RGB = np.array([[30, 40, 140], [40, 120, 200], [60, 170, 90], [230, 210, 80], [200, 80, 50], [250, 245, 240]], dtype=float)


def _render_lola() -> np.ndarray:
    lat, lon = _cap_latlon()
    h = dem.height(lat, lon)
    # Hillshade in the map plane (scale distortion < 2% this close to the pole), lit from the map's upper left.
    dz_dy, dz_dx = np.gradient(h, CAP_M_PER_PX)
    dz_dy = -dz_dy  # rows go toward -y
    az, alt = np.radians(315.0), np.radians(45.0)
    slope = np.arctan(np.hypot(dz_dx, dz_dy))
    aspect = np.arctan2(-dz_dx, dz_dy)
    shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    color = np.stack([np.interp(h, _RAMP_H, _RAMP_RGB[:, c]) for c in range(3)], axis=-1)
    return (color * (0.35 + 0.65 * shade[..., None])).astype(np.uint8)


@lru_cache(maxsize=2)
def cap_jpeg(source: Source) -> bytes:
    """JPEG of the cap, rendered once and cached on disk (the sources never change)."""
    cached = IMAGERY_DIR / f"cap_{source}_{CAP_SIZE_PX}.jpg"
    if cached.exists():
        return cached.read_bytes()
    rgb = _render_wac() if source == "wac" else _render_lola()
    buf = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(buf, format="JPEG", quality=88)
    cached.write_bytes(buf.getvalue())
    return buf.getvalue()
