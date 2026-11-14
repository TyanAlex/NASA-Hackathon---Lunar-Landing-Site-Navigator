"""Download the SPICE kernels the backend needs into data/kernels/."""

import shutil
import ssl
import sys
import urllib.request
from pathlib import Path

import certifi

BASE = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
KERNELS = {
    "naif0012.tls": f"{BASE}/lsk/naif0012.tls",
    "pck00011.tpc": f"{BASE}/pck/pck00011.tpc",
    "de440s.bsp": f"{BASE}/spk/planets/de440s.bsp",
    "moon_pa_de440_200625.bpc": f"{BASE}/pck/moon_pa_de440_200625.bpc",
    "moon_de440_250416.tf": f"{BASE}/fk/satellites/moon_de440_250416.tf",
}

KERNEL_DIR = Path(__file__).resolve().parent.parent / "data" / "kernels"

# python.org macOS builds don't use the system trust store; certifi's bundle works everywhere.
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


def main() -> int:
    KERNEL_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in KERNELS.items():
        dest = KERNEL_DIR / name
        if dest.exists():
            print(f"✓ {name} (already present)")
            continue
        print(f"↓ {name} ...", flush=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        with urllib.request.urlopen(url, context=SSL_CONTEXT) as resp, open(tmp, "wb") as out:
            shutil.copyfileobj(resp, out)
        tmp.rename(dest)
    print(f"Kernels ready in {KERNEL_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
