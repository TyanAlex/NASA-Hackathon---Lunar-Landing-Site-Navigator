"""SPICE wrapper: kernel loading and Sun/Earth topocentric az/el for a lunar surface site."""

import threading
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import spiceypy as spice

KERNEL_DIR = Path(__file__).resolve().parents[2] / "data" / "kernels"
KERNELS = [
    "naif0012.tls",
    "pck00011.tpc",
    "de440s.bsp",
    "moon_pa_de440_200625.bpc",
    "moon_de440_250416.tf",
]

MOON_FRAME = "MOON_ME"

# CSPICE is not thread-safe, and FastAPI runs sync endpoints in a thread pool.
# Concurrent calls corrupt SPICE's internal state and abort the process. Hold this around any SPICE use.
LOCK = threading.Lock()


def load_kernels() -> None:
    missing = [k for k in KERNELS if not (KERNEL_DIR / k).exists()]
    if missing:
        raise RuntimeError(
            f"Missing SPICE kernels {missing}. Run: python scripts/download_data.py"
        )
    for k in KERNELS:
        spice.furnsh(str(KERNEL_DIR / k))


def unload_kernels() -> None:
    spice.kclear()


def to_et(t: datetime) -> float:
    """UTC datetime -> SPICE ephemeris time (TDB seconds past J2000)."""
    if t.tzinfo is not None:
        t = t.astimezone(timezone.utc).replace(tzinfo=None)
    return spice.str2et(t.strftime("%Y-%m-%dT%H:%M:%S.%f"))


def site_position(lat_deg: float, lon_deg: float, height_km: float = 0.0) -> np.ndarray:
    """Body-fixed position of a site on the Moon's reference ellipsoid (a sphere, per pck00011)."""
    radii = spice.bodvrd("MOON", "RADII", 3)[1]
    return spice.georec(
        np.radians(lon_deg), np.radians(lat_deg), height_km, radii[0], (radii[0] - radii[2]) / radii[0]
    )


def azel(target: str, et: float, obspos: np.ndarray) -> tuple[float, float, float]:
    """Azimuth (deg, clockwise from north), elevation (deg), range (km) of target from obspos."""
    state, _ = spice.azlcpo("ELLIPSOID", target, et, "LT+S", False, True, obspos, "MOON", MOON_FRAME)
    rng, az, el = state[0], state[1], state[2]
    return float(np.degrees(az) % 360.0), float(np.degrees(el)), float(rng)


def direction_from_moon(target: str, et: float) -> tuple[float, float, float]:
    """Unit vector Moon center -> target in MOON_ME (used to light the 3D globe)."""
    pos, _ = spice.spkpos(target, et, MOON_FRAME, "LT+S", "MOON")
    u = np.asarray(pos) / np.linalg.norm(pos)
    return float(u[0]), float(u[1]), float(u[2])
