import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core import dem, horizon
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_polar_and_global_dems_agree_where_they_overlap():
    rng = np.random.default_rng(1)
    lat = rng.uniform(-70, -62, 2000)
    lon = rng.uniform(0, 360, 2000)
    polar = dem._polar_height(lat, lon)
    glob = dem._global_height(lat, lon)
    assert np.corrcoef(polar, glob)[0, 1] > 0.99
    assert np.median(np.abs(polar - glob)) < 100


def test_shackleton_floor_is_ringed_by_crater_walls():
    # ~21 km wide, ~4.2 km deep: from the center the rim is ~atan(4.2/10.5) ≈ 22° up.
    _, el, _ = horizon.profile(-89.67, 129.78)
    assert 15 < el.min() and el.max() < 30


def test_flat_mare_horizon_is_near_zero():
    _, el, _ = horizon.profile(0.674, 23.473)  # Apollo 11, Mare Tranquillitatis
    assert np.abs(el).max() < 2


def test_shackleton_floor_is_permanently_shadowed(client):
    # Known permanently shadowed region: the Sun never clears the crater rim over a full year.
    r = client.get("/api/ephemeris", params=dict(
        lat=-89.67, lon=129.78, start="2026-01-01T00:00:00Z", end="2026-12-31T00:00:00Z", step_minutes=720))
    assert r.status_code == 200, r.text
    assert r.json()["summary"]["sun_visible_fraction"] == 0.0


def test_horizon_endpoint(client):
    r = client.get("/api/horizon", params=dict(lat=-84.79, lon=29.2))
    assert r.status_code == 200
    d = r.json()
    assert len(d["az"]) == len(d["el"]) == 720
    assert d["ground_height_m"] > 3000  # Mons Mouton is a ~6 km massif


def test_pole_is_clamped_not_degenerate(client):
    d = client.get("/api/horizon", params=dict(lat=-90, lon=0)).json()
    assert d["lat"] == -horizon.MAX_ABS_LAT
    assert np.ptp(d["el"]) > 0.1  # a real profile, not one point repeated


def test_terrain_tile_matches_dem(client):
    # Level 6 tile containing Shackleton (89.67°S, 129.78°E): heights should match the DEM point lookup.
    z = 6
    span = 180 / 2**z
    x, y = int((129.78 + 180) // span), int((90 + 89.67) // span)
    r = client.get(f"/api/terrain/{z}/{x}/{y}")
    assert r.status_code == 200
    h = np.frombuffer(r.content, dtype="<f4").reshape(65, 65)
    west, north = -180 + x * span, 90 - y * span
    assert h[0, 0] == pytest.approx(float(dem.height(north, west)), abs=1)
    assert h[-1, -1] == pytest.approx(float(dem.height(north - span, west + span)), abs=1)
    assert client.get("/api/terrain/3/99/0").status_code == 404


def test_polar_cap_geometry():
    from app.core import polar_imagery as P

    lat, lon = P._cap_latlon()
    n = P.CAP_SIZE_PX
    assert lat[n // 2, n // 2] < -89.99  # center pixel is the pole
    assert lat[0, n // 2] == pytest.approx(P.CAP_EDGE_LAT, abs=0.05)  # top-center pixel sits on the cap edge...
    assert lon[0, n // 2] == pytest.approx(0, abs=0.1)  # ...on the 0° meridian
    assert lon[n // 2, -1] == pytest.approx(90, abs=0.1)  # right edge is 90°E


def test_polar_cap_endpoint(client):
    r = client.get("/api/imagery/south/lola/cap.jpg")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert client.get("/api/imagery/south/nope/cap.jpg").status_code == 404
