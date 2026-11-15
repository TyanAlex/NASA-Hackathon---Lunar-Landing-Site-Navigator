"""Shared helpers for sampling projected rasters."""

import numpy as np

MOON_RADIUS_M = 1_737_400.0


def bilinear(grid: np.ndarray, line: np.ndarray, sample: np.ndarray, wrap_samples: bool = False) -> np.ndarray:
    """Bilinear interpolation at fractional (line, sample) pixel coordinates. Edges are clamped
    (or wrapped in the sample direction, for global longitude grids)."""
    rows, cols = grid.shape
    l0 = np.clip(np.floor(line).astype(np.int64), 0, rows - 2)
    s0 = np.floor(sample).astype(np.int64)
    fl = np.clip(line - l0, 0.0, 1.0)
    fs = sample - s0
    if wrap_samples:
        s0 %= cols
        s1 = (s0 + 1) % cols
    else:
        s0 = np.clip(s0, 0, cols - 2)
        s1 = s0 + 1
        fs = np.clip(fs, 0.0, 1.0)
    l1 = l0 + 1
    top = grid[l0, s0] * (1 - fs) + grid[l0, s1] * fs
    bottom = grid[l1, s0] * (1 - fs) + grid[l1, s1] * fs
    return top * (1 - fl) + bottom * fl


def south_polar_stereo_px(lat: np.ndarray, lon: np.ndarray, offset_px: float, m_per_px: float) -> tuple[np.ndarray, np.ndarray]:
    """(line, sample) in a PDS south polar stereographic map (center lon 0°, spherical Moon).
    Axis orientation verified against global maps for both the LOLA DEM and the LROC WAC mosaic."""
    t = 2 * MOON_RADIUS_M * np.tan(np.pi / 4 + np.radians(lat) / 2)
    x = t * np.sin(np.radians(lon))
    y = t * np.cos(np.radians(lon))
    return offset_px - y / m_per_px, offset_px + x / m_per_px
