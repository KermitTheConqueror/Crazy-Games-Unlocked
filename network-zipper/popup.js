// New CrazyGames-only launcher; replaces the upstream DevTools panel UI.
const $ = id => document.getElementById(id);
let sourceTab, valid = false, busy = false;
async function send(type, extra = {}) {
  const result = await chrome.runtime.sendMessage({type, ...extra});
  if (result.error) throw Error(result.error);
  return result;
}
async function refresh() {
  const state = await send('status');
  $('count').textContent = state.count;
  $('size').textContent = (state.bytes / 1048576).toFixed(1) + ' MB';
  $('status').textContent = valid ? state.message : 'Open a game on crazygames.com to use this extension.';
  $('start').disabled = !valid || state.running || state.stopping || busy;
  $('stop').disabled = !valid || !state.running || busy;
  $('download').disabled = !valid || !state.count || state.stopping || busy;
}
function action(id, fn) {
  $(id).addEventListener('click', async () => {
    busy = true;
    try { await refresh(); await fn(); }
    catch (e) { $('status').textContent = e.message; busy = false; return; }
    busy = false;
    await refresh();
  });
}
action('start', () => send('start', {sourceTabId: sourceTab.id}));
action('stop', () => send('stop', {sourceTabId: sourceTab.id}));
action('download', async () => {
  await send('export', {sourceTabId: sourceTab.id});
});
(async () => {
  [sourceTab] = await chrome.tabs.query({active: true, currentWindow: true});
  valid = Zipper.allowed(sourceTab?.url);
  if (valid) $('game').value = Zipper.gameURL(sourceTab.url);
  await refresh();
  setInterval(() => { if (!busy) refresh().catch(e => $('status').textContent = e.message); }, 1000);
})().catch(e => $('status').textContent = e.message);
