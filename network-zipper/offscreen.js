// Hidden extension document: builds local archives; never opens a browser tab.
const blobs = new Set();
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'zip-offscreen') return;
  (async()=>{
    if (message.type === 'release') {
      if (blobs.delete(message.url)) URL.revokeObjectURL(message.url);
      return {ok:true};
    }
    if (message.type !== 'build') throw Error('Unknown ZIP action.');
    const files = await ZipperDB.all();
    if (!files.length) throw Error('No files have been captured yet.');
    const zip = new JSZip(), used = new Set(), index = [];
    for (const file of files) {
      const base = await Zipper.archivePath(file.url);
      let path = base, suffix = 1;
      while (used.has(path.toLowerCase())) path = base+'__'+suffix++;
      used.add(path.toLowerCase());zip.file(path,file.data);
      index.push({url:file.url,path,mimeType:file.mimeType,status:file.status,bytes:file.data.length});
    }
    zip.file('capture-index.json',JSON.stringify({gameURL:message.state.gameURL,exportedAt:new Date().toISOString(),files:index},null,2));
    if (message.state.errors?.length) zip.file('errors.log',message.state.errors.join('\n'));
    zip.file('READ-ME.txt','Captured network response bodies. Only loaded resources are included.\nURLs and server dependencies are not rewritten. See capture-index.json for URL mappings.\n');
    const url = URL.createObjectURL(await zip.generateAsync({type:'blob',compression:'STORE'}));
    blobs.add(url);
    return {url,filename:new URL(message.state.gameURL).pathname.split('/')[2]+'-network.zip'};
  })().then(reply,e=>reply({error:e.message}));
  return true;
});
