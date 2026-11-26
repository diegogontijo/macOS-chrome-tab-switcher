// tab list shared by the on-page overlay (overlay.js)
// and the fallback popup window (fallback.html).
globalThis.TabberUI ??= (() => {
  const CSS = `
    .tb-panel {
      box-sizing: border-box;
      width: 480px;
      max-width: calc(100vw - 32px);
      max-height: min(70vh, 560px);
      overflow-y: auto;
      padding: 6px;
      border-radius: 14px;
      background: rgba(32, 32, 36, 0.9);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      backdrop-filter: blur(20px) saturate(160%);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      color: #f2f2f4;
      font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      text-align: left;
      pointer-events: auto;
      scrollbar-width: none;
      user-select: none;
    }
    .tb-row {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 10px;
      border-radius: 9px;
      cursor: default;
    }
    .tb-row:hover { background: rgba(255, 255, 255, 0.06); }
    .tb-row.tb-selected { background: rgba(255, 255, 255, 0.16); }
    .tb-icon {
      flex: none;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      object-fit: contain;
    }
    .tb-letter {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.15);
      font-size: 11px;
      font-weight: 600;
    }
    .tb-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tb-title, .tb-host { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tb-title { font-weight: 500; }
    .tb-host { font-size: 11px; opacity: 0.6; }
    .tb-badge { flex: none; font-size: 11px; opacity: 0.7; }
    @media (prefers-color-scheme: light) {
      .tb-panel {
        background: rgba(250, 250, 252, 0.92);
        color: #1c1c1e;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(0, 0, 0, 0.08);
      }
      .tb-row:hover { background: rgba(0, 0, 0, 0.05); }
      .tb-row.tb-selected { background: rgba(0, 0, 0, 0.1); }
      .tb-letter { background: rgba(0, 0, 0, 0.08); }
    }
  `;

  function letterIcon(item) {
    const el = document.createElement('div');
    el.className = 'tb-icon tb-letter';
    el.textContent = (item.host || item.title || '?').charAt(0).toUpperCase();
    return el;
  }

  function buildRow(item, i, onPick) {
    const row = document.createElement('div');
    row.className = 'tb-row';
    row.setAttribute('role', 'option');
    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPick(i);
    });

    if (item.favicon) {
      const img = document.createElement('img');
      img.className = 'tb-icon';
      img.alt = '';
      img.src = item.favicon;
      img.addEventListener('error', () => img.replaceWith(letterIcon(item)), { once: true });
      row.append(img);
    } else {
      row.append(letterIcon(item));
    }

    const text = document.createElement('div');
    text.className = 'tb-text';
    const title = document.createElement('div');
    title.className = 'tb-title';
    title.textContent = item.title;
    text.append(title);
    if (item.host) {
      const host = document.createElement('div');
      host.className = 'tb-host';
      host.textContent = item.host;
      text.append(host);
    }
    row.append(text);

    const badges = (item.audible ? '🔊 ' : '') + (item.pinned ? '📌' : '');
    if (badges.trim()) {
      const badge = document.createElement('span');
      badge.className = 'tb-badge';
      badge.textContent = badges.trim();
      row.append(badge);
    }
    return row;
  }

  function createList(container, { onPick }) {
    const panel = document.createElement('div');
    panel.className = 'tb-panel';
    panel.setAttribute('role', 'listbox');
    container.append(panel);

    let key = '';
    let rows = [];

    function render(items, index) {
      const nextKey = items.map((t) => t.id).join(',');
      if (nextKey !== key) {
        key = nextKey;
        panel.textContent = '';
        rows = items.map((item, i) => buildRow(item, i, onPick));
        panel.append(...rows);
      }
      rows.forEach((row, i) => {
        const selected = i === index;
        row.classList.toggle('tb-selected', selected);
        row.setAttribute('aria-selected', String(selected));
      });
      const sel = rows[index];
      if (sel) {
        // scroll only the list (scrollIntoView could scroll the page behind it).
        const top = sel.offsetTop - 6;
        const bottom = sel.offsetTop + sel.offsetHeight + 6;
        if (top < panel.scrollTop) panel.scrollTop = top;
        else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
      }
    }

    return { render, element: panel };
  }

  return { CSS, createList };
})();
