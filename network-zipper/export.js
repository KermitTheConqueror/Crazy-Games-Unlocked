// Modified export flow: preserve response bytes, avoid filename collisions, include errors.
let blobURL;
(async () => {
  const status = document.getElementById('status');
  const button = document.getElementById('download');
  try {
    const state = await chrome.runtime.sendMessage({type: 'status'});
    if (state.running || state.stopping) throw Error('Stop collection using the extension before exporting.');
    const files = await ZipperDB.all();
    if (!files.length) throw Error('No files have been captured yet.');
    const zip = new JSZip();
    const index = [];
    const used = new Set();
    for (const file of files) {
      let path = await Zipper.archivePath(file.url);
      const base = path;
      let suffix = 1;
      while (used.has(path.toLowerCase())) path = base + '__' + suffix++;
      used.add(path.toLowerCase());
      zip.file(path, file.data);
      index.push({url: file.url, path, mimeType: file.mimeType, status: file.status, bytes: file.data.length});
    }
    zip.file('capture-index.json', JSON.stringify({gameURL: state.gameURL, exportedAt: new Date().toISOString(), files: index}, null, 2));
    if (state.errors?.length) zip.file('errors.log', state.errors.join('\n'));
    zip.file('READ-ME.txt', 'Captured network response bodies. Only loaded resources are included.\nOriginal absolute URLs and server dependencies are not rewritten.\nUse capture-index.json to map source URLs to files.\n');
    const blob = await zip.generateAsync({type: 'blob', compression: 'STORE'}, progress => status.textContent = `Building ZIP… ${progress.percent.toFixed(0)}%`);
    blobURL = URL.createObjectURL(blob);
    const name = new URL(state.gameURL).pathname.split('/')[2];
    button.disabled = false;
    button.onclick = () => {
      const link = document.createElement('a');
      link.href = blobURL; link.download = `${name}-network.zip`;
      document.body.append(link); link.click(); link.remove();
    };
    status.textContent = `${files.length} files ready (${(blob.size / 1048576).toFixed(1)} MB).`;
    button.click();
  } catch (e) { status.textContent = e.message; }
})();
addEventListener('pagehide', () => { if (blobURL) URL.revokeObjectURL(blobURL); });
