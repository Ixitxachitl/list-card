console.log(`%clist-card\n%cVersion: ${'0.4.4'}`, 'color: rebeccapurple; font-weight: bold;', '');

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

    // Make text selection behave inside dashboards
    const stop = (e) => e.stopPropagation();
    content.addEventListener('mousedown', stop);
    content.addEventListener('mouseup', stop);
    content.addEventListener('touchstart', stop, { passive: true });
    content.addEventListener('touchmove', stop, { passive: true });
    content.addEventListener('touchend', stop, { passive: true });

    const style = document.createElement('style');
    style.textContent = `
      :host { user-select: text !important; -webkit-user-select: text !important; -webkit-touch-callout: default; touch-action: auto; }
      .selectable, .selectable * { user-select: text !important; -webkit-user-select: text !important; }
      a, img { -webkit-user-drag: none; user-drag: none; }
      .title-html { padding: 16px 16px 0 16px; }
      table { width: 100%; padding: 0 16px 16px 16px; }  /* original spacing */
      thead th { text-align: left; }
      tbody tr:nth-child(odd)  { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td, th { cursor: text; }
      td a { color: var(--primary-text-color); text-decoration: none; font-weight: normal; cursor: pointer; }
    `;

    card.append(content, style);
    root.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    this._hass = hass;
    const c = this._config;
    if (!c || !c.entity || !hass?.states?.[c.entity]) { this.style.display = 'none'; return; }

    const content = this.shadowRoot.getElementById('container');
    const st = hass.states[c.entity];

    const feed = c.feed_attribute ? st.attributes?.[c.feed_attribute] : st.attributes?.['feed'] ?? st.attributes;
    const rows = Array.isArray(feed) ? feed : [];
    if (!rows.length) { this.style.display = 'none'; return; }

    this.style.display = 'block';
    const cols = Array.isArray(c.columns) ? c.columns : null;
    const rowLimit = Number.isFinite(c.row_limit) ? c.row_limit : rows.length;

    let html = '<table>';

    if (cols) {
      html += '<colgroup>';
      for (const col of cols) {
        const w = (col?.col_width ?? '').toString().trim();
        html += w ? `<col style="width:${w}">` : '<col>';
      }
      html += '</colgroup>';
    }

    html += '<thead><tr>';
    if (!cols) {
      const keys = Object.keys(rows[0] || {});
      for (const k of keys) html += `<th>${k}</th>`;
    } else {
      for (const col of cols) {
        const t = (col?.title ?? col?.field ?? '').toString();
        const cls = (col?.field ?? '').toString().trim().replace(/[^\w-]/g, '_');
        html += `<th class="col-${cls}" data-field="${col.field ?? ''}">${t}</th>`; // HTML allowed
      }
    }
    html += '</tr></thead><tbody>';

    let r = 0;
    for (const entry of rows) {
      if (r >= rowLimit) break;
      if (typeof entry !== 'object' || entry == null) continue;

      html += '<tr>';

      if (!cols) {
        for (const k of Object.keys(entry)) html += `<td>${this._raw(entry[k])}</td>`; // HTML allowed
      } else {
        if (!cols.every(cn => Object.prototype.hasOwnProperty.call(entry, cn.field))) continue;

        for (const col of cols) {
          const f = col.field;
          const cls = String(f || '').trim().replace(/[^\w-]/g, '_');
          const href = col.add_link ? (entry[col.add_link] ?? '') : '';
          const open = href ? `<a href="${href}" draggable="false" target="_blank" rel="noopener noreferrer">` : '';
          const close = href ? '</a>' : '';

          html += `<td class="col-${cls} ${f || ''}" data-field="${f || ''}">`;

          if (col.type === 'image') {
            const w = Number.isFinite(col.width) ? col.width : 70;
            const h = Number.isFinite(col.height) ? col.height : 90;
            const val = entry[f];
            const url = (Array.isArray(val) && val[0]?.url) ? val[0].url : val;
            html += `${open}<img src="${url}" draggable="false" width="${w}" height="${h}" />${close}`;
          } else if (col.type === 'icon') {
            html += `<ha-icon class="column-${f || ''}" icon="${entry[f]}"></ha-icon>`;
          } else {
            html += `${open}${this._raw(entry[f])}${close}`; // HTML allowed
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

window.customCards = window.customCards || [];
window.customCards.push({
  type: "list-card",
  name: "List Card",
  preview: false,
  description: "Generate a table from a sensor that provides a list of attributes.",
});

ListCard.getConfigElement = async function () {
  const url = new URL('./list-card-editor.js', import.meta.url);
  url.searchParams.set('v', '1');
  await import(url.href);
  return document.createElement('list-card-editor');
};

// (optional, but mirrors core cards’ signature)
ListCard.getStubConfig = function (hass, entities, entitiesFallback) {
  return { entity: (entities && entities[0]) || "" };
};
