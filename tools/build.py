"""Builds the GIMBER x Dubai deck: one self-contained HTML file (fonts, logos and photos are embedded, it works offline).

Usage:  python3 tools/build.py
Reads:  src/deck.html       the shell: tokens, shared CSS, the slide engine and the pour curtain
        src/slides/NN-*.html one file per slide (its own <style> and its <section class="slide">), joined in file-name order
        src/notes.js        the speaker notes of every slide (and the questions bank on the last one)
        src/presenter.js, src/presenter.css   the presenter view (second window, timer, panels), injected inside the deck
        assets/, fonts/     logos, photos and fonts that get embedded
Output: GIMBER_Dubai_presentation.html, plus an identical index.html (the page that GitHub Pages serves)
"""
import base64
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, ASSETS, FONTS = ROOT / 'src', ROOT / 'assets', ROOT / 'fonts'
OUT = ROOT / 'GIMBER_Dubai_presentation.html'
INDEX = ROOT / 'index.html'


def b64(path, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(path.read_bytes()).decode())


def main():
    html = (SRC / 'deck.html').read_text(encoding='utf-8')
    parts = sorted((SRC / 'slides').glob('[0-9][0-9]-*.html'))
    assert parts, 'no slides in src/slides'
    slides = '\n\n'.join(p.read_text(encoding='utf-8') for p in parts)
    assert html.count('<!--{{SLIDES}}-->') == 1
    html = html.replace('<!--{{SLIDES}}-->', slides)
    n_slides = len(re.findall(r'<section class="slide[ "]', html))
    assert html.count('/*{{NOTES}}*/') == 1 and html.count('/*{{PRESENTER_JS}}*/') == 1 and html.count('/*{{IMAGES_CSS}}*/') == 1
    notes = (SRC / 'notes.js').read_text(encoding='utf-8')
    rows = len(re.findall(r"^ \[-?\d+,'", notes, re.M))
    assert rows == n_slides, 'the notes have %d rows for %d slides' % (rows, n_slides)
    html = html.replace('/*{{NOTES}}*/', notes)
    html = html.replace('/*{{PRESENTER_JS}}*/', (SRC / 'presenter.js').read_text(encoding='utf-8'))

    # photos: one CSS class per image that a slide uses (.im-name), embedded once
    css = []
    used = 0
    for img in sorted((ASSETS / 'img').glob('*.jpg')):
        cls = 'im-' + img.stem
        if re.search(r'\b%s\b' % re.escape(cls), html):
            css.append('.%s{background-image:url("%s")}' % (cls, b64(img, 'image/jpeg')))
            used += 1
    html = html.replace('/*{{IMAGES_CSS}}*/', '\n'.join(css) + '\n' + (SRC / 'presenter.css').read_text(encoding='utf-8'))

    for key, (path, mime) in {
        'FONT_CH_R': (FONTS / 'charis-regular.woff2', 'font/woff2'),
        'FONT_CH_I': (FONTS / 'charis-italic.woff2', 'font/woff2'),
        'FONT_CH_B': (FONTS / 'charis-bold.woff2', 'font/woff2'),
        'FONT_CH_BI': (FONTS / 'charis-bolditalic.woff2', 'font/woff2'),
        'FONT_GS_400': (FONTS / 'googlesans-400.woff2', 'font/woff2'),
        'FONT_GS_500': (FONTS / 'googlesans-500.woff2', 'font/woff2'),
        'FONT_GS_600': (FONTS / 'googlesans-600.woff2', 'font/woff2'),
        'FONT_GS_700': (FONTS / 'googlesans-700.woff2', 'font/woff2'),
        'FONT_FT': (FONTS / 'figtree.woff2', 'font/woff2'),
        'FONT_AR': (FONTS / 'cairo-arabic.woff2', 'font/woff2'),
        'EDHEC': (ASSETS / 'logos' / 'edhec.svg', 'image/svg+xml'),
        'GIMBER_INK': (ASSETS / 'logos' / 'gimber-ink.png', 'image/png'),
        'GIMBER_WHITE': (ASSETS / 'logos' / 'gimber-white.png', 'image/png'),
    }.items():
        html = html.replace('{{%s}}' % key, b64(path, mime))
    html = html.replace('{{BUILD}}', time.strftime('%Y%m%d-%H%M%S'))
    left = re.search(r'\{\{[A-Z_]+\}\}', html)
    assert not left, 'unreplaced placeholder: ' + left.group(0)

    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
    OUT.write_text(head + html + '\n</html>\n', encoding='utf-8')
    INDEX.write_bytes(OUT.read_bytes())
    print('built %d slides, %d photos, %.1f MB -> %s' % (n_slides, used, OUT.stat().st_size / 1024 / 1024, OUT))


if __name__ == '__main__':
    sys.exit(main())
