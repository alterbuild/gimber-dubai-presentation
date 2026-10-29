#!/usr/bin/env python3
"""Builds GIMBER_Dubai_presentation.pdf from the built deck.

Every slide is rendered with headless Google Chrome in its final state (reduced-motion mode, so no animation is caught half way), at 2x
resolution, and placed on one 16:9 page. The five part screens of the live deck (the "pour" with the next speaker's name) are added as
pages of their own, where the speaker changes; pass --slides-only to leave them out. The PDF gets bookmarks for every part and slide.

Usage:  python3 tools/build.py && python3 tools/make_pdf.py [--slides-only]
Needs:  Google Chrome (macOS app), PyMuPDF (fitz), Pillow.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'GIMBER_Dubai_presentation.html'
OUT = ROOT / 'GIMBER_Dubai_presentation.pdf'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SCALE = 2                  # device pixel ratio of the renders
PAGE_W, PAGE_H = 960, 540  # PDF points (13.33 x 7.5 in)

PRINT_CSS = '''
#ctrl,#notes,#tip{display:none!important}
html,body{background:#fff!important;overflow:hidden!important}
#stage{transform:none!important;border-radius:0!important;box-shadow:none!important}
body.sec #stage>.slide,body.sec #prog{display:none!important}
body.sec #stage{background:#fff!important}
body.sec #curtain i{transform:translateY(0)!important}
body.sec #curtain i::before{animation:none!important}
'''


def array(html, name):
    m = re.search(r'const %s=(\[[^\]]*\]);' % name, html)
    assert m, name + ' not found'
    return json.loads(m.group(1).replace("'", '"'))


def chrome(args, timeout=120):
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
           '--force-prefers-reduced-motion', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=6000'] + args
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def main():
    parts_on = '--slides-only' not in sys.argv
    if not SRC.exists():
        sys.exit('Missing %s. Run: python3 tools/build.py' % SRC)
    if not Path(CHROME).exists():
        sys.exit('Google Chrome not found at ' + CHROME)
    html = SRC.read_text(encoding='utf-8')
    secl, spk = array(html, 'SECL'), array(html, 'SPK')
    ini = [''.join(w[0] for w in s.split()) for s in spk]
    sec_js = ('<script>document.addEventListener("DOMContentLoaded",function(){var m=/^#sec(\\d)$/.exec(location.hash);if(!m)return;'
              'var k=+m[1]-1,SECL=%s,SPK=%s,INI=%s;document.body.classList.add("sec");var c=document.getElementById("curtain");'
              'c.querySelector(".cn").textContent=m[1];c.querySelector(".ct").innerHTML="<em>Part "+m[1]+" of "+SECL.length+"</em>"+SECL[k]+'
              '"<small><b class=\\"av p"+m[1]+"\\">"+INI[k]+"</b>"+SPK[k]+(k==0?" continues":" takes over")+"</small>"})</script>') % (json.dumps(secl), json.dumps(spk), json.dumps(ini))
    html = html.replace('</style>', PRINT_CSS + '</style>' + sec_js, 1)

    tmp = Path(tempfile.mkdtemp(prefix='gimber_pdf_'))
    page = tmp / 'print.html'
    page.write_text(html, encoding='utf-8')
    url = page.as_uri()

    # page order: slides in order, with the part screen before the first slide of each part (same rule as the live deck)
    tags = re.findall(r'<section class="slide[^"]*"([^>]*)>', html)
    n_slides = len(tags)
    secs = [(re.search(r'data-sec="(\d)"', t) or [None, None])[1] for t in tags]
    labels = [re.sub(r'^Slide \d+, ?', '', re.search(r'aria-label="([^"]+)"', t).group(1)).strip() for t in tags]
    pages, prev = [], None
    for n in range(1, n_slides + 1):
        sec = secs[n - 1]
        if parts_on and sec and sec != prev:
            pages.append(('sec', int(sec)))
        pages.append(('slide', n))
        prev = sec or prev

    doc = fitz.open()
    toc = []
    for kind, v in pages:
        png = tmp / ('%s%02d.png' % (kind, v))
        frag = '#%d' % v if kind == 'slide' else '#sec%d' % v
        r = chrome(['--force-device-scale-factor=%d' % SCALE, '--window-size=1600,900', '--screenshot=%s' % png, url + frag])
        assert png.exists(), 'render failed for %s %d: %s' % (kind, v, r.stderr[-400:])
        im = Image.open(png).convert('RGB').crop((0, 0, 1600 * SCALE, 900 * SCALE))
        jpg = png.with_suffix('.jpg')
        im.save(jpg, 'JPEG', quality=92, subsampling=0, optimize=True)
        pg = doc.new_page(width=PAGE_W, height=PAGE_H)
        pg.insert_image(fitz.Rect(0, 0, PAGE_W, PAGE_H), filename=str(jpg))
        num = doc.page_count
        if kind == 'sec':
            toc.append([1, 'Part %d: %s (%s)' % (v, secl[v - 1], spk[v - 1]), num])
        else:
            lab = labels[v - 1]
            toc.append([2 if secs[v - 1] and parts_on else 1, '%d. %s' % (v, lab[:1].upper() + lab[1:]), num])
        print('%-5s %2d -> page %2d  %4d KB' % (kind, v, num, round(jpg.stat().st_size / 1024)))

    doc.set_toc(toc)
    doc.set_metadata({'title': 'GIMBER x Dubai: international marketing and growth plan',
                      'subject': 'SME Marketing & Growth Strategies, EDHEC Business School, October 2026',
                      'author': ', '.join(spk),
                      'keywords': 'GIMBER, Dubai, international marketing, growth strategy, pitch deck'})
    doc.save(str(OUT), garbage=4, deflate=True)
    print('PDF ->', OUT, round(OUT.stat().st_size / 1024 / 1024, 2), 'MB,', doc.page_count, 'pages')


if __name__ == '__main__':
    main()
