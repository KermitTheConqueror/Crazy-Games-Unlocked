// Transparent, click-through file feed on the captured game's own tab.
(() => {
  if (!Zipper.allowed(location.href) || globalThis.__zipperFileFeed) return;
  globalThis.__zipperFileFeed = true;
  let host, root, captureId, offset = 0, timer, closed = false;
  function mount() {
    host = document.createElement('div');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:0!important;height:0!important;z-index:2147483646!important;pointer-events:none!important;';
    root = host.attachShadow({mode:'closed'});
    root.innerHTML = `<style>
      .feed{position:fixed;top:12px;left:14px;width:min(560px,calc(100vw - 28px));max-height:42vh;overflow:hidden;pointer-events:none;background:none;color:#d9c3ff;font:12px/1.6 ui-monospace,Consolas,monospace;text-shadow:0 1px 3px #000,0 0 6px #000;}
      strong{display:block;font:700 12px/1.7 system-ui,sans-serif;letter-spacing:.5px;margin-bottom:5px;color:#efddff}.files{display:flex;flex-direction:column;gap:2px}.file{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:arrive .3s ease-out both}@keyframes arrive{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.file{animation:none}}
    </style><section class="feed" aria-label="Collected game files"><strong id="summary"></strong><div class="files"></div></section>`;
    document.documentElement.append(host);
  }
  function reset() { if (root) root.querySelector('.files').replaceChildren();offset = 0; }
  async function poll() {
    if (closed) return;
    try {
      const result = await chrome.runtime.sendMessage({type:'file-feed',captureId,offset});
      if (result?.error) throw Error(result.error);
      if (!result?.active) { host?.remove();host = root = undefined;captureId = undefined;offset = 0; }
      else {
        if (!host) mount();
        if (captureId !== result.captureId || result.offset < offset) reset();
        captureId = result.captureId;
        for (const file of result.files) {
          const item = document.createElement('div');item.className = 'file';
          const url = new URL(file.url);
          let name = url.pathname.split('/').pop() || 'index.html';
          try { name = decodeURIComponent(name); } catch {}
          item.textContent = `↓ ${name}${url.search} · ${(file.bytes / 1024).toFixed(1)} KB`;
          root.querySelector('.files').prepend(item);
        }
        offset = result.offset + result.files.length;
        root.getElementById('summary').textContent = `${result.running ? 'COLLECTING' : 'COLLECTION STOPPED'} · ${result.count} files saved`;
      }
    } catch {
      // An extension reload invalidates old content scripts; stop until the page reloads.
      if (root) root.getElementById('summary').textContent = 'Reload this page to reconnect CrazyGames Unlocked.';
      return;
    }
    if (!closed) timer = setTimeout(poll, 600);
  }
  window.addEventListener('pagehide', () => {closed = true;clearTimeout(timer);host?.remove();}, {once:true});
  poll();
})();
