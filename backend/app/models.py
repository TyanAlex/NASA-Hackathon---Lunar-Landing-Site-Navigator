from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Site(BaseModel):
    id: str
    name: str
    lat: float  # degrees, north positive
    lon: float  # degrees, east positive
    program: str
    kind: Literal["historical", "recent", "candidate"]
    approximate: bool = False
    notes: str | None = None


class BodyPosition(BaseModel):
    az: float  # degrees clockwise from north
    el: float  # degrees above the local horizontal plane
    range_km: float
    horizon_el: float  # local horizon elevation at this azimuth, degrees
    visible: bool  # el above horizon_el
    dir: tuple[float, float, float]  # unit vector Moon center -> body, MOON_ME frame


class Sample(BaseModel):
    time: datetime
    sun: BodyPosition
    earth: BodyPosition


class Summary(BaseModel):
    sun_visible_fraction: float
    earth_visible_fraction: float
    sun_max_el: float
    earth_max_el: float
    next_sunrise: datetime | None
    next_sunset: datetime | None
    next_earthrise: datetime | None
    next_earthset: datetime | None


class EphemerisResponse(BaseModel):
    lat: float
    lon: float
    start: datetime
    end: datetime
    step_minutes: float
    samples: list[Sample]
    summary: Summary


class HorizonResponse(BaseModel):
    lat: float
    lon: float
    ground_height_m: float  # terrain height above the 1737.4 km reference sphere
    observer_height_m: float
    az: list[float]  # degrees clockwise from north
    el: list[float]  # terrain horizon elevation, degrees
