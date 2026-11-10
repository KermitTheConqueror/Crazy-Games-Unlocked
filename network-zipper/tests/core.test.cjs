const {test} = require('node:test');
const assert = require('node:assert/strict');
const {gameURL, allowed, archivePath} = require('../core.js');
const JSZip = require('../lib/jszip.js');
test('lightweight mode keeps reference-style wrapper resources but skips game builds and videos',()=>{
  const {captureEligible}=require('../core.js');
  for(const url of ['https://games.crazygames.com/en_us/armored-robot/index.html','https://builds.crazygames.com/gameframe/v1/bundle.js','https://api.crazygames.com/v4/en_US/configv3','https://fonts.gstatic.com/s/nunito/font.woff2','https://fafvertizing.crazygames.com/v12.25/rafvertizing.js']) assert.equal(captureEligible(url),true,url);
  for(const url of ['https://files.crazygames.com/armored-robot/9/Build/main.wasm.br','https://files.crazygames.com/armored-robot/9/Build/main.data.br','https://videos.crazygames.com/armored-robot/9/armored-robot.mp4']) {
    assert.equal(captureEligible(url),false,url);
    assert.equal(captureEligible(url,{lightweight:false}),true,url);
  }
  assert.equal(captureEligible('https://developer.example/game.js',{childSession:true}),false);
  assert.equal(captureEligible('https://developer.example/game.js',{frameId:'child',rootFrameId:'root'}),false);
});
test('site access includes homepage while capture still requires a game',()=>{
  const {siteAllowed}=require('../core.js');
  for(const url of ['https://www.crazygames.com/','https://crazygames.com/','https://www.crazygames.com/category/action']) assert.equal(siteAllowed(url),true);
  for(const url of ['https://crazygames.com.evil.test/','https://github.com/','http://crazygames.com/','https://user@crazygames.com/']) assert.equal(siteAllowed(url),false);
  assert.equal(allowed('https://www.crazygames.com/'),false);
});
test('converts the supplied CrazyGames URL exactly', () => {
  assert.equal(gameURL('https://www.crazygames.com/game/lumber-hero-idle-defense?ref=home#play'), 'https://games.crazygames.com/en_us/lumber-hero-idle-defense/index.html');
  assert.equal(gameURL('https://crazygames.com/game/test-game/'), 'https://games.crazygames.com/en_us/test-game/index.html');
  assert.equal(gameURL('https://games.crazygames.com/en_us/test-game/index.html'), 'https://games.crazygames.com/en_us/test-game/index.html');
});
test('accepts consecutive hyphens in Growden game and index URLs',()=>{
  const page='https://www.crazygames.com/game/grow-a-garden---growden-io';
  const entry='https://games.crazygames.com/en_us/grow-a-garden---growden-io/index.html';
  assert.equal(allowed(page),true);
  assert.equal(gameURL(page),entry);
  assert.equal(allowed(entry),true);
  assert.equal(gameURL(entry),entry);
  assert.equal(allowed(page+'/extra'),false);
});
test('rejects GitHub, lookalike domains, credentials and non-game pages', () => {
  for (const url of ['https://github.com/genizy/network-zipper', 'https://user.github.io/game/a', 'https://crazygames.com.evil.test/game/a', 'https://evilcrazygames.com/game/a', 'https://crazygames.com/', 'http://crazygames.com/game/a', 'https://u:p@crazygames.com/game/a', 'https://crazygames.com:8080/game/a', 'javascript:alert(1)', undefined]) assert.equal(allowed(url), false, String(url));
});
test('preserves distinct query variants and safe archive structure', async () => {
  const a = await archivePath('https://cdn.example/a.wasm?v=1');
  const b = await archivePath('https://cdn.example/a.wasm?v=2');
  assert.notEqual(a, b);
  assert.match(a, /^files\/cdn.example\/a__q_[a-f0-9]{16}\.wasm$/);
  assert.equal(await archivePath('https://cdn.example/'), 'files/cdn.example/index.html');
  assert.ok(!(await archivePath('https://cdn.example/%2e%2e%2fsecret')).includes('/../'));
});
test('bundled ZIP library round-trips binary bytes and Unicode text', async () => {
  const zip = new JSZip();
  const bytes = Uint8Array.from([0, 1, 127, 128, 254, 255]);
  zip.file('asset.wasm', bytes);
  zip.file('text.json', new TextEncoder().encode('{"name":"héllo 🌍"}'));
  const loaded = await JSZip.loadAsync(await zip.generateAsync({type:'uint8array'}));
  assert.deepEqual(await loaded.file('asset.wasm').async('uint8array'), bytes);
  assert.equal(await loaded.file('text.json').async('string'), '{"name":"héllo 🌍"}');
});
