<div align="center">

# ⌃⇥ Tabber

**Zen-style Ctrl+Tab for Google Chrome on macOS.**

Hold <kbd>Ctrl</kbd>, tap <kbd>Tab</kbd> to walk back through your tabs in the order you used them, release to jump.

Makes Chrome's <kbd>Ctrl</kbd>+<kbd>Tab</kbd> switch to your **most recently used tab** (MRU),
like Zen Browser and Firefox, instead of the next tab to the right.

[**Download**](https://github.com/diegogontijo/macOS-chrome-tab-switcher/releases/latest) · [**FAQ**](#-faq)

![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome-121%2B-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square)
![Karabiner-Elements](https://img.shields.io/badge/Karabiner--Elements-required-555?style=flat-square)

</div>

---

## ✨ Features

- **Most recently used order.** <kbd>Ctrl</kbd>+<kbd>Tab</kbd> goes to the tab you were just on, not the next one to the right.
- **Hold to browse, release to switch.** Just like Zen: the list stays open while <kbd>Ctrl</kbd> is held.
- **No flicker on quick taps.** The list only appears after 150 ms, so a fast <kbd>Ctrl</kbd>+<kbd>Tab</kbd> just toggles between your last two tabs.
- **On-screen list** with favicon, title and site, in light and dark mode.
- **Works everywhere.** On pages where Chrome blocks extensions (`chrome://`, Web Store, New Tab), the list opens in a small popup window instead.
- **Minimal permissions.** No "read and change all your data on all websites".

## ⌨️ Shortcuts

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>Tab</kbd> (quick) | Toggle with the last used tab |
| Hold <kbd>Ctrl</kbd>, tap <kbd>Tab</kbd> <kbd>Tab</kbd>… | Move down the list (older tabs) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd> | Move up the list |
| Release <kbd>Ctrl</kbd> | Go to the highlighted tab |
| <kbd>Ctrl</kbd>+<kbd>Esc</kbd> | Close the list without switching |
| Click an item | Go straight to that tab |

The list shows tabs from the **current window** only, same as Zen.

## 🧠 How it works

Chrome doesn't let any extension use <kbd>Ctrl</kbd>+<kbd>Tab</kbd>. So
[Karabiner-Elements](https://karabiner-elements.pqrs.org/) catches it first
(**only while Chrome is in front**) and turns it into internal shortcuts the
extension understands:

```
 you press            karabiner sends        extension command
 ───────────────      ───────────────        ─────────────────
 ctrl+tab        ──▶  ctrl+shift+1      ──▶  mru-next
 ctrl+shift+tab  ──▶  ctrl+shift+2      ──▶  mru-prev
 release ctrl    ──▶  ctrl+shift+3      ──▶  mru-commit
 ctrl+esc        ──▶  ctrl+shift+4      ──▶  mru-cancel
```

The tab order comes from Chrome itself (`tab.lastAccessed`), so nothing is lost
if the extension's service worker restarts.

## 🚀 Installation

### 1. Install Karabiner-Elements

```bash
brew install --cask karabiner-elements
```

Or download the installer from [karabiner-elements.pqrs.org](https://karabiner-elements.pqrs.org/).

Open Karabiner-Elements and grant what macOS asks for:

- **System Settings → General → Login Items & Extensions**
  - turn on the Karabiner items under *Allow in the Background*
  - click ⓘ next to *Driver Extensions* and enable **Karabiner-VirtualHIDDevice**
- **System Settings → Privacy & Security → Input Monitoring**
  - enable **karabiner_core_service**

Using an external keyboard? Make sure it's checked under **Karabiner → Devices**.

> You don't need to keep the Karabiner window open. Its background services
> keep running and start automatically at login.

### 2. Enable the rule

```bash
mkdir -p ~/.config/karabiner/assets/complex_modifications
cp karabiner/tabber.json ~/.config/karabiner/assets/complex_modifications/
```

In Karabiner-Elements: **Complex Modifications → Add predefined rule** → **Enable** next to *Tabber*.

### 3. Load the extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick the `extension/` folder

> The extension runs straight from this folder, so don't move or delete it.

### 4. Check the shortcuts

Open `chrome://extensions/shortcuts` and make sure **Tabber** has all 4:
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd> through <kbd>4</kbd>. If one is
empty (Chrome skips shortcuts that conflict), click the pencil and set it.

## 🧪 Try it

1. Open 5 tabs and visit them in order: A, B, C, D, E
2. Quick <kbd>Ctrl</kbd>+<kbd>Tab</kbd> → you're on D. Again → back to E
3. Hold <kbd>Ctrl</kbd>, tap <kbd>Tab</kbd> twice → the list shows C highlighted. Release → you're on C
4. In `chrome://settings` the list opens in a popup window
5. In other apps (Terminal, VS Code…) <kbd>Ctrl</kbd>+<kbd>Tab</kbd> works as usual

## 📁 Project structure

```
extension/
├── manifest.json     commands and permissions
├── background.js     tab order, switching, commit / cancel
├── ui.js             tab list component (shared)
├── overlay.js        list drawn on top of the page
├── fallback.html     popup window for protected pages
└── fallback.js
karabiner/
└── tabber.json       karabiner rule
test/
├── background.test.mjs
└── preview.html      visual preview of the list
```

## 🔐 Permissions

| Permission | Why |
|---|---|
| `tabs` | Read tab titles and URLs to build the list |
| `scripting` + `activeTab` | Draw the list on the current tab, granted by the shortcut itself |
| `favicon` | Show site icons |

## 🛠 Development

Run the tests (they mock the Chrome APIs):

```bash
node --test test/
```

Tweak the list's look without reloading the extension:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/test/preview.html`.

After changing the extension, hit **reload** on its card in `chrome://extensions`.

## ❓ FAQ

### How do I make Ctrl+Tab switch to the last used tab in Google Chrome?

Chrome's <kbd>Ctrl</kbd>+<kbd>Tab</kbd> always goes to the next tab on the right,
and there is no setting to change it. Tabber changes that on macOS: install
Karabiner-Elements, enable the Tabber rule and load the extension
([installation](#-installation)). After that, <kbd>Ctrl</kbd>+<kbd>Tab</kbd> takes
you to the tab you used before, in most recently used order.

### Can I get Zen Browser's (or Firefox's) Ctrl+Tab behavior in Chrome?

Yes, that's exactly what Tabber does. Hold <kbd>Ctrl</kbd>, tap <kbd>Tab</kbd> to
move through your recent tabs in an on-screen list, and release <kbd>Ctrl</kbd> to
switch. It mirrors Firefox's *"Ctrl+Tab cycles through tabs in recently used order"*
option, which Zen Browser uses.

### Why can't a Chrome extension use Ctrl+Tab on its own?

Chrome reserves <kbd>Ctrl</kbd>+<kbd>Tab</kbd>: the `chrome.commands` API doesn't
accept the Tab key, and web pages never receive the shortcut. Tabber works around
this with Karabiner-Elements, which catches <kbd>Ctrl</kbd>+<kbd>Tab</kbd> at the
system level (only while Chrome is in front) and forwards it to the extension.

### How do I switch back to the previous tab in Chrome on a Mac?

With Tabber, a quick <kbd>Ctrl</kbd>+<kbd>Tab</kbd> toggles between your two most
recent tabs, like <kbd>⌘</kbd>+<kbd>Tab</kbd> does for apps.

### Is this the same as Chrome's tab search (⌘+Shift+A)?

No. Tab search is a searchable list you type into. Tabber is the quick
hold-and-release switcher for jumping between the tabs you just used.

### Does it work on Windows or Linux?

Not yet. The extension itself is platform independent, but the
<kbd>Ctrl</kbd>+<kbd>Tab</kbd> remap currently ships only as a Karabiner-Elements
rule, which is macOS only.

### Does it work in Brave, Edge, Arc or other Chromium browsers?

Not tested. The extension should load in Chromium-based browsers, but the
Karabiner rule only targets Google Chrome. Adding the browser's bundle identifier
to `karabiner/tabber.json` is the starting point.

### Does it collect data or need access to all my websites?

No. It makes no network requests and stores nothing. It only uses `tabs`,
`scripting` + `activeTab` (granted by the shortcut itself) and `favicon`. See
[permissions](#-permissions).

### Do I need to keep Karabiner-Elements open?

No. You can close its window (even with <kbd>⌘</kbd>+<kbd>Q</kbd>). Its background
services keep running and start automatically at login.

## 📝 Notes

- Chrome's native <kbd>Ctrl</kbd>+<kbd>Tab</kbd> (next tab) stops working. For
  sequential switching use <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>→</kbd> / <kbd>←</kbd>
  or <kbd>⌘</kbd>+<kbd>⇧</kbd>+<kbd>]</kbd> / <kbd>[</kbd>.
- Every time you release <kbd>Ctrl</kbd> in Chrome, Karabiner sends
  <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>3</kbd>. The extension ignores it when no
  switch is in progress.
- The rule targets stable Chrome (`com.google.Chrome`). For Beta or Canary, add
  `^com\\.google\\.Chrome\\.beta$` / `...canary$` to `bundle_identifiers` in
  `karabiner/tabber.json`.

## 🗑 Uninstall

- **Chrome:** remove Tabber in `chrome://extensions`
- **Karabiner:** disable the rule under Complex Modifications, or uninstall the app
