console.log(`%clist-card\n%cVersion: ${'0.2.0'}`,'color: rebeccapurple; font-weight: bold;','');

class ListCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static getStubConfig() {
    return {
      type: 'custom:list-card',
      title: 'List Card',
      entity: 'sensor.example',
      row_limit: 5,
      columns: [
        { field: 'title', title: 'Title', width: '40%' },
        { field: 'status', title: 'Status', width: '120px' },
        { field: 'url', title: 'Link', add_link: 'url' },
      ],
    };
  }

  static getConfigElement() {
    return document.createElement('list-card-editor');
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('Please define an entity');
    }

    const root = this.shadowRoot;
    if (root.lastChild) root.removeChild(root.lastChild);

    const cardConfig = { ...config };
    const columns = Array.isArray(cardConfig.columns)
      ? cardConfig.columns
      : cardConfig.columns
      ? Object.values(cardConfig.columns)
      : undefined;

    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    const style = document.createElement('style');

    style.textContent = `
      :host, ha-card, table, thead, tbody, tr, th, td, a, img, span {
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        padding: 0 16px 16px 16px;
      }
      table.has-widths { table-layout: fixed; }
      thead th {
        text-align: left;
        font-weight: 600;
        padding: 8px 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      tbody td { padding: 8px 8px; vertical-align: top; overflow-wrap: anywhere; }
      tbody tr:nth-child(odd) { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td a { color: var(--primary-text-color); text-decoration: none; font-weight: normal; }
    `;

    // Back-compat per-column custom CSS
    if (columns) {
      for (const col of columns) {
        if (col && col.style && col.field) {
          const styles = col.style;
          style.textContent += `\n      .${cssClass(col.field)} {`;
          for (const block of Array.isArray(styles) ? styles : [styles]) {
            if (!block) continue;
            for (const [prop, val] of Object.entries(block)) {
              style.textContent += `\n        ${prop}: ${val};`;
            }
          }
          style.textContent += `\n      }`;
        }
      }
    }

    content.id = 'container';
    if (cardConfig.title) card.header = cardConfig.title;
    card.appendChild(content);
    card.appendChild(style);
    this.shadowRoot.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    const config = this._config;
    if (!config || !hass) return;

    const stateObj = hass.states[config.entity];
    if (!stateObj) {
      this.style.display = 'none';
      return;
    }

    const feed = config.feed_attribute
      ? stateObj.attributes[config.feed_attribute]
      : stateObj.attributes;
    const columns = Array.isArray(config.columns)
      ? config.columns
      : config.columns
      ? Object.values(config.columns)
      : undefined;

    this.style.display = 'block';
    const rowLimit = config.row_limit ? Number(config.row_limit) : (feed ? Object.keys(feed).length : 0);
    let rows = 0;

    if (!feed || Object.keys(feed).length === 0) {
      this.style.display = 'none';
      return;
    }

    const anyWidths = !!(columns && columns.some((c) => normalizeWidth(c && c.width)));
    let colgroup = '';
    if (columns) {
      colgroup += '<colgroup>';
      for (const col of columns) {
        const w = normalizeWidth(col && col.width);
        colgroup += w ? `<col style='width:${w}'>` : `<col>`;
      }
      colgroup += '</colgroup>';
    }

    let card_content = `<table${anyWidths ? ' class=' + 'has-widths' : ''}>${colgroup}<thead><tr>`;

    if (!columns) {
      const first = feed[Object.keys(feed)[0]];
      for (const key in first) {
        if (Object.prototype.hasOwnProperty.call(first, key)) {
          card_content += `<th>${escapeHtml(key)}</th>`;
        }
      }
    } else {
      for (const col of columns) {
        if (!col) continue;
        const cls = cssClass(col.field);
        const w = normalizeWidth(col.width);
        card_content += `<th class='${cls}'${w ? ` style='width:${w}'` : ''}>${escapeHtml(col.title ?? col.field)}</th>`;
      }
    }

    card_content += `</tr></thead><tbody>`;

    for (const entryKey in feed) {
      if (rows >= rowLimit) break;
      if (!Object.prototype.hasOwnProperty.call(feed, entryKey)) continue;
      const row = feed[entryKey];

      card_content += `<tr>`;
      if (!columns) {
        for (const field in row) {
          if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
          card_content += `<td>${escapeHtml(String(row[field]))}</td>`;
        }
      } else {
        // Ensure every configured field exists
        let hasAll = true;
        for (const col of columns) {
          if (!row || !Object.prototype.hasOwnProperty.call(row, col.field)) { hasAll = false; break; }
        }
        if (!hasAll) { continue; }

        for (const col of columns) {
          const cls = cssClass(col.field);
          const w = normalizeWidth(col.width);
          card_content += `<td class='${cls}'${w ? ` style='width:${w}'` : ''}>`;

          const wrapLink = !!col.add_link && !col.allow_html; // don't wrap if HTML is provided
          if (wrapLink) {
            const href = row[col.add_link];
            card_content += `<a href='${encodeURI(String(href))}' target='_blank' rel='noreferrer noopener'>`;
          }

          if (col.type === 'image') {
            const imageWidth = Number(col.width) || 70;
            const imageHeight = Number(col.height) || 90;
            const data = row[col.field];
            const url = Array.isArray(data) && data[0] && data[0].url ? data[0].url : data;
            card_content += `<img src='${encodeURI(String(url))}' width='${imageWidth}' height='${imageHeight}' alt=''>`;
          } else if (col.type === 'icon') {
            const icon = row[col.field];
            card_content += `<ha-icon class='column-${cls}' icon='${escapeHtml(String(icon))}'></ha-icon>`;
          } else {
            // text with optional HTML
            let text = row[col.field];
            if (col.regex) {
              const match = new RegExp(col.regex, 'u').exec(String(row[col.field] ?? ''));
              if (match) text = match[0];
            }
            if (col.prefix) text = `${col.prefix}${text ?? ''}`;
            if (col.postfix) text = `${text ?? ''}${col.postfix}`;
            const rendered = col.allow_html ? sanitizeHTML(String(text ?? '')) : escapeHtml(String(text ?? ''));
            card_content += rendered;
          }

          if (wrapLink) card_content += `</a>`;

          card_content += `</td>`;
        }
      }
      card_content += `</tr>`;
      rows++;
    }

    card_content += `</tbody></table>`;
    this.shadowRoot.getElementById('container').innerHTML = card_content;
  }

  getCardSize() { return 1; }
}

customElements.define('list-card', ListCard);

// ---------------------------
// Visual Editor (no focus loss, HA-friendly events/components)
// ---------------------------
class ListCardEditor extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
  }

  setConfig(config) {
    const prevLen = (this._config && Array.isArray(this._config.columns)) ? this._config.columns.length : undefined;
    const nextLen = (config && Array.isArray(config.columns)) ? config.columns.length : undefined;

    this._config = { ...config };

    // Only (re)render on first run or when column count changes to avoid focus loss
    if (!this._initialized || prevLen !== nextLen) {
      this._initialized = true;
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._entityPicker) this._entityPicker.hass = hass;
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const root = this.shadowRoot;
    root.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
      .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
      .columns { border: 1px solid var(--divider-color, #ddd); border-radius: 8px; padding: 12px; }
      .col-item { border: 1px dashed var(--divider-color, #ccc); border-radius: 8px; padding: 8px; margin: 8px 0; }
      label { font-size: 0.9em; color: var(--secondary-text-color); display:block; margin-bottom: 4px; }
    `;

    const wrap = document.createElement('div');

    // Top-level fields (HA components)
    const r1 = document.createElement('div');
    r1.className = 'row';

    const entityWrap = document.createElement('div');
    entityWrap.innerHTML = `<label>Entity</label>`;
    const entityPicker = document.createElement('ha-entity-picker');
    entityPicker.hass = this._hass;
    entityPicker.value = this._config?.entity || '';
    entityPicker.addEventListener('value-changed', (e) => this._update('entity', e.detail.value));
    entityWrap.appendChild(entityPicker);
    this._entityPicker = entityPicker;

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<label>Title</label>`;
    const titleInput = document.createElement('ha-textfield');
    titleInput.value = this._config?.title || '';
    titleInput.addEventListener('value-changed', (e) => this._update('title', e.detail.value));
    titleWrap.appendChild(titleInput);

    r1.appendChild(entityWrap);
    r1.appendChild(titleWrap);

    const r2 = document.createElement('div');
    r2.className = 'row';

    const feedWrap = document.createElement('div');
    feedWrap.innerHTML = `<label>Feed attribute (optional)</label>`;
    const feedInput = document.createElement('ha-textfield');
    feedInput.placeholder = 'e.g. items';
    feedInput.value = this._config?.feed_attribute || '';
    feedInput.addEventListener('value-changed', (e) => this._update('feed_attribute', e.detail.value));
    feedWrap.appendChild(feedInput);

    const limitWrap = document.createElement('div');
    limitWrap.innerHTML = `<label>Row limit (optional)</label>`;
    const limitInput = document.createElement('ha-textfield');
    limitInput.type = 'number';
    limitInput.value = this._config?.row_limit ?? '';
    limitInput.addEventListener('value-changed', (e) => this._update('row_limit', e.detail.value ? Number(e.detail.value) : undefined));
    limitWrap.appendChild(limitInput);

    r2.appendChild(feedWrap);
    r2.appendChild(limitWrap);

    // Columns editor
    const colsBox = document.createElement('div');
    colsBox.className = 'columns';
    colsBox.innerHTML = `<strong>Columns</strong>`;

    const cols = Array.isArray(this._config?.columns) ? this._config.columns : [];

    const list = document.createElement('div');
    cols.forEach((col, idx) => list.appendChild(this._renderColumn(col, idx)));
    colsBox.appendChild(list);

    const addBtn = document.createElement('mwc-button');
    addBtn.raised = true;
    addBtn.label = 'Add column';
    addBtn.addEventListener('click', () => {
      const next = [
        ...cols,
        { field: '', title: '', type: 'text', width: '', prefix: '', postfix: '', allow_html: false },
      ];
      this._update('columns', next);
      this._render(); // structural change → safe rerender
    });
    colsBox.appendChild(addBtn);

    wrap.appendChild(r1);
    wrap.appendChild(r2);
    wrap.appendChild(colsBox);

    root.appendChild(style);
    root.appendChild(wrap);
  }

  _renderColumn(col, idx) {
    const item = document.createElement('div');
    item.className = 'col-item';

    const row1 = document.createElement('div');
    row1.className = 'row3';

    // field
    const fWrap = document.createElement('div');
    fWrap.innerHTML = `<label>Field</label>`;
    const fInput = document.createElement('ha-textfield');
    fInput.value = col.field || '';
    fInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { field: e.detail.value }));
    fWrap.appendChild(fInput);

    // title
    const tWrap = document.createElement('div');
    tWrap.innerHTML = `<label>Title</label>`;
    const tInput = document.createElement('ha-textfield');
    tInput.value = col.title || '';
    tInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { title: e.detail.value }));
    tWrap.appendChild(tInput);

    // type
    const yWrap = document.createElement('div');
    yWrap.innerHTML = `<label>Type</label>`;
    const ySel = document.createElement('ha-select');
    ['text', 'image', 'icon'].forEach((opt) => {
      const o = document.createElement('mwc-list-item');
      o.value = opt; o.textContent = opt; if ((col.type || 'text') === opt) o.selected = true; ySel.appendChild(o);
    });
    ySel.addEventListener('selected', () => this._updateArray('columns', idx, { type: ySel.value }));
    yWrap.appendChild(ySel);

    row1.appendChild(fWrap);
    row1.appendChild(tWrap);
    row1.appendChild(yWrap);

    const row2 = document.createElement('div');
    row2.className = 'row3';

    // width
    const wWrap = document.createElement('div');
    wWrap.innerHTML = `<label>Width</label>`;
    const wInput = document.createElement('ha-textfield');
    wInput.placeholder = 'e.g. 120px or 25%';
    wInput.value = col.width || '';
    wInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { width: e.detail.value }));
    wWrap.appendChild(wInput);

    // link
    const lWrap = document.createElement('div');
    lWrap.innerHTML = `<label>Link (field name for href)</label>`;
    const lInput = document.createElement('ha-textfield');
    lInput.placeholder = 'e.g. url';
    lInput.value = col.add_link || '';
    lInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { add_link: e.detail.value }));
    lWrap.appendChild(lInput);

    // regex
    const rWrap = document.createElement('div');
    rWrap.innerHTML = `<label>Regex (optional)</label>`;
    const rInput = document.createElement('ha-textfield');
    rInput.placeholder = 'e.g. digits';
    rInput.value = col.regex || '';
    rInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { regex: e.detail.value }));
    rWrap.appendChild(rInput);

    row2.appendChild(wWrap);
    row2.appendChild(lWrap);
    row2.appendChild(rWrap);

    const row3 = document.createElement('div');
    row3.className = 'row3';

    // prefix
    const pWrap = document.createElement('div');
    pWrap.innerHTML = `<label>Prefix</label>`;
    const pInput = document.createElement('ha-textfield');
    pInput.value = col.prefix || '';
    pInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { prefix: e.detail.value }));
    pWrap.appendChild(pInput);

    // postfix
    const sWrap = document.createElement('div');
    sWrap.innerHTML = `<label>Postfix</label>`;
    const sInput = document.createElement('ha-textfield');
    sInput.value = col.postfix || '';
    sInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { postfix: e.detail.value }));
    sWrap.appendChild(sInput);

    // image height (only relevant for image type)
    const hWrap = document.createElement('div');
    hWrap.innerHTML = `<label>Image height (px)</label>`;
    const hInput = document.createElement('ha-textfield');
    hInput.type = 'number';
    hInput.value = col.height || '';
    hInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { height: e.detail.value ? Number(e.detail.value) : undefined }));
    hWrap.appendChild(hInput);

    // allow_html toggle
    const aWrap = document.createElement('div');
    aWrap.innerHTML = `<label>Allow HTML</label>`;
    const aSel = document.createElement('ha-select');
    [
      { v: false, t: 'No (escape text)' },
      { v: true,  t: 'Yes (sanitize first)' },
    ].forEach(({ v, t }) => {
      const o = document.createElement('mwc-list-item');
      o.value = String(v); o.textContent = t; if (!!col.allow_html === v) o.selected = true; aSel.appendChild(o);
    });
    aSel.addEventListener('selected', () => this._updateArray('columns', idx, { allow_html: aSel.value === 'true' }));
    aWrap.appendChild(aSel);

    row3.appendChild(pWrap);
    row3.appendChild(sWrap);
    row3.appendChild(hWrap);

    const row4 = document.createElement('div');
    row4.className = 'row3';
    row4.appendChild(aWrap);

    const controls = document.createElement('div');
    const del = document.createElement('mwc-button');
    del.label = 'Delete column';
    del.addEventListener('click', () => {
      const next = (Array.isArray(this._config.columns) ? this._config.columns : []).filter((_, i) => i !== idx);
      this._update('columns', next);
      this._render(); // structural change → safe rerender
    });
    controls.appendChild(del);

    item.appendChild(row1);
    item.appendChild(row2);
    item.appendChild(row3);
    item.appendChild(row4);
    item.appendChild(controls);
    return item;
  }

  _update(key, value) {
    this._config = { ...this._config, [key]: value };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  _updateArray(arrayKey, index, patch) {
    const arr = Array.isArray(this._config[arrayKey]) ? [...this._config[arrayKey]] : [];
    arr[index] = { ...arr[index], ...patch };
    this._update(arrayKey, arr);
  }
}

customElements.define('list-card-editor', ListCardEditor);

// ---------------------------
// Helpers
// ---------------------------
function normalizeWidth(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') return `${val}px`;
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return `${s}px`;
  if (/^\d+(?:\.\d+)?(px|%)$/.test(s)) return s;
  if (s === 'auto') return s;
  return '';
}

function cssClass(field) {
  return String(field || '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Very small, conservative sanitizer: allows a, b, i, strong, em, span, br, ul, ol, li
// a[href|target|rel|title], span[class|title]
function sanitizeHTML(input) {
  const template = document.createElement('template');
  template.innerHTML = input;
  const allowedTags = new Set(['A','B','I','STRONG','EM','SPAN','BR','UL','OL','LI']);
  const allowedAttrs = {
    'A': new Set(['href','target','rel','title']),
    'SPAN': new Set(['class','title'])
  };
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowedTags.has(el.tagName)) { toRemove.push(el); continue; }
    // Strip disallowed attributes
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const tag = el.tagName;
      const allowed = allowedAttrs[tag] && allowedAttrs[tag].has(name);
      if (!allowed) el.removeAttribute(name);
    });
    // Constrain links
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href) && !/^mailto:|^tel:/i.test(href)) {
        el.removeAttribute('href');
      }
      el.setAttribute('rel','noreferrer noopener');
      if (!el.getAttribute('target')) el.setAttribute('target','_blank');
    }
  }
  toRemove.forEach((n) => n.replaceWith(document.createTextNode(n.textContent || '')));
  return template.innerHTML;
}

function fireEvent(node, type, detail, options) {
  const event = new Event(type, {
    bubbles: true,
    composed: true,
    cancelable: false,
    ...(options || {}),
  });
  event.detail = detail;
  node.dispatchEvent(event);
}

// Card description in HA's Custom Cards list
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'list-card',
  name: 'List Card',
  preview: false,
  description: 'Table from a sensor that provides list attributes. Visual editor, selectable text, per-column width, and optional safe HTML.'
});
