import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # context manager runs lifespan -> loads kernels
        yield c


def get(client, **params):
    r = client.get("/api/ephemeris", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_sites(client):
    sites = client.get("/api/sites").json()
    assert any(s["id"] == "apollo-11" for s in sites)


def test_near_side_equator_sees_full_sun_range(client):
    # One synodic month at Apollo 11: Sun swings from below horizon to high noon.
    d = get(client, lat=0.674, lon=23.473, start="2026-12-01T00:00:00Z", end="2026-12-31T00:00:00Z", step_minutes=360)
    assert d["summary"]["sun_max_el"] > 60
    assert 0.35 < d["summary"]["sun_visible_fraction"] < 0.65
    # Near side, close to sub-Earth point: Earth always well above horizon.
    assert d["summary"]["earth_visible_fraction"] == 1.0
    assert min(s["earth"]["el"] for s in d["samples"]) > 50


def test_south_pole_sun_stays_grazing(client):
    d = get(client, lat=-89.9, lon=0, start="2026-12-01T00:00:00Z", end="2026-12-31T00:00:00Z", step_minutes=360)
    els = [s["sun"]["el"] for s in d["samples"]]
    assert all(abs(e) < 2.0 for e in els)  # obliquity ~1.54° + 0.1° from pole


def test_far_side_never_sees_earth(client):
    d = get(client, lat=-45.44, lon=177.6, start="2026-12-01T00:00:00Z", end="2026-12-31T00:00:00Z", step_minutes=360)
    assert d["summary"]["earth_visible_fraction"] == 0.0


def test_rejects_too_many_samples(client):
    r = client.get("/api/ephemeris", params=dict(lat=0, lon=0, start="2026-01-01T00:00:00Z", end="2026-12-31T00:00:00Z", step_minutes=1))
    assert r.status_code == 422
