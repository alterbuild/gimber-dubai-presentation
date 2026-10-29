/* ======================================================================================================================
   Presenter mode: two windows (presentation for the projector, presenter view for the laptop) kept in step, plus a timer,
   a blank-screen switch and a full-screen picker that lets you choose the display.
   Injected inside the deck IIFE by tools/build.py (it uses slides, N, cur, go, show, started, NOTES, SPK, SECL, ui).
   Windows talk through: window.postMessage on the windows we opened (works from file:// too), BroadcastChannel and, as a
   last resort, localStorage events.
   ====================================================================================================================== */
const QS=new URLSearchParams(location.search);
const MODE=QS.has('presenter')?'presenter':'deck';
const AUD=QS.has('audience');
const ID=Math.random().toString(36).slice(2,9);
const peers=new Set(),seen={};
let seq=0,bc=null;
try{if(typeof BroadcastChannel==='function')bc=new BroadcastChannel('gimber-deck-v1')}catch(e){bc=null}
if(window.opener&&window.opener!==window)peers.add(window.opener);
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mmss=s=>{s=Math.max(0,Math.round(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const baseUrl=()=>location.href.split('#')[0].split('?')[0];
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ---------- transport ---------- */
function post(m){
  m.__ld=1;m.from=ID;m.seq=++seq;m.role=MODE;
  if(bc){try{bc.postMessage(m)}catch(e){}}
  else{try{localStorage.setItem('gimber-sync',JSON.stringify(m));localStorage.removeItem('gimber-sync')}catch(e){}}
  peers.forEach(w=>{try{if(w.closed)peers.delete(w);else w.postMessage(m,'*')}catch(e){peers.delete(w)}});
}
function receive(m,src){
  if(!m||m.__ld!==1||m.from===ID||typeof m.type!=='string')return;
  if(typeof m.seq!=='number'||(seen[m.from]!==undefined&&m.seq<=seen[m.from]))return;
  seen[m.from]=m.seq;
  if(src&&src!==window&&typeof src.postMessage==='function')peers.add(src);
  onMessage(m);
}
if(bc)bc.onmessage=e=>receive(e.data);
addEventListener('message',e=>receive(e.data,e.source));
addEventListener('storage',e=>{if(e.key==='gimber-sync'&&e.newValue){try{receive(JSON.parse(e.newValue))}catch(x){}}});
addEventListener('pagehide',()=>post({type:'bye'}));
function focusPeers(){peers.forEach(w=>{try{w.focus()}catch(e){}})}

/* ---------- small helpers ---------- */
let toastT=0;
function toast(msg,ms){
  let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent=msg;void t.offsetWidth;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),ms||4200);
}

/* ---------- timer (shared by both windows, survives a reload) ---------- */
const TKEY='gimber-timer-v2',TARGET0=15*60;   /* the talk lasts 15 minutes by default (editable in the presenter view) */
let timer={run:false,acc:0,t0:0,target:TARGET0*1000};
(function(){
  try{
    const s=JSON.parse(store.get(TKEY)||'null');
    if(s&&isFinite(s.acc)&&isFinite(s.target)){
      const stale=Date.now()-(s.savedAt||0)>3*3600*1000;   /* a leftover from an earlier session */
      timer={run:!!s.run&&!stale,acc:stale?0:s.acc,t0:s.t0||0,target:s.target};
      if(timer.run&&!(timer.t0>0))timer.run=false;
    }
  }catch(e){}
})();
const elapsed=()=>timer.acc+(timer.run?Math.max(0,Date.now()-timer.t0):0);
function setTimer(t,send){
  timer=t;store.set(TKEY,JSON.stringify(Object.assign({savedAt:Date.now()},t)));
  if(send)post({type:'timer',t:t});
  renderTimer();
}
function timerToggle(){setTimer(timer.run?Object.assign({},timer,{run:false,acc:elapsed(),t0:0}):Object.assign({},timer,{run:true,t0:Date.now()}),true)}
function timerReset(){setTimer({run:false,acc:0,t0:0,target:timer.target},true);entryAt=0}
function validTimer(t){return t&&typeof t==='object'&&isFinite(t.acc)&&isFinite(t.t0)&&isFinite(t.target)&&t.target>=0&&t.target<=86400000}
function timerState(){const rem=timer.target-elapsed();return timer.target>0?(rem<0?'over':rem<=60000?'warn':'ok'):'ok'}
/* planned timing, read from the notes ("about 1:10"): the cumulative sum gives when each slide should start */
const DUR=NOTES.map(n=>{const m=/about (\d+):(\d\d)/.exec(n[1]);return m?(+m[1])*60+(+m[2]):0});
const PLAN=[];let PLAN_END=0;(function(){let a=0;DUR.forEach((d,i)=>{PLAN[i]=a;a+=d});PLAN_END=a})();
/* the relative weights of the slides come from the notes; the plan is stretched to the target time */
const planK=()=>timer.target>0&&PLAN_END>0?timer.target/1000/PLAN_END:1;
/* a copy whose notes carry no text (the public build) has no notes panel: the presenter view keeps the slides, the timer and the layouts */
const NOTES_ON=NOTES.some(n=>n[2]);

/* ---------- full screen, with a choice of display ---------- */
function fsEl(){return document.fullscreenElement||document.webkitFullscreenElement||null}
function reqFs(opts){
  const el=document.documentElement,f=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!f)return Promise.reject(new Error('no fullscreen'));
  try{const r=(opts&&el.requestFullscreen)?el.requestFullscreen(opts):f.call(el);return r&&r.then?r:Promise.resolve()}catch(e){return Promise.reject(e)}
}
function exitFs(){const f=document.exitFullscreen||document.webkitExitFullscreen;if(f){try{const r=f.call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}}
let menuOpen=false,hintShown=false;
function closeMenu(){const m=$('fsm');if(m)m.remove();menuOpen=false;document.removeEventListener('keydown',menuKey,true);document.removeEventListener('pointerdown',menuOut,true)}
function menuKey(e){
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();return}
  const b=[...document.querySelectorAll('#fsm .fm-l button')];
  if(/^[1-9]$/.test(e.key)&&b[+e.key-1]){e.preventDefault();e.stopPropagation();b[+e.key-1].click()}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();const i=b.indexOf(document.activeElement);b[(i+(e.key==='ArrowDown'?1:-1)+b.length)%b.length].focus()}
}
function menuOut(e){if(!e.target.closest('#fsm')&&!e.target.closest('#b-fs')&&!e.target.closest('#pv-aud'))closeMenu()}
/* shows a list of displays; onPick(screen) runs on the click, so it has the user gesture that full screen and window.open need */
function pickScreen(details,title,note,onPick){
  closeMenu();
  const cur=details.currentScreen,list=details.screens;
  const m=document.createElement('div');m.id='fsm';m.setAttribute('role','dialog');m.setAttribute('aria-label',title);
  m.innerHTML='<h3>'+esc(title)+'</h3><div class="fm-l">'+list.map((s,i)=>{
    const tags=[s.isPrimary?'main display':'',s.isInternal?'built-in':'',s===cur||(cur&&s.label===cur.label&&s.left===cur.left)?'this window is here':''].filter(Boolean).join(' · ');
    const isCur=s===cur||(cur&&s.left===cur.left&&s.top===cur.top);
    return '<button type="button" data-i="'+i+'" data-cur="'+(isCur?1:0)+'"><span class="fm-i">'+(i+1)+'</span><span><b>'+esc(s.label||('Display '+(i+1)))+'</b><small>'+s.width+' × '+s.height+(tags?' · '+esc(tags):'')+'</small></span></button>';
  }).join('')+'</div><p class="fm-n">'+esc(note)+'</p><button type="button" class="fm-x">Cancel</button>';
  document.body.appendChild(m);menuOpen=true;
  m.querySelectorAll('.fm-l button').forEach(b=>b.addEventListener('click',()=>{const s=list[+b.dataset.i];closeMenu();onPick(s)}));
  m.querySelector('.fm-x').addEventListener('click',closeMenu);
  const first=[...m.querySelectorAll('.fm-l button')].find(b=>b.dataset.cur==='0')||m.querySelector('.fm-l button');
  first.focus();
  document.addEventListener('keydown',menuKey,true);document.addEventListener('pointerdown',menuOut,true);
}
async function screenDetails(){
  if(window.getScreenDetails&&window.screen&&window.screen.isExtended){
    try{const d=await window.getScreenDetails();if(d&&d.screens&&d.screens.length>1)return d}catch(e){}
  }
  return null;
}
function fsDirect(){
  reqFs().catch(()=>toast('Full screen was blocked. Click Full screen again.'));
  if(!hintShown&&!AUD){hintShown=true;toast('Full screen opens on the display this window is on. To use the projector, drag the window there first.',5200)}
}
const canListScreens=()=>!!(window.getScreenDetails&&window.screen&&window.screen.isExtended);
function fsAsk(){
  if(fsEl()){exitFs();return}
  if(menuOpen){closeMenu();return}
  /* no await before the plain path: Safari and Firefox only allow full screen inside the click itself */
  if(!canListScreens()){fsDirect();return}
  screenDetails().then(d=>{
    if(!d){fsDirect();return}
    pickScreen(d,'Full screen on which display?','Pick the projector. Allow "window management" if the browser asks, so it can list your displays.',s=>{
      reqFs({screen:s}).catch(()=>reqFs().catch(()=>toast('Full screen was blocked. Click Full screen again.')));
    });
  });
}

/* ---------- messages ---------- */
let pendingGo=null,presAt=0,audAt=0,audInfo=null,blank=false;
const presenterAlive=()=>Date.now()-presAt<6000;
const audienceAlive=()=>Date.now()-audAt<6000;
function onMessage(m){
  switch(m.type){
    case 'hello':
      if(MODE==='deck'){post(stateMsg())}
      else{post({type:'timer',t:timer});if(m.role==='deck'){want=pcur;wantAt=Date.now();post({type:'go',n:pcur,force:true});if(blank)post({type:'blank',on:true})}}
      break;
    case 'ping':if(MODE==='deck'){presAt=Date.now();post({type:'pong',slide:cur,fs:!!fsEl(),blank:blank,w:innerWidth,h:innerHeight});renderDeckUi()}break;
    case 'pong':if(MODE==='presenter'&&m.role==='deck'){audAt=Date.now();audInfo=m;renderLink()}break;
    case 'bye':
      if(MODE==='presenter'&&m.role==='deck'){audAt=0;renderLink()}
      if(MODE==='deck'&&m.role==='presenter'){presAt=0;renderDeckUi()}
      break;
    case 'state':
      if(MODE==='presenter'&&m.role==='deck'){
        audAt=Date.now();audInfo=m;
        if(validTimer(m.timer)&&!timer.run&&!(elapsed()>0))applyTimer(m.timer);
        if(Number.isInteger(m.slide)&&!(Date.now()-wantAt<3000&&m.slide!==want))pvSet(clamp(m.slide,0,N-1),true);
        renderLink();
      }
      break;
    case 'go':
      if(MODE==='deck'&&Number.isInteger(m.n)){presAt=Date.now();goRemote(clamp(m.n,0,N-1),!!m.force)}
      break;
    case 'timer':if(validTimer(m.t))applyTimer(m.t);break;
    case 'blank':setBlank(!!m.on,false);break;
  }
}
function applyTimer(t){timer={run:!!t.run,acc:t.acc,t0:t.t0,target:t.target};store.set(TKEY,JSON.stringify(Object.assign({savedAt:Date.now()},timer)));renderTimer()}
function stateMsg(){return {type:'state',slide:cur,blank:blank,timer:timer,fs:!!fsEl()}}

/* ---------- blank screen (the room sees black) ---------- */
function setBlank(on,send){
  blank=on;
  if(MODE==='deck'){
    let b=$('blank');if(!b){b=document.createElement('div');b.id='blank';document.body.appendChild(b)}
    document.body.classList.toggle('blank',on);
  }else{const bb=$('pv-blank');if(bb)bb.setAttribute('aria-pressed',String(on))}
  if(send)post({type:'blank',on:on});
}

/* ======================================================================================================================
   Presentation window (the one for the projector)
   ====================================================================================================================== */
function goRemote(n,force){
  if(!started)started=true;           /* a window opened by the presenter view starts on the presenter's slide */
  if(busy){pendingGo=n;return}
  go(n,force);
}
function pvShow(n){   /* called by show(): tell the presenter view which slide the room is looking at */
  if(MODE!=='deck')return;
  post(stateMsg());
  renderDeckUi();
}
function afterBusy(){if(pendingGo!=null){const t=pendingGo;pendingGo=null;go(t)}}
function renderDeckUi(){
  const b=$('b-pv');if(b){b.classList.toggle('live',presenterAlive());b.setAttribute('aria-pressed',String(presenterAlive()))}
}
function openPresenter(){
  if(presenterAlive()){focusPeers();toast('The presenter view is already open.',2600);return}
  const w=window.open(baseUrl()+'?presenter','gimber-presenter','popup=yes,width=1320,height=840,left=40,top=40');
  if(!w){toast('The browser blocked the pop-up. Allow pop-ups for this page, or open the presentation in its own browser tab, and try again.',6500);return}
  peers.add(w);try{w.focus()}catch(e){}
}
function hudRender(){
  const h=$('hud');if(!h||h.hidden)return;
  const s=timerState();h.dataset.s=s;
  h.innerHTML='<b>'+mmss(elapsed()/1000)+'</b>'+(timer.target>0?'<small>of '+mmss(timer.target/1000)+'</small>':'');
}
function hudToggle(){
  let h=$('hud');
  if(!h){h=document.createElement('div');h.id='hud';h.hidden=true;h.setAttribute('aria-hidden','true');document.body.appendChild(h)}
  h.hidden=!h.hidden;hudRender();
  if(!h.hidden)toast(timer.run?'Timer on screen (T hides it).':'Timer on screen. Start it from the presenter view; T hides it.',2800);
}
if(MODE==='deck'){
  const bp=$('b-pv');if(bp)bp.addEventListener('click',openPresenter);
  addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||menuOpen)return;
    const k=e.key;
    if(k==='p'||k==='P')openPresenter();
    else if(k==='t'||k==='T')hudToggle();
    else if(k==='b'||k==='B'||k==='.')setBlank(!blank,true);
  });
  setInterval(()=>{hudRender();renderDeckUi()},500);
  if(AUD){
    const g=document.createElement('div');g.id='fsgo';g.innerHTML='<div>Click to go full screen<small>Press F at any time. Esc leaves full screen.</small></div>';
    document.body.appendChild(g);
    const done=ev=>{if(ev){ev.stopPropagation();ev.preventDefault()}g.remove();reqFs().catch(()=>{})};
    g.addEventListener('click',done);
    addEventListener('keydown',e=>{if(g.isConnected&&(e.key==='f'||e.key==='F')){g.remove()}},true);
  }
  post({type:'hello'});
}

/* ======================================================================================================================
   Presenter view (the window that stays on the laptop)
   Panels (current, next and previous slide, speaker notes, timer, all slides) sit in a tree of splits. Drag a panel by its
   title bar to move it (beside another panel = put it there, middle = swap, strip at the bottom = hide), drag the lines
   between panels to resize, or use the Panels menu (P) to show hidden panels and pick a preset. The arrangement and the
   colour theme are kept in localStorage.
   ====================================================================================================================== */
let pcur=0,want=-1,wantAt=0,entryAt=0,autoStart=store.get('gimber-autostart')!=='0',autoScroll=store.get('gimber-autoscroll')!=='0',manualUntil=0,spos=0,flowT=0,pristine=null,els={},mountSeq=0,tickT=-1;
const NSIZE=[16,18,20,22,24,26,28,30,32,36,40,44,48,54,60,66,72];
let nfont=clamp(+store.get('gimber-nfont')||30,16,72);
const TOPIC=slides.map(s=>{const t=(s.getAttribute('aria-label')||'').replace(/^Slide \d+,\s*/,'');return t.charAt(0).toUpperCase()+t.slice(1)});
/* a clone must not share ids (clip paths, patterns) with the slide it came from */
function uniq(root,tag){
  const list=[...root.querySelectorAll('[id]')];if(!list.length)return;
  const map={};list.forEach(e=>{map[e.id]=e.id+'-'+tag;e.id=map[e.id]});
  const fix=v=>v.replace(/url\(#([^)]+)\)/g,(m,i)=>map[i]?'url(#'+map[i]+')':m);
  root.querySelectorAll('*').forEach(e=>{
    ['clip-path','mask','fill','stroke','filter','style'].forEach(a=>{const v=e.getAttribute(a);if(v&&v.indexOf('url(#')>-1)e.setAttribute(a,fix(v))});
    ['href','xlink:href'].forEach(a=>{const v=e.getAttribute(a);if(v&&v.charAt(0)==='#'&&map[v.slice(1)])e.setAttribute(a,'#'+map[v.slice(1)])});
  });
}
function makePvs(i,kind){
  const w=document.createElement('div');w.className='gl pvs';w.setAttribute('aria-hidden','true');
  const c=pristine[i].cloneNode(true);c.classList.add('on');c.removeAttribute('aria-label');uniq(c,kind+(++mountSeq));
  w.appendChild(c);return w;
}

/* ---------- icons ---------- */
const ico=(d,f)=>'<svg class="pv-i" viewBox="0 0 24 24" aria-hidden="true"'+(f?' data-f="1"':'')+'>'+d+'</svg>';
const SCR='<rect x="3" y="4" width="18" height="12.5" rx="2.5"/><path d="M8.5 20.5h7M12 16.5v4"/>';
const IC={
  grip:ico('<circle cx="9" cy="5.5" r="1.8"/><circle cx="15" cy="5.5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18.5" r="1.8"/><circle cx="15" cy="18.5" r="1.8"/>',1),
  x:ico('<path d="M6 6l12 12M18 6L6 18"/>'),
  cur:ico(SCR+'<path d="M10.3 7.4v5.7l4.7-2.85z" fill="currentColor" stroke="none"/>'),
  next:ico(SCR+'<path d="M8.5 10.25H15M12.6 7.6l2.9 2.65-2.9 2.65"/>'),
  prev:ico(SCR+'<path d="M15.5 10.25H9M11.4 7.6L8.5 10.25l2.9 2.65"/>'),
  notes:ico('<rect x="4" y="3" width="16" height="18" rx="2.8"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  timer:ico('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4.3l2.7 1.6M9.5 2.8h5M12 2.8V6"/>'),
  rail:ico('<rect x="3" y="3.5" width="8" height="6" rx="1.6"/><rect x="3" y="14.5" width="8" height="6" rx="1.6"/><path d="M15 6.5h6M15 17.5h6"/>'),
  panels:ico('<rect x="3" y="3.5" width="18" height="17" rx="3"/><path d="M3 9.5h18M10 9.5v11"/>'),
  sun:ico('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3L7 7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/>'),
  moon:ico('<path d="M20 14.6A8.4 8.4 0 1 1 9.4 4a6.9 6.9 0 0 0 10.6 10.6z"/>'),
  help:ico('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1 1-1.1 1.7M12 17h.01"/>'),
  eyeoff:ico('<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4 9.5 6-.4.8-1.1 1.9-2.2 3M6.6 7.6C4.9 8.8 3.6 10.6 2.5 12c1 2 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  play:ico('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',1),
  pause:ico('<rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/>',1),
  chl:ico('<path d="M14.5 5.5l-6.5 6.5 6.5 6.5"/>'),
  chr:ico('<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>'),
  cog:ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  blank:ico('<rect x="3" y="4" width="18" height="12.5" rx="2.5"/><path d="M8.5 20.5h7M12 16.5v4"/>')
};

/* @tree */
/* The layout is a tree: a leaf is {id,w} (a panel), a split is {d:'x'|'y',w,kids} ('x' puts the kids side by side, 'y' stacks them).
   w is the weight of the node inside its parent, so sizes stay proportional when the window changes. */
const isLeaf=n=>typeof n.id==='string';
const lyP=(id,w)=>({id:id,w:w||1});
const lyX=(w,k)=>({d:'x',w:w||1,kids:k});
const lyY=(w,k)=>({d:'y',w:w||1,kids:k});
const lyClone=n=>n?JSON.parse(JSON.stringify(n)):null;
/* drops empty splits, lets a split with one kid be that kid, merges a split into a parent that runs the same way, and evens out the weights */
function lyTidy(n){
  if(!n)return null;
  if(isLeaf(n))return n;
  const flat=[];
  n.kids.forEach(k=>{
    k=lyTidy(k);if(!k)return;
    if(!isLeaf(k)&&k.d===n.d){const s=k.kids.reduce((a,c)=>a+c.w,0)||1;k.kids.forEach(c=>{c.w=c.w/s*k.w;flat.push(c)})}
    else flat.push(k);
  });
  if(!flat.length)return null;
  if(flat.length===1){flat[0].w=n.w;return flat[0]}
  /* the weights of the kids add up to their number: a flex row whose weights add up to less than 1 would not fill its space */
  const sum=flat.reduce((a,k)=>a+k.w,0);
  if(Math.abs(sum-flat.length)>1e-9){const f=flat.length/sum;flat.forEach(k=>{k.w*=f})}
  n.kids=flat;return n;
}
function lyFind(n,id,parent,i){
  if(!n)return null;
  if(isLeaf(n))return n.id===id?{n:n,parent:parent||null,i:i||0}:null;
  for(let j=0;j<n.kids.length;j++){const r=lyFind(n.kids[j],id,n,j);if(r)return r}
  return null;
}
function lyIds(n,out){
  out=out||[];if(!n)return out;
  if(isLeaf(n))out.push(n.id);else n.kids.forEach(k=>lyIds(k,out));
  return out;
}
/* takes a panel out of the tree (the others share its room) */
function lyDrop(n,id){
  if(!n)return null;
  if(isLeaf(n))return n.id===id?null:n;
  (function rm(x){if(isLeaf(x))return;x.kids=x.kids.filter(k=>!(isLeaf(k)&&k.id===id));x.kids.forEach(rm)})(n);
  return lyTidy(n);
}
/* puts panel `id` beside panel `tid`, on the side `zone` (left, right, top, bottom); `share` is the part of tid's room it takes */
function lyBeside(root,tid,id,zone,share){
  const f=lyFind(root,tid);if(!f)return root;
  const d=(zone==='left'||zone==='right')?'x':'y',first=zone==='left'||zone==='top',sh=share||.5,neu=lyP(id,1);
  if(f.parent&&f.parent.d===d){
    const w=f.n.w;neu.w=w*sh;f.n.w=w*(1-sh);
    f.parent.kids.splice(f.i+(first?0:1),0,neu);
    return root;
  }
  const w=f.n.w;neu.w=sh;f.n.w=1-sh;
  const s={d:d,w:w,kids:first?[neu,f.n]:[f.n,neu]};
  if(!f.parent)return s;
  f.parent.kids[f.i]=s;return root;
}
/* puts panel `id` along an outer edge of the whole workspace */
function lyEdge(root,id,side){
  const d=(side==='left'||side==='right')?'x':'y',first=side==='left'||side==='top',neu=lyP(id,1);
  if(!root)return neu;
  if(!isLeaf(root)&&root.d===d){
    neu.w=root.kids.reduce((a,k)=>a+k.w,0)*.4;
    if(first)root.kids.unshift(neu);else root.kids.push(neu);
    return root;
  }
  root.w=1;neu.w=.42;
  return {d:d,w:1,kids:first?[neu,root]:[root,neu]};
}
function lySwap(root,a,b){
  const A=lyFind(root,a),B=lyFind(root,b);if(!A||!B)return;
  const t=A.n.id;A.n.id=B.n.id;B.n.id=t;
}
/* where a panel goes when it is shown from the menu: next to its relatives (the timer goes below, the notes at the side, the slide list at the left), else it splits the biggest panel along its long side */
function lyAuto(root,id,size){
  if(!root)return lyP(id,1);
  const vis=lyIds(root),rel={prev:[['cur','left'],['next','left']],next:[['cur','right'],['prev','right']],cur:[['next','left'],['prev','right']]}[id]||[];
  for(let i=0;i<rel.length;i++)if(vis.indexOf(rel[i][0])>-1)return lyBeside(root,rel[i][0],id,rel[i][1],.4);
  let best=vis[0],area=-1;
  vis.forEach(v=>{const s=size(v),a=s[0]*s[1];if(a>area){area=a;best=v}});
  const s=size(best),home={rail:'left',notes:'right',timer:'bottom'};
  return lyBeside(root,best,id,home[id]||(s[0]>=s[1]*.9?'right':'bottom'),.4);
}
/* smallest room (width 0, height 1) a node needs; panels declare theirs, gaps between them are `gap` pixels */
function lyMin(n,ax,mins,gap){
  if(isLeaf(n))return mins[n.id][ax];
  if((n.d==='x')===(ax===0))return n.kids.reduce((a,k)=>a+lyMin(k,ax,mins,gap),0)+gap*(n.kids.length-1);
  return Math.max.apply(null,n.kids.map(k=>lyMin(k,ax,mins,gap)));
}
/* reads a saved tree: unknown or repeated panels and bad weights are dropped */
function lySane(n,known,seen){
  if(!n||typeof n!=='object')return null;
  const w=isFinite(n.w)&&n.w>0&&n.w<1e4?+n.w:1;
  if(typeof n.id==='string'){
    if(!known[n.id]||seen[n.id])return null;
    seen[n.id]=1;return {id:n.id,w:w};
  }
  if((n.d!=='x'&&n.d!=='y')||!Array.isArray(n.kids))return null;
  return {d:n.d,w:w,kids:n.kids.map(k=>lySane(k,known,seen)).filter(Boolean)};
}
/* @end-tree */

/* ---------- panels, presets and what is remembered ---------- */
const PANEL={
  cur:{t:'Current slide',ic:'cur',min:[260,200]},
  next:{t:'Next slide',ic:'next',min:[220,180]},
  prev:{t:'Previous slide',ic:'prev',min:[220,180]},
  notes:{t:'Speaker notes',ic:'notes',min:[320,240]},
  timer:{t:'Timer',ic:'timer',min:[270,230]},
  rail:{t:'All slides',ic:'rail',min:[200,170]}
};
const PIDS=['cur','next','prev','notes','timer','rail'].filter(id=>NOTES_ON||id!=='notes'),MINS={};
PIDS.forEach(i=>{MINS[i]=PANEL[i].min});
const GUT=12,LKEY='gimber-pv-layout-v1',THKEY='gimber-pv-theme';
const PRESETS=[
  {id:'balanced',name:'Balanced',make:()=>lyX(1,[lyY(1.25,[lyP('cur',1.6),lyP('timer',1)]),lyY(1,[lyP('notes',1.7),lyP('next',1)])])},
  {id:'notes',name:'Notes',n:1,make:()=>lyX(1,[lyP('notes',1.75),lyY(1,[lyP('cur',1.2),lyP('timer',1)])])},
  {id:'slides',name:'Slides',make:()=>lyY(1,[lyX(2.6,[lyP('prev',1),lyP('cur',2.2),lyP('next',1)]),lyP('timer',1)])},
  {id:'time',name:'Time',make:()=>lyY(1,[lyP('timer',1.5),lyX(1,[lyP('cur',1),lyP('next',1)])])},
  {id:'qa',name:'Questions',make:()=>lyX(1,[lyP('rail',1.15),lyP('notes',1.75),lyY(1,[lyP('cur',1),lyP('timer',.8)])])},
  {id:'minimal',name:'Minimal',n:1,make:()=>lyX(1,[lyP('notes',2),lyP('timer',1)])},
  {id:'all',name:'Everything',make:()=>lyX(1,[lyP('rail',.8),lyY(2.6,[lyX(1.55,[lyP('prev',1),lyP('cur',1.7),lyP('next',1)]),lyX(1,[lyP('timer',1),lyP('notes',2.1)])])])}
].filter(p=>NOTES_ON||!p.n);
/* without notes the presets that are about them go (n:1), and the others share the room of the notes panel */
const presetTree=p=>{const t=p.make();return NOTES_ON?t:lyDrop(t,'notes')};
let pvTree=null,pvPreset='balanced',pvDirty=false,pvMine=null,pvMenuOn=false,drag=null;
const PN={};
const pvPresetTree=id=>{if(id==='mine')return pvMine?lyClone(pvMine):null;const p=PRESETS.find(x=>x.id===id);return p?lyTidy(presetTree(p)):null};
const pvVisible=()=>PIDS.filter(id=>PN[id]&&PN[id].vis);
function pvPersist(){store.set(LKEY,JSON.stringify({p:pvPreset,d:pvDirty,t:pvTree,m:pvMine}))}
function pvRestore(){
  const known={};PIDS.forEach(i=>{known[i]=1});
  let s=null;try{s=JSON.parse(store.get(LKEY)||'null')}catch(e){}
  if(s&&typeof s==='object'){
    pvMine=s.m?lyTidy(lySane(s.m,known,{})):null;
    const t=s.t?lyTidy(lySane(s.t,known,{})):null,okP=s.p==='mine'?!!pvMine:PRESETS.some(p=>p.id===s.p);
    if(okP&&(t||s.t===null)){pvTree=t;pvPreset=s.p;pvDirty=!!s.d;return}
  }
  pvTree=pvPresetTree('balanced');pvPreset='balanced';pvDirty=false;
}
let sayT=0;
function pvSay(msg){const s=els.say;if(!s)return;s.textContent='';clearTimeout(sayT);sayT=setTimeout(()=>{s.textContent=msg},30)}

/* ---------- panels ---------- */
const mkEl=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e};
const roFns=[];
function watch(el,fn){if(window.ResizeObserver)new ResizeObserver(()=>fn()).observe(el);else roFns.push(fn)}
if(!window.ResizeObserver)addEventListener('resize',()=>roFns.forEach(f=>f()));
/* what every panel shares: a title bar with a grip (drag it to move the panel), room for extras and a hide button */
function mkPanel(id){
  const t=PANEL[id].t,el=mkEl('section','pv-panel');
  el.dataset.id=id;el.setAttribute('aria-label',t);
  el.innerHTML='<header class="pv-ph"><button type="button" class="pv-grip" title="Drag to move" aria-label="Move '+t+'. Drag it, or use the arrow keys to swap it with a neighbour">'+IC.grip+'</button>'+
    '<h2>'+t+'</h2><span class="pv-hx"></span><span class="pv-ht"></span><span class="pv-sp"></span><span class="pv-hr"></span>'+
    '<button type="button" class="pv-hide" title="Hide this panel" aria-label="Hide '+t+'">'+IC.x+'</button></header><div class="pv-pb"></div>';
  const q=s=>el.querySelector(s),p={id:id,el:el,vis:false,grip:q('.pv-grip'),hx:q('.pv-hx'),ht:q('.pv-ht'),hr:q('.pv-hr'),body:q('.pv-pb')};
  PN[id]=p;
  q('.pv-hide').addEventListener('click',()=>pvHide(id));
  q('.pv-ph').addEventListener('pointerdown',e=>{if(e.target.closest('.pv-hide,.pv-hr button,.pv-hr label'))return;dragWatch(e,id,'panel')});
  p.grip.addEventListener('keydown',e=>gripKey(e,id));
  return p;
}

/* current, next and previous slide: the same slide clone as the thumbnails, scaled to fit, with the sliding transition */
function fitSlide(p){
  const aw=p.area.clientWidth,ah=p.area.clientHeight;if(!aw||!ah)return;
  const s=Math.min(aw/1600,ah/900);
  p.box.style.width=Math.floor(1600*s)+'px';p.box.style.height=Math.floor(900*s)+'px';p.box.style.setProperty('--s',s);
}
function swapLayer(p,k,dir){
  const box=p.box;
  [...box.querySelectorAll('.pv-layer.out')].forEach(l=>l.remove());
  const old=[...box.querySelectorAll('.pv-layer')];
  old.forEach(l=>{try{l.getAnimations().forEach(a=>a.finish())}catch(e){}});
  const layer=mkEl('div','pv-layer');
  if(k>=0)layer.appendChild(makePvs(k,'c'));
  else layer.innerHTML='<div class="pv-none"><span>'+(p.off<0?'This is the first slide':'This is the last slide')+'</span></div>';
  box.appendChild(layer);
  const still=!dir||!old.length||!layer.animate||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(still){old.forEach(l=>l.remove());return}
  const o={duration:340,easing:'cubic-bezier(.22,.8,.24,1)',fill:'both'};
  old.forEach(l=>{l.classList.add('out');const a=l.animate([{transform:'translateX(0)'},{transform:'translateX('+(-100*dir)+'%)'}],o);a.onfinish=()=>l.remove()});
  layer.animate([{transform:'translateX('+(100*dir)+'%)'},{transform:'translateX(0)'}],o);
}
/* n is the slide on the projector; a hidden panel is left alone and catches up when it comes back */
function slideUpd(p,n,dir){
  if(!p.vis)return;
  const t=n+p.off,ok=t>=0&&t<N,k=ok?t:-1;
  if(p.idx===k)return;
  const first=p.idx===-9;p.idx=k;
  swapLayer(p,k,first?0:dir);
  p.hx.textContent=ok?(t+1)+' / '+N:'';
  p.ht.textContent=ok?TOPIC[t]:'';
  p.box.setAttribute('aria-label',!ok?(p.off<0?'No previous slide':'No next slide'):p.off<0?'Go back to slide '+(t+1)+': '+TOPIC[t]:p.off>0?'Go to slide '+(t+1)+': '+TOPIC[t]:'Current slide, '+(t+1)+': '+TOPIC[t]+(n<N-1?'. Click for the next slide':''));
}
function mkSlideP(id,off){
  const p=mkPanel(id);p.off=off;p.idx=-9;
  p.body.classList.add('pv-sl');
  p.body.innerHTML='<div class="pv-area"><div class="pv-box" role="button" tabindex="0"></div></div>';
  p.area=p.body.firstChild;p.box=p.area.firstChild;
  const act=()=>{if(p.idx>=0)pvGo(off<0?pcur-1:pcur+1)};
  p.box.addEventListener('click',act);
  p.box.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();act()}});
  watch(p.area,()=>fitSlide(p));
  p.on=()=>{slideUpd(p,pcur,0);fitSlide(p)};
  return p;
}

/* all slides: a grid of thumbnails whose size follows the width of the panel (no hover zoom: resize the panel instead) */
function railFit(p){
  const W=p.body.clientWidth;if(!W)return;
  const pad=14,gap=14,aim=172,inner=W-pad*2;
  const cols=Math.max(1,Math.floor((inner+gap)/(aim+gap))),tw=Math.max(60,Math.floor((inner-gap*(cols-1))/cols));
  p.grid.style.setProperty('--cols',cols);p.grid.style.setProperty('--tw',tw+'px');p.grid.style.setProperty('--ts',(tw/1600).toFixed(5));
  p.grid.classList.toggle('ttl',tw>=120);
}
function railEnsure(p){
  if(p.built)return;p.built=true;
  p.grid.innerHTML=slides.map((s,i)=>'<button type="button" class="pv-th" aria-label="Go to slide '+(i+1)+': '+esc(TOPIC[i])+'"><span class="tb"><span class="nm">'+(i+1)+'</span></span><span class="tl">'+esc(TOPIC[i])+'</span></button>').join('');
  p.th=[...p.grid.children];
  p.th.forEach((b,i)=>b.addEventListener('click',()=>{pvGo(i);b.blur()}));
  let i=0;   /* thumbnails are filled in one by one so the window appears at once */
  (function step(){if(i>=N)return;p.th[i].firstChild.appendChild(makePvs(i,'t'));i++;setTimeout(step,28)})();
}
function railMark(n,instant){
  const p=PN.rail;if(!p||!p.th)return;
  p.th.forEach((b,i)=>b.setAttribute('aria-current',String(i===n)));
  if(!p.vis||(!instant&&p.body.matches(':hover')))return;
  const sc=p.body,rb=sc.getBoundingClientRect(),bb=p.th[n].getBoundingClientRect();
  const to=sc.scrollTop+(bb.top-rb.top)-(rb.height-bb.height)/2;
  if(sc.scrollTo&&!instant)sc.scrollTo({top:to,behavior:'smooth'});else sc.scrollTop=to;
}
function mkRailP(){
  const p=mkPanel('rail');
  p.body.classList.add('pv-rl');
  p.grid=mkEl('div','pv-grid');p.body.appendChild(p.grid);
  p.th=null;p.built=false;
  watch(p.body,()=>railFit(p));
  p.on=()=>{railEnsure(p);railFit(p);railMark(pcur,true)};
  return p;
}

/* speaker notes (silent: the audio is only played from the presentation window) */
function mkNotesP(){
  const p=mkPanel('notes');
  p.hr.innerHTML='<span class="pv-who" hidden><span class="av"></span><b></b></span>'+
    '<span class="pv-fs"><button type="button" class="pv-ib" data-fs="-1" aria-label="Smaller notes text" title="Smaller text (−)">A<small>−</small></button><button type="button" class="pv-ib" data-fs="1" aria-label="Larger notes text" title="Larger text (+)">A<small>+</small></button></span>'+
    '<label class="pv-sw" title="Scrolls the notes slowly while the time planned for this slide goes by. Scrolling by hand pauses it for a few seconds."><input type="checkbox" role="switch"><i></i><span>Auto-scroll</span></label>';
  p.body.classList.add('pv-nt');
  p.body.innerHTML='<div class="pv-nbody" tabindex="0"></div>';
  return p;
}

/* timer: Start/Pause sits in the title bar, the digits fill the body and scale with the panel; target, auto-start and reset live in the cog menu */
function mkTimerP(){
  const p=mkPanel('timer');p.el.classList.add('pv-timer');
  p.hr.innerHTML='<button type="button" class="pv-btn pv-pri tt"></button>'+
    '<button type="button" class="pv-ib pv-cog" aria-haspopup="dialog" aria-expanded="false" aria-label="Timer settings" title="Timer settings: target time, auto-start, reset">'+IC.cog+'</button>';
  p.body.classList.add('pv-tb');
  p.body.innerHTML=
    '<div class="pv-nums"><div class="pv-ni"><div class="pv-n"><small>Elapsed</small><b class="el">00:00</b></div><div class="pv-n"><small class="reml">Remaining</small><b class="rem">15:00</b></div></div></div>'+
    '<div class="pv-pbar"><i></i></div><div class="pv-pace"></div>';
  return p;
}

/* ---------- the workspace: a tree of splits, with a gutter between neighbours ---------- */
function pvNode(n){
  if(isLeaf(n)){const e=PN[n.id].el;e.style.flex=n.w+' 1 0px';return e}
  const s=mkEl('div','pv-split');s.dataset.d=n.d;s.style.flex=n.w+' 1 0px';
  n.kids.forEach((k,i)=>{if(i)s.appendChild(mkGutter(n,i-1));s.appendChild(pvNode(k))});
  return s;
}
function pvRender(){
  pvPopClose(false);
  const keep=[els.nb.scrollTop,PN.rail.body.scrollTop],on=pvTree?lyIds(pvTree):[];
  PIDS.forEach(id=>{const p=PN[id];p.vis=on.indexOf(id)>-1;if(!p.vis)els.park.appendChild(p.el)});
  els.work.textContent='';
  if(pvTree){const r=pvNode(pvTree);r.style.flex='1 1 0px';els.work.appendChild(r)}
  else els.work.appendChild(els.none);
  els.nb.scrollTop=keep[0];PN.rail.body.scrollTop=keep[1];   /* moving a panel in the page resets its scroll */
  PIDS.forEach(id=>{const p=PN[id];if(p.vis&&p.on)p.on()});
}
/* something changed in the arrangement: keep it, redraw, and tell the menu */
function pvCommit(root,flash){
  pvTree=lyTidy(root);pvDirty=true;pvPersist();pvRender();pvSync();
  if(flash&&PN[flash]&&PN[flash].vis){const el=PN[flash].el;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1300)}
}
function pvTouched(){pvDirty=true;pvPersist();pvSync()}
function pvApply(id,quiet){
  const t=pvPresetTree(id);if(!t)return;
  pvTree=t;pvPreset=id;pvDirty=false;pvPersist();pvRender();pvSync();
  const nm=id==='mine'?'My layout':PRESETS.find(p=>p.id===id).name;
  if(!quiet)toast('Layout: '+nm,1700);
  pvSay('Layout '+nm);
}
function pvHide(id){
  if(!pvTree||!lyFind(pvTree,id))return;
  pvCommit(lyDrop(pvTree,id));
  pvSay(PANEL[id].t+' hidden. Show it again from the Panels menu.');
}
function pvAdd(id){
  if(pvTree&&lyFind(pvTree,id))return;
  const size=v=>{const r=PN[v].el.getBoundingClientRect();return [r.width,r.height]};
  pvCommit(lyAuto(pvTree,id,size),id);
  pvSay(PANEL[id].t+' shown.');
}
function pvSaveMine(){
  if(!pvTree)return;
  pvMine=lyClone(pvTree);pvPreset='mine';pvDirty=false;pvPersist();pvSync();
  toast('Saved as My layout (key '+(PRESETS.length+1)+')',2200);
}

/* resizing: drag the line between two neighbours (or focus it and use the arrow keys; double-click evens them out) */
function mkGutter(split,i){
  const g=mkEl('div','pv-gut'),a=split.kids[i].w,b=split.kids[i+1].w;
  g.dataset.d=split.d;g.tabIndex=0;g.setAttribute('role','separator');
  g.setAttribute('aria-orientation',split.d==='x'?'vertical':'horizontal');
  g.setAttribute('aria-label','Resize the panels on either side. Drag, use the arrow keys, or double-click to even them out');
  g.setAttribute('aria-valuemin','0');g.setAttribute('aria-valuemax','100');g.setAttribute('aria-valuenow',String(Math.round(a/(a+b)*100)));
  g.addEventListener('pointerdown',e=>startResize(e,split,i,g));
  g.addEventListener('keydown',e=>keyResize(e,split,i,g));
  g.addEventListener('dblclick',()=>{const c=gutCtx(split,i,g);gutSet(c,c.tot/2,g);pvTouched()});
  return g;
}
function gutCtx(split,i,g){
  const ax=split.d==='x'?0:1,A=g.previousElementSibling,B=g.nextElementSibling,na=split.kids[i],nb=split.kids[i+1];
  const rA=A.getBoundingClientRect(),rB=B.getBoundingClientRect(),a0=ax?rA.height:rA.width,tot=a0+(ax?rB.height:rB.width);
  return {ax:ax,A:A,B:B,na:na,nb:nb,a0:a0,tot:tot,W:na.w+nb.w,minA:Math.min(lyMin(na,ax,MINS,GUT),tot/2),minB:Math.min(lyMin(nb,ax,MINS,GUT),tot/2)};
}
function gutSet(c,a,g){
  a=clamp(a,c.minA,c.tot-c.minB);
  c.na.w=c.W*a/c.tot;c.nb.w=c.W-c.na.w;               /* weights stay in proportion with the pixels */
  c.A.style.flexGrow=c.na.w;c.B.style.flexGrow=c.nb.w;
  g.setAttribute('aria-valuenow',String(Math.round(a/c.tot*100)));
}
function startResize(e,split,i,g){
  if(e.button!==undefined&&e.button!==0)return;
  e.preventDefault();
  const c=gutCtx(split,i,g),p0=c.ax?e.clientY:e.clientX;let moved=false;
  try{g.setPointerCapture(e.pointerId)}catch(x){}
  g.classList.add('on');document.body.classList.add('pv-sizing',c.ax?'pv-ns':'pv-ew');
  const mv=ev=>{if(ev.pointerId!==e.pointerId)return;const d=(c.ax?ev.clientY:ev.clientX)-p0;if(d)moved=true;gutSet(c,c.a0+d,g)};
  const up=ev=>{
    if(ev.pointerId!==e.pointerId)return;
    g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);g.removeEventListener('pointercancel',up);
    g.classList.remove('on');document.body.classList.remove('pv-sizing','pv-ns','pv-ew');
    try{g.releasePointerCapture(ev.pointerId)}catch(x){}
    g.blur();if(moved)pvTouched();
  };
  g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
}
function keyResize(e,split,i,g){
  if(!g.matches(':focus-visible'))return;   /* after a mouse drag the arrow keys go back to the slides */
  const k=e.key,v=split.d==='x',less=v?'ArrowLeft':'ArrowUp',more=v?'ArrowRight':'ArrowDown';
  if(k!==less&&k!==more&&k!=='Home'&&k!=='End')return;
  e.preventDefault();e.stopPropagation();
  const c=gutCtx(split,i,g);
  gutSet(c,k==='Home'?c.minA:k==='End'?c.tot-c.minB:c.a0+(e.shiftKey?96:24)*(k===less?-1:1),g);
  pvTouched();
}

/* moving: drag a panel by its title bar (or its row in the Panels menu) */
const inR=(r,x,y,m)=>x>=r.left-m&&x<=r.right+m&&y>=r.top-m&&y<=r.bottom+m;
const rectOf=(l,t,w,h)=>({left:l,top:t,width:w,height:h});
function halfOf(r,z){
  const w=r.width,h=r.height;
  return z==='left'?rectOf(r.left,r.top,w/2,h):z==='right'?rectOf(r.left+w/2,r.top,w/2,h):z==='top'?rectOf(r.left,r.top,w,h/2):rectOf(r.left,r.top+h/2,w,h/2);
}
function dragWatch(e,id,from){
  if(drag||(e.button!==undefined&&e.button!==0))return;
  drag={id:id,from:from,x0:e.clientX,y0:e.clientY,pid:e.pointerId,on:false,tgt:null,vis:!!PN[id].vis};
  document.addEventListener('pointermove',dragMove,true);document.addEventListener('pointerup',dragEnd,true);
  document.addEventListener('pointercancel',dragCancel,true);document.addEventListener('keydown',dragKey,true);
  addEventListener('blur',dragCancel);
}
function dragStop(){
  const d=drag;drag=null;
  document.removeEventListener('pointermove',dragMove,true);document.removeEventListener('pointerup',dragEnd,true);
  document.removeEventListener('pointercancel',dragCancel,true);document.removeEventListener('keydown',dragKey,true);
  removeEventListener('blur',dragCancel);
  document.body.classList.remove('pv-dragging');
  els.ghost.hidden=true;els.tray.hidden=true;els.tray.classList.remove('hot');els.drop.classList.remove('on');els.menu.classList.remove('away');
  if(d&&d.vis)PN[d.id].el.classList.remove('is-drag');
  const a=document.activeElement;if(a&&a.classList&&(a.classList.contains('pv-grip')||a.classList.contains('pv-gut')))a.blur();
  return d;
}
function dragBegin(d){
  d.on=true;document.body.classList.add('pv-dragging');
  d.work=els.work.getBoundingClientRect();d.wrap=els.wrap.getBoundingClientRect();
  d.rects=pvVisible().map(id=>({id:id,r:PN[id].el.getBoundingClientRect()}));
  els.ghost.innerHTML=IC[PANEL[d.id].ic]+'<b>'+PANEL[d.id].t+'</b>';els.ghost.hidden=false;
  if(d.vis){PN[d.id].el.classList.add('is-drag');els.tray.hidden=false;d.tray=els.tray.getBoundingClientRect()}
  if(d.from==='menu')els.menu.classList.add('away');   /* get the list out of the way so the whole workspace can be seen */
}
function dragMove(e){
  const d=drag;if(!d||e.pointerId!==d.pid)return;
  if(!d.on){if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<6)return;dragBegin(d)}
  e.preventDefault();
  els.ghost.style.transform='translate('+(e.clientX+16)+'px,'+(e.clientY+12)+'px)';
  d.tgt=pvTarget(d,e.clientX,e.clientY);pvIndicate(d.tgt);
}
/* where would the panel land if it were dropped here? */
function pvTarget(d,x,y){
  if(d.tray&&inR(d.tray,x,y,8))return {t:'hide'};
  const w=d.work;if(!inR(w,x,y,0))return null;
  if(!d.rects.length)return {t:'root',r:w};
  if(d.rects.length===1&&d.rects[0].id===d.id)return {t:'none'};
  const E=30;   /* the outer edges of the workspace: a new strip along the whole side */
  if(x-w.left<E)return {t:'edge',side:'left',r:rectOf(w.left,w.top,w.width*.3,w.height)};
  if(w.right-x<E)return {t:'edge',side:'right',r:rectOf(w.right-w.width*.3,w.top,w.width*.3,w.height)};
  if(y-w.top<E)return {t:'edge',side:'top',r:rectOf(w.left,w.top,w.width,w.height*.3)};
  if(w.bottom-y<E)return {t:'edge',side:'bottom',r:rectOf(w.left,w.bottom-w.height*.3,w.width,w.height*.3)};
  let best=null,bd=1e12;
  d.rects.forEach(o=>{const r=o.r,dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=o}});
  if(best.id===d.id)return {t:'none'};
  const r=best.r,fx=clamp((x-r.left)/r.width,0,1),fy=clamp((y-r.top)/r.height,0,1),dist={left:fx,right:1-fx,top:fy,bottom:1-fy};
  let z='left',m=dist.left;['right','top','bottom'].forEach(k=>{if(dist[k]<m){m=dist[k];z=k}});
  if(d.vis&&m>=.3)return {t:'swap',id:best.id,r:r};   /* the middle of a panel swaps the two */
  return {t:'beside',id:best.id,zone:z,r:halfOf(r,z)};
}
function pvIndicate(t){
  const dp=els.drop;
  els.tray.classList.toggle('hot',!!t&&t.t==='hide');
  if(!t||!t.r){dp.classList.remove('on');return}
  const b=drag.wrap;
  dp.style.left=(t.r.left-b.left)+'px';dp.style.top=(t.r.top-b.top)+'px';dp.style.width=t.r.width+'px';dp.style.height=t.r.height+'px';
  dp.dataset.k=t.t;dp.classList.add('on');
}
function dragEnd(e){
  const d=drag;if(!d||e.pointerId!==d.pid)return;
  const was=dragStop();
  if(!was.on)return;
  e.preventDefault();
  if(was.tgt){pvMove(was.id,was.tgt);if(was.from==='menu')pvMenuClose(false)}
}
function dragCancel(){if(drag)dragStop()}
function dragKey(e){if(e.key==='Escape'&&drag){e.preventDefault();e.stopPropagation();dragStop()}}
function pvMove(id,t){
  let root=pvTree;const had=!!(root&&lyFind(root,id));
  if(t.t==='none')return;
  if(t.t==='hide'){if(!had)return;pvHide(id);return}
  if(t.t==='swap'){if(!had)return;lySwap(root,id,t.id);pvCommit(root,id);pvSay(PANEL[id].t+' swapped with '+PANEL[t.id].t);return}
  if(had)root=lyDrop(root,id);
  if(t.t==='root'||!root)root=lyP(id,1);
  else if(t.t==='edge')root=lyEdge(root,id,t.side);
  else if(t.t==='beside')root=lyBeside(root,t.id,id,t.zone);
  pvCommit(root,id);
  pvSay(PANEL[id].t+' moved.');
}
/* keyboard: with a grip focused, the arrow keys swap the panel with its neighbour on that side */
function gripKey(e,id){
  const k=e.key;
  if(!/^Arrow(Left|Right|Up|Down)$/.test(k)||!e.target.matches(':focus-visible'))return;
  e.preventDefault();e.stopPropagation();
  const me=PN[id].el.getBoundingClientRect();let best=null,bd=1e9;
  pvVisible().forEach(o=>{
    if(o===id)return;
    const r=PN[o].el.getBoundingClientRect(),ox=Math.min(me.right,r.right)-Math.max(me.left,r.left),oy=Math.min(me.bottom,r.bottom)-Math.max(me.top,r.top);let d=-1;
    if(k==='ArrowRight'&&r.left>=me.right-2&&oy>0)d=r.left-me.right;
    else if(k==='ArrowLeft'&&r.right<=me.left+2&&oy>0)d=me.left-r.right;
    else if(k==='ArrowDown'&&r.top>=me.bottom-2&&ox>0)d=r.top-me.bottom;
    else if(k==='ArrowUp'&&r.bottom<=me.top+2&&ox>0)d=me.top-r.bottom;
    if(d>=0&&d<bd){bd=d;best=o}
  });
  if(!best){pvSay('No panel on that side.');return}
  lySwap(pvTree,id,best);pvCommit(pvTree,id);PN[id].grip.focus();
  pvSay(PANEL[id].t+' swapped with '+PANEL[best].t+'.');
}

/* ---------- the Panels menu: presets, show or hide each panel, save your own layout ---------- */
function pvMini(n){
  if(isLeaf(n))return '<span class="mc" data-k="'+n.id+'" style="flex:'+n.w+' 1 0">'+IC[PANEL[n.id].ic]+'</span>';
  return '<span class="ms" data-d="'+n.d+'" style="flex:'+n.w+' 1 0">'+n.kids.map(pvMini).join('')+'</span>';
}
function pvTile(id,name,key,tree){
  const on=!pvDirty&&pvPreset===id;
  return '<button type="button" class="pv-preset" data-p="'+id+'" aria-pressed="'+on+'"'+(tree?'':' disabled')+'><span class="pv-mini">'+
    (tree?pvMini(tree):'<span class="pv-minin">Not saved yet</span>')+'</span><span class="pn"><b>'+name+'</b><kbd>'+key+'</kbd></span></button>';
}
function pvSync(){
  const m=els.menu;if(!m)return;
  const ae=document.activeElement;let keep=null;
  if(ae&&m.contains(ae)){const d=ae.dataset;keep=d.p?'.pv-preset[data-p="'+d.p+'"]':d.id?'input[data-id="'+d.id+'"]':d.a?'[data-a="'+d.a+'"]':null}
  const on=pvTree?lyIds(pvTree):[];
  m.querySelector('.pv-presets').innerHTML=PRESETS.map((p,i)=>pvTile(p.id,p.name,i+1,presetTree(p))).join('')+pvTile('mine','My layout',PRESETS.length+1,pvMine);
  m.querySelector('.pv-plist').innerHTML=PIDS.map(id=>'<li data-id="'+id+'" data-on="'+(on.indexOf(id)>-1)+'"><span class="pv-pg" title="Drag it into the workspace" aria-hidden="true">'+IC.grip+'</span>'+
    '<label><input type="checkbox" role="switch" data-id="'+id+'"'+(on.indexOf(id)>-1?' checked':'')+'><span class="ic" data-k="'+id+'">'+IC[PANEL[id].ic]+'</span><span class="nm">'+PANEL[id].t+'</span><i class="sw"></i></label></li>').join('');
  m.querySelector('.pv-mc').textContent=pvDirty?'· custom arrangement':'';
  m.querySelector('[data-a="reset"]').disabled=!pvDirty;
  m.querySelector('[data-a="save"]').disabled=!pvTree;
  if(keep){const f=m.querySelector(keep);if(f)f.focus()}
}
function mkMenu(){
  const m=mkEl('div','pv-menu');m.id='pv-menu';m.setAttribute('role','dialog');m.setAttribute('aria-label','Panels and layouts');m.hidden=true;
  m.innerHTML=
    '<div class="pv-mh"><h2>Panels</h2><button type="button" class="pv-hide pv-mx" aria-label="Close the Panels menu" title="Close (Esc)">'+IC.x+'</button></div>'+
    '<h3>Presets <em class="pv-mc"></em></h3><div class="pv-presets"></div>'+
    '<h3>Show or hide</h3><ul class="pv-plist"></ul>'+
    '<div class="pv-mf"><button type="button" class="pv-btn" data-a="reset" title="Back to the preset you chose">Reset layout</button><button type="button" class="pv-btn" data-a="save" title="Keep this arrangement as a preset of your own">Save as My layout</button></div>'+
    '<p class="pv-mn">Drag a panel by its title bar to move it, drag the lines between panels to resize them, or drop a panel on the strip that appears at the bottom to hide it. Panels can also be dragged from this list.</p>';
  m.addEventListener('click',e=>{
    if(e.target.closest('.pv-mx')){pvMenuClose(true);return}
    const pr=e.target.closest('.pv-preset');if(pr){if(!pr.disabled)pvApply(pr.dataset.p);return}
    const a=e.target.closest('[data-a]');
    if(a&&!a.disabled){if(a.dataset.a==='reset')pvApply(pvPreset);else if(a.dataset.a==='save')pvSaveMine()}
  });
  m.addEventListener('change',e=>{const c=e.target.closest('input[data-id]');if(c){if(c.checked)pvAdd(c.dataset.id);else pvHide(c.dataset.id)}});
  m.addEventListener('pointerdown',e=>{const g=e.target.closest('.pv-pg');if(g){e.preventDefault();dragWatch(e,g.closest('li').dataset.id,'menu')}});
  return m;
}
function pvMenuPlace(){
  const r=els.pbtn.getBoundingClientRect(),m=els.menu;
  m.style.top=Math.round(r.bottom+10)+'px';m.style.right=Math.max(12,Math.round(innerWidth-r.right))+'px';
}
function pvMenuOpen(){
  if(pvMenuOn)return;
  closeMenu();pvPopClose(false);pvSync();
  els.menu.hidden=false;pvMenuOn=true;els.pbtn.setAttribute('aria-expanded','true');pvMenuPlace();
  const f=els.menu.querySelector('.pv-preset[aria-pressed="true"]')||els.menu.querySelector('.pv-preset:not(:disabled)');if(f)f.focus();
  document.addEventListener('pointerdown',pvMenuOut,true);document.addEventListener('keydown',pvMenuKey,true);
}
function pvMenuClose(refocus){
  if(!pvMenuOn)return;
  els.menu.hidden=true;pvMenuOn=false;els.pbtn.setAttribute('aria-expanded','false');
  document.removeEventListener('pointerdown',pvMenuOut,true);document.removeEventListener('keydown',pvMenuKey,true);
  if(refocus)els.pbtn.focus();
}
function pvMenuOut(e){if(!e.target.closest('#pv-menu')&&!e.target.closest('#pv-panels'))pvMenuClose(false)}
function pvMenuKey(e){
  if(drag)return;
  if(e.key==='Escape'&&!document.querySelector('.pv-help')){e.preventDefault();e.stopPropagation();pvMenuClose(true);return}
  const t=e.target;if(!t||!t.classList||!t.classList.contains('pv-preset')||!/^Arrow/.test(e.key))return;
  const all=[...els.menu.querySelectorAll('.pv-preset:not(:disabled)')],i=all.indexOf(t),
        cols=getComputedStyle(els.menu.querySelector('.pv-presets')).gridTemplateColumns.split(' ').length,
        d=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-cols:cols;
  e.preventDefault();e.stopPropagation();
  if(all[i+d])all[i+d].focus();
}

/* ---------- colour theme: light or dark, the system's choice until you pick one ---------- */
const sysDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
function pvTheme(t,keep){
  document.documentElement.dataset.theme=t;
  if(els.seg)els.seg.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.th===t)));
  if(keep)store.set(THKEY,t);
}
function pvThemeInit(){
  const s=store.get(THKEY);
  pvTheme(s==='light'||s==='dark'?s:(sysDark&&sysDark.matches?'dark':'light'));
  if(sysDark&&sysDark.addEventListener)sysDark.addEventListener('change',()=>{const v=store.get(THKEY);if(v!=='light'&&v!=='dark')pvTheme(sysDark.matches?'dark':'light')});
}

/* ---------- following the talk ---------- */
function pvSet(n,fromAudience){
  const prev=pcur;pcur=n;
  if(!fromAudience){want=n;wantAt=Date.now()}
  if(prev===0&&n>0&&autoStart&&!timer.run&&elapsed()===0)timerToggle();
  entryAt=elapsed();
  const dir=n>prev?1:n<prev?-1:0,sec=+slides[n].dataset.sec,no=NOTES[n],sp=no[0]>=0?SPK[no[0]]:'';
  ['cur','next','prev'].forEach(id=>slideUpd(PN[id],n,dir));
  els.who.hidden=!sp;
  if(sp){els.whoAv.className='av p'+(no[0]+1);els.whoAv.textContent=sp.split(' ').map(w=>w[0]).join('');els.whoN.textContent=sp}
  els.nb.innerHTML=notesHtml(n);els.nb.scrollTop=0;spos=0;manualUntil=0;
  els.cnt.textContent=(n+1)+' / '+N;els.ftt.textContent=TOPIC[n]+(sec?' · Part '+sec+' of 5':'');
  els.prev.disabled=n===0;els.nextb.disabled=n===N-1;
  railMark(n);
  renderTimer();
}
function pvGo(n){
  n=clamp(n,0,N-1);if(n===pcur)return;
  pvSet(n,false);post({type:'go',n:n});
}
function notesHtml(i){
  const no=NOTES[i];
  if(no[2].indexOf('\n')>=0)return '<h4>'+esc(no[1])+'</h4>'+noteHtml(no[2]);
  const sent=no[2].replace(/([.!?])\s+(?=[A-Z“"(])/g,'$1\u0001').split('\u0001'),ps=[];
  for(let k=0;k<sent.length;k+=2)ps.push(sent.slice(k,k+2).join(' '));
  return '<h4>'+esc(no[1])+'</h4>'+ps.map(p=>'<p>'+esc(p)+'</p>').join('');
}
function renderLink(){
  if(MODE!=='presenter'||!els.link)return;
  const on=audienceAlive();
  els.link.dataset.s=on?'on':'off';
  els.link.title=on&&audInfo&&audInfo.w?'Presentation window: '+audInfo.w+' × '+audInfo.h+(audInfo.fs?', full screen':''):'';
  els.linkT.textContent=on?'Presentation window connected'+(audInfo&&audInfo.fs?' · full screen':''):'No presentation window yet';
  els.aud.hidden=on;
}
function buildTicks(){
  /* a thin mark on the progress bar for each slide, where the plan says it should start */
  if(tickT===timer.target)return;tickT=timer.target;
  const T=timer.target/1000,k=planK();
  els.pb.querySelectorAll('em').forEach(e=>e.remove());
  if(!(T>0))return;
  PLAN.forEach((p,i)=>{if(i>0&&DUR[i-1]>0){const x=p*k/T*100;if(x>0&&x<100){const e=document.createElement('em');e.style.left=x+'%';els.pb.appendChild(e)}}});
}
function renderTimer(){
  if(MODE==='deck'){hudRender();return}
  if(!els.el)return;
  const e=elapsed()/1000,rem=timer.target/1000-e,st=timerState(),lab=timer.run?'Pause':(e>0?'Resume':'Start');
  els.timer.dataset.s=st;
  els.el.textContent=mmss(e);
  els.rem.textContent=timer.target>0?(rem<0?'−':'')+mmss(Math.abs(rem)):'—';
  els.remL.textContent=timer.target>0?(rem<0?'Over time':'Remaining'):'No target';
  if(els.tt.dataset.l!==lab){els.tt.dataset.l=lab;els.tt.innerHTML=(timer.run?IC.pause:IC.play)+'<span>'+lab+'</span>';els.tt.setAttribute('aria-label',lab+' the timer (T)');els.tt.title=lab+' (T)'}
  if(document.activeElement!==els.tg)els.tg.value=timer.target>0?mmss(timer.target/1000):'';
  buildTicks();
  els.pbi.style.width=timer.target>0?Math.min(100,e/(timer.target/1000)*100)+'%':'0%';
  /* pace against the plan (the notes' proportions, stretched to the target) */
  const k=planK(),spent=e-entryAt/1000,dur=DUR[pcur]*k,delta=entryAt/1000-PLAN[pcur]*k;
  let h='';
  if(!timer.run&&e===0)h='<span data-s="">Timer not started</span>';
  else{
    const ds=Math.abs(delta)<=15?'On plan':mmss(Math.abs(delta))+(delta>0?' behind':' ahead');
    h+='<span data-s="'+(Math.abs(delta)<=15?'ok':delta>0?'warn':'ok')+'" title="Compared with the plan'+(NOTES_ON?' in the notes':'')+', stretched to the target time">'+ds+'</span>';
    if(dur>0)h+='<span data-s="'+(spent>dur+10?'over':'')+'" title="Time on this slide, and the time the plan gives it">This slide '+mmss(Math.max(0,spent))+' / '+mmss(dur)+'</span>';
    if(!timer.run)h+='<span data-s="warn">Paused</span>';
  }
  els.pace.innerHTML=h;
  els.clock.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function parseTarget(v){
  v=String(v).trim();if(!v)return 0;
  const m=/^(\d{1,3}):([0-5]?\d)$/.exec(v);
  if(m)return(+m[1]*60+ +m[2])*1000;
  if(/^\d{1,3}$/.test(v))return +v*60000;
  return -1;
}
function pvOpenAudience(){
  pvMenuClose(false);pvPopClose(false);
  const open=(s)=>{
    const f=s?'popup=yes,left='+Math.round(s.availLeft!=null?s.availLeft:s.left)+',top='+Math.round(s.availTop!=null?s.availTop:s.top)+',width='+Math.round(s.availWidth||s.width)+',height='+Math.round(s.availHeight||s.height)
            :'popup=yes,width=1100,height=640,left=80,top=80';
    const w=window.open(baseUrl()+'?audience#'+(pcur+1),'gimber-audience',f);
    if(!w){toast('The browser blocked the pop-up. Allow pop-ups for this page and try again.',6000);return}
    peers.add(w);
    toast(s?'Presentation window opened. Click inside it to go full screen.':'Presentation window opened. Drag it to the projector, then click inside it to go full screen.',6500);
  };
  if(!canListScreens()){open(null);return}
  screenDetails().then(d=>{
    if(d)pickScreen(d,'Show the presentation on which display?','Choose the projector. The window opens there; click inside it once to go full screen.',open);
    else open(null);
  });
}

/* ---------- timer settings: target time, auto-start and reset, in a small popover under the cog ---------- */
let popOn=false;
function mkPop(){
  const e=mkEl('div','pv-pop');e.hidden=true;e.setAttribute('role','dialog');e.setAttribute('aria-label','Timer settings');
  e.innerHTML='<label class="tgl">Target time<input type="text" class="tg" size="5" inputmode="numeric" aria-label="Target time, minutes and seconds"></label>'+
    '<label class="ck"><input type="checkbox" class="as"><span>Start the timer when I leave the first slide</span></label>'+
    '<button type="button" class="pv-btn tr">Reset timer</button>';
  return e;
}
function pvPopOpen(){
  if(popOn)return;
  pvMenuClose(false);
  const b=els.cog.getBoundingClientRect(),p=els.pop;
  p.hidden=false;popOn=true;els.cog.setAttribute('aria-expanded','true');
  p.style.top=Math.round(b.bottom+8)+'px';p.style.left=Math.round(clamp(b.right-p.offsetWidth,12,innerWidth-p.offsetWidth-12))+'px';
  els.tg.focus();els.tg.select();
  document.addEventListener('pointerdown',pvPopOut,true);document.addEventListener('keydown',pvPopKey,true);
}
function pvPopClose(refocus){
  if(!popOn)return;
  els.pop.hidden=true;popOn=false;els.cog.setAttribute('aria-expanded','false');
  document.removeEventListener('pointerdown',pvPopOut,true);document.removeEventListener('keydown',pvPopKey,true);
  if(refocus&&els.cog.isConnected)els.cog.focus();
}
function pvPopOut(e){if(!e.target.closest('.pv-pop')&&!e.target.closest('.pv-cog'))pvPopClose(false)}
function pvPopKey(e){if(e.key==='Escape'&&!drag&&!document.querySelector('.pv-help')){e.preventDefault();e.stopPropagation();pvPopClose(true)}}

/* ---------- the window ---------- */
function buildPresenter(){
  started=true;pristine=slides.map(s=>s.cloneNode(true));
  document.body.classList.add('pv');
  document.title='Presenter view · '+document.title;
  const r=mkEl('div','pv-root');r.id='pv';
  r.innerHTML=
    '<header class="pv-top"><div class="pv-brand"><i class="lg lg-ll"></i><i class="lg lg-llw"></i><span>Presenter view</span></div>'+
    '<div class="pv-link" id="pv-link" data-s="off"><i></i><span id="pv-linkt"></span></div>'+
    '<button type="button" class="pv-btn pv-pri" id="pv-aud">Open presentation window</button><span class="pv-sp"></span>'+
    '<button type="button" class="pv-btn" id="pv-panels" aria-haspopup="dialog" aria-expanded="false" aria-controls="pv-menu" title="Panels and layouts (P)">'+IC.panels+'<span>Panels</span><kbd>P</kbd></button>'+
    '<div class="pv-seg" role="group" aria-label="Colour theme"><button type="button" data-th="light" aria-pressed="false">'+IC.sun+'<span>Light</span></button><button type="button" data-th="dark" aria-pressed="false">'+IC.moon+'<span>Dark</span></button></div>'+
    '<button type="button" class="pv-btn" id="pv-help" title="How it works (?)">'+IC.help+'<span>Help</span></button>'+
    '<div class="pv-clock" id="pv-clock" title="Time of day"></div></header>'+
    '<main class="pv-wrap"></main>'+
    '<footer class="pv-bar"><button type="button" class="pv-btn pv-lg" id="pv-prev">'+IC.chl+'<span>Previous</span></button>'+
    '<button type="button" class="pv-btn pv-lg pv-pri" id="pv-nextb"><span>Next</span>'+IC.chr+'</button>'+
    '<div class="pv-cnt"><b id="pv-cnt"></b><span id="pv-ftt"></span></div><span class="pv-sp"></span>'+
    '<button type="button" class="pv-btn pv-lg" id="pv-blank" aria-pressed="false" title="Black screen in the presentation window (B)">'+IC.blank+'<span class="a">Blank screen</span><span class="b">Show screen</span><kbd>B</kbd></button></footer>';
  document.body.appendChild(r);
  const q=s=>r.querySelector(s);
  els.wrap=q('.pv-wrap');els.work=mkEl('div','pv-work');els.drop=mkEl('div','pv-drop');
  els.tray=mkEl('div','pv-tray',IC.eyeoff+'<span>Drop here to hide this panel</span>');els.tray.hidden=true;
  els.wrap.append(els.work,els.drop,els.tray);
  els.none=mkEl('div','pv-nopanel','<b>No panels on screen</b><span>Pick a preset, or switch a panel on.</span><button type="button" class="pv-btn pv-pri pv-lg">Open the Panels menu</button>');
  els.none.querySelector('button').addEventListener('click',pvMenuOpen);
  els.park=mkEl('div','pv-park');els.park.hidden=true;
  els.ghost=mkEl('div','pv-ghost');els.ghost.hidden=true;
  els.say=mkEl('div','pv-sr');els.say.setAttribute('role','status');els.say.setAttribute('aria-live','polite');
  els.menu=mkMenu();els.pop=mkPop();
  r.append(els.park,els.ghost,els.say,els.menu,els.pop);
  mkSlideP('cur',0);mkSlideP('next',1);mkSlideP('prev',-1);mkNotesP();mkTimerP();mkRailP();
  PIDS.forEach(id=>els.park.appendChild(PN[id].el));
  const T=PN.timer.el,NT=PN.notes.el;
  els={link:q('#pv-link'),linkT:q('#pv-linkt'),aud:q('#pv-aud'),pbtn:q('#pv-panels'),seg:[...r.querySelectorAll('.pv-seg button')],clock:q('#pv-clock'),
       cnt:q('#pv-cnt'),ftt:q('#pv-ftt'),prev:q('#pv-prev'),nextb:q('#pv-nextb'),
       wrap:els.wrap,work:els.work,drop:els.drop,tray:els.tray,none:els.none,park:els.park,ghost:els.ghost,say:els.say,menu:els.menu,pop:els.pop,
       timer:T,el:T.querySelector('.el'),rem:T.querySelector('.rem'),remL:T.querySelector('.reml'),pb:T.querySelector('.pv-pbar'),pbi:T.querySelector('.pv-pbar i'),
       tt:T.querySelector('.tt'),cog:T.querySelector('.pv-cog'),tr:els.pop.querySelector('.tr'),tg:els.pop.querySelector('.tg'),as:els.pop.querySelector('.as'),pace:T.querySelector('.pv-pace'),
       nb:NT.querySelector('.pv-nbody'),sw:NT.querySelector('.pv-sw'),asc:NT.querySelector('.pv-sw input'),who:NT.querySelector('.pv-who')};
  els.whoAv=els.who.firstChild;els.whoN=els.who.lastChild;
  pvThemeInit();pvRestore();
  r.style.setProperty('--nf',nfont+'px');
  els.as.checked=autoStart;
  els.asc.checked=autoScroll;
  els.asc.addEventListener('change',()=>setAutoScroll(els.asc.checked));
  ['wheel','touchstart','pointerdown'].forEach(t=>els.nb.addEventListener(t,()=>{manualUntil=Date.now()+8000},{passive:true}));
  els.as.addEventListener('change',()=>{autoStart=els.as.checked;store.set('gimber-autostart',autoStart?'1':'0')});
  els.tt.addEventListener('click',timerToggle);
  let rt=0;
  els.tr.addEventListener('click',()=>{
    if(els.tr.dataset.c){clearTimeout(rt);delete els.tr.dataset.c;els.tr.textContent='Reset timer';timerReset();return}
    els.tr.dataset.c='1';els.tr.textContent='Sure? Click again';rt=setTimeout(()=>{delete els.tr.dataset.c;els.tr.textContent='Reset timer'},3000);
  });
  const applyTarget=()=>{const v=parseTarget(els.tg.value);if(v>=0)setTimer(Object.assign({},timer,{target:v}),true);else renderTimer()};
  els.tg.addEventListener('change',applyTarget);
  els.tg.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){applyTarget();els.tg.blur()}});
  els.prev.addEventListener('click',()=>pvGo(pcur-1));
  els.nextb.addEventListener('click',()=>pvGo(pcur+1));
  els.aud.addEventListener('click',pvOpenAudience);
  els.cog.addEventListener('click',()=>{if(popOn)pvPopClose(false);else pvPopOpen()});
  addEventListener('resize',()=>{pvPopClose(false);if(pvMenuOn)pvMenuPlace()});
  els.pbtn.addEventListener('click',()=>{if(pvMenuOn)pvMenuClose(false);else pvMenuOpen()});
  els.seg.forEach(b=>b.addEventListener('click',()=>pvTheme(b.dataset.th,true)));
  q('#pv-blank').addEventListener('click',()=>setBlank(!blank,true));
  NT.querySelectorAll('[data-fs]').forEach(b=>b.addEventListener('click',()=>stepFont(+b.dataset.fs)));
  q('#pv-help').addEventListener('click',pvHelp);
  addEventListener('keydown',pvKey);
  pvRender();pvSync();
  pvSet(0,true);entryAt=elapsed();
  setInterval(renderTimer,250);
  requestAnimationFrame(notesFlow);
  setInterval(()=>{post({type:'ping'});renderLink()},2000);
  renderLink();renderTimer();
  post({type:'hello'});post({type:'ping'});
  if(!store.get('gimber-pv-seen')){store.set('gimber-pv-seen','1');store.set('gimber-pv-panels','1');setTimeout(pvHelp,400)}
  else if(!store.get('gimber-pv-panels')){store.set('gimber-pv-panels','1');setTimeout(()=>toast('New: drag panels by their title bar, resize them, and press P for layouts and light mode.',9000),900)}
}
function setFont(v){nfont=clamp(v,16,72);store.set('gimber-nfont',nfont);$('pv').style.setProperty('--nf',nfont+'px')}
function stepFont(d){
  let i=0;NSIZE.forEach((v,k)=>{if(Math.abs(v-nfont)<Math.abs(NSIZE[i]-nfont))i=k});
  setFont(NSIZE[clamp(i+d,0,NSIZE.length-1)]);
}
/* the notes follow the plan: the line being read stays about a third of the way down while the slide's planned time passes */
function setAutoScroll(on){
  autoScroll=!!on;store.set('gimber-autoscroll',autoScroll?'1':'0');
  if(els.asc)els.asc.checked=autoScroll;
  manualUntil=0;if(els.nb)spos=els.nb.scrollTop;
}
function notesFlow(ts){
  requestAnimationFrame(notesFlow);
  const nb=els.nb;if(!nb)return;
  const dt=Math.min(.1,(ts-flowT)/1000||.016);flowT=ts;
  const held=autoScroll&&Date.now()<manualUntil,p=held?'1':'';
  if(els.sw.dataset.p!==p)els.sw.dataset.p=p;
  if(!autoScroll||held)return;
  const max=nb.scrollHeight-nb.clientHeight,dur=DUR[pcur]*planK();
  if(max<=0||!(dur>0))return;
  if(Math.abs(nb.scrollTop-spos)>2)spos=nb.scrollTop;   /* moved by hand, by the reset on a new slide, or by a resize */
  const f=clamp((elapsed()-entryAt)/1000/dur,0,1);
  const to=clamp(f*nb.scrollHeight-nb.clientHeight*.3,0,max),d=to-spos;
  if(Math.abs(d)<.05)return;
  spos+=clamp(d*Math.min(1,dt*3),-900*dt,900*dt);
  nb.scrollTop=spos;
}
function pvKey(e){
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const t=e.target,tag=t&&t.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  const k=e.key,helpOpen=!!document.querySelector('.pv-help');
  if(helpOpen){e.preventDefault();pvHelp();return}   /* any key closes the help */
  if(menuOpen||drag)return;
  if(/^[1-9]$/.test(k)&&!e.shiftKey){   /* number keys pick a preset: 1 to 7, and 8 for My layout */
    const n=+k-1;
    if(n<PRESETS.length){e.preventDefault();pvApply(PRESETS[n].id)}
    else if(n===PRESETS.length&&pvMine){e.preventDefault();pvApply('mine')}
    return;
  }
  if(t&&t.closest&&t.closest('#pv-menu'))return;      /* the Panels menu has its own keys */
  const onBtn=t&&t.closest&&t.closest('button');
  if(onBtn&&(k===' '||k==='Enter'))return;
  if(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter'){e.preventDefault();pvGo(pcur+1)}
  else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace'){e.preventDefault();pvGo(pcur-1)}
  else if(k==='Home'){e.preventDefault();pvGo(0)}
  else if(k==='End'){e.preventDefault();pvGo(N-1)}
  else if(k==='t'||k==='T'){e.preventDefault();timerToggle()}
  else if(k==='b'||k==='B'||k==='.'){e.preventDefault();setBlank(!blank,true)}
  else if(k==='p'||k==='P'){e.preventDefault();if(pvMenuOn)pvMenuClose(false);else pvMenuOpen()}
  else if(k==='+'||k==='='){stepFont(1)}
  else if(k==='-'||k==='_'){stepFont(-1)}
  else if(k==='s'||k==='S'){e.preventDefault();setAutoScroll(!autoScroll)}
  else if(k==='?'){e.preventDefault();pvHelp()}
}
function pvHelp(){
  const old=document.querySelector('.pv-help');if(old){old.remove();return}
  pvMenuClose(false);pvPopClose(false);
  const h=document.createElement('div');h.className='pv-help';
  h.innerHTML='<div role="dialog" aria-label="How to present with two screens"><h2>Presenting with a projector</h2>'+
  '<h3>1. Extend the screens</h3><ul><li><b>Mac:</b> System Settings › Displays › your projector › Use as: <b>Extended display</b> (not “Mirror”).</li>'+
  '<li><b>Windows:</b> press <kbd>Win</kbd> + <kbd>P</kbd> and choose <b>Extend</b>.</li></ul>'+
  '<h3>2. Open the presentation window</h3><ol><li>Click <b>Open presentation window</b>. In Chrome or Edge you can pick the projector from a list (allow “window management” once).</li>'+
  '<li>In Safari and Firefox the window opens here: drag it onto the projector.</li><li>Click once inside it to go full screen. <kbd>Esc</kbd> leaves full screen.</li></ol>'+
  '<h3>3. Present from this window</h3><ul><li><kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd> move the projector. You can also click the current slide for the next one, the previous or next slide to go there, or any thumbnail in All slides.</li>'+
  '<li><kbd>T</kbd> starts or pauses the timer, <kbd>B</kbd> blanks the projector'+(NOTES_ON?', <kbd>+</kbd> <kbd>−</kbd> change the notes size, <kbd>S</kbd> turns the notes auto-scroll on or off':'')+'.</li>'+
  (NOTES_ON?'<li>The notes scroll slowly while the time planned for each slide goes by. Scroll by hand and it pauses for a few seconds; the slide with the questions is not scrolled.</li>':'')+
  '<li>The talk lasts 15 minutes by default; change the target in the timer. The pace follows the '+(NOTES_ON?'plan in the notes':'time planned for each slide')+', stretched to that time.</li></ul>'+
  '<h3>Arrange the panels</h3><ul><li><b>Move:</b> drag a panel by its title bar. Drop it on the side, top or bottom of another panel to put it there, in the middle to swap the two, or on the strip that appears at the bottom to hide it.</li>'+
  '<li><b>Resize:</b> drag the line between two panels. Double-click it to even them out, or Tab to it and use the arrow keys.</li>'+
  '<li><b>Panels menu</b> (<kbd>P</kbd>): switch panels on or off, including the previous slide, drag them from the list to where you want them, and pick a preset with <kbd>1</kbd> to <kbd>'+PRESETS.length+'</kbd>. <b>Save as My layout</b> keeps your own (<kbd>'+(PRESETS.length+1)+'</kbd>).</li>'+
  '<li>Light or dark colours: the switch at the top right. Everything is remembered on this computer. To make everything bigger, zoom the browser (<kbd>Ctrl</kbd> or <kbd>⌘</kbd> and <kbd>+</kbd>).</li></ul>'+
  '<h3>If the screens are mirrored</h3><p>A mirrored projector shows exactly what is on your laptop screen, so '+(NOTES_ON?'the notes':'the timer and the next slide')+' would be visible to the room. Switch to Extend. If you cannot, present from the presentation window alone: '+(NOTES_ON?'<kbd>N</kbd> shows the notes and <kbd>T</kbd> a discreet timer, and both are':'<kbd>T</kbd> shows a discreet timer, which is')+' visible to the room.</p>'+
  '<button type="button" class="pv-btn pv-pri pv-lg" id="pv-hx">Got it</button></div>';
  $('pv').appendChild(h);
  h.addEventListener('click',e=>{if(e.target===h)h.remove()});
  h.querySelector('#pv-hx').addEventListener('click',()=>h.remove());
  h.querySelector('#pv-hx').focus({preventScroll:true});
}

/* ---------- start ---------- */
if(MODE==='presenter')buildPresenter();
