"""LOLA digital elevation models.

Heights are meters relative to a 1737.4 km sphere (PDS label: radius = DN * 0.5 + 1737400).
- South polar stereographic, 240 m/px, 60°S–90°S (LDEM_60S_240M)
- Global simple cylindrical, 16 px/deg ≈ 1.9 km/px (LDEM_16), used everywhere else

Projection constants come from the PDS .lbl files; the polar axis orientation was verified
against the global map (corr 0.999, median |Δh| 35 m over 62–70°S).
"""

from functools import cache
from pathlib import Path

import numpy as np

from app.core.raster import MOON_RADIUS_M, bilinear, south_polar_stereo_px

DEM_DIR = Path(__file__).resolve().parents[2] / "data" / "dem"
SCALE = 0.5  # m per DN

# LDEM_60S_240M: polar stereographic centered on the south pole
POLAR_FILE = "ldem_60s_240m.img"
POLAR_SIZE = 7760
POLAR_OFFSET_PX = 3879.5
POLAR_M_PER_PX = 240.0
POLAR_MAX_LAT = -60.0
POLAR_BLEND_LAT = -60.5  # stay a little inside the polar map's edge

# LDEM_16: simple cylindrical, longitude 0–360 east, pixel-registered
GLOBAL_FILE = "ldem_16.img"
GLOBAL_SHAPE = (2880, 5760)
GLOBAL_PX_PER_DEG = 16
GLOBAL_LINE_OFFSET = 1439.5
GLOBAL_SAMPLE_OFFSET = 2879.5
GLOBAL_CENTER_LON = 180.0


@cache
def _polar() -> np.ndarray:
    return np.memmap(DEM_DIR / POLAR_FILE, dtype="<i2", mode="r", shape=(POLAR_SIZE, POLAR_SIZE))


@cache
def _global() -> np.ndarray:
    return np.memmap(DEM_DIR / GLOBAL_FILE, dtype="<i2", mode="r", shape=GLOBAL_SHAPE)


def check_files() -> None:
    missing = [f for f in (POLAR_FILE, GLOBAL_FILE) if not (DEM_DIR / f).exists()]
    if missing:
        raise RuntimeError(f"Missing LOLA DEMs {missing}. Run: python scripts/download_data.py")


def _polar_height(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    line, sample = south_polar_stereo_px(lat, lon, POLAR_OFFSET_PX, POLAR_M_PER_PX)
    return bilinear(_polar(), line, sample) * SCALE


def _global_height(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    line = GLOBAL_LINE_OFFSET - lat * GLOBAL_PX_PER_DEG
    sample = GLOBAL_SAMPLE_OFFSET + ((lon % 360.0) - GLOBAL_CENTER_LON) * GLOBAL_PX_PER_DEG
    return bilinear(_global(), line, sample, wrap_samples=True) * SCALE


def height(lat: np.ndarray | float, lon: np.ndarray | float) -> np.ndarray:
    """Terrain height (m) above the 1737.4 km sphere. Vectorized; degrees in, meters out."""
    lat = np.asarray(lat, dtype=float)
    lon = np.asarray(lon, dtype=float)
    out = np.empty(np.broadcast(lat, lon).shape)
    lat, lon = np.broadcast_arrays(lat, lon)
    polar = lat <= POLAR_BLEND_LAT
    if polar.any():
        out[polar] = _polar_height(lat[polar], lon[polar])
    if (~polar).any():
        out[~polar] = _global_height(lat[~polar], lon[~polar])
    return out
