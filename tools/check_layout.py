#!/usr/bin/env python3
"""Layout check of the built deck, with headless Chrome: for every slide it reports content that runs into the footer, past the side
margins, text that is clipped, and text smaller than 22 px (the sources line and the folio are exempt).

Usage:  python3 tools/check_layout.py
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'GIMBER_Dubai_presentation.html'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PRINT_CSS = '#ctrl,#notes,#tip{display:none!important}html,body{background:#fff!important;overflow:hidden!important}#stage{transform:none!important;border-radius:0!important;box-shadow:none!important}'
JS = r'''
<script>
addEventListener('load',function(){(document.fonts&&document.fonts.ready||Promise.resolve()).then(function(){setTimeout(function(){
 var out=[];
 document.querySelectorAll('.slide').forEach(function(s,i){
  var n=i+1,foot=s.querySelector('.foot'),body=s.querySelector('.body')||s,full=s.classList.contains('s1')||s.classList.contains('s17');
  var footTop=foot?foot.getBoundingClientRect().top:900;
  s.querySelectorAll('*').forEach(function(el){
   if(el.closest('.bubbles')||el.closest('svg')&&el.tagName!=='svg')return;
   var cs=getComputedStyle(el);if(cs.display==='none')return;
   var r=el.getBoundingClientRect();if(r.width<1||r.height<1)return;
   var name=el.tagName.toLowerCase()+(el.className&&el.className.baseVal===undefined?'.'+String(el.className).split(' ').join('.'):'');
   var inFoot=!!el.closest('.foot'),inTop=!!el.closest('.top');
   if(!inFoot&&!inTop&&!full&&body.contains(el)&&r.bottom>footTop+1)out.push([n,'runs into the footer',name,Math.round(r.bottom-footTop)+'px']);
   if(!full&&r.right>1600-72+4&&!el.closest('.ph'))out.push([n,'past the right margin',name,Math.round(r.right-1528)+'px']);
   if(!full&&r.left<72-4&&!el.closest('.ph')&&!el.closest('.ph-frame'))out.push([n,'past the left margin',name,Math.round(72-r.left)+'px']);
   if(!inFoot&&(cs.overflow==='hidden'||cs.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+1&&!el.classList.contains('ph')&&!el.classList.contains('tk')&&!el.closest('.ph'))out.push([n,'text clipped',name,el.scrollWidth+'>'+el.clientWidth]);
   var own=[].some.call(el.childNodes,function(c){return c.nodeType===3&&c.textContent.trim().length>0});
   if(own&&!inFoot&&!el.closest('.vh')){var fs=parseFloat(cs.fontSize);if(fs<22)out.push([n,'small text',name,fs+'px: '+el.textContent.trim().slice(0,30)])}
  });
 });
 var pre=document.createElement('pre');pre.id='res';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
},300)})});
</script>'''


def main():
    html = SRC.read_text(encoding='utf-8')
    html = html.replace('</style>', PRINT_CSS + '</style>', 1).replace('</html>', JS + '</html>')
    tmp = Path(tempfile.mkdtemp(prefix='gimber_chk_')) / 'check.html'
    tmp.write_text(html, encoding='utf-8')
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--force-prefers-reduced-motion', '--virtual-time-budget=8000',
           '--window-size=1600,900', '--dump-dom', tmp.as_uri() + '#1']
    dom = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    m = re.search(r'<pre id="res">(.*?)</pre>', dom, re.S)
    if not m:
        print('no result (did the page load?)')
        return
    items = json.loads(m.group(1).replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>'))
    if not items:
        print('layout ok: nothing runs into the footer or the margins, no clipped or tiny text')
    seen = set()
    for n, kind, name, info in items:
        key = (n, kind, name)
        if key in seen:
            continue
        seen.add(key)
        print('slide %2d  %-24s %-44s %s' % (n, kind, name[:44], info))


if __name__ == '__main__':
    main()
