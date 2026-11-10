// Recreate an open panel after navigation; a deliberately closed panel stays closed.
(async () => {
  if (!Zipper.siteAllowed(location.href)) return;
  try {
    const saved = await chrome.runtime.sendMessage({type:'panel-state'});
    if (saved?.open && !globalThis.__networkZipperPanel) globalThis.__openNetworkZipper(saved);
  } catch { /* The user can click the toolbar icon after an extension reload. */ }
})();
