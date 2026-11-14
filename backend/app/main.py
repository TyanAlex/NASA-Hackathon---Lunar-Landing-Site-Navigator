from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ephemeris, sites
from app.core import spice


@asynccontextmanager
async def lifespan(_: FastAPI):
    spice.load_kernels()
    yield
    spice.unload_kernels()


app = FastAPI(title="Lunar Landing Site Navigator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(sites.router, prefix="/api")
app.include_router(ephemeris.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
