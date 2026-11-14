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
    visible: bool  # above the local horizon profile


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
