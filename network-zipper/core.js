// Custom CrazyGames adaptation of genizy/network-zipper. Modified November 2026.
(function (root) {
  function gameURL(value) {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) throw Error('Open an HTTPS CrazyGames game page first.');
    let match;
    if (['www.crazygames.com', 'crazygames.com'].includes(u.hostname)) {
      match = /^\/game\/([a-z0-9]+(?:-+[a-z0-9]+)*)\/?$/.exec(u.pathname);
      if (match) return `https://games.crazygames.com/en_us/${match[1]}/index.html`;
    } else if (u.hostname === 'games.crazygames.com') {
      match = /^\/([a-z]{2}_[a-z]{2})\/([a-z0-9]+(?:-+[a-z0-9]+)*)\/index\.html$/.exec(u.pathname);
      if (match) return u.origin + u.pathname;
    }
    throw Error('This extension only runs on CrazyGames game pages.');
  }
  function allowed(value) { try { gameURL(value); return true; } catch { return false; } }
  function siteAllowed(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
        ['crazygames.com', 'www.crazygames.com', 'games.crazygames.com'].includes(u.hostname);
    } catch { return false; }
  }
  function safePart(part) {
    // Encode rather than strip unsafe characters, preserving distinct filenames.
    return part.replace(/[%<>:"\\|?*\x00-\x1f]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .replace(/^\.+$/, s => s.replace(/\./g, '%2e')).replace(/[. ]$/g, c => '%' + c.charCodeAt(0).toString(16));
  }
  async function archivePath(value) {
    const u = new URL(value);
    let path = u.pathname.endsWith('/') ? u.pathname + 'index.html' : u.pathname;
    path = path.split('/').map(safePart).join('/');
    if (u.search) {
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.search));
      const tag = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('').slice(0, 16);
      const slash = path.lastIndexOf('/'), dot = path.lastIndexOf('.');
      const at = dot > slash ? dot : path.length;
      path = path.slice(0, at) + '__q_' + tag + path.slice(at);
    }
    return 'files/' + safePart(u.host) + path;
  }
  function captureEligible(url, {lightweight = true, type, childSession, frameId, rootFrameId} = {}) {
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol) || ['WebSocket','EventSource'].includes(type)) return false;
      if (!lightweight) return true;
      if (childSession || (frameId && rootFrameId && frameId !== rootFrameId)) return false;
      if (['files.crazygames.com','videos.crazygames.com'].includes(u.hostname)) return false;
      if (type === 'Media') return false;
      return true;
    } catch { return false; }
  }
  const api = { gameURL, allowed, siteAllowed, archivePath, captureEligible };
  root.Zipper = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
