from typing import get_args

from fastapi import APIRouter, HTTPException, Response

from app.core import polar_imagery

router = APIRouter()


@router.get("/imagery/south/{source}/cap.jpg", response_class=Response)
def south_polar_cap(source: str) -> Response:
    """4096x4096 south polar stereographic image, 75°S to the pole (see polar_imagery.py for the geometry)."""
    if source not in get_args(polar_imagery.Source):
        raise HTTPException(404, f"unknown source {source!r}")
    return Response(
        polar_imagery.cap_jpeg(source),  # type: ignore[arg-type]
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
