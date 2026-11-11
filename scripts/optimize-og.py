import io
import sys
from pathlib import Path

from PIL import Image, ImageCms, features

LIMIT = 300 * 1024


def encode(image, icc):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True, icc_profile=icc)
    return buffer.getvalue()


def main(source, target, width, height):
    size = (int(width), int(height))
    image = Image.open(source).convert("RGB")
    if image.size != size:
        raise SystemExit(f"OG render is {image.size}, expected {size}")
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    data = encode(image, icc)
    if len(data) > LIMIT:
        method = (
            Image.Quantize.LIBIMAGEQUANT
            if features.check_feature("libimagequant")
            else Image.Quantize.FASTOCTREE
        )
        palette = image.quantize(colors=256, method=method, dither=Image.Dither.FLOYDSTEINBERG)
        data = encode(palette, icc)
    if len(data) > LIMIT:
        raise SystemExit(f"OG image is {len(data)} bytes, limit {LIMIT}")
    Path(target).write_bytes(data)


if __name__ == "__main__":
    main(*sys.argv[1:5])
