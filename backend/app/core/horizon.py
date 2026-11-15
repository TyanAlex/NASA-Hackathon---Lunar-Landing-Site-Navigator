"""Local terrain horizon from LOLA DEMs.

For each azimuth, march outward along the great circle and take the maximum elevation angle
to the terrain, accounting for the Moon's curvature (no atmosphere → no refraction).
"""

from functools import lru_cache

import numpy as np

from app.core import dem

AZ_STEP_DEG = 0.5
MAX_RANGE_M = 200_000.0  # an 8 km peak drops below the curvature horizon at ~170 km
OBSERVER_HEIGHT_M = 2.0  # lander solar panel / antenna height above the ground
MAX_ABS_LAT = 89.99  # bearings are undefined exactly at a pole


def _ranges() -> np.ndarray:
    """Sample distances: fine near the site, ~1% steps farther out (DEM is 240 m/px at best)."""
    near = np.arange(120.0, 12_000.0, 120.0)
    far = 12_000.0 * 1.01 ** np.arange(1, 400)
    return np.concatenate([near, far[far <= MAX_RANGE_M]])


RANGES_M = _ranges()
AZIMUTHS_DEG = np.arange(0.0, 360.0, AZ_STEP_DEG)


def clamp_lat(lat: float) -> float:
    return float(np.clip(lat, -MAX_ABS_LAT, MAX_ABS_LAT))


@lru_cache(maxsize=256)
def _profile(lat: float, lon: float) -> tuple[np.ndarray, float]:
    """(horizon elevation per AZIMUTHS_DEG in degrees, ground height in m)."""
    phi1, lam1 = np.radians(lat), np.radians(lon)
    theta = np.radians(AZIMUTHS_DEG)[:, None]  # (n_az, 1), clockwise from north
    delta = (RANGES_M / dem.MOON_RADIUS_M)[None, :]  # (1, n_r) central angle

    # Destination points on the sphere for every (azimuth, range).
    sin_phi2 = np.sin(phi1) * np.cos(delta) + np.cos(phi1) * np.sin(delta) * np.cos(theta)
    phi2 = np.arcsin(np.clip(sin_phi2, -1, 1))
    lam2 = lam1 + np.arctan2(np.sin(theta) * np.sin(delta) * np.cos(phi1), np.cos(delta) - np.sin(phi1) * sin_phi2)

    ground = float(dem.height(lat, lon))
    r_obs = dem.MOON_RADIUS_M + ground + OBSERVER_HEIGHT_M
    r_t = dem.MOON_RADIUS_M + dem.height(np.degrees(phi2), np.degrees(lam2))

    # Elevation angle from the observer's local horizontal to each terrain point.
    el = np.degrees(np.arctan2(r_t * np.cos(delta) - r_obs, r_t * np.sin(delta)))
    return el.max(axis=1), ground


def profile(lat: float, lon: float) -> tuple[np.ndarray, np.ndarray, float]:
    """(azimuths deg, horizon elevations deg, ground height m) for a site."""
    el, ground = _profile(round(clamp_lat(lat), 5), round(lon, 5))
    return AZIMUTHS_DEG, el, ground


def horizon_elevation(lat: float, lon: float, az_deg: float) -> float:
    az, el, _ = profile(lat, lon)
    return float(np.interp(az_deg % 360.0, az, el, period=360.0))
