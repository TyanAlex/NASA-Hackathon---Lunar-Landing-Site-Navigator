# Backend — Lunar Landing Site Navigator API

FastAPI service that computes Sun and Earth azimuth/elevation from any lunar surface site using NASA/NAIF SPICE (DE440 ephemeris, `MOON_ME` frame). Results match JPL Horizons to <0.001°.

## Setup

```fish
cd backend
python3 -m venv .venv
source .venv/bin/activate.fish   # bash/zsh: source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_kernels.py   # ~44 MB, into data/kernels/ (gitignored)
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
| GET | `/api/ephemeris?lat&lon&start&end&step_minutes` | Sun/Earth az/el time series + summary (visible fraction, next sunrise/sunset/earthrise/earthset). Max 2000 samples. |

Azimuth is degrees clockwise from north; elevation is relative to the local ellipsoid horizontal.

## Limitations

- **Horizon is a smooth sphere** (`app/core/horizon.py` returns 0°). Terrain-aware horizons from LOLA DEMs are the next step — this matters a lot at the south pole.
- Sites marked `approximate: true` should be verified in Quickmap before relying on them.

## Tests

```fish
pytest
```
