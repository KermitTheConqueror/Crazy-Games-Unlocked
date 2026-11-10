const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Zipper = require('../core.js');
const event = () => ({listeners: [], addListener(fn) {this.listeners.push(fn);}, emit(...args) {this.listeners.forEach(fn => fn(...args));}});
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const calls = [], records = new Map(), stored = {};
  const tabs = new Map([[1, {id:1, url:'https://www.crazygames.com/game/lumber-hero-idle-defense'}]]);
  const chrome = {
    action: {onClicked:event(),setBadgeText:async()=>{},setTitle:async()=>{},setBadgeBackgroundColor:async()=>{}},
    scripting: {executeScript:async options=>{calls.push(options);}},
    runtime: {id:'test', getURL:p => 'chrome-extension://test/'+p, onMessage:event(),sendMessage:async message=>{calls.push(message);return {url:'blob:test-zip',filename:'game-network.zip'};}},
    offscreen: {hasDocument:async()=>false,createDocument:async()=>calls.push('offscreen')},
    downloads: {download:async options=>{calls.push({download:options});return 42;},search:async()=>[{state:'in_progress'}],onChanged:event()},
    storage: {session: {get:async key=>({[key]:stored[key]}), set:async values=>{Object.assign(stored,values);},remove:async key=>{delete stored[key];}}},
    windows: {create:async()=> {calls.push('window'); tabs.set(2,{id:2,url:'about:blank'}); return {id:10,tabs:[tabs.get(2)]};}, remove:async()=>{}},
    tabs: {get:async id => {if(!tabs.has(id)) throw Error('Tab closed'); return tabs.get(id);}, update:async(id,{url})=>{calls.push('navigate');tabs.get(id).url=url;},reload:async()=>calls.push('reload'),create:async()=>calls.push('new-tab'), onUpdated:event(), onRemoved:event()},
    debugger: {attach:async()=>calls.push('attach'), detach:async()=>calls.push('detach'), onEvent:event(), onDetach:event(), sendCommand:async(target,method)=>{
      calls.push(method);
      if(method==='Network.getResponseBody') return {body:'AAH/gA==',base64Encoded:true};
      return {};
    }}
  };
  const context = vm.createContext({chrome, Zipper, ZipperDB:{clear:async()=>records.clear(),put:async r=>records.set(r.url,r)}, importScripts(){}, TextEncoder, Uint8Array, atob, console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),context);
  const send = (message, sender={id:'test',url:'chrome-extension://test/popup.html'}) => new Promise(resolve=>chrome.runtime.onMessage.listeners[0](message,sender,resolve));
  return {chrome,tabs,calls,records,send};
}
test('rejects non-CrazyGames initiation before creating a window', async()=>{
  const h=harness(); h.tabs.get(1).url='https://github.com/';
  assert.match((await h.send({type:'start',sourceTabId:1})).error,/only runs on CrazyGames/);
  assert.ok(!h.calls.includes('window'));
});
test('toolbar injects the panel or warning on ordinary web pages',async()=>{
  const h=harness();
  await h.chrome.action.onClicked.listeners[0](h.tabs.get(1));
  const injection=h.calls.find(c=>typeof c==='object');
  assert.equal(injection.target.tabId,1);
  assert.deepEqual(Array.from(injection.files),['core.js','floating.js','panel-open.js']);
  h.calls.length=0;h.tabs.get(1).url='https://example.com/';
  await h.chrome.action.onClicked.listeners[0](h.tabs.get(1));
  assert.equal(h.calls.length,1);
});
test('homepage can read status but cannot start a game capture',async()=>{
  const h=harness();h.tabs.get(1).url='https://www.crazygames.com/';
  const sender={id:'test',url:h.tabs.get(1).url,frameId:0,tab:{id:1}};
  assert.equal((await h.send({type:'status'},sender)).count,0);
  assert.match((await h.send({type:'start'},sender)).error,/only runs on CrazyGames game pages/);
  assert.ok(!h.calls.includes('window'));
});
test('floating panel starts collection using the sender tab, ignoring a supplied tab id',async()=>{
  const h=harness();
  const sender={id:'test',url:h.tabs.get(1).url,frameId:0,tab:{id:1}};
  const result=await h.send({type:'start',sourceTabId:999},sender);
  assert.equal(result.running,true);
});
test('attaches before navigation, captures bytes, ignores other tabs and stops on source navigation',async()=>{
  const h=harness();
  assert.equal((await h.send({type:'start',sourceTabId:1})).running,true);
  assert.ok(h.calls.indexOf('Network.enable')<h.calls.indexOf('navigate'));
  assert.ok(!h.calls.includes('window'));
  assert.equal(h.tabs.get(1).url,'https://games.crazygames.com/en_us/lumber-hero-idle-defense/index.html');
  const emit=(tabId,method,p)=>h.chrome.debugger.onEvent.emit({tabId},method,p);
  const response={requestId:'r1',response:{url:'https://cdn.test/game.wasm',status:200,mimeType:'application/wasm'}};
  emit(2,'Network.responseReceived',response); emit(2,'Network.loadingFinished',{requestId:'r1'}); await tick();
  assert.equal(h.records.size,0);
  emit(1,'Network.responseReceived',response); emit(1,'Network.loadingFinished',{requestId:'r1'}); await tick();
  assert.deepEqual(Array.from(h.records.get(response.response.url).data),[0,1,255,128]);
  assert.equal((await h.send({type:'status'})).count,1);
  h.chrome.tabs.onUpdated.emit(1,{url:'https://github.com/'}); await tick();
  assert.equal((await h.send({type:'status'})).running,false);
  assert.ok(h.calls.includes('detach'));
});
test('enables and resumes child targets, handles detach, retains saved data',async()=>{
  const h=harness(); await h.send({type:'start',sourceTabId:1});
  h.chrome.debugger.onEvent.emit({tabId:1},'Target.attachedToTarget',{sessionId:'child'}); await tick();
  assert.ok(h.calls.includes('Runtime.runIfWaitingForDebugger'));
  h.chrome.debugger.onDetach.emit({tabId:1},'canceled_by_user'); await tick();
  assert.equal((await h.send({type:'status'})).running,false);
});
test('stop drains pending response writes before returning',async()=>{
  const h=harness(); await h.send({type:'start',sourceTabId:1});
  let release;
  const original=h.chrome.debugger.sendCommand;
  h.chrome.debugger.sendCommand=async(t,m,p)=>m==='Network.getResponseBody'?new Promise(r=>release=r):original(t,m,p);
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.responseReceived',{requestId:'r',response:{url:'https://cdn.test/a',status:200,mimeType:'text/plain'}});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.loadingFinished',{requestId:'r'});
  let done=false;
  const stopping=h.send({type:'stop',sourceTabId:1}).then(r=>{done=true;return r;});
  await tick(); assert.equal(done,false);
  release({body:'hello',base64Encoded:false});
  const result=await stopping; assert.equal(result.count,1);assert.equal(result.running,false);
  assert.equal(h.records.size,1);
});
test('leaving for a blank page stops capture too',async()=>{
  const h=harness(); await h.send({type:'start',sourceTabId:1});
  h.chrome.tabs.onUpdated.emit(1,{url:'about:blank'}); await tick();
  assert.equal((await h.send({type:'status'})).running,false);
});
test('HTTP failures are reported instead of silently treated as assets',async()=>{
  const h=harness(); await h.send({type:'start',sourceTabId:1});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.responseReceived',{requestId:'404',response:{url:'https://cdn.test/missing',status:404}}); await tick();
  const status=await h.send({type:'status'});
  assert.match(status.errors[0],/HTTP 404/); assert.equal(status.count,0);
});
test('file feed includes only successfully saved files and only on the captured tab',async()=>{
  const h=harness();await h.send({type:'start',sourceTabId:1});
  const sender={id:'test',url:h.tabs.get(1).url,frameId:0,tab:{id:1}};
  const before=await h.send({type:'file-feed',offset:0},sender);
  assert.equal(before.files.length,0);
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.responseReceived',{requestId:'asset',response:{url:'https://cdn.test/file.wasm',status:200,mimeType:'application/wasm'}});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.loadingFinished',{requestId:'asset'});await tick();
  const after=await h.send({type:'file-feed',offset:0,captureId:before.captureId},sender);
  assert.equal(after.files[0].url,'https://cdn.test/file.wasm');
  assert.equal(after.files[0].bytes,4);
  assert.equal((await h.send({type:'file-feed',offset:1,captureId:after.captureId},sender)).files.length,0);
  h.tabs.set(2,{id:2,url:sender.url});
  assert.equal((await h.send({type:'file-feed'},{...sender,tab:{id:2}})).active,false);
});
test('open panel and position survive same-tab game navigation, explicit close persists',async()=>{
  const h=harness();
  const sender={id:'test',url:h.tabs.get(1).url,frameId:0,tab:{id:1}};
  await h.send({type:'panel-save',open:true,position:{x:640,y:72}},sender);
  await h.send({type:'start'},sender);
  const navigated={...sender,url:h.tabs.get(1).url};
  const restored=await h.send({type:'panel-state'},navigated);
  assert.equal(restored.open,true);assert.equal(restored.position.x,640);assert.equal(restored.position.y,72);
  await h.send({type:'panel-save',open:false,position:{x:640,y:72}},navigated);
  assert.equal((await h.send({type:'panel-state'},navigated)).open,false);
  h.tabs.set(2,{id:2,url:navigated.url});
  assert.equal((await h.send({type:'panel-state'},{...navigated,tab:{id:2}})).open,false);
});
test('download uses browser downloads without opening a new tab',async()=>{
  const h=harness();await h.send({type:'start',sourceTabId:1});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.responseReceived',{requestId:'a',response:{url:'https://cdn.test/a',status:200,mimeType:'text/plain'}});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.loadingFinished',{requestId:'a'});await tick();
  const result=await h.send({type:'export'});
  assert.equal(result.error,undefined);assert.equal(result.running,false);
  assert.ok(h.calls.some(c=>c?.download?.url==='blob:test-zip'));
  assert.ok(!h.calls.includes('new-tab'));
  h.chrome.downloads.onChanged.emit({id:42,state:{current:'complete'}});await tick();
  assert.ok(h.calls.some(c=>c?.type==='release'));
});
test('refresh clears saved files and reloads the current game with capture enabled',async()=>{
  const h=harness();await h.send({type:'start',sourceTabId:1});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.responseReceived',{requestId:'a',response:{url:'https://cdn.test/a',status:200,mimeType:'text/plain'}});
  h.chrome.debugger.onEvent.emit({tabId:1},'Network.loadingFinished',{requestId:'a'});await tick();
  assert.equal(h.records.size,1);
  const result=await h.send({type:'refresh',sourceTabId:1});
  assert.equal(result.error,undefined);assert.equal(result.running,true);assert.equal(result.count,0);assert.equal(h.records.size,0);
  assert.ok(h.calls.includes('reload'));assert.ok(!h.calls.includes('new-tab'));
});
