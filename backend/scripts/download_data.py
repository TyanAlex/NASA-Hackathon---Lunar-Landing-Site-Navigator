"""Download the data the backend needs: SPICE kernels (data/kernels/), LOLA DEMs (data/dem/),
and the LROC WAC south polar mosaic (data/imagery/)."""

import shutil
import ssl
import sys
import urllib.request
from pathlib import Path

import certifi

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
LOLA = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr"
LROC = "https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA/BDR/WAC_GLOBAL"

FILES = {
    "kernels/naif0012.tls": f"{NAIF}/lsk/naif0012.tls",
    "kernels/pck00011.tpc": f"{NAIF}/pck/pck00011.tpc",
    "kernels/de440s.bsp": f"{NAIF}/spk/planets/de440s.bsp",
    "kernels/moon_pa_de440_200625.bpc": f"{NAIF}/pck/moon_pa_de440_200625.bpc",
    "kernels/moon_de440_250416.tf": f"{NAIF}/fk/satellites/moon_de440_250416.tf",
    # LOLA DEMs: south polar stereographic 240 m/px (60°S–90°S), global cylindrical 16 px/deg (~1.9 km).
    "dem/ldem_60s_240m.img": f"{LOLA}/polar/img/ldem_60s_240m.img",
    "dem/ldem_60s_240m.lbl": f"{LOLA}/polar/img/ldem_60s_240m.lbl",
    "dem/ldem_16.img": f"{LOLA}/cylindrical/img/ldem_16.img",
    "dem/ldem_16.lbl": f"{LOLA}/cylindrical/img/ldem_16.lbl",
    # LROC WAC south polar mosaic, polar stereographic 128 px/deg (~237 m/px), 60°S–90°S. Label is attached.
    "imagery/wac_p900s0000_128p.img": f"{LROC}/WAC_GLOBAL_P900S0000_128P.IMG",
}

# python.org macOS builds don't use the system trust store; certifi's bundle works everywhere.
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


def main() -> int:
    for rel, url in FILES.items():
        dest = DATA_DIR / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            print(f"✓ {rel} (already present)")
            continue
        print(f"↓ {rel} ...", flush=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        with urllib.request.urlopen(url, context=SSL_CONTEXT) as resp, open(tmp, "wb") as out:
            shutil.copyfileobj(resp, out)
        tmp.rename(dest)
    print(f"Data ready in {DATA_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
