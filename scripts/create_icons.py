from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parent.parent
icons_dir = root / 'assets' / 'icons'
icons_dir.mkdir(parents=True, exist_ok=True)

for size in (192, 512):
    width = height = size
    bg = (11, 15, 23)
    accent = (255, 176, 0)
    border = (255, 208, 102)
    pixels = bytearray()
    radius = size // 2 - 8

    for y in range(height):
        pixels.append(0)
        for x in range(width):
            dx = min(x, width - 1 - x)
            dy = min(y, height - 1 - y)
            # rounded-square mask
            if dx < 8 or dy < 8 or (x - width // 2) ** 2 + (y - height // 2) ** 2 > radius * radius:
                color = bg
            else:
                cx = width // 2
                cy = height // 2
                if max(abs(x - cx), abs(y - cy)) < width // 3:
                    color = accent
                else:
                    color = bg
            if dx < 10 and dy < 10:
                color = border
            pixels.extend(color)

    raw = zlib.compress(pixels)
    path = icons_dir / f'icon-{size}.png'
    with path.open('wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')

        def chunk(tag, data):
            f.write(struct.pack('!I', len(data)))
            f.write(tag)
            f.write(data)
            f.write(struct.pack('!I', zlib.crc32(tag + data) & 0xffffffff))

        ihdr = struct.pack('!IIBBBBB', width, height, 8, 2, 0, 0, 0)
        chunk(b'IHDR', ihdr)
        chunk(b'IDAT', raw)
        chunk(b'IEND', b'')

print('created icons')
