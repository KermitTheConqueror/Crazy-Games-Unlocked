// Custom CrazyGames collector based on genizy/network-zipper's network-to-ZIP workflow.
// Modified November 2026: debugger capture, origin gating, binary bodies, local storage.
importScripts('core.js', 'db.js');
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_FILE = 64 * 1024 * 1024;
let lightweight = true;
let session = null;
let starting = false;
let exporting = false;
let exportFinished = Promise.resolve();
let resetPromise = null;
let savedFiles = [];
let stopPromise = null;
const pending = new Set();
const requests = new Map();
let state = {running: false, stopping: false, count: 0, bytes: 0, errors: [], message: 'Ready. Open a game and click CrazyGames.'};
const ready = chrome.storage.session.get('state').then(saved => {
  if (saved.state) {
    state = {...saved.state, running: false, stopping: false};
    if (saved.state.running) state.message = 'Capture interrupted. Saved files are available to download.';
  }
});
function saveState() { return chrome.storage.session.set({state}); }
function error(message) {
  if (state.errors.length < 500) state.errors.push(message);
  state.message = message;
  return saveState();
}
const command = (target, method, params = {}) => chrome.debugger.sendCommand(target, method, params);
async function requirePage(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!Zipper.allowed(tab.url)) {
    let detected = 'unavailable address';
    try { const u = new URL(tab.url); detected = u.origin + u.pathname; } catch {}
    throw Error('This extension only runs on CrazyGames game pages. Detected: ' + detected);
  }
  return tab;
}
async function stop(message = 'Collection stopped. Your ZIP is ready.') {
  if (stopPromise) return stopPromise;
  stopPromise = (async () => {
    const old = session;
    session = null;
    state.running = false;
    state.stopping = true;
    // Let body reads already in progress finish before detaching or exporting.
    await Promise.allSettled([...pending]);
    if (old?.tabId != null) await chrome.debugger.detach({tabId: old.tabId}).catch(() => {});
    requests.clear();
    state.stopping = false;
    state.message = message;
    await saveState();
  })();
  try { await stopPromise; } finally { stopPromise = null; }
}
async function enable(target) {
  await command(target, 'Network.enable', {maxTotalBufferSize: MAX_BYTES, maxResourceBufferSize: MAX_FILE});
  await command(target, 'Network.setCacheDisabled', {cacheDisabled: true});
  await command(target, 'Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: true, flatten: true});
}
function resetCollection() {
  if (resetPromise) return resetPromise;
  resetPromise = (async () => {
    await stop('Leaving game. Clearing collected files…');
    // Finish an already requested ZIP before deleting its source files.
    await exportFinished;
    await ZipperDB.clear();
    savedFiles = [];
    requests.clear();
    state = {running:false,stopping:false,count:0,bytes:0,errors:[],message:'Collection cleared. Open a game to start again.'};
    await saveState();
  })();
  return resetPromise.finally(() => {resetPromise = null;});
}
function isCapturePage(value) {
  try {
    const next = new URL(value), game = new URL(state.gameURL);
    return next.origin === game.origin && next.pathname === game.pathname;
  } catch { return false; }
}
async function start(sourceTabId) {
  if (resetPromise || exporting || starting || session || state.stopping) throw Error('Wait for the current operation or stop collection before starting another.');
  starting = true;
  try {
    const source = await requirePage(sourceTabId);
    const url = Zipper.gameURL(source.url);
    await ZipperDB.clear();
    savedFiles = [];
    state = {running: true, stopping: false, count: 0, bytes: 0, errors: [], gameURL: url, mode: lightweight ? 'lightweight-online' : 'full-capture', captureTabId: sourceTabId, captureId: String(Date.now()), message: 'Opening the game and collecting its loaded files…'};
    const current = session = {sourceTabId, tabId: sourceTabId, lightweight, saved: new Set(), reading: new Set(), inflight:new Set(), startedAt:Date.now(), lastFileAt:Date.now(), hasEntry:false};
    await saveState();
    // Attach before replacing this tab so the initial game HTML is captured.
    await chrome.debugger.attach({tabId: current.tabId}, '1.3');
    await enable({tabId: current.tabId});
    const frameTree = await command({tabId:current.tabId}, 'Page.getFrameTree');
    current.rootFrameId = frameTree?.frameTree?.frame?.id;
    await requirePage(sourceTabId);
    if (session !== current) throw Error('Collection was cancelled.');
    current.launched = true;
    if (source.url === url) await chrome.tabs.reload(current.tabId, {bypassCache:true});
    else await chrome.tabs.update(current.tabId, {url});
  } catch (e) {
    await stop('Could not start: ' + e.message);
    throw e;
  } finally { starting = false; }
}
function key(target, id) { return `${target.sessionId || 'main'}:${id}`; }
function eligible(current,target,params,url) {
  return Zipper.captureEligible(url,{lightweight:current.lightweight,type:params.type,childSession:Boolean(target.sessionId),frameId:params.frameId,rootFrameId:current.rootFrameId});
}
async function capture(target, requestId, record, current) {
  if (current.saved.has(record.url) || current.reading.has(record.url)) return;
  current.reading.add(record.url);
  try {
    const response = await command(target, 'Network.getResponseBody', {requestId});
    const data = response.base64Encoded
      ? Uint8Array.from(atob(response.body), c => c.charCodeAt(0))
      : new TextEncoder().encode(response.body);
    if (data.length > MAX_FILE || state.bytes + data.length > MAX_BYTES) {
      await error('Storage limit reached (64 MB per file, 256 MB total). Some files were skipped; download this collection.');
      return;
    }
    // Reserve the bytes before yielding to concurrent responses.
    state.bytes += data.length;
    try { await ZipperDB.put({...record, data}); }
    catch (e) { state.bytes -= data.length; throw e; }
    current.saved.add(record.url);
    current.lastFileAt = Date.now();
    if (record.url === state.gameURL && /html/i.test(record.mimeType || '')) current.hasEntry = true;
    savedFiles.push({url: record.url, bytes: data.length});
    state.count++;
    if (!state.errors.length) state.message = `Collecting automatically — ${state.count} files saved. Play to load more.`;
    await saveState();
  } catch (e) {
    await error(`Could not capture ${record.url}: ${e.message}`);
  } finally { current.reading.delete(record.url); }
}
chrome.debugger.onEvent.addListener((target, method, params) => {
  const current = session;
  if (!current || target.tabId !== current.tabId) return;
  if (method === 'Network.requestWillBeSent') {
    const id = key(target,params.requestId);
    current.inflight.delete(id);
    if (eligible(current,target,params,params.request.url) && !current.saved.has(params.request.url)) current.inflight.add(id);
  } else if (method === 'Target.attachedToTarget') {
    const child = {tabId: target.tabId, sessionId: params.sessionId};
    const task = (async () => {
      try { if (!current.lightweight) await enable(child); }
      catch (e) { await error('A child frame or worker could not be captured: ' + e.message); }
      finally { await command(child, 'Runtime.runIfWaitingForDebugger').catch(() => {}); }
    })();
    pending.add(task); task.finally(() => pending.delete(task));
  } else if (method === 'Network.responseReceived') {
    if (['WebSocket','EventSource'].includes(params.type)) return;
    const r = params.response;
    if (!eligible(current,target,params,r.url)) { current.inflight.delete(key(target,params.requestId));return; }
    if (/^https?:\/\//.test(r.url) && r.status >= 200 && r.status < 300) {
      requests.set(key(target, params.requestId), {url: r.url, status: r.status, mimeType: r.mimeType});
    } else if (r.status >= 400) {
      error(`HTTP ${r.status}: ${r.url}`).catch(() => {});
    }
  } else if (method === 'Network.loadingFinished') {
    current.inflight.delete(key(target,params.requestId));
    const id = key(target, params.requestId), record = requests.get(id);
    requests.delete(id);
    if (!record) return;
    const task = capture(target, params.requestId, record, current);
    pending.add(task); task.finally(() => pending.delete(task));
  } else if (method === 'Network.loadingFailed') {
    current.inflight.delete(key(target,params.requestId));
    requests.delete(key(target, params.requestId));
    error('A resource failed to load: ' + params.errorText).catch(() => {});
  }
});
chrome.debugger.onDetach.addListener((target, reason) => {
  if (session?.tabId === target.tabId) stop('Collection ended: ' + reason).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => {
  ready.then(() => {
    if (tabId === state.captureTabId) return resetCollection();
  }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url) return;
  ready.then(() => {
    if (tabId === state.captureTabId && !isCapturePage(change.url)) return resetCollection();
  }).catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target === 'zip-offscreen') return;
  if (sender.id !== chrome.runtime.id) return;
  const extensionPage = sender.url?.startsWith(chrome.runtime.getURL(''));
  const floatingPanel = sender.frameId === 0 && sender.tab && Zipper.siteAllowed(sender.url);
  if (!extensionPage && !floatingPanel) return;
  (async () => {
    await ready;
    if (floatingPanel && !Zipper.siteAllowed((await chrome.tabs.get(sender.tab.id)).url)) throw Error('Open CrazyGames to use this panel.');
    const sourceTabId = floatingPanel ? sender.tab.id : message.sourceTabId;
    if (message.type === 'capture-mode' && floatingPanel) {
      if (starting || state.running || state.stopping || exporting || resetPromise) throw Error('Stop collection before changing capture mode.');
      lightweight = message.lightweight !== false;
      return {ok:true,lightweight};
    }
    if (floatingPanel && message.type === 'panel-state') {
      const key = 'panel-' + sourceTabId;
      return (await chrome.storage.session.get(key))[key] || {open:false};
    }
    if (floatingPanel && message.type === 'panel-save') {
      const key = 'panel-' + sourceTabId;
      const position = message.position;
      const saved = {open: Boolean(message.open)};
      if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) saved.position = {x:position.x,y:position.y};
      await chrome.storage.session.set({[key]:saved});
      return {ok:true};
    }
    if (message.type === 'file-feed' && floatingPanel) {
      if (sourceTabId !== state.captureTabId) return {active: false};
      const offset = message.captureId === state.captureId && Number.isSafeInteger(message.offset) && message.offset >= 0 ? Math.min(message.offset, savedFiles.length) : 0;
      return {active: true, captureId: state.captureId, running: state.running, count: state.count, offset, files: savedFiles.slice(offset, offset + 200)};
    }
    if (message.type === 'start') await start(sourceTabId);
    else if (message.type === 'stop') { if (!floatingPanel) await requirePage(sourceTabId); await stop(); }
    else if (message.type === 'refresh') {
      if (resetPromise || exporting || starting) throw Error('Wait for the current operation to finish.');
      await requirePage(sourceTabId);
      await stop();
      await start(sourceTabId);
    }
    else if (message.type === 'export') await downloadZIP();
    else if (message.type !== 'status') throw Error('Unknown action.');
    return {...state, running: state.running || starting, exporting, lightweight};
  })().then(reply, e => reply({error: e.message}));
  return true;
});
async function downloadZIP() {
  if (resetPromise || exporting || starting) throw Error('A download or collection setup is already in progress.');
  exporting = true;
  let finishExport;
  exportFinished = new Promise(resolve => {finishExport = resolve;});
  let blobURL;
  try {
    await stop('Preparing ZIP download…');
    if (!state.count) throw Error('No files have been captured yet.');
    if (!(await chrome.offscreen.hasDocument())) await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'Build the collected files into a ZIP and download without opening a tab.'});
    const result = await chrome.runtime.sendMessage({target:'zip-offscreen',type:'build',state});
    if (!result || result.error) throw Error(result?.error || 'Could not build the ZIP.');
    blobURL = result.url;
    const id = await chrome.downloads.download({url:blobURL,filename:result.filename,conflictAction:'uniquify',saveAs:false});
    await chrome.storage.session.set({['zip-download-'+id]:blobURL});
    // Cover small downloads that finish before their URL is recorded.
    const [item] = await chrome.downloads.search({id});
    if (item && item.state !== 'in_progress') await releaseDownload(id);
    state.message = 'ZIP download started. Check your browser downloads.';
    await saveState();
  } catch(e) {
    if (blobURL) await chrome.runtime.sendMessage({target:'zip-offscreen',type:'release',url:blobURL}).catch(()=>{});
    state.message = 'Download failed: '+e.message;
    await saveState();throw e;
  } finally { exporting = false; finishExport(); }
}
async function releaseDownload(id) {
  const key = 'zip-download-'+id;
  const value = (await chrome.storage.session.get(key))[key];
  if (!value) return;
  await chrome.runtime.sendMessage({target:'zip-offscreen',type:'release',url:value}).catch(()=>{});
  await chrome.storage.session.remove(key);
}
chrome.downloads.onChanged.addListener(delta => {
  if (['complete','interrupted'].includes(delta.state?.current)) releaseDownload(delta.id).catch(()=>{});
});
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    if (!Zipper.siteAllowed(tab.url)) {
      await chrome.tabs.create({url:'https://www.crazygames.com/'});
      return;
    }
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['core.js', 'floating.js', 'panel-open.js']});
    await chrome.action.setBadgeText({tabId: tab.id, text: ''});
    await chrome.action.setTitle({tabId: tab.id, title: 'Open floating CrazyGames Unlocked'});
  } catch (e) {
    await chrome.action.setBadgeText({tabId: tab.id, text: '!'}).catch(() => {});
    await chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: '#7c3aed'}).catch(() => {});
    await chrome.action.setTitle({tabId: tab.id, title: 'This browser page blocks on-page panels. Open https://www.crazygames.com to use CrazyGames Unlocked.'}).catch(() => {});
  }
});
