import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "screenshots" / "web" / "manifest.json"
CROPS = ROOT / "content" / "screen-crops.json"
MATTE = (234, 235, 239)
PHONE_RATIO = 9 / 19.5
TOLERANCE = 8


def distance(first, second):
    return max(abs(a - b) for a, b in zip(first[:3], second[:3]))


def median(pixels):
    ordered = sorted(pixels, key=lambda pixel: sum(pixel[:3]))
    return ordered[len(ordered) // 2]


def row(image, y):
    margin = image.width // 10
    return median([image.getpixel((x, y)) for x in range(margin, image.width - margin)])


def side_streaks(column, ruled):
    runs = []
    for y, pixel in enumerate(column):
        if runs and distance(pixel, runs[-1][2]) <= 6:
            runs[-1][1] = y
        else:
            runs.append([y, y, pixel])
    streaks = []
    for index in range(1, len(runs) - 1):
        start, stop, pixel = runs[index]
        before, after = runs[index - 1][2], runs[index + 1][2]
        excursion = min(distance(pixel, before), distance(pixel, after))
        if stop - start < 5 and distance(before, after) <= 12 and excursion > 24 and not ruled(start):
            streaks.append(start)
    return streaks


def check(key, entry):
    problems = []
    fit = entry.get("fit")
    if fit is None:
        return [f"{key}: phone capture has no fit record"]
    path = ROOT / entry["variants"][-1]["src"].lstrip("/")
    with Image.open(path) as opened:
        image = opened.convert("RGB")
    width, height = image.size
    if abs(width / height - PHONE_RATIO) > 0.004:
        problems.append(f"{key}: {width}x{height} is not 9:19.5")
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    for point in corners:
        if distance(image.getpixel(point), MATTE) <= 3:
            problems.append(f"{key}: corner {point} is the mockup matte")
    if fit["top"]:
        content = row(image, fit["top"] + 1)
        for y in (0, fit["top"] // 2, fit["top"] - 1):
            if distance(row(image, y), content) > TOLERANCE:
                problems.append(f"{key}: top band row {y} {row(image, y)} differs from content {content}")
    if fit["bottom"]:
        edge = height - fit["bottom"]
        content = row(image, edge - 2)
        for y in (edge, edge + fit["bottom"] // 2, height - 1):
            if distance(row(image, y), content) > TOLERANCE:
                problems.append(f"{key}: bottom band row {y} {row(image, y)} differs from content {content}")
    for side, band in (("left", range(fit["left"])), ("right", range(width - fit["right"], width))):
        if not band:
            continue
        inner = band[-1] + 1 if side == "left" else band[0] - 1
        step = 1 if side == "left" else -1
        middle = band[len(band) // 2]
        column = [image.getpixel((middle, y)) for y in range(height)]
        streaks = side_streaks(column, lambda y: distance(row(image, y), column[y]) <= 16)
        if streaks:
            problems.append(f"{key}: {side} band has row streaks at {streaks[:5]}")
        loose = 0
        for y in range(0, height, 2):
            edge = image.getpixel((inner, y))
            if all(
                distance(image.getpixel((inner + step * offset, near)), edge) <= 10
                for offset in range(12)
                for near in range(max(0, y - 2), min(height, y + 3))
            ):
                loose += distance(column[y], edge) > 3 * TOLERANCE
        if loose > height // 100:
            problems.append(f"{key}: {side} band breaks off a flat content edge on {loose} rows")
    return problems


def last_row(entry):
    path = ROOT / entry["variants"][-1]["src"].lstrip("/")
    with Image.open(path) as opened:
        image = opened.convert("RGB")
    return row(image, image.height - 1)


def check_trims(phones):
    problems = []
    trims = json.loads(CROPS.read_text(encoding="utf-8")).get("phoneTrims", {})
    for key in sorted(trims):
        if key not in phones:
            problems.append(f"{key}: phoneTrims names no phone capture")
            continue
        project = key.split("-")[0]
        bottom = last_row(phones[key])
        for sibling in sorted(other for other in phones if other != key and other.split("-")[0] == project):
            other = last_row(phones[sibling])
            if distance(bottom, other) > TOLERANCE:
                problems.append(f"{key}: trimmed bottom {bottom} differs from {sibling} bottom {other}")
    return problems


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    phones = {key: entry for key, entry in manifest.items() if entry["width"] < entry["height"]}
    problems = [problem for key, entry in sorted(phones.items()) for problem in check(key, entry)]
    problems += check_trims(phones)
    for problem in problems:
        print(problem, file=sys.stderr)
    print(f"Checked {len(phones)} phone captures: {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
