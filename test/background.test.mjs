// tests background.js logic against a mocked chrome.
// run with: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// tabs in window 1, visited in order A, B, C, D, E (E is active).
function makeTabs() {
  return ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({
    id: 10 + i,
    windowId: 1,
    title: name,
    url: `https://${name.toLowerCase()}.example.com/`,
    active: name === 'E',
    lastAccessed: 1000 + i,
  }));
}

function load({ tabs = makeTabs(), injectFails = false } = {}) {
  const calls = [];
  const on = { command: [], message: [], removed: [], focus: [] };
  const ev = (list) => ({ addListener: (f) => list.push(f) });
  const chrome = {
    commands: { onCommand: ev(on.command) },
    runtime: {
      onMessage: ev(on.message),
      getURL: (p) => 'chrome-extension://tabber' + p,
      sendMessage: async (m) => calls.push(['runtime.sendMessage', m.type, m.index]),
    },
    tabs: {
      onRemoved: ev(on.removed),
      query: async ({ windowId }) => tabs.filter((t) => t.windowId === windowId).map((t) => ({ ...t })),
      update: async (id, props) => calls.push(['tabs.update', id, props.active]),
      sendMessage: async (id, m) => calls.push(['tabs.sendMessage', id, m.type, m.index]),
    },
    scripting: {
      executeScript: async ({ target }) => {
        if (injectFails) throw new Error('Cannot access a chrome:// URL');
        calls.push(['inject', target.tabId]);
      },
    },
    windows: {
      onFocusChanged: ev(on.focus),
      get: async (id) => ({ id, left: 0, top: 0, width: 1200, height: 800 }),
      getLastFocused: async () => ({ id: 1, focused: true }),
      create: async (opts) => {
        calls.push(['windows.create', opts.type]);
        return { id: 99 };
      },
      remove: async (id) => calls.push(['windows.remove', id]),
      update: async (id, props) => calls.push(['windows.update', id, props.focused]),
    },
  };
  const ctx = vm.createContext({ chrome, console, setTimeout, clearTimeout, URL });
  vm.runInContext(SOURCE, ctx);
  const api = ctx.__tabberTest;
  const activeTab = tabs.find((t) => t.active);

  return {
    calls,
    session: () => api.getSession(),
    async command(name) {
      on.command.forEach((f) => f(name, { ...activeTab }));
      await api.idle();
    },
    async message(msg) {
      on.message.forEach((f) => f(msg, {}, () => {}));
      await api.idle();
    },
    async removeTab(id) {
      on.removed.forEach((f) => f(id));
      await api.idle();
    },
    async waitShown() {
      await sleep(200);
      await api.idle();
    },
    activated: () => calls.filter((c) => c[0] === 'tabs.update').map((c) => c[1]),
  };
}

const ID = { A: 10, B: 11, C: 12, D: 13, E: 14 };

test('quick ctrl+tab goes to the last used tab without showing the list', async () => {
  const t = load();
  await t.command('mru-next');
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.D]);
  assert.equal(t.calls.some((c) => c[0] === 'inject'), false);
  assert.equal(t.session(), null);
});

test('holding ctrl and pressing tab twice shows the list and goes to the 3rd most recent', async () => {
  const t = load();
  await t.command('mru-next');
  await t.command('mru-next');
  await t.waitShown();
  assert.ok(t.calls.some((c) => c[0] === 'inject' && c[1] === ID.E), 'list injected into the current tab');
  const render = t.calls.filter((c) => c[0] === 'tabs.sendMessage' && c[2] === 'tabber:render').at(-1);
  assert.equal(render[3], 2, 'C highlighted (index 2)');
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.C]);
  assert.ok(t.calls.some((c) => c[0] === 'tabs.sendMessage' && c[2] === 'tabber:hide'));
});

test('ctrl+shift+tab moves up the list and wraps around', async () => {
  const t = load();
  await t.command('mru-next'); // D
  await t.command('mru-prev'); // E
  await t.command('mru-prev'); // wraps around: A
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.A]);
});

test('ctrl+shift+tab alone starts from the oldest tab', async () => {
  const t = load();
  await t.command('mru-prev');
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.A]);
});

test('tab wraps around at the end of the list', async () => {
  const t = load();
  for (let i = 0; i < 5; i++) await t.command('mru-next'); // D C B A E
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.E]);
});

test('ctrl+esc cancels without switching tabs', async () => {
  const t = load();
  await t.command('mru-next');
  await t.waitShown();
  await t.command('mru-cancel');
  assert.deepEqual(t.activated(), []);
  assert.equal(t.session(), null);
  assert.ok(t.calls.some((c) => c[2] === 'tabber:hide'));
});

test('releasing ctrl outside a switch is ignored', async () => {
  const t = load();
  await t.command('mru-commit');
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), []);
});

test('double commit (karabiner + page) switches only once', async () => {
  const t = load();
  await t.command('mru-next');
  await t.waitShown();
  await t.message({ type: 'tabber:release' });
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.D]);
});

test('clicking an item goes to that tab', async () => {
  const t = load();
  await t.command('mru-next');
  await t.waitShown();
  await t.message({ type: 'tabber:select', index: 3 }); // B
  assert.deepEqual(t.activated(), [ID.B]);
});

test('with a single tab nothing happens', async () => {
  const t = load({ tabs: [{ id: 1, windowId: 1, title: 'X', url: 'https://x.com', active: true, lastAccessed: 1 }] });
  await t.command('mru-next');
  assert.equal(t.session(), null);
});

test('protected page uses the fallback popup window', async () => {
  const t = load({ injectFails: true });
  await t.command('mru-next');
  await t.waitShown();
  assert.ok(t.calls.some((c) => c[0] === 'windows.create' && c[1] === 'popup'));
  await t.command('mru-next');
  assert.ok(t.calls.some((c) => c[0] === 'runtime.sendMessage' && c[1] === 'tabber:render' && c[2] === 2));
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.C]);
  assert.ok(t.calls.some((c) => c[0] === 'windows.remove' && c[1] === 99));
  assert.ok(t.calls.some((c) => c[0] === 'windows.update' && c[1] === 1 && c[2] === true));
});

test('tab closed during a switch is removed from the list', async () => {
  const t = load();
  await t.command('mru-next'); // D (index 1)
  await t.command('mru-next'); // C (index 2)
  await t.removeTab(ID.D);     // list: E C B A -> C becomes index 1
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), [ID.C]);
});

test('closing the current tab during a switch cancels', async () => {
  const t = load();
  await t.command('mru-next');
  await t.removeTab(ID.E);
  assert.equal(t.session(), null);
  await t.command('mru-commit');
  assert.deepEqual(t.activated(), []);
});
