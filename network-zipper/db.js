// Custom storage for the CrazyGames adaptation. Bodies stay on this computer.
globalThis.ZipperDB = {
  async open() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('crazygames-network-zipper', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files', {keyPath: 'url'});
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async run(mode, action) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('files', mode);
        const request = action(tx.objectStore('files'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = tx.onabort = () => reject(tx.error || Error('File storage failed.'));
      });
    } finally { db.close(); }
  },
  clear() { return this.run('readwrite', s => s.clear()); },
  put(file) { return this.run('readwrite', s => s.put(file)); },
  all() { return this.run('readonly', s => s.getAll()); }
};
