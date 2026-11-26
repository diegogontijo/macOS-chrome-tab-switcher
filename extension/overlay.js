// list shown on top of the page. injected on demand by background.js
// (together with ui.js) into the tab you are on when you press ctrl+tab.
(() => {
  if (globalThis.__tabberOverlay) return;

  const host = document.createElement('div');
  host.id = 'tabber-overlay-host';
  // inline styles with !important so the site's css can't interfere.
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'inset: 0',
    'width: 100vw',
    'height: 100vh',
    'max-width: none',
    'max-height: none',
    'margin: 0',
    'padding: 0',
    'border: 0',
    'background: transparent',
    'overflow: visible',
    'display: block',
    'pointer-events: none',
    'z-index: 2147483647',
  ]
    .map((rule) => rule + ' !important')
    .join(';');
  host.setAttribute('popover', 'manual');

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent =
    TabberUI.CSS +
    `
    .tb-wrap {
      position: fixed;
      inset: 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 18vh;
      pointer-events: none;
    }
  `;
  const wrap = document.createElement('div');
  wrap.className = 'tb-wrap';
  shadow.append(style, wrap);

  const list = TabberUI.createList(wrap, {
    onPick: (index) => send({ type: 'tabber:select', index }),
  });

  let visible = false;

  function send(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {
      // the extension was reloaded; this page kept an old copy.
      hide();
    }
  }

  function show() {
    if (!host.isConnected) {
      (document.fullscreenElement || document.documentElement).append(host);
    }
    // "popover" puts the list on top of everything, even site dialogs.
    try {
      if (!host.matches(':popover-open')) host.showPopover();
    } catch {}
    visible = true;
  }

  function hide() {
    visible = false;
    try {
      if (host.matches(':popover-open')) host.hidePopover();
    } catch {}
    host.remove();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'tabber:render') {
      show();
      list.render(msg.items, msg.index);
    } else if (msg.type === 'tabber:hide') {
      hide();
    }
  });

  // backup: if the page has focus, it also sees ctrl being released.
  addEventListener(
    'keyup',
    (e) => {
      if (visible && e.key === 'Control') send({ type: 'tabber:release' });
    },
    true,
  );
  addEventListener(
    'keydown',
    (e) => {
      if (visible && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        send({ type: 'tabber:cancel' });
      }
    },
    true,
  );

  globalThis.__tabberOverlay = { show, hide };
})();
