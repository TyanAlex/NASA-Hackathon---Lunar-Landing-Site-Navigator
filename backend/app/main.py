from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ephemeris, horizon, imagery, sites, terrain
from app.core import dem, polar_imagery, spice


@asynccontextmanager
async def lifespan(_: FastAPI):
    dem.check_files()
    polar_imagery.check_files()
    spice.load_kernels()
    yield
    spice.unload_kernels()


app = FastAPI(title="Lunar Lens API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "https://lunar-lens-three.vercel.app",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(sites.router, prefix="/api")
app.include_router(ephemeris.router, prefix="/api")
app.include_router(horizon.router, prefix="/api")
app.include_router(terrain.router, prefix="/api")
app.include_router(imagery.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
