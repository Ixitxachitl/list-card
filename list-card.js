console.log(`%clist-card\n%cVersion: ${'0.4.8'}`, 'color: rebeccapurple; font-weight: bold;', '');

/* =========================
   List Card (runtime)
   ========================= */
class ListCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this._config = {}; }

  setConfig(config) {
    if (!config || !config.entity) throw new Error('Please define an entity');
    const root = this.shadowRoot;
    root.innerHTML = '';

    const cardConfig = { ...config };
    const card = document.createElement('ha-card');

    // Header: plain text header or HTML block in body (preserve original behavior)
    if (cardConfig.title) {
      if (/<[a-z][\s\S]*>/i.test(cardConfig.title)) {
        const t = document.createElement('div');
        t.className = 'title-html';
        t.innerHTML = cardConfig.title;
        card.appendChild(t);
      } else {
        card.header = cardConfig.title;
      }
    }

    const content = document.createElement('div');
    content.id = 'container';
    content.classList.add('selectable');

    // Stop ALL pointer / mouse / touch events from propagating so HA's
    // gesture handlers never interfere with native text selection & copy.
    const stop = (e) => e.stopPropagation();
    for (const ev of ['mousedown', 'mouseup', 'pointerdown', 'pointerup',
      'pointermove', 'click', 'selectstart', 'copy'])
      content.addEventListener(ev, stop);
    for (const ev of ['touchstart', 'touchmove', 'touchend'])
      content.addEventListener(ev, stop, { passive: true });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        user-select: text !important;
        -webkit-user-select: text !important;
        -webkit-touch-callout: default !important;
        touch-action: auto;
      }
      ha-card { overflow: visible; }
      #container,
      .selectable, .selectable * {
        user-select: text !important;
        -webkit-user-select: text !important;
        -webkit-touch-callout: default !important;
        cursor: text;
      }
      a, img { -webkit-user-drag: none; user-drag: none; }
      .title-html { padding: 16px 16px 0 16px; }
      table { width: 100%; padding: 0 16px 16px 16px; }
      thead th { text-align: left; }
      tbody tr:nth-child(odd)  { background-color: var(--card-background-color, var(--paper-card-background-color)); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td, th {
        cursor: text;
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      td a { color: var(--primary-text-color); text-decoration: none; font-weight: normal; cursor: pointer; }
      ::selection { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    `;

    card.append(content, style);
    root.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    this._hass = hass;
    try { this._renderTable(); } catch (e) { console.warn('list-card: render error', e); }
  }

  _renderTable() {
    const c = this._config;
    if (!c || !c.entity || !this._hass?.states?.[c.entity]) { this.style.display = 'none'; return; }

    const content = this.shadowRoot?.getElementById('container');
    if (!content) return; // shadow DOM not ready yet

    const st = this._hass.states[c.entity];
    if (!st) { this.style.display = 'none'; return; }

    const attrs = st.attributes || {};
    const feed = c.feed_attribute ? attrs[c.feed_attribute] : (attrs.feed ?? attrs);
    const rows = Array.isArray(feed) ? feed : [];
    if (!rows.length) { this.style.display = 'none'; return; }

    this.style.display = 'block';
    const cols = Array.isArray(c.columns) && c.columns.length ? c.columns : null;
    const rowLimit = Number.isFinite(c.row_limit) && c.row_limit > 0 ? c.row_limit : rows.length;

    let html = '<table>';

    /* ── colgroup ── */
    if (cols) {
      html += '<colgroup>';
      for (const col of cols) {
        if (!col) { html += '<col>'; continue; }
        const w = (col.col_width ?? '').toString().trim();
        html += w ? `<col style="width:${w}">` : '<col>';
      }
      html += '</colgroup>';
    }

    /* ── thead ── */
    html += '<thead><tr>';
    if (!cols) {
      const first = rows[0];
      const keys = (first && typeof first === 'object') ? Object.keys(first) : [];
      for (const k of keys) html += `<th>${k}</th>`;
    } else {
      for (const col of cols) {
        if (!col) { html += '<th></th>'; continue; }
        const t = (col.title ?? col.field ?? '').toString();
        const cls = (col.field ?? '').toString().trim().replace(/[^\w-]/g, '_');
        html += `<th class="col-${cls}" data-field="${col.field ?? ''}">${t}</th>`;
      }
    }
    html += '</tr></thead><tbody>';

    /* ── rows ── */
    let r = 0;
    for (const entry of rows) {
      if (r >= rowLimit) break;
      if (typeof entry !== 'object' || entry == null) continue;

      html += '<tr>';

      if (!cols) {
        for (const k of Object.keys(entry)) html += `<td>${this._raw(entry[k])}</td>`;
      } else {
        for (const col of cols) {
          if (!col) { html += '<td></td>'; continue; }
          const f = col.field || '';
          const cls = f.replace(/[^\w-]/g, '_');
          const val = f ? entry[f] : undefined;
          const href = col.add_link ? String(entry[col.add_link] ?? '') : '';
          const open = href ? `<a href="${href}" draggable="false" target="_blank" rel="noopener noreferrer">` : '';
          const close = href ? '</a>' : '';

          html += `<td class="col-${cls}" data-field="${f}">`;

          if (col.type === 'image') {
            const url = (Array.isArray(val) && val[0]?.url) ? val[0].url : val;
            if (url) {
              const w = Number.isFinite(col.width) ? col.width : 70;
              const h = Number.isFinite(col.height) ? col.height : 90;
              html += `${open}<img src="${url}" draggable="false" width="${w}" height="${h}" />${close}`;
            }
          } else if (col.type === 'icon') {
            const icon = val ? String(val) : '';
            if (icon) html += `<ha-icon class="column-${cls}" icon="${icon}"></ha-icon>`;
          } else {
            html += `${open}${this._raw(val)}${close}`;
          }

          html += '</td>';
        }
      }

      html += '</tr>';
      r++;
    }

    html += '</tbody></table>';
    content.innerHTML = html;
  }

  getCardSize() { return 1; }
  _raw(v) { return v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v)); }
}

customElements.define('list-card', ListCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'list-card',
  name: 'List Card',
  preview: false,
  description: 'Generate a table from a sensor that provides a list of attributes.',
});

ListCard.getConfigElement = async function () {
  const url = new URL('./list-card-editor.js', import.meta.url);
  url.searchParams.set('v', '6');
  await import(url.href);
  return document.createElement('list-card-editor');
};

// (optional, but mirrors core cards’ signature)
ListCard.getStubConfig = function (hass, entities, entitiesFallback) {
  return { entity: (entities && entities[0]) || "" };
};
