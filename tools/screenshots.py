#!/usr/bin/env python3
"""Renders slides of the built deck to PNG with headless Google Chrome, in their final state (no animation caught half way).

Usage:  python3 tools/screenshots.py OUT_DIR [slide numbers, e.g. 1 2 5]   (all slides when none are given)
Needs:  Google Chrome (macOS app).
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'GIMBER_Dubai_presentation.html'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PRINT_CSS = '''
#ctrl,#notes,#tip{display:none!important}
html,body{background:#fff!important;overflow:hidden!important}
#stage{transform:none!important;border-radius:0!important;box-shadow:none!important}
'''


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    html = SRC.read_text(encoding='utf-8')
    n = len(re.findall(r'<section class="slide[ "]', html))
    which = [int(a) for a in sys.argv[2:]] or list(range(1, n + 1))
    tmp = Path(tempfile.mkdtemp(prefix='gimber_shot_')) / 'print.html'
    tmp.write_text(html.replace('</style>', PRINT_CSS + '</style>', 1), encoding='utf-8')
    for k in which:
        png = out / ('s%02d.png' % k)
        cmd = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--force-prefers-reduced-motion',
               '--run-all-compositor-stages-before-draw', '--virtual-time-budget=5000', '--window-size=1600,900',
               '--screenshot=%s' % png, tmp.as_uri() + '#%d' % k]
        subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        print(png.name, 'ok' if png.exists() else 'FAILED')


if __name__ == '__main__':
    main()
