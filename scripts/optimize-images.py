import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "content" / "images.json"


def load_config():
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    quality = config.get("quality")
    output = config.get("output")
    images = config.get("images")
    if not isinstance(quality, int) or not 1 <= quality <= 100:
        raise ValueError("images.json: quality must be an integer between 1 and 100")
    if not isinstance(output, str) or not output.startswith("screenshots/"):
        raise ValueError("images.json: output must live under screenshots/")
    if not isinstance(images, list) or not images:
        raise ValueError("images.json: images must be a non-empty list")
    return quality, ROOT / output, output, images


def encode(image, width, quality):
    height = round(image.height * width / image.width)
    resized = image if width == image.width else image.resize((width, height), Image.LANCZOS)
    buffer = io.BytesIO()
    resized.save(buffer, "WEBP", quality=quality, method=6)
    return buffer.getvalue(), height


def optimize(entry, quality, target, public_dir):
    source = ROOT / entry["source"]
    if not source.is_file():
        raise FileNotFoundError(f"Missing source image: {entry['source']}")
    stem = source.stem
    with Image.open(source) as opened:
        image = opened.convert("RGBA" if opened.mode in ("RGBA", "LA", "P") else "RGB")
    widths = sorted({min(width, image.width) for width in entry["widths"]})
    variants = []
    for width in widths:
        data, height = encode(image, width, quality)
        digest = hashlib.sha256(data).hexdigest()[:10]
        name = f"{stem}-{width}.{digest}.webp"
        (target / name).write_bytes(data)
        variants.append({"src": f"/{public_dir}/{name}", "width": width, "height": height, "bytes": len(data)})
    largest = variants[-1]
    return stem, {"width": largest["width"], "height": largest["height"], "variants": variants}


def main():
    quality, target, public_dir, images = load_config()
    target.mkdir(parents=True, exist_ok=True)
    for stale in target.glob("*.webp"):
        stale.unlink()
    manifest = dict(sorted(optimize(entry, quality, target, public_dir) for entry in images))
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    total = sum(variant["bytes"] for item in manifest.values() for variant in item["variants"])
    print(f"Optimized {len(manifest)} images into {public_dir}: {total // 1024} KB")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"optimize-images: {error}", file=sys.stderr)
        sys.exit(1)
