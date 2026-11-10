# CrazyGames Unlocked 1.0.14

Version 1.0.14 displays its version in the floating panel header and includes the detected page address in URL rejection errors. Growden's exact repeated-hyphen URL is covered by a full mocked startup regression test. If the old error persists, ensure **Load unpacked** points to this updated folder, not an older extracted copy, and refresh the game page after reloading the extension.

Version 1.0.12 fixes game URL validation for consecutive hyphens, including `grow-a-garden---growden-io`. Both the original game page and converted index.html URL now pass validation.

Version 1.0.11 removes the auto-stop checkbox and automatic idle timeout. Collection continues until you click **Stop collection**, download the ZIP, leave/close the game page, or the browser disconnects the debugger. **Small online copy** remains enabled by default to skip large game assets. Auto-stop descriptions in the version history below apply only to older versions.

Version 1.0.10 defaults to **Small online copy**, matching the style of the supplied Armored Robot example. It captures the top-level loading page and supporting resources, while excluding `files.crazygames.com` game builds, `videos.crazygames.com`, media requests, and child-frame/worker traffic. Excluded downloads still run normally in the game but do not enter the ZIP or extend the collector's idle wait. This is a smaller online-dependent copy; size varies by game and is not capped at 2 MB.

To collect game assets as before, stop collection, uncheck **Small online copy**, then click **Refresh files**. Mode changes apply to new collections. ZIP output now uses lossless DEFLATE compression instead of storing every file uncompressed. Saved file contents and folder paths are preserved.

Version 1.0.9 adds **Auto-stop when files finish loading**, enabled by default. Collection stops after at least 10 seconds of capture, successful capture of the game entry HTML, no outstanding tracked file requests/body writes, and 8 seconds without a newly saved file. The saved collection remains available to download and the debugger detaches. Long-lived WebSocket/EventSource connections are excluded from file capture and the idle check. No minimum MB target is used; 64 MB remains the maximum size of a single captured response, not a collection goal.

This is a network-idle heuristic, not proof of a complete or minimal playable game. It cannot identify every unnecessary asset, split a large required bundle, or predict assets loaded by later gameplay. Disable the checkbox before starting or refreshing if you want to collect continuously through more levels. **Refresh files** clears the previous collection and starts again. The checkbox preference lasts while this background worker is active.

Chrome's debugging notification and its Cancel control are browser UI, not extension UI. This extension cannot hide that control during debugger capture. Auto-stop ends the debugger session sooner; the browser controls when its notification disappears.

Version 1.0.8 resets the file count and size to zero and clears the stored collection when its game tab closes or navigates to a different page (including another game). Closing only the floating panel or switching to another tab does not clear it. Initial navigation to the game's index.html and Refresh files still work normally. An already requested ZIP finishes building before its source files are cleared.

Version 1.0.7: clicking the extension outside CrazyGames opens `https://www.crazygames.com/` in a new tab, keeping your current page intact. On CrazyGames, it opens or closes the floating panel as before. This replaces the previous outside-site warning behavior.

Version 1.0.6 downloads ZIPs directly through the browser download system without opening a new tab. A hidden extension document builds the archive. The new **Refresh files** button clears the current collection, reloads this game with cache bypassed, and restarts capture. Download first if you want to keep the previous collection. Refresh retains the panel's saved position.

Version 1.0.5 uses the supplied purple-and-green artwork as the extension icon and panel logo. The redesigned panel has purple surfaces, a green start button, and separate file/size counters. Its open state and position are saved per tab in session storage and restored when that tab navigates to the game's index.html or another CrazyGames page. A deliberately closed panel stays closed. The browser necessarily replaces the page during navigation; the panel is recreated as soon as its content scripts load.

Version 1.0.4 keeps the warning at the top center for 5 seconds before its 400 ms fade. Starting collection replaces the current tab with the game's index.html URL. A transparent, click-through feed in the top-left displays each successfully collected filename and size, with new entries arriving from above. Recent entries remain visible within the top 42% of the screen; older entries move out of view, but all files remain in the collection and ZIP index. The feed reports collection saves, not separate downloads to disk.

Version 1.0.2 also opens the floating panel on the CrazyGames homepage and browsing pages. Choose a game before starting collection; the start button stays disabled until a supported game is open. Clicking the extension on another normal website displays a dismissible purple warning with a link to CrazyGames. Browser-protected pages such as `chrome://extensions` cannot host injected warnings, so those show a purple `!` badge and an explanatory tooltip instead. Warnings only appear when you click the extension.

The rounded, draggable control panel and ZIP downloads remain available. Based on https://github.com/genizy/network-zipper (see LICENSE and NOTICE).

## Install or restore

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder containing `manifest.json`. If this folder is already installed, click **Reload** on its extension card.

Requires Chrome / Edge 125 or newer. No build or package installation is needed.

## Use

1. Open a CrazyGames game page, such as `https://www.crazygames.com/game/lumber-hero-idle-defense`.
2. Click the extension icon to open its floating panel inside the tab, then **CrazyGames ↗**. Drag the panel by its title bar. Its rounded corners and shadow keep it distinct from the page. You can also focus the title bar and use arrow keys to move it (Shift moves faster).
3. The iframe URL replaces the current tab. Collection starts before navigation to capture the initial HTML too. No new game window opens.
4. Play to load more files. Keep this game tab open. Watch the transparent file feed at the top left; click the extension icon to reopen collection controls over the game.
5. Open the panel on a CrazyGames game page and click **Download ZIP**. This stops capture and starts a normal browser download without opening a tab. The panel shows download preparation or errors. Your browser's save-location settings still apply. **Refresh files** clears the collection and reloads the game to collect it again. The close button, Escape while focused inside the panel, or another click on the extension icon closes the panel without stopping collection. Clicking the icon again reopens it.

The added `downloads` permission starts the ZIP download; `offscreen` builds its Blob in a hidden document. Neither opens a visible page. Download Blob URLs are released when the browser reports completion or interruption.

After updating, reload the extension and refresh your CrazyGames tab to remove any old injected panel. The panel stays within the viewport when dragged or when the browser resizes. Clicking the icon opens the panel or warning; a previously open panel also restores automatically on CrazyGames pages. Content scripts are restricted to the three supported CrazyGames hosts. No all-sites permission is added.

Starting a new collection replaces the previous locally stored collection. Download before leaving if you want to keep it. Closing the game tab or navigating to a different page clears the collection and resets the counters, even if collection was already stopped. The file-feed content script runs only on games.crazygames.com and only displays data for the tab being captured.

## Limits

Only loaded, successful HTTP(S) response bodies are collected, including child frames and workers. Files retain binary bytes and query variants get distinct filenames. `capture-index.json` maps original URLs to paths; capture errors appear in `errors.log`.

The `/game/SLUG` to `/en_us/SLUG/index.html` conversion may not work for every game. Games requiring the original wrapper, different entry points or server services may fail. Collected files are not automatically converted to offline-playable games.

Limits are 64 MB per file and 256 MB per collection. Only one collection runs at once. Opening DevTools on the captured game may interrupt collection. The browser displays its debugger notification while capturing.

Captured data stays in local extension IndexedDB until the next collection or extension removal. No analytics or account login is used. Permissions: `debugger` for response bodies, `tabs` and `activeTab` for page validation, and `storage` for progress. The source browsing tab's network traffic is not captured.

## Verification

Run `node --test tests/*.test.cjs` for URL validation, filename handling, binary ZIP integrity and mocked collector lifecycle checks. Live game playback remains unverified in this environment.
