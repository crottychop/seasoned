#!/usr/bin/env python3
"""Die-cut an ingredient photo into a transparent PNG for the recipe grid.

Pipeline: load (file or URL) -> rembg background removal -> autocrop to the
subject -> pad to a square with a small margin -> resize -> save RGBA PNG to
pictures/ingredients/<name>.png.

Usage:
    ./process_ingredient.py <input-file-or-url> <output-name> [--size 600]

Example:
    ./process_ingredient.py /tmp/ginger.jpg ginger
    ./process_ingredient.py "https://example.com/onion.jpg" yellow-onion

Notes:
- Uses the cached `isnet-general-use` rembg model (sharper edges on produce/
  objects than u2net). Falls back to the default model if unavailable.
- Output is always square so the grid tiles line up regardless of source aspect.
"""
import io
import sys
import argparse
import urllib.request
from pathlib import Path

from PIL import Image
from rembg import remove, new_session

OUT_DIR = Path(__file__).parent / "pictures" / "ingredients"
MARGIN = 0.08  # transparent breathing room around the subject, fraction of side


def load_bytes(src: str) -> bytes:
    if src.startswith(("http://", "https://")):
        req = urllib.request.Request(src, headers={"User-Agent": "seasoned-cookbook/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    return Path(src).read_bytes()


def _has_alpha(img: Image.Image) -> bool:
    """True if the image already carries a real (non-opaque) alpha channel."""
    if img.mode not in ("RGBA", "LA"):
        return False
    return img.convert("RGBA").getchannel("A").getextrema()[0] < 255


def die_cut(src: str, name: str, size: int = 720) -> Path:
    raw = load_bytes(src)
    img = Image.open(io.BytesIO(raw))

    # If the source is already a clean cut-out (e.g. hand-done in Photoshop),
    # trust its alpha and skip rembg; otherwise remove the background.
    if _has_alpha(img):
        img = img.convert("RGBA")
    else:
        try:
            session = new_session("isnet-general-use")
        except Exception:
            session = None
        cut = remove(raw, session=session) if session else remove(raw)
        img = Image.open(io.BytesIO(cut)).convert("RGBA")

    # Autocrop to the non-transparent bounding box.
    bbox = img.split()[3].getbbox()
    if bbox:
        img = img.crop(bbox)

    # Pad to a square canvas with a small transparent margin.
    side = int(max(img.width, img.height) * (1 + 2 * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)

    canvas = canvas.resize((size, size), Image.LANCZOS)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{name}.webp"
    canvas.save(out, "WEBP", quality=86, method=6)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="image file path or http(s) URL")
    ap.add_argument("name", help="output base name (becomes <name>.png)")
    ap.add_argument("--size", type=int, default=720)
    args = ap.parse_args()

    out = die_cut(args.input, args.name, args.size)
    kb = out.stat().st_size / 1024
    print(f"✓ {out.relative_to(Path(__file__).parent)}  ({kb:.0f} KB)")


if __name__ == "__main__":
    main()
