#!/usr/bin/env python3
"""The four round drawings of the positioning map on slide 9: a syrup pump bottle (Monin), a dark spirit bottle (Lyre's), a short juice shot
(Barakat) and GIMBER itself (its bottle, a glass with ice and lemon, the real logo on the label).

build.py puts them in the {{ART_C1}} to {{ART_C4}} placeholders. They are flat SVG, drawn to fill a round frame (84 px for the three competitors,
132 px for GIMBER); the GIMBER one has a glint that crosses the bottle and sparkles that twinkle (classes animated by src/slides/09-positioning.html).
Run the file to write the four on one page:  python3 tools/chart_art.py preview.html
"""
import sys
from math import cos, pi, sin

from recipe_art import BODY, CUP, STAR, garnish

INK, TEAL, TEAL_D, AMBER, AMBER_M = '#10282B', '#0B6E6E', '#07494B', '#E9A116', '#F5CC72'


def svg(size, inner):
    return '<svg viewBox="0 0 %d %d" aria-hidden="true">%s</svg>' % (size, size, inner)


def monin():
    return svg(100, f'''<rect width="100" height="100" fill="#E3F1F0"/><circle cx="50" cy="54" r="40" fill="#BFE0DD"/>
<rect x="44" y="30" width="12" height="13" fill="#fff" fill-opacity=".75"/>
<path d="M40 42H60Q70 42 70 52V84Q70 90 64 90H36Q30 90 30 84V52Q30 42 40 42Z" fill="#fff" fill-opacity=".8"/>
<path d="M30 58H70V84Q70 90 64 90H36Q30 90 30 84Z" fill="#8FCBA5"/>
<rect x="30" y="64" width="40" height="19" fill="#fff"/><rect x="30" y="64" width="40" height="3.6" fill="{TEAL}"/><circle cx="50" cy="75.5" r="4.6" fill="{TEAL}"/>
<rect x="44" y="21" width="12" height="9" rx="2" fill="{TEAL_D}"/><rect x="46.5" y="29" width="7" height="6" fill="{TEAL_D}"/>
<path d="M56 24H69Q71.5 24 71.5 26.5V31" fill="none" stroke="{TEAL_D}" stroke-width="4" stroke-linecap="round"/>
<rect x="34" y="47" width="3.6" height="9" rx="1.8" fill="#fff" fill-opacity=".7"/>''')


def lyres():
    return svg(100, f'''<rect width="100" height="100" fill="#E8EDEE"/><circle cx="50" cy="54" r="40" fill="#D2DCDD"/>
<rect x="43" y="9" width="14" height="9.5" rx="2.5" fill="{AMBER}"/><rect x="44.5" y="18" width="11" height="24" fill="{INK}"/>
<path d="M44.5 41C44.5 48 32 48 32 60V84Q32 90 38 90H62Q68 90 68 84V60C68 48 55.5 48 55.5 41Z" fill="{INK}"/>
<rect x="32" y="62" width="36" height="22" fill="{AMBER_M}"/><rect x="35" y="65" width="30" height="16" fill="none" stroke="{INK}" stroke-width="1.4"/>
<path d="M50 67.5L55.5 73L50 78.5L44.5 73Z" fill="{INK}"/><rect x="35.4" y="50" width="3.4" height="8" rx="1.7" fill="#fff" fill-opacity=".28"/>''')


def barakat():
    return svg(100, f'''<rect width="100" height="100" fill="#FDF1D5"/><circle cx="50" cy="56" r="38" fill="#F8DE9B"/>
<rect x="41" y="24" width="18" height="11" rx="3" fill="#8A5600"/><rect x="43" y="35" width="14" height="13" fill="#F2C14E"/>
<path d="M43 47C43 51 31 51 31 62V82Q31 90 40 90H60Q69 90 69 82V62C69 51 57 51 57 47Z" fill="#F2C14E"/>
<rect x="31" y="62" width="38" height="21" fill="#fff"/><path d="M42 77C42 68 55 67 57 67C58 75 50 78 42 77Z" fill="{TEAL}"/><path d="M42 77L52 71" stroke="#fff" stroke-width="1.2" fill="none"/>
<rect x="35" y="52" width="3.6" height="8" rx="1.8" fill="#fff" fill-opacity=".6"/>''')


def gimber():
    ice = ''.join('<g transform="translate(%g %g) rotate(%g)"><rect x="-7" y="-7" width="14" height="14" rx="3.4" fill="#fff" fill-opacity=".85"/></g>' % c
                  for c in ((14, 13, 10), (31, 10, -12), (24, 28, 6)))
    return svg(132, f'''<defs><clipPath id="cg-b"><path d="{BODY}"/></clipPath><clipPath id="cg-g"><path d="{CUP}"/></clipPath></defs>
<rect width="132" height="132" fill="{AMBER_M}"/><circle cx="66" cy="68" r="58" fill="#FDF1D5"/>
<g transform="translate(20 8) scale(.98)">
 <rect x="10.5" y="0" width="15" height="9.5" rx="2.2" fill="#CDD7D8"/><rect x="10.5" y="6.8" width="15" height="2.7" rx="1.2" fill="#A9B8BA"/>
 <path d="{BODY}" fill="#fff" fill-opacity=".7"/><rect x="12.5" y="9" width="11" height="14" fill="#fff" fill-opacity=".7"/>
 <g clip-path="url(#cg-b)"><rect x="0" y="30" width="36" height="90" fill="#EAA423"/><rect x="1" y="58" width="34" height="34" fill="#fff"/>
  <use href="#rc-logo" x="5" y="64"/><rect x="5" y="73" width="26" height="1.2" fill="{AMBER}"/><circle cx="18" cy="83" r="5.6" fill="{AMBER}"/>
  <text x="18" y="86.2" text-anchor="middle" fill="{INK}" style="font:700 9px var(--display)">1</text>
  <rect class="cs-glint" x="-6" y="10" width="7" height="110" fill="#fff"/></g>
 <rect x="5.5" y="42" width="3.2" height="12" rx="1.6" fill="#fff" fill-opacity=".5"/>
</g>
<g transform="translate(68 56) scale(.86)">
 <path d="{CUP}" fill="#fff" fill-opacity=".7"/><g clip-path="url(#cg-g)"><rect x="0" y="17" width="52" height="50" fill="#F4C24F"/></g>
 <rect x="6.6" y="57" width="38.8" height="5" fill="#fff" fill-opacity=".5"/><rect x="0" y="0" width="52" height="2.4" fill="#fff" fill-opacity=".9"/>{ice}
</g>
<g transform="translate(108 62) scale(.9)">{garnish('lemon')}</g>
<g class="cs-star" style="--sd:1.2s"><path transform="translate(116 22) scale(.8)" d="{STAR}" fill="{AMBER}"/></g>
<g class="cs-star" style="--sd:2.6s"><path transform="translate(20 34) scale(.6)" d="{STAR}" fill="{AMBER}"/></g>
<g class="cs-star" style="--sd:3.8s"><path transform="translate(96 16) scale(.45)" d="{STAR}" fill="{AMBER}"/></g>''')


def placeholders():
    """-> {placeholder: SVG} for build.py."""
    return {'ART_C1': monin(), 'ART_C2': lyres(), 'ART_C3': barakat(), 'ART_C4': gimber()}


if __name__ == '__main__':
    if len(sys.argv) > 1:
        css = '<style>body{margin:24px;background:#fff;display:flex;gap:18px;align-items:center}svg{display:block;width:252px;height:252px;border-radius:50%;overflow:hidden}svg:last-child{width:396px;height:396px}</style>'
        logo = '<svg width="0" height="0" style="position:absolute"><defs><rect id="rc-logo" width="26" height="5.6" fill="#10282B"/></defs></svg>'
        open(sys.argv[1], 'w', encoding='utf-8').write('<!doctype html><meta charset="utf-8">%s%s%s' % (css, logo, ''.join(placeholders().values())))
        print('preview ->', sys.argv[1])
    for key, art in placeholders().items():
        print(key, len(art), 'bytes')
