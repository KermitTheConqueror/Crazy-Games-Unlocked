// Runs in an isolated content-script world; closed shadow DOM isolates the panel styles.
globalThis.__openNetworkZipper = (restored = null) => {
  if (globalThis.__networkZipperPanel) { globalThis.__networkZipperPanel(); return; }
  if (!Zipper.siteAllowed(location.href)) {
    const warning = document.createElement('div');
    warning.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;z-index:2147483647!important;';
    const shadow = warning.attachShadow({mode:'closed'});
    shadow.innerHTML = `<style>*{box-sizing:border-box}.warning{position:fixed;left:50%;transform:translateX(-50%);top:20px;opacity:1;transition:opacity 400ms ease;width:min(380px,calc(100vw - 40px));padding:20px;border-radius:22px;background:#51218a;color:#f4e9ff;border:1px solid #c79bff;box-shadow:0 16px 60px #0007;font:14px/1.5 system-ui,sans-serif}strong{display:block;color:#e0bdff;font-size:16px;padding-right:22px}p{margin:9px 0 14px}a{color:#fff;background:#7c3aed;padding:9px 13px;border-radius:12px;display:inline-block;text-decoration:none;font-weight:700}button{position:absolute;right:12px;top:10px;border:0;background:transparent;color:#eddcff;font:24px system-ui;cursor:pointer}</style><section class="warning" role="alert"><button aria-label="Close warning">×</button><strong>CrazyGames only</strong><p>This is not a CrazyGames page. Open the CrazyGames homepage or a game page to use CrazyGames Unlocked.</p><a href="https://www.crazygames.com/" target="_blank" rel="noopener noreferrer">Open CrazyGames ↗</a></section>`;
    document.documentElement.append(warning);
    let fadeTimer, removeTimer;
    const dismiss = () => {
      clearTimeout(fadeTimer);clearTimeout(removeTimer);
      warning.remove();
      if (globalThis.__networkZipperPanel === dismiss) delete globalThis.__networkZipperPanel;
    };
    globalThis.__networkZipperPanel = dismiss;
    shadow.querySelector('button').onclick = dismiss;
    fadeTimer = setTimeout(() => {
      const card = shadow.querySelector('.warning');
      card.style.opacity = '0';
      card.style.pointerEvents = 'none';
      removeTimer = setTimeout(dismiss, 400);
    }, 5000);
    return;
  }
  const host = document.createElement('div');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;z-index:2147483647!important;';
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}.panel{position:fixed;top:24px;left:24px;width:min(380px,calc(100vw - 16px));max-height:calc(100vh - 16px);display:flex;flex-direction:column;overflow:hidden;background:#10121b;color:#f2f3fa;border:1px solid #41405b;border-radius:22px;box-shadow:0 22px 75px #0009;font:13px/1.5 system-ui,sans-serif;color-scheme:dark}
      header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:#202030;cursor:grab;touch-action:none;user-select:none}header:active{cursor:grabbing}header strong{font-size:11px;letter-spacing:1.4px;color:#c8b9ff}header button{width:28px;height:28px;padding:0;margin:0;border-radius:50%;font-size:20px;background:#343349;color:#eee}
      .body{overflow:auto;padding:20px}h2{font-size:27px;line-height:1.2;letter-spacing:-.8px;margin:0 0 8px}p{margin:8px 0;color:#a8abc0}.url{font-size:11px;overflow-wrap:anywhere;background:#1b1e2d;border:1px solid #34374a;border-radius:12px;padding:10px;margin:15px 0}
      button{font:700 13px system-ui;cursor:pointer;border:0;border-radius:13px;background:#b9a5ff;color:#18112d;padding:12px 14px}button:hover:not(:disabled){filter:brightness(1.12)}button:focus-visible,header:focus-visible{outline:2px solid #d3c7ff;outline-offset:-3px}button:disabled{opacity:.4;cursor:default}#start{width:100%}.stats{display:flex;gap:28px;padding:16px 0;margin-top:10px;border-bottom:1px solid #2b2e40}.stats strong{font-size:24px}.stats small{display:block;font-size:10px;color:#9397ad;letter-spacing:1px}#status{font-size:12px;color:#d4caef;overflow-wrap:anywhere;margin:12px 0}.actions{display:flex;gap:10px}.actions button{flex:1;background:#292d40;color:#e6e8f5}.hint{font-size:11px;margin-top:12px}
      .panel{background:radial-gradient(ellipse at 90% 0%,#6d28d933,transparent 55%),#11101b;border:1px solid #8c61df66;border-radius:26px;box-shadow:0 24px 90px #000a,0 0 40px #6d28d91a}
      header{padding:14px 18px;background:linear-gradient(110deg,#32204e,#1b1729);border-bottom:1px solid #b896ff1c}header strong{font-size:10px;letter-spacing:1.6px}header button{background:#ffffff0a;border:1px solid #ffffff12;color:#bfaedc}
      .brand{display:flex;gap:13px;align-items:center;margin:0 0 22px}.brand img{height:60px;width:60px;object-fit:contain;filter:drop-shadow(0 5px 12px #6e28e44d)}.brand h2{font-size:24px;line-height:1.12;margin:0;letter-spacing:-.7px}.brand p{font-size:10px;letter-spacing:1.8px;color:#a995cb;margin:6px 0 0}.body{padding:22px}.intro{font-size:12px;color:#aca3bf}
      .url{background:#ffffff04;border:1px solid #ffffff10;color:#baadcc;padding:12px;border-radius:12px;font:11px/1.55 ui-monospace,monospace;margin:16px 0}
      #start{background:linear-gradient(115deg,#acff3d,#78e523);color:#193300;box-shadow:0 5px 25px #8cff2518;font-size:13px;padding:14px;border-radius:14px}#start:disabled{box-shadow:none}
      .stats{gap:10px;border:0;padding:0;margin-top:18px}.stats>div{flex:1;padding:14px 16px;border:1px solid #ffffff0c;border-radius:16px;background:#ffffff03}.stats strong{font-size:28px;letter-spacing:-1px;font-weight:650}.stats small{font-size:9px;letter-spacing:1.3px;margin-top:2px;color:#9685ad}
      #status{padding:12px 0;font-size:11px;color:#baa6d9;margin:0}.actions button{padding:12px 10px;background:#ffffff05;border:1px solid #ffffff14;border-radius:12px;font-size:12px}.actions #download{background:#7843d8;color:white;border-color:#ab7cff40}.capture-option{display:flex;align-items:center;gap:9px;font-size:11px;color:#c8b3ee;margin:0 0 12px;cursor:pointer}.capture-option input{accent-color:#9deb38}.refresh{width:100%;margin-bottom:10px;background:#ffffff05;color:#c8b3ee;border:1px solid #ffffff14;font-size:12px}.hint{border-top:1px solid #ffffff0a;padding-top:14px;color:#847591;font-size:10px;line-height:1.7}
    </style>
    <section class="panel" role="dialog" aria-label="CrazyGames Unlocked">
      <header tabindex="0" aria-label="Move panel: drag or use arrow keys"><strong>⠿ &nbsp; CRAZYGAMES UNLOCKED · v${chrome.runtime.getManifest().version}</strong><button id="close" aria-label="Close panel">×</button></header>
      <div class="body"><div class="brand"><img src="${chrome.runtime.getURL('icons/icon.png')}" alt=""><div><h2>CrazyGames<br>Unlocked</h2><p>PLAY IT. KEEP IT.</p></div></div><p class="intro">Your game’s files, collected as you play.</p><div class="url" id="game"></div><button id="start">CrazyGames · Start collecting ↗</button><div class="stats"><div><strong id="count">0</strong><small>FILES SAVED</small></div><div><strong id="size">0 MB</strong><small>COLLECTED</small></div></div><p id="status" role="status" aria-live="polite">Checking collection…</p><label class="capture-option" title="Save a small online-dependent copy like your example ZIP"><input type="checkbox" id="lightweight" checked> Small online copy · skip large game assets</label><button id="refresh" class="refresh" title="Clear collected files and reload this game">↻ Refresh files</button><div class="actions"><button id="stop" disabled>Stop collection</button><button id="download" disabled>↓ Download ZIP</button></div><p class="hint">Drag the header to move. Your panel follows you into the game. Closing it leaves collection running.</p></div>
    </section>`;
  document.documentElement.append(host);
  const $ = id => root.getElementById(id), panel = root.querySelector('.panel'), header = root.querySelector('header');
  const events = new AbortController();
  let timer, busy = false, closed = false, drag;
  function savePanel(open = true) {
    const r = panel.getBoundingClientRect();
    return send('panel-save', {open,position:{x:r.left,y:r.top}});
  }
  function close() { savePanel(false).catch(()=>{});closed=true;clearTimeout(timer);events.abort();host.remove();delete globalThis.__networkZipperPanel; }
  globalThis.__networkZipperPanel = close;
  $('close').onclick = close;
  function move(x,y) {
    const rect=panel.getBoundingClientRect();
    panel.style.left=Math.max(8,Math.min(x,innerWidth-rect.width-8))+'px';
    panel.style.top=Math.max(8,Math.min(y,innerHeight-rect.height-8))+'px';
  }
  header.addEventListener('pointerdown',e=>{
    if(e.target.closest('button') || e.button!==0) return;
    const rect=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-rect.left,y:e.clientY-rect.top};header.setPointerCapture(e.pointerId);e.preventDefault();
  });
  header.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId) move(e.clientX-drag.x,e.clientY-drag.y);});
  const release=()=>{if(drag) savePanel().catch(()=>{});drag=null;};
  header.addEventListener('pointerup',release);header.addEventListener('pointercancel',release);header.addEventListener('lostpointercapture',release);
  header.addEventListener('keydown',e=>{
    if(e.target!==header || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();const rect=panel.getBoundingClientRect(),step=e.shiftKey?40:10;
    move(rect.left+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),rect.top+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));
    savePanel().catch(()=>{});
  });
  root.addEventListener('keydown',e=>{if(e.key==='Escape') close();});
  window.addEventListener('resize',()=>{const r=panel.getBoundingClientRect();move(r.left,r.top);},{signal:events.signal});
  async function send(type, extra = {}) {
    const result=await chrome.runtime.sendMessage({type,...extra});
    if(result?.error) throw Error(result.error);
    if(!result) throw Error('Reload the page after updating the extension.');
    return result;
  }
  async function refresh() {
    if(!Zipper.siteAllowed(location.href)) {close();return;}
    const onGame=Zipper.allowed(location.href);
    $('game').textContent=onGame ? Zipper.gameURL(location.href) : 'Choose a game on CrazyGames to start collecting.';
    const state=await send('status');
    $('lightweight').checked=state.lightweight !== false;
    $('lightweight').disabled=busy || state.running || state.stopping || state.exporting;
    $('count').textContent=state.count;$('size').textContent=(state.bytes/1048576).toFixed(1)+' MB';
    $('status').textContent=!onGame && !state.running ? 'Ready on CrazyGames. Open a game, then click CrazyGames ↗ to collect its files.' : state.message;
    $('start').disabled=!onGame || busy || state.running || state.stopping || state.exporting;
    $('refresh').disabled=!onGame || busy || state.stopping || state.exporting;
    $('stop').disabled=busy || !state.running || state.stopping || state.exporting;
    $('download').disabled=busy || !state.count || state.stopping || state.exporting;
  }
  $('lightweight').onchange=async()=>{
    try {await send('capture-mode',{lightweight:$('lightweight').checked});}
    catch(e) {$('status').textContent=e.message;}
  };
  for(const [id,type] of [['start','start'],['stop','stop'],['download','export'],['refresh','refresh']]) $(id).onclick=async()=>{
    busy=true;for(const key of ['start','stop','download','refresh']) $(key).disabled=true;
    $('status').textContent=type==='export'?'Building your ZIP…':type==='refresh'?'Clearing files and reloading the game…':'Working…';
    try {if(type==='start' || type==='refresh') await savePanel();await send(type);busy=false;await refresh();}
    catch(e) {$('status').textContent=e.message;busy=false;}
  };
  async function poll() {
    if(closed) return;
    try {if(!busy) await refresh();} catch(e) {$('status').textContent=e.message;}
    if(!closed) timer=setTimeout(poll,1000);
  }
  const position=restored?.position;
  move(position?.x ?? innerWidth-400,position?.y ?? 24);
  savePanel().catch(()=>{});poll();
};
