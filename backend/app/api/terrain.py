"""Heightmap tiles for the 3D globe, sampled from the same LOLA DEMs as the horizon.

Tiling matches Cesium's GeographicTilingScheme: 2x1 tiles at level 0, each level splits in four,
rows counted from the north. Each tile is a TILE_SIZE x TILE_SIZE grid (edges included, row-major
from the north-west corner) of float32 heights in meters above the 1737.4 km sphere.
"""

import numpy as np
from fastapi import APIRouter, HTTPException, Response

from app.core import dem

router = APIRouter()

TILE_SIZE = 65
MAX_LEVEL = 12


@router.get("/terrain/{z}/{x}/{y}", response_class=Response)
def terrain_tile(z: int, x: int, y: int) -> Response:
    if not (0 <= z <= MAX_LEVEL and 0 <= x < 2 ** (z + 1) and 0 <= y < 2**z):
        raise HTTPException(404, "tile out of range")
    span = 180.0 / 2**z
    west, north = -180.0 + x * span, 90.0 - y * span
    lon = np.linspace(west, west + span, TILE_SIZE)
    lat = np.linspace(north, north - span, TILE_SIZE)
    heights = dem.height(lat[:, None], lon[None, :]).astype("<f4")
    return Response(
        heights.tobytes(),
        media_type="application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},  # DEM never changes
    )
