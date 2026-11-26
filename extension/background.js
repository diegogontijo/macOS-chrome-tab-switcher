// tabber: switch tabs in recently used order (zen style).
//
// karabiner turns the keyboard into 4 extension commands:
//   ctrl+tab        -> mru-next    (move down the list / start a switch)
//   ctrl+shift+tab  -> mru-prev    (move up the list)
//   release ctrl    -> mru-commit  (go to the highlighted tab)
//   ctrl+esc        -> mru-cancel  (close without switching)

const SHOW_DELAY_MS = 150; // a quick ctrl+tab never shows the list
const FALLBACK_WIDTH = 480;
const ROW_HEIGHT = 44;
const FALLBACK_CHROME_HEIGHT = 44; // popup title bar + padding
const FALLBACK_MAX_ROWS = 9;

let session = null;
let seq = 0;
let queue = Promise.resolve();

// every event goes through a queue, so a "commit" never overtakes
// a ctrl+tab that is still being processed.
function enqueue(fn) {
  queue = queue.then(fn).catch((err) => console.error('[tabber]', err));
  return queue;
}

chrome.commands.onCommand.addListener((command, tab) => {
  enqueue(() => handleCommand(command, tab));
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg && msg.type) {
    case 'tabber:getState':
      sendResponse(session ? viewState(session) : null);
      return;
    case 'tabber:step':
      enqueue(() => step(msg.direction > 0 ? 1 : -1));
      return;
    case 'tabber:release':
      enqueue(() => commit());
      return;
    case 'tabber:select':
      enqueue(() => commit(msg.index));
      return;
    case 'tabber:cancel':
      enqueue(() => cancel());
      return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => onTabRemoved(tabId));
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  const s = session;
  if (!s || windowId === s.windowId || windowId === s.popupId) return;
  // on macos chrome sometimes reports "no focus" for a moment while
  // switching windows; only cancel if focus really left.
  setTimeout(() => {
    enqueue(async () => {
      if (session !== s) return;
      const focused = await chrome.windows.getLastFocused().catch(() => null);
      if (focused && focused.focused && (focused.id === s.windowId || focused.id === s.popupId)) return;
      await cancel();
    });
  }, 300);
});

async function handleCommand(command, tab) {
  switch (command) {
    case 'mru-next':
      return step(1, tab);
    case 'mru-prev':
      return step(-1, tab);
    case 'mru-commit':
      return commit();
    case 'mru-cancel':
      return cancel();
  }
}

async function step(direction, tab) {
  if (!session) return start(direction, tab);
  const n = session.tabs.length;
  session.index = (session.index + direction + n) % n;
  await render(session);
}

async function start(direction, tab) {
  let windowId = tab && tab.windowId;
  if (windowId == null) {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    windowId = win.id;
  }
  const tabs = await chrome.tabs.query({ windowId });
  if (tabs.length < 2) return;

  tabs.sort(byRecency);
  const s = {
    id: ++seq,
    windowId,
    originTabId: tabs[0].id,
    tabs: tabs.map(toItem),
    index: direction > 0 ? 1 : tabs.length - 1,
    mode: null, // 'overlay' | 'popup'
    popupId: null,
    timer: null,
  };
  session = s;
  s.timer = setTimeout(() => enqueue(() => show(s)), SHOW_DELAY_MS);
}

function byRecency(a, b) {
  if (a.active !== b.active) return a.active ? -1 : 1;
  return (b.lastAccessed || 0) - (a.lastAccessed || 0);
}

function toItem(tab) {
  const url = tab.url || tab.pendingUrl || '';
  return {
    id: tab.id,
    title: tab.title || url || 'new tab',
    host: hostOf(url),
    favicon: faviconUrl(url),
    audible: !!tab.audible,
    pinned: !!tab.pinned,
  };
}

function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname.replace(/^www\./, '');
    if (u.protocol === 'file:') return 'local file';
    return u.protocol + '//' + u.hostname;
  } catch {
    return '';
  }
}

function faviconUrl(pageUrl) {
  if (!pageUrl) return '';
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', '32');
  return u.toString();
}

function viewState(s) {
  return { items: s.tabs, index: s.index };
}

async function show(s) {
  if (session !== s || s.mode) return;
  try {
    // permission comes from the shortcut itself (activeTab), no access to all sites needed.
    await chrome.scripting.executeScript({
      target: { tabId: s.originTabId },
      files: ['ui.js', 'overlay.js'],
    });
    s.mode = 'overlay';
    await chrome.tabs.sendMessage(s.originTabId, { type: 'tabber:render', ...viewState(s) });
  } catch {
    // protected pages (chrome://, web store, new tab...): use the popup window.
    if (session !== s) return;
    if (s.mode === 'overlay') {
      await chrome.tabs.sendMessage(s.originTabId, { type: 'tabber:hide' }).catch(() => {});
    }
    s.mode = null;
    await openFallback(s);
  }
}

async function openFallback(s) {
  const win = await chrome.windows.get(s.windowId);
  const rows = Math.min(s.tabs.length, FALLBACK_MAX_ROWS);
  const height = rows * ROW_HEIGHT + 12 + FALLBACK_CHROME_HEIGHT;
  const left = Math.round(win.left + Math.max(0, (win.width - FALLBACK_WIDTH) / 2));
  const top = Math.round(win.top + Math.max(60, (win.height - height) / 3));
  s.mode = 'popup';
  const popup = await chrome.windows.create({
    url: chrome.runtime.getURL('fallback.html'),
    type: 'popup',
    focused: true,
    width: FALLBACK_WIDTH,
    height,
    left,
    top,
  });
  s.popupId = popup.id;
  if (session !== s) await chrome.windows.remove(popup.id).catch(() => {});
}

async function render(s) {
  const msg = { type: 'tabber:render', ...viewState(s) };
  if (s.mode === 'overlay') {
    await chrome.tabs.sendMessage(s.originTabId, msg).catch(() => {});
  } else if (s.mode === 'popup') {
    await chrome.runtime.sendMessage(msg).catch(() => {});
  }
}

async function commit(index) {
  const s = session;
  if (!s) return; // ctrl released outside a switch: ignore
  if (Number.isInteger(index) && index >= 0 && index < s.tabs.length) s.index = index;
  const target = s.tabs[s.index];
  end(s);
  await chrome.tabs.update(target.id, { active: true }).catch(() => {});
  await hideUI(s);
}

async function cancel() {
  const s = session;
  if (!s) return;
  end(s);
  await hideUI(s);
}

function end(s) {
  clearTimeout(s.timer);
  if (session === s) session = null;
}

async function hideUI(s) {
  if (s.mode === 'overlay') {
    await chrome.tabs.sendMessage(s.originTabId, { type: 'tabber:hide' }).catch(() => {});
  } else if (s.mode === 'popup') {
    if (s.popupId != null) await chrome.windows.remove(s.popupId).catch(() => {});
    await chrome.windows.update(s.windowId, { focused: true }).catch(() => {});
  }
}

async function onTabRemoved(tabId) {
  const s = session;
  if (!s) return;
  const i = s.tabs.findIndex((t) => t.id === tabId);
  if (i < 0) return;
  if (tabId === s.originTabId) return cancel();
  s.tabs.splice(i, 1);
  if (s.tabs.length < 2) return cancel();
  if (i < s.index || s.index >= s.tabs.length) s.index = Math.max(1, s.index - 1);
  await render(s);
}

// only used by the automated tests (test/background.test.mjs).
globalThis.__tabberTest = {
  getSession: () => session,
  idle: () => queue,
};
