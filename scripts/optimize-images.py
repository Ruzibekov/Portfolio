import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "content" / "images.json"
PHONE_RATIO = 9 / 19.5


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


MATTE = (234, 235, 239)
CROPS = ROOT / "content" / "screen-crops.json"


def load_trims():
    trims = json.loads(CROPS.read_text(encoding="utf-8")).get("phoneTrims", {})
    if not isinstance(trims, dict):
        raise ValueError("screen-crops.json: phoneTrims must be an object")
    for key, trim in trims.items():
        if (
            not isinstance(trim, dict)
            or set(trim) - {"top", "right", "bottom", "left"}
            or not all(
                isinstance(value, int) and not isinstance(value, bool) and value >= 0
                for value in trim.values()
            )
        ):
            raise ValueError(
                f"screen-crops.json: phoneTrims.{key} needs non-negative top/right/bottom/left integers"
            )
    return trims


def distance(first, second):
    return max(abs(a - b) for a, b in zip(first[:3], second[:3]))


def median(pixels):
    ordered = sorted(pixels, key=lambda pixel: sum(pixel[:3]))
    return ordered[len(ordered) // 2]


def row_surface(image, y, margin):
    width = image.width
    return median([image.getpixel((x, y)) for x in range(margin, width - margin)])


def has_matte(image):
    width, height = image.size
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    return sum(distance(image.getpixel(point), MATTE) <= 4 for point in corners) >= 3


def corner_shape(image, corner, is_matte):
    x0, y0 = corner
    dx = 1 if x0 == 0 else -1
    dy = 1 if y0 == 0 else -1
    inside = image.getpixel((x0 + dx * 14, y0 + dy * 14))
    reach = 0
    while reach < 12 and is_matte(image.getpixel((x0 + dx * reach, y0 + dy * reach)), inside):
        reach += 1
    if not reach:
        return 0, set()
    size = int(reach * 3.42) + 14

    def at(ox, oy):
        return image.getpixel((x0 + dx * ox, y0 + dy * oy))

    def blend(pixel):
        mixed = distance(pixel, MATTE) + distance(pixel, inside) <= distance(MATTE, inside) + 12
        return mixed and distance(pixel, inside) > 24

    def grow(cells, accept):
        found = set(cells)
        queue = list(cells)
        while queue:
            ox, oy = queue.pop()
            for nx, ny in [(ox + 1, oy), (ox, oy + 1), (ox - 1, oy), (ox, oy - 1)]:
                if 0 <= nx < size and 0 <= ny < size and (nx, ny) not in found and accept(nx, ny):
                    found.add((nx, ny))
                    queue.append((nx, ny))
        return found

    found = grow([(0, 0)], lambda ox, oy: is_matte(at(ox, oy), inside))
    for _ in range(8):
        found |= {
            (nx, ny)
            for ox, oy in found
            for nx, ny in [(ox + 1, oy), (ox, oy + 1)]
            if nx < size and ny < size and blend(at(nx, ny))
        }
    ring = {
        (ox + mx, oy + my)
        for ox, oy in found
        for mx in (0, 1, 2)
        for my in (0, 1, 2)
        if ox + mx < size and oy + my < size
    }
    return size, ring


def paint_corners(image, is_matte):
    width, height = image.size
    pixels = image.load()
    original = image.copy().load()
    for corner in [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]:
        size, ring = corner_shape(image, corner, is_matte)
        x0, y0 = corner

        def place(ox, oy):
            return (ox if x0 == 0 else width - 1 - ox, oy if y0 == 0 else height - 1 - oy)

        inside = original[place(14, 14)]

        def open_cell(ox, oy):
            return (ox, oy) not in ring and not is_matte(original[place(ox, oy)], inside)

        for ox, oy in ring:
            across = next((x for x in range(ox, width // 2) if open_cell(x, oy)), width // 2)
            down = next((y for y in range(oy, height // 2) if open_cell(ox, y)), height // 2)
            source = (across, oy) if across - ox <= down - oy else (ox, down)
            pixels[place(ox, oy)] = original[place(*source)]
    return image


def stray_edges(image):
    width, height = image.size
    lines = {
        "left": ([(0, y) for y in range(height)], [(1, y) for y in range(height)]),
        "right": (
            [(width - 1, y) for y in range(height)],
            [(width - 2, y) for y in range(height)],
        ),
        "top": ([(x, 0) for x in range(width)], [(x, 1) for x in range(width)]),
        "bottom": (
            [(x, height - 1) for x in range(width)],
            [(x, height - 2) for x in range(width)],
        ),
    }
    stray = {}
    for side, (edge, inner) in lines.items():
        edge_pixels = [image.getpixel(point) for point in edge]
        inner_pixels = [image.getpixel(point) for point in inner]
        flat = median(edge_pixels)
        uniform = sum(distance(pixel, flat) <= 4 for pixel in edge_pixels) >= 0.9 * len(
            edge_pixels
        )
        gap = sum(distance(a, b) for a, b in zip(edge_pixels, inner_pixels)) / len(
            edge_pixels
        )
        stray[side] = 1 if uniform and gap > 20 else 0
    return stray


def clear_matte(image):
    stray = stray_edges(image)
    if any(stray.values()) and not has_matte(image):
        image = image.crop(
            (
                stray["left"],
                stray["top"],
                image.width - stray["right"],
                image.height - stray["bottom"],
            )
        )
    if has_matte(image):
        inner = image.crop((1, 1, image.width - 1, image.height - 1))
        return paint_corners(inner, lambda pixel, inside: distance(pixel, MATTE) <= 5)
    return paint_corners(
        image.copy(),
        lambda pixel, inside: (
            distance(pixel, MATTE) <= 16 and distance(pixel, inside) > 40
        ),
    )


def side_band(image, edge, inward, size):
    height = image.height
    colours = []
    for y in range(height):
        pixel = image.getpixel((edge, y))
        flat = all(
            distance(image.getpixel((edge + inward * step, near)), pixel) <= 10
            for step in range(12)
            for near in range(max(0, y - 2), min(height, y + 3))
        )
        colours.append(pixel if flat else None)
    known = [y for y, colour in enumerate(colours) if colour is not None]
    if not known:
        surface = median([image.getpixel((edge, y)) for y in range(height)])
        colours = [surface] * height
    else:
        nearest = 0
        for y in range(height):
            while nearest + 1 < len(known) and abs(known[nearest + 1] - y) <= abs(known[nearest] - y):
                nearest += 1
            if colours[y] is None:
                colours[y] = colours[known[nearest]]
    shortest = max(5, round(5 * image.width / 540))
    runs = []
    for y, colour in enumerate(colours):
        if runs and distance(colour, runs[-1][2]) <= 6:
            runs[-1][1] = y
        else:
            runs.append([y, y, colour])
    for index in range(1, len(runs) - 1):
        start, stop, colour = runs[index]
        before = runs[index - 1][2]
        if stop - start < shortest and distance(before, runs[index + 1][2]) <= 24:
            colours[start : stop + 1] = [before] * (stop - start + 1)
    column = Image.new(image.mode, (1, height))
    column.putdata(colours)
    return column.resize((size, height))


def fit_phone(image, trim):
    if image.width >= image.height:
        return image, None
    image = clear_matte(image)
    if trim:
        image = image.crop(
            (
                trim.get("left", 0),
                trim.get("top", 0),
                image.width - trim.get("right", 0),
                image.height - trim.get("bottom", 0),
            )
        )
    width, height = image.size
    wide = round(height * PHONE_RATIO)
    tall = round(width / PHONE_RATIO)
    fit = {"top": 0, "right": 0, "bottom": 0, "left": 0}
    if wide == width or tall == height:
        return image, fit
    if 0 < wide - width <= 3 or 0 < tall - height <= 3:
        return image.resize((max(wide, width), max(tall, height)), Image.Resampling.LANCZOS), fit
    if wide > width:
        left = (wide - width) // 2
        right = wide - width - left
        canvas = Image.new(image.mode, (wide, height))
        canvas.paste(image, (left, 0))
        if left:
            canvas.paste(side_band(image, 0, 1, left), (0, 0))
        if right:
            canvas.paste(side_band(image, width - 1, -1, right), (left + width, 0))
        fit.update(left=left, right=right)
        return canvas, fit
    top = (tall - height) // 2
    bottom = tall - height - top
    margin = width // 10
    canvas = Image.new(image.mode, (width, tall), row_surface(image, 0, margin))
    if bottom:
        canvas.paste(
            Image.new(
                image.mode, (width, bottom), row_surface(image, height - 1, margin)
            ),
            (0, top + height),
        )
    canvas.paste(image, (0, top))
    fit.update(top=top, bottom=bottom)
    return canvas, fit


def encode(image, width, quality):
    height = round(image.height * width / image.width)
    resized = (
        image if width == image.width else image.resize((width, height), Image.Resampling.LANCZOS)
    )
    buffer = io.BytesIO()
    resized.save(buffer, "WEBP", quality=quality, method=6)
    return buffer.getvalue(), height


def optimize(entry, quality, target, public_dir, trims):
    source = ROOT / entry["source"]
    if not source.is_file():
        raise FileNotFoundError(f"Missing source image: {entry['source']}")
    stem = source.stem
    with Image.open(source) as opened:
        image, fit = fit_phone(
            opened.convert("RGBA" if opened.mode in ("RGBA", "LA", "P") else "RGB"),
            trims.get(stem),
        )
    widths = sorted({min(width, image.width) for width in entry["widths"]})
    variants = []
    for width in widths:
        data, height = encode(image, width, quality)
        digest = hashlib.sha256(data).hexdigest()[:10]
        name = f"{stem}-{width}.{digest}.webp"
        (target / name).write_bytes(data)
        variants.append(
            {
                "src": f"/{public_dir}/{name}",
                "width": width,
                "height": height,
                "bytes": len(data),
            }
        )
    largest = variants[-1]
    record = {
        "width": largest["width"],
        "height": largest["height"],
        "variants": variants,
    }
    if fit is not None:
        scale = largest["width"] / image.width
        record["fit"] = {side: round(value * scale) for side, value in fit.items()}
    return stem, record


def main():
    quality, target, public_dir, images = load_config()
    trims = load_trims()
    stems = {Path(entry["source"]).stem for entry in images}
    unknown = sorted(set(trims) - stems)
    if unknown:
        raise ValueError(f"screen-crops.json: phoneTrims for unknown images {unknown}")
    target.mkdir(parents=True, exist_ok=True)
    for stale in target.glob("*.webp"):
        stale.unlink()
    manifest = dict(
        sorted(optimize(entry, quality, target, public_dir, trims) for entry in images)
    )
    (target / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    total = sum(
        variant["bytes"] for item in manifest.values() for variant in item["variants"]
    )
    print(f"Optimized {len(manifest)} images into {public_dir}: {total // 1024} KB")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"optimize-images: {error}", file=sys.stderr)
        sys.exit(1)
