# Backend — Lunar Lens API

FastAPI service that computes Sun and Earth azimuth/elevation from any lunar surface site using NASA/NAIF SPICE (DE440 ephemeris, `MOON_ME` frame), and decides visibility against the **real terrain horizon** computed from LRO LOLA elevation models. Sun/Earth positions match JPL Horizons to <0.001°.

## Setup

```fish
cd backend
python3 -m venv .venv
source .venv/bin/activate.fish   # bash/zsh: source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_data.py   # ~450 MB into data/ (gitignored): SPICE kernels, LOLA DEMs, LROC WAC polar mosaic
```

## Run

```fish
uvicorn app.main:app --reload
```

Interactive docs: http://localhost:8000/docs. The Vite dev server proxies `/api` here.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/sites` | Curated landing sites (`app/data/sites.json`) |
| GET | `/api/ephemeris?lat&lon&start&end&step_minutes` | Sun/Earth az/el time series, each with the terrain horizon at that azimuth, plus summary (visible fraction, next sunrise/sunset/earthrise/earthset). Max 2000 samples. |
| GET | `/api/horizon?lat&lon` | 360° terrain horizon profile (0.5° steps) and ground height |
| GET | `/api/terrain/{z}/{x}/{y}` | 65×65 float32 heightmap tile for the 3D globe (Cesium geographic tiling), from the same LOLA DEMs |
| GET | `/api/imagery/south/{wac\|lola}/cap.jpg` | 4096² south polar stereographic image (75°S–pole) sampled by the globe's polar shader, so the pole doesn't smear |

Azimuth is degrees clockwise from north; elevation is relative to the local horizontal. Latitudes are clamped to ±89.99° (azimuth is undefined exactly at a pole).

## Terrain horizon

`app/core/horizon.py` marches outward along each azimuth to 200 km and takes the maximum elevation angle to the terrain, including the Moon's curvature (no atmosphere, so no refraction). Observer is 2 m above the ground.

Elevation data (`app/core/dem.py`):

| Region | Product | Resolution |
|---|---|---|
| 60°S – pole | `LDEM_60S_240M` (polar stereographic) | 240 m/px |
| Everywhere else | `LDEM_16` (simple cylindrical) | ~1.9 km/px |

Sanity checks in `tests/test_horizon.py`: the two DEMs agree where they overlap (corr > 0.99), Shackleton's floor is ringed by ~22° walls and never sees the Sun over a full year (known permanently shadowed region), and a flat mare horizon stays within ±2°.

## Limitations

- North polar sites use the coarse global DEM (add `LDEM_60N_240M` if needed).
- Sites marked `approximate: true` should be verified in Quickmap before relying on them.

## Tests

```fish
pytest
```
