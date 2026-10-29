#!/usr/bin/env python3
"""The four round illustrations of slide 7 (phases of targeting): a hotel, a wellness cafe, a rooftop skyline at sunset and a mosque at night.

build.py puts them in the {{ART_P1}} to {{ART_P4}} placeholders. Each one is a 96 x 96 flat SVG; the circle comes from the round frame of the slide.
The pieces that move have classes that src/slides/07-segments.html animates: the building rises and its windows light up one by one, steam curls out of
the cup and the sprig sways, the sun climbs behind the skyline while the water slides, the stars twinkle and a ring spreads out of the mosque.
Run the file to write the four on one page:  python3 tools/phase_art.py preview.html
"""
import sys
from math import cos, pi, sin

DELAYS = {1: 1000, 2: 1150, 3: 1300, 4: 1450}      # --d of the round frames in the slide
INK, TEAL, TEAL_D, TEAL_M, AMBER, AMBER_M, SLATE = '#10282B', '#0B6E6E', '#07494B', '#8CC4C0', '#E9A116', '#F5CC72', '#4B6366'


def star5(r=7.0, ri=2.9):
    pts = ['%.2f %.2f' % ((r if k % 2 == 0 else ri) * cos(-pi / 2 + k * pi / 5), (r if k % 2 == 0 else ri) * sin(-pi / 2 + k * pi / 5)) for k in range(10)]
    return 'M' + 'L'.join(pts) + 'Z'


def spark(r=5.0):
    return 'M0-%(r)gL%(a).2f-%(a).2fL%(r)g 0L%(a).2f %(a).2fL0 %(r)gL-%(a).2f %(a).2fL-%(r)g 0L-%(a).2f-%(a).2fZ' % dict(r=r, a=r * 0.27)


def leaf(x, y, rot, n, color):
    return '<path transform="translate(%g %g) rotate(%g)" d="M0 0C%.1f %.1f %.1f %.1f %g 0C%.1f %.1f %.1f %.1f 0 0Z" fill="%s"/>' % (
        x, y, rot, n * .3, -n * .5, n * .75, -n * .5, n, n * .75, n * .5, n * .3, n * .5, color)


def hotel(d0):
    d = lambda o: 'style="--d:%d"' % (d0 + o)
    lit = {(0, 0), (0, 2), (1, 1), (2, 0), (2, 2)}
    flick = {(0, 2): (2.6, -.4), (2, 0): (3.4, -1.7)}
    wins = ''.join('<rect x="%d" y="%d" width="9" height="8" rx="1.6" fill="#2C4D52"/>' % (31 + 13 * c, 33 + 12 * r) for r in range(3) for c in range(3))
    glow = ''
    for i, (r, c) in enumerate(sorted(lit)):
        fl = flick.get((r, c))
        style = ' style="--fl:%.1fs;--fd:%.1fs"' % fl if fl else ''
        glow += '<g class="pa-fade" %s><rect%s%s x="%d" y="%d" width="9" height="8" rx="1.6" fill="%s"/></g>' % (
            d(620 + 110 * i), ' class="pa-flick"' if fl else '', style, 31 + 13 * c, 33 + 12 * r, AMBER_M)
    return f'''<rect width="96" height="96" fill="#FDF1D5"/><rect y="78" width="96" height="18" fill="#F8DE9B"/>
<g class="pa-rise" {d(150)}><rect x="25" y="26" width="46" height="54" rx="3" fill="{INK}"/><rect x="33" y="19" width="30" height="9" rx="2" fill="{TEAL_D}"/>{wins}
<path d="M42 80V73a6 6 0 0 1 12 0V80Z" fill="{AMBER}"/><path d="M38 67H58L60.5 63H35.5Z" fill="#8A5600"/></g>
{glow}
<g class="pa-pop" {d(450)}><g transform="translate(48 11)"><g class="pa-star" style="--sd:{d0 / 1000 + 1.2:.1f}s"><path d="{star5()}" fill="{AMBER}"/></g></g></g>
<g class="pa-pop" {d(700)}><path d="M8 57H24L16 68Z" fill="#fff"/><path d="M10.4 60.4H21.6L16 67Z" fill="{AMBER}"/><rect x="15.2" y="68" width="1.6" height="9" fill="#fff"/><rect x="10.5" y="76.5" width="11" height="2" rx="1" fill="#fff"/></g>
<g class="pa-star" style="--sd:{d0 / 1000 + 2.4:.1f}s"><path transform="translate(83 30) scale(.7)" d="{spark()}" fill="{AMBER}"/></g>'''


def cafe(d0):
    d = lambda o: 'style="--d:%d"' % (d0 + o)
    steam = ''.join(
        '<g class="pa-fade" %s><path class="pa-steam" style="--sd:%.1fs" transform="translate(%d 38)" d="M0 0q-5-6 0-12t0-12" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-opacity=".55"/></g>'
        % (d(900 + 120 * i), -0.9 * i, x, TEAL) for i, x in enumerate((37, 47, 57)))
    return f'''<rect width="96" height="96" fill="#E3F1F0"/><rect y="78" width="96" height="18" fill="#BFE0DD"/>
<g class="pa-pop" {d(150)}><rect x="19" y="73" width="56" height="6" rx="3" fill="{TEAL_D}"/>
<path d="M26 45H66V56Q66 74 46 74Q26 74 26 56Z" fill="{TEAL}"/><path d="M26 45H66V50H26Z" fill="#fff"/>
<path d="M66 51H70Q78 51 78 59Q78 67 70 67H64" fill="none" stroke="{TEAL}" stroke-width="4.5" stroke-linecap="round"/>
<ellipse cx="46" cy="45" rx="20" ry="5" fill="#fff"/><ellipse cx="46" cy="45.4" rx="17" ry="3.6" fill="{AMBER}"/>
<rect x="31" y="55" width="3.6" height="13" rx="1.8" fill="#fff" fill-opacity=".35"/></g>
{steam}
<g class="pa-sway" style="transform-origin:15px 78px"><g class="pa-pop" {d(550)}><path d="M15 78Q13 66 18 53" fill="none" stroke="{TEAL_D}" stroke-width="2.4" stroke-linecap="round"/>
{leaf(14.6, 72, -38, 15, TEAL_M)}{leaf(15.2, 66, 200, 15, TEAL)}{leaf(16.8, 60, -46, 14, TEAL_M)}{leaf(18, 54, -96, 11, TEAL)}</g></g>
<g class="pa-star" style="--sd:{d0 / 1000 + 1.6:.1f}s"><path transform="translate(80 28) scale(.7)" d="{spark()}" fill="{TEAL}"/></g>
<g class="pa-star" style="--sd:{d0 / 1000 + 2.9:.1f}s"><path transform="translate(22 30) scale(.5)" d="{spark()}" fill="{TEAL}"/></g>'''


def skyline(d0):
    d = lambda o: 'style="--d:%d"' % (d0 + o)
    spots = ((11, 56), (24, 49), (71, 54), (85, 47), (39, 40), (41, 52), (57, 60), (26, 63), (73, 66), (42, 66))
    lights = ''.join('<rect class="pa-flick" style="--fl:%.1fs;--fd:%.1fs" x="%d" y="%d" width="2.2" height="2.2" rx=".5" fill="%s"/>' % (2.2 + .45 * (i % 4), -.7 * i, x, y, AMBER_M)
                     for i, (x, y) in enumerate(spots))
    wave = 'M-16 0q4-3 8 0t8 0' + 't8 0' * 14
    tiers = ((8, 0), (22, 1.3), (22, 2.2), (32, 2.8), (32, 4), (44, 4.8), (44, 6.2), (58, 7.4), (58, 9), (70, 10.4), (70, 11.6), (80, 12.6))
    burj = 'M' + 'L'.join('%.1f %d' % (40 + w, y) for y, w in tiers) + 'L' + 'L'.join('%.1f %d' % (40 - w, y) for y, w in reversed(tiers)) + 'Z'
    return f'''<rect width="96" height="96" fill="#DDEFEE"/>
<g class="pa-up" {d(150)}><g class="pa-glow"><circle cx="64" cy="48" r="20" fill="{AMBER_M}"/></g></g>
<g class="pa-rise" {d(350)}><g fill="{TEAL_M}"><rect x="4" y="50" width="12" height="30"/><rect x="18" y="42" width="10" height="38"/><rect x="66" y="46" width="11" height="34"/><rect x="79" y="38" width="12" height="42"/></g>
<path d="{burj}" fill="{TEAL}"/>
<path d="M52 57L64 51V80H52Z" fill="{TEAL_D}"/><rect x="21" y="59" width="10" height="21" fill="{TEAL_D}"/><rect x="68" y="61" width="12" height="19" fill="{TEAL_D}"/></g>
<g class="pa-fade" {d(1000)}>{lights}</g>
<rect y="78" width="96" height="18" fill="{TEAL_D}"/>
<g class="pa-wave"><path transform="translate(0 83)" d="{wave}V16H-16Z" fill="{TEAL}" fill-opacity=".55"/></g>
<g class="pa-wave2"><path transform="translate(0 89)" d="{wave}V16H-16Z" fill="{TEAL_M}" fill-opacity=".45"/></g>'''


def mosque(d0):
    d = lambda o: 'style="--d:%d"' % (d0 + o)
    return f'''<rect width="96" height="96" fill="#E6EEEE"/><rect y="78" width="96" height="18" fill="#C9D6D6"/>
<g class="pa-ping" style="--pd:{d0 / 1000 + 1.4:.1f}s"><circle cx="48" cy="62" r="46" fill="none" stroke="{TEAL}" stroke-width="2"/></g>
<g class="pa-ping" style="--pd:{d0 / 1000 + 2.9:.1f}s"><circle cx="48" cy="62" r="46" fill="none" stroke="{TEAL}" stroke-width="2"/></g>
<g class="pa-pop" {d(150)}><circle cx="72" cy="24" r="9" fill="{AMBER}"/><circle cx="76.2" cy="21" r="7.8" fill="#E6EEEE"/></g>
<g class="pa-rise" {d(300)}><rect x="22" y="62" width="52" height="18" fill="{SLATE}"/>
<path d="M33 62A15 15 0 0 1 63 62Z" fill="{SLATE}"/><rect x="47.2" y="36" width="1.6" height="9" fill="{SLATE}"/><circle cx="48" cy="34.5" r="2.4" fill="{SLATE}"/>
<path d="M21 64A7.5 7.5 0 0 1 36 64Z" fill="{SLATE}"/><path d="M60 64A7.5 7.5 0 0 1 75 64Z" fill="{SLATE}"/>
<rect x="11" y="42" width="6" height="38" fill="{SLATE}"/><path d="M10 42L14 32L18 42Z" fill="{SLATE}"/><rect x="79" y="42" width="6" height="38" fill="{SLATE}"/><path d="M78 42L82 32L86 42Z" fill="{SLATE}"/>
<path d="M43 80V73a5 5 0 0 1 10 0V80Z" fill="{AMBER_M}"/><path d="M27 80V74a3.4 3.4 0 0 1 6.8 0V80Z" fill="#7C9194"/><path d="M62.2 80V74a3.4 3.4 0 0 1 6.8 0V80Z" fill="#7C9194"/></g>
<g class="pa-star" style="--sd:{d0 / 1000 + 1.0:.1f}s"><path transform="translate(24 18) scale(.8)" d="{spark()}" fill="{AMBER}"/></g>
<g class="pa-star" style="--sd:{d0 / 1000 + 2.3:.1f}s"><path transform="translate(58 14) scale(.55)" d="{spark()}" fill="{AMBER}"/></g>
<g class="pa-star" style="--sd:{d0 / 1000 + 3.4:.1f}s"><path transform="translate(38 28) scale(.45)" d="{spark()}" fill="{TEAL}"/></g>'''


SCENES = {1: hotel, 2: cafe, 3: skyline, 4: mosque}


def placeholders():
    """-> {placeholder: SVG} for build.py."""
    return {'ART_P%d' % n: '<svg viewBox="0 0 96 96" aria-hidden="true">%s</svg>' % fn(DELAYS[n]) for n, fn in SCENES.items()}


if __name__ == '__main__':
    if len(sys.argv) > 1:
        css = '<style>body{margin:24px;background:#fff;display:flex;gap:18px}svg{display:block;width:288px;height:288px;border-radius:50%;overflow:hidden}</style>'
        open(sys.argv[1], 'w', encoding='utf-8').write('<!doctype html><meta charset="utf-8">%s%s' % (css, ''.join(placeholders().values())))
        print('preview ->', sys.argv[1])
    for key, svg in placeholders().items():
        print(key, len(svg), 'bytes')
