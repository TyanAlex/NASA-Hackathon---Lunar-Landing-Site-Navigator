from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core import spice
from app.core.horizon import horizon_elevation
from app.models import BodyPosition, EphemerisResponse, Sample, Summary

router = APIRouter()

MAX_SAMPLES = 2000


def _utc(t: datetime) -> datetime:
    return t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t.astimezone(timezone.utc)


def _crossing(times: list[datetime], margins: list[float], rising: bool) -> datetime | None:
    """First time the margin (elevation minus horizon) crosses zero in the given direction,
    linearly interpolated between samples."""
    for i in range(1, len(margins)):
        a, b = margins[i - 1], margins[i]
        if (rising and a <= 0 < b) or (not rising and a > 0 >= b):
            frac = a / (a - b)
            return times[i - 1] + (times[i] - times[i - 1]) * frac
    return None


@router.get("/ephemeris", response_model=EphemerisResponse)
def ephemeris(
    lat: float = Query(..., ge=-90, le=90, description="Latitude, degrees north"),
    lon: float = Query(..., ge=-180, le=360, description="Longitude, degrees east"),
    start: datetime = Query(..., description="UTC start (ISO 8601)"),
    end: datetime = Query(..., description="UTC end (ISO 8601)"),
    step_minutes: float = Query(60, gt=0, le=1440),
) -> EphemerisResponse:
    start, end = _utc(start), _utc(end)
    if end <= start:
        raise HTTPException(422, "end must be after start")
    step = timedelta(minutes=step_minutes)
    n = int((end - start) / step) + 1
    if n > MAX_SAMPLES:
        raise HTTPException(422, f"Too many samples ({n}); max {MAX_SAMPLES}. Increase step_minutes.")

    obspos = spice.site_position(lat, lon)
    times = [start + step * i for i in range(n)]
    samples: list[Sample] = []
    sun_margin: list[float] = []
    earth_margin: list[float] = []

    for t in times:
        et = spice.to_et(t)
        bodies = {}
        for key, target, margins in (("sun", "SUN", sun_margin), ("earth", "EARTH", earth_margin)):
            az, el, rng = spice.azel(target, et, obspos)
            m = el - horizon_elevation(lat, lon, az)
            margins.append(m)
            bodies[key] = BodyPosition(az=az, el=el, range_km=rng, visible=m > 0)
        samples.append(Sample(time=t, **bodies))

    summary = Summary(
        sun_visible_fraction=sum(m > 0 for m in sun_margin) / n,
        earth_visible_fraction=sum(m > 0 for m in earth_margin) / n,
        sun_max_el=max(s.sun.el for s in samples),
        earth_max_el=max(s.earth.el for s in samples),
        next_sunrise=_crossing(times, sun_margin, rising=True),
        next_sunset=_crossing(times, sun_margin, rising=False),
        next_earthrise=_crossing(times, earth_margin, rising=True),
        next_earthset=_crossing(times, earth_margin, rising=False),
    )
    return EphemerisResponse(
        lat=lat, lon=lon, start=start, end=end, step_minutes=step_minutes, samples=samples, summary=summary
    )
