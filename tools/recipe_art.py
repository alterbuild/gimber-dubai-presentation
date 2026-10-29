#!/usr/bin/env python3
"""The three recipe illustrations of slide 3 (GIMBER N°1 Original, N°2 Brut, N°3 Lilly): a bottle, a glass and a garnish, flat SVG.

build.py puts them in the {{ART_N1}}, {{ART_N2}} and {{ART_N3}} placeholders. Every piece that moves has a class that src/slides/03-brand.html animates:
the disc pops, the bottle falls in, the drinks rise with a living surface, the ice drops and then floats, the garnish spins in, sparkles twinkle and a
light glint crosses the bottle now and then. The label of the bottle uses the real logo through <use href="#rc-logo"> (defined once in the slide).
Run the file to write the three scenes on one page:  python3 tools/recipe_art.py preview.html
"""
import sys
from math import cos, pi, sin

W, H = 470, 138                       # size of a card of slide 3
INK = '#10282B'
RECIPES = {
    1: dict(bg='#FDF1D5', disc='#F8DE9B', bottle='#EAA423', glass='#F4C24F', accent='#E9A116', on='#10282B', num='1', garnish='lemon', delay=450),
    2: dict(bg='#E3F1F0', disc='#BFE0DD', bottle='#C97A1C', glass='#DE9531', accent='#0B6E6E', on='#FFFFFF', num='2', garnish='ginger', delay=600),
    3: dict(bg='#FBE7E1', disc='#F6C7BA', bottle='#E8702E', glass='#F29244', accent='#CF4A2D', on='#FFFFFF', num='3', garnish='passion', delay=750),
}

BODY = 'M12.5 22C12.5 27.5 1 28.5 1 41V106Q1 117 12 117H24Q35 117 35 106V41C35 28.5 23.5 27.5 23.5 22Z'   # bottle, 36 x 117
CUP = 'M0 0H52L46.5 61.5Q46 64 43.5 64H8.5Q6 64 5.5 61.5Z'                                              # glass, 52 x 64
EDGE = 'M186 0C172 38 192 100 176 138'                                                                  # left edge of the ink panel
STAR = 'M0-6.5L1.7-1.7L6.5 0L1.7 1.7L0 6.5L-1.7 1.7L-6.5 0L-1.7-1.7Z'


def wave(width, depth):
    """A surface of liquid: a wave that repeats every 24 px (so sliding it by 24 px loops without a seam), and the liquid under it."""
    n = int(width / 12) + 6
    return 'M-24 0q6-2.2 12 0' + 't12 0' * (n - 1) + 'V%d' % depth + 'H-24Z'


def garnish(kind):
    if kind == 'lemon':
        spokes = ''.join('<path d="M0 0L%.2f %.2f"/>' % (8.7 * cos(k * pi / 4), 8.7 * sin(k * pi / 4)) for k in range(8))
        return ('<circle r="12" fill="#F1CF3A"/><circle r="10.3" fill="#FFF3B5"/><circle r="8.7" fill="#F7DB5B"/>'
                '<g stroke="#FFF3B5" stroke-width="1.3" stroke-linecap="round">%s</g><circle r="1.5" fill="#FFF3B5"/>' % spokes)
    if kind == 'ginger':
        return ('<path d="M-11 -2C-12 -8 -5 -12 1 -11.5C8 -11 12.5 -6 11.5 0C12 6.5 6 11.5 -.5 11.5C-7 12 -12 7 -11 -2Z" fill="#C58A4B"/>'
                '<path d="M-9.4 -1.6C-10 -6.6 -4.4 -9.8 .8 -9.4C6.6 -9 10 -5 9.4 0C9.8 5.2 5 9.4 -.4 9.4C-5.8 9.8 -9.8 5.8 -9.4 -1.6Z" fill="#F4DDA9"/>'
                '<path d="M-5 -1C-5 -4.5 -1.5 -6 1.5 -5.3C4.8 -4.6 6 -1 5.3 1.6C4.6 4.6 1.2 6 -1.4 5.3C-4 4.7 -5 2 -5 -1Z" fill="none" stroke="#E2BC78" stroke-width="1.2"/>'
                '<circle r="1.6" fill="#E2BC78"/>')
    seeds = ''.join('<ellipse cx="%.2f" cy="%.2f" rx="1.1" ry="1.7" transform="rotate(%.0f %.2f %.2f)"/>'
                    % (4.9 * cos(k * 2 * pi / 7), 4.9 * sin(k * 2 * pi / 7), k * 360 / 7 + 90, 4.9 * cos(k * 2 * pi / 7), 4.9 * sin(k * 2 * pi / 7)) for k in range(7))
    return ('<circle r="12.5" fill="#8A2D3B"/><circle r="10.8" fill="#F8E6C8"/><circle r="9" fill="#F3A22E"/>'
            '<g fill="#3A2527">%s<ellipse rx="1.1" ry="1.7"/></g>' % seeds)


def scene(n):
    p = RECIPES[n]
    k, d0 = 'rc%d' % n, p['delay']

    def d(off):
        return 'style="--d:%d"' % (d0 + off)

    ice = ''.join(
        '<g class="rc-drop" %s><g class="rc-bob" style="--bd:%.1fs"><g transform="translate(%g %g) rotate(%g)">'
        '<rect x="-7" y="-7" width="14" height="14" rx="3.4" fill="#fff" fill-opacity=".82"/><rect x="-4.4" y="-4.4" width="5.2" height="2.2" rx="1.1" fill="#fff"/>'
        '</g></g></g>' % (d(off), bd, x, y, r) for off, bd, x, y, r in ((820, 0, 14, 12, 10), (900, -1.1, 31, 9, -12), (980, -2.2, 24, 26, 6)))
    return f'''<svg viewBox="0 0 {W} {H}" aria-hidden="true">
<defs><clipPath id="{k}-b"><path d="{BODY}"/></clipPath><clipPath id="{k}-g"><path d="{CUP}"/></clipPath></defs>
<rect width="{W}" height="{H}" fill="{p['bg']}"/>
<path d="{EDGE}H{W}V0Z" fill="{INK}"/><path d="{EDGE}" fill="none" stroke="{p['accent']}" stroke-width="4" stroke-linecap="round"/>
<circle class="rc-disc" {d(100)} cx="96" cy="72" r="60" fill="{p['disc']}"/>
<rect x="18" y="131" width="130" height="3" rx="1.5" fill="{p['accent']}" fill-opacity=".35"/>
<g class="rc-fall" {d(250)}><g transform="translate(30 14)">
 <rect x="10.5" y="0" width="15" height="9.5" rx="2.2" fill="#CDD7D8"/><rect x="10.5" y="6.8" width="15" height="2.7" rx="1.2" fill="#A9B8BA"/>
 <path d="{BODY}" fill="#fff" fill-opacity=".6"/><rect x="12.5" y="9" width="11" height="14" fill="#fff" fill-opacity=".6"/>
 <g clip-path="url(#{k}-b)">
  <g class="rc-liq" {d(550)}><g class="rc-wave"><path d="{wave(36, 100)}" transform="translate(0 30)" fill="{p['bottle']}"/></g></g>
  <rect x="1" y="58" width="34" height="34" fill="#fff"/>
  <use href="#rc-logo" x="5" y="64" class="rc-logo" {d(1000)}/>
  <rect x="5" y="73" width="26" height="1.2" fill="{p['accent']}"/>
  <circle cx="18" cy="83" r="5.6" fill="{p['accent']}"/><text x="18" y="86.2" text-anchor="middle" fill="{p['on']}" style="font:700 9px var(--display)">{p['num']}</text>
  <rect class="rc-glint" style="--gd:{d0 / 1000 + 2.4:.1f}s" x="-6" y="10" width="7" height="110" fill="#fff"/>
 </g>
 <rect x="5.5" y="42" width="3.2" height="12" rx="1.6" fill="#fff" fill-opacity=".45"/>
</g></g>
<g class="rc-fall" {d(450)}><g transform="translate(82 68)">
 <path d="{CUP}" fill="#fff" fill-opacity=".62"/>
 <g clip-path="url(#{k}-g)"><g class="rc-liq" {d(700)}><g class="rc-wave"><path d="{wave(52, 70)}" transform="translate(0 17)" fill="{p['glass']}"/></g></g></g>
 <rect x="6.6" y="57" width="38.8" height="5" fill="#fff" fill-opacity=".5"/><rect x="0" y="0" width="52" height="2.4" fill="#fff" fill-opacity=".85"/>
 <rect x="7.5" y="22" width="3.4" height="28" rx="1.7" fill="#fff" fill-opacity=".42"/>
 {ice}
</g></g>
<g class="rc-garnish" {d(1100)}><g transform="translate(133 71)">{garnish(p['garnish'])}</g></g>
<g class="rc-star" style="--sd:{d0 / 1000 + 1.8:.1f}s"><path transform="translate(150 38) scale(.9)" d="{STAR}" fill="{p['accent']}"/></g>
<g class="rc-star" style="--sd:{d0 / 1000 + 3.1:.1f}s"><path transform="translate(24 30) scale(.65)" d="{STAR}" fill="{p['accent']}"/></g>
<g class="rc-star" style="--sd:{d0 / 1000 + 4.4:.1f}s"><path transform="translate(116 18) scale(.5)" d="{STAR}" fill="{p['accent']}"/></g>
</svg>'''


def placeholders():
    """-> {placeholder: SVG} for build.py."""
    return {'ART_N%d' % n: scene(n) for n in RECIPES}


if __name__ == '__main__':
    if len(sys.argv) > 1:
        css = ('<style>body{margin:24px;background:#fff;font-family:sans-serif}svg{display:block;width:470px;height:138px;margin:0 0 14px;border-radius:16px;overflow:hidden}</style>')
        logo = '<svg width="0" height="0" style="position:absolute"><defs><rect id="rc-logo" width="26" height="5.6" fill="#10282B"/></defs></svg>'
        open(sys.argv[1], 'w', encoding='utf-8').write('<!doctype html><meta charset="utf-8">%s%s%s' % (css, logo, ''.join(scene(n) for n in RECIPES)))
        print('preview ->', sys.argv[1])
    for key, svg in placeholders().items():
        print(key, len(svg), 'bytes')
