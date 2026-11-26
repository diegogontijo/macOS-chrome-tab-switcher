// fallback popup window: used when chrome doesn't allow drawing over the
// page (chrome://, chrome web store, new tab page...).
const style = document.createElement('style');
style.textContent = TabberUI.CSS;
document.head.prepend(style);

const list = TabberUI.createList(document.getElementById('root'), {
  onPick: (index) => send({ type: 'tabber:select', index }),
});

function send(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

chrome.runtime.sendMessage({ type: 'tabber:getState' }).then((state) => {
  if (!state) window.close();
  else list.render(state.items, state.index);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'tabber:render') list.render(msg.items, msg.index);
});

addEventListener('keyup', (e) => {
  if (e.key === 'Control') send({ type: 'tabber:release' });
});

addEventListener('keydown', (e) => {
  // if chrome doesn't deliver the shortcuts to the extension in this window,
  // the page handles the same keys karabiner sends.
  if (e.ctrlKey && e.shiftKey) {
    const map = {
      Digit1: { type: 'tabber:step', direction: 1 },
      Digit2: { type: 'tabber:step', direction: -1 },
      Digit3: { type: 'tabber:release' },
      Digit4: { type: 'tabber:cancel' },
    };
    if (map[e.code]) {
      e.preventDefault();
      send(map[e.code]);
      return;
    }
  }
  if (e.key === 'Escape') send({ type: 'tabber:cancel' });
  else if (e.key === 'Enter') send({ type: 'tabber:release' });
  else if (e.key === 'ArrowDown') send({ type: 'tabber:step', direction: 1 });
  else if (e.key === 'ArrowUp') send({ type: 'tabber:step', direction: -1 });
});
