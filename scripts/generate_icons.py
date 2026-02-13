"""
Generate Qvé app icon set from brand identity.
Uses Cormorant Garamond Light "Q" lettermark on dark background with wine accent.

Brand colors from landing page:
- Background: #0A0908
- Wine accent: #8B4A5C
- Text primary: #F0EDE6
"""

import os
import struct
from PIL import Image, ImageDraw, ImageFont

# Paths
TEMP = os.environ['TEMP']
FONT_PATH = os.path.join(TEMP, 'CormorantGaramond-Light.woff2')
STATIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'qve', 'static')

# Brand colors
BG_COLOR = (10, 9, 8, 255)        # #0A0908
TEXT_COLOR = (240, 237, 230, 255)  # #F0EDE6
WINE_COLOR = (139, 74, 92, 255)   # #8B4A5C


def create_icon(size, output_path):
    """Create a single icon at the given size."""
    img = Image.new('RGBA', (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Scale font to fill ~65% of the icon
    font_size = int(size * 0.72)
    font = ImageFont.truetype(FONT_PATH, font_size)

    # Measure the Q
    bbox = draw.textbbox((0, 0), 'Q', font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Center it (nudge up slightly since Q's tail hangs below baseline)
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1] - (size * 0.03)

    # Draw the Q in text color
    draw.text((x, y), 'Q', font=font, fill=TEXT_COLOR)

    # Add a subtle wine-colored accent line under the Q tail
    line_y = int(y + text_h + bbox[1] + size * 0.02)
    line_h = max(1, int(size * 0.015))
    line_w = int(size * 0.2)
    line_x = int((size - line_w) / 2)

    # Only add accent line on larger icons where it's visible
    if size >= 64:
        draw.rectangle(
            [line_x, line_y, line_x + line_w, line_y + line_h],
            fill=WINE_COLOR
        )

    img.save(output_path, 'PNG')
    print(f'  Created {output_path} ({size}x{size}, {os.path.getsize(output_path)} bytes)')
    return img


def create_ico(images_16_32, output_path):
    """Create a proper .ico file with 16x16 and 32x32 sizes."""
    img_32 = images_16_32[1]
    img_16 = images_16_32[0]
    img_32.save(output_path, format='ICO', sizes=[(16, 16), (32, 32)],
                append_images=[img_16])
    print(f'  Created {output_path} (ICO, {os.path.getsize(output_path)} bytes)')


def create_svg_favicon(output_path):
    """Create an SVG favicon with dark mode support."""
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    rect { fill: #0A0908; }
    text { fill: #F0EDE6; }
    line { stroke: #8B4A5C; }
    @media (prefers-color-scheme: light) {
      rect { fill: #FAF9F7; }
      text { fill: #1A1918; }
    }
  </style>
  <rect width="100" height="100" rx="12"/>
  <text x="50" y="72" font-family="'Cormorant Garamond',Georgia,serif" font-size="72" font-weight="300" text-anchor="middle">Q</text>
  <line x1="40" y1="80" x2="60" y2="80" stroke-width="1.5" stroke-linecap="round"/>
</svg>'''
    with open(output_path, 'w') as f:
        f.write(svg)
    print(f'  Created {output_path} (SVG favicon with dark mode support)')


def main():
    os.makedirs(STATIC_DIR, exist_ok=True)
    print('Generating Qvé icon set...\n')

    # Generate PNG icons
    sizes = {
        'favicon-32x32.png': 32,
        'icon-192.png': 192,
        'icon-512.png': 512,
    }

    images = {}
    for filename, size in sizes.items():
        path = os.path.join(STATIC_DIR, filename)
        images[size] = create_icon(size, path)

    # Generate 16x16 for ICO (not saved separately)
    img_16 = create_icon(16, os.path.join(TEMP, 'icon-16.png'))

    # Generate proper .ico file
    create_ico([img_16, images[32]], os.path.join(STATIC_DIR, 'favicon.ico'))

    # Generate SVG favicon
    create_svg_favicon(os.path.join(STATIC_DIR, 'favicon.svg'))

    # Generate apple-touch-icon (180x180)
    create_icon(180, os.path.join(STATIC_DIR, 'apple-touch-icon.png'))

    print('\nDone! Generated:')
    print('  - favicon.ico (16+32, proper ICO format)')
    print('  - favicon.svg (scalable, dark mode aware)')
    print('  - favicon-32x32.png')
    print('  - apple-touch-icon.png (180x180)')
    print('  - icon-192.png (PWA)')
    print('  - icon-512.png (PWA install/splash)')


if __name__ == '__main__':
    main()
