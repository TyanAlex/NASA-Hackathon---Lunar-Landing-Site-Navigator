from fastapi import APIRouter, Query

from app.core import horizon
from app.models import HorizonResponse

router = APIRouter()


@router.get("/horizon", response_model=HorizonResponse)
def get_horizon(
    lat: float = Query(..., ge=-90, le=90, description="Latitude, degrees north"),
    lon: float = Query(..., ge=-180, le=360, description="Longitude, degrees east"),
) -> HorizonResponse:
    lat = horizon.clamp_lat(lat)
    az, el, ground = horizon.profile(lat, lon)
    return HorizonResponse(
        lat=lat,
        lon=lon,
        ground_height_m=ground,
        observer_height_m=horizon.OBSERVER_HEIGHT_M,
        az=az.round(2).tolist(),
        el=el.round(3).tolist(),
    )
