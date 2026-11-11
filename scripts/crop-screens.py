import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS = ROOT / "screenshots"
CONFIG = ROOT / "content" / "screen-crops.json"


def inside(path, folder):
    try:
        path.resolve().relative_to(folder.resolve())
    except ValueError:
        return False
    return True


def validate(crops):
    if not isinstance(crops, list) or not crops:
        raise ValueError("Crop config needs a non-empty crops list")
    seen = set()
    plans = []
    for index, entry in enumerate(crops):
        label = f"crop #{index + 1}"
        for field in ("source", "box", "output"):
            if field not in entry:
                raise ValueError(f"{label} is missing {field}")
        source = ROOT / entry["source"]
        output = ROOT / entry["output"]
        if not inside(source, SCREENSHOTS) or not source.is_file():
            raise ValueError(
                f"{label} source must be an existing file under screenshots/: {entry['source']}"
            )
        if not inside(output, SCREENSHOTS) or output.suffix != ".png":
            raise ValueError(
                f"{label} output must be a PNG under screenshots/: {entry['output']}"
            )
        key = output.resolve()
        if key in seen:
            raise ValueError(f"{label} repeats output {entry['output']}")
        seen.add(key)
        box = entry["box"]
        if (
            not isinstance(box, list)
            or len(box) != 4
            or not all(
                isinstance(value, int) and not isinstance(value, bool) for value in box
            )
        ):
            raise ValueError(
                f"{label} box must be four integers [x, y, width, height]: {box}"
            )
        x, y, width, height = box
        if width <= 0 or height <= 0:
            raise ValueError(f"{label} box width and height must be positive: {box}")
        with Image.open(source) as opened:
            if x < 0 or y < 0 or x + width > opened.width or y + height > opened.height:
                raise ValueError(
                    f"{label} box {box} is outside {entry['source']} ({opened.width}x{opened.height})"
                )
        plans.append((source, output, (x, y, x + width, y + height)))
    return plans


def main():
    config = Path(sys.argv[1]) if len(sys.argv) > 1 else CONFIG
    crops = json.loads(config.read_text(encoding="utf-8")).get("crops")
    plans = validate(crops)
    for source, output, box in plans:
        with Image.open(source) as opened:
            opened.convert("RGB").crop(box).save(output, "PNG", optimize=True)
    print(f"Cropped {len(plans)} phone screens")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError, AttributeError) as error:
        print(f"crop-screens: {error}", file=sys.stderr)
        sys.exit(1)
