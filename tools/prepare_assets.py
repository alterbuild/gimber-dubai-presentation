#!/usr/bin/env python3
"""Prepares the photos and logos of the deck from the team's own files.

Reads the images straight out of the draft deck (GIMBER PRESENTATION.pptx) and the report (GIMBER_Dubai_Report1.docx),
removes the rounded transparent corners they carry, and writes web-sized JPEGs to assets/img/. The wordmark comes from the real logo
(assets/logos/gimber-original.png) and is written as transparent black and white versions in assets/logos/.
Run once (the results are committed to the folder):  python3 tools/prepare_assets.py
Needs: Pillow.
"""
import io
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT.parent / 'Final project:presentation'
PPTX = BASE / 'GIMBER PRESENTATION.pptx'
DOCX = BASE / 'GIMBER_Dubai_Report1.docx'
OUT = ROOT / 'assets' / 'img'
LOGO = ROOT / 'assets' / 'logos'

# name -> (member in the pptx, optional max width)
PPTX_IMAGES = {
    'cover-bottle': ('image1.jpeg', 1000),
    'close-cocktails': ('image81.jpeg', 900),
    'n1-mug': ('image42.png', None),
    'cocktails-dark': ('image43.png', None),
    'n3-passion': ('image44.png', None),
    'persona-sarah': ('image27.png', None),
    'persona-omar': ('image28.png', None),
    'persona-lina': ('image29.png', None),
    'venue-restaurant': ('image30.png', None),
    'venue-bar-gold': ('image45.png', None),
    'venue-bar-window': ('image54.png', None),
    'dubai-marina-night': ('image16.png', None),
    'dubai-burj': ('image17.png', None),
    'dubai-atlantis': ('image18.png', None),
    'dubai-skyline-dawn': ('image25.png', None),
    'dubai-night-wide': ('image22.png', None),
    'dubai-rooftop': ('image76.png', None),
    'dubai-burj-sunset': ('image73.png', None),
    'dubai-beachclub': ('image75.png', None),
    'dubai-hotelpool': ('image74.png', None),
    'culture-mosque': ('image55.png', None),
    'culture-pastries': ('image56.png', None),
    'culture-dhow': ('image57.png', None),
    'comp-lyres': ('image58.png', None),
    'comp-monin': ('image59.png', None),
    'comp-barakat': ('image60.png', None),
    'cocktails-wide': ('image78.png', None),
    'n1-cream-wide': ('image80.png', None),
    'n3-splash': ('image79.png', None),
    'plane-wing': ('image23.png', None),
}

# the three recipes: crops of the high-resolution figure of the report (name -> box in the 2460 px wide figure)
DOCX_FIGURE = 'word/media/e07467a6dcce32f639cc30f63e7056af8788b6d1.jpg'
DOCX_CROPS = {
    'recipe-n1': (50, 40, 744, 505),
    'recipe-n2': (882, 40, 1580, 505),
    'recipe-n3': (1716, 40, 2410, 505),
}


def flatten(im):
    """RGBA -> RGB on white, cropped inside the rounded transparent corners (smallest inset that is fully opaque)."""
    if im.mode != 'RGBA':
        return im.convert('RGB')
    a = im.getchannel('A')
    w, h = im.size
    d = 0
    while d < min(w, h) // 6:
        box = (d, d, w - d, h - d)
        if a.crop(box).getextrema()[0] >= 250:
            break
        d += 1
    im = im.crop((d, d, w - d, h - d))
    bg = Image.new('RGB', im.size, (255, 255, 255))
    bg.paste(im, mask=im.getchannel('A'))
    return bg


def save(im, name, max_w=None):
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    path = OUT / (name + '.jpg')
    im.save(path, 'JPEG', quality=86, optimize=True, progressive=True, subsampling=0)
    print('%-22s %4dx%-4d %4d KB' % (name, im.width, im.height, path.stat().st_size // 1024))


def wordmark():
    """The real logo (assets/logos/gimber-original.png, black on white) -> transparent black and white versions."""
    import numpy as np
    g = np.array(Image.open(LOGO / 'gimber-original.png').convert('L')).astype(float)
    al = Image.fromarray(np.clip((255 - g) * 1.03 - 2, 0, 255).astype('uint8'))
    al = al.crop(al.point(lambda v: 255 if v > 10 else 0).getbbox())
    al = al.resize((1400, round(al.height * 1400 / al.width)), Image.LANCZOS)
    for name, rgb in (('gimber-ink', (0, 0, 0)), ('gimber-white', (255, 255, 255))):
        im = Image.new('RGBA', al.size, rgb + (255,))
        im.putalpha(al)
        im.save(LOGO / (name + '.png'), optimize=True)
        print(name, im.size)


def main():
    if not PPTX.exists() or not DOCX.exists():
        sys.exit('Missing the draft deck or the report next to this folder: ' + str(BASE))
    OUT.mkdir(parents=True, exist_ok=True)
    LOGO.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(PPTX) as z:
        for name, (member, max_w) in PPTX_IMAGES.items():
            im = Image.open(io.BytesIO(z.read('ppt/media/' + member)))
            save(flatten(im), name, max_w)

    wordmark()
    with zipfile.ZipFile(DOCX) as z:
        fig = Image.open(io.BytesIO(z.read(DOCX_FIGURE))).convert('RGB')
        for name, box in DOCX_CROPS.items():
            save(fig.crop(box), name, 760)


if __name__ == '__main__':
    main()
