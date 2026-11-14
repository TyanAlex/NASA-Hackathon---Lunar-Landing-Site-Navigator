import json
from functools import cache
from pathlib import Path

from fastapi import APIRouter

from app.models import Site

router = APIRouter()

SITES_FILE = Path(__file__).resolve().parents[1] / "data" / "sites.json"


@cache
def load_sites() -> list[Site]:
    return [Site(**s) for s in json.loads(SITES_FILE.read_text())]


@router.get("/sites", response_model=list[Site])
def sites() -> list[Site]:
    return load_sites()
