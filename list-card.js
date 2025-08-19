console.log(`%clist-card\n%cVersion: ${'0.1.0'}`,'color: rebeccapurple; font-weight: bold;','');

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

    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    while (root && root.lastChild) root.removeChild(root.lastChild);

    const cardConfig = { ...config };
    const columns = Array.isArray(cardConfig.columns)
      ? cardConfig.columns
      : cardConfig.columns
      ? Object.values(cardConfig.columns)
      : undefined;

    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    const style = document.createElement('style');

    // Card styles (match original padding/spacing)
    style.textContent = `
      :host, ha-card, table, thead, tbody, tr, th, td, a, img, span {
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
      }
      table { width: 100%; padding: 0 16px 16px 16px; }
      thead th { text-align: left; }
      tbody tr:nth-child(odd) { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td a { color: var(--primary-text-color); text-decoration: none; font-weight: normal; }
      table.has-widths { table-layout: fixed; }
    `;

    // Include per-column CSS from config.columns[*].style (back-compat)
    if (columns) {
      for (const col of columns) {
        if (col && col.style && col.field) {
          const styles = col.style;
          style.textContent += `
      .${cssClass(col.field)} {`;
          for (const block of Array.isArray(styles) ? styles : [styles]) {
            if (!block) continue;
            for (const [prop, val] of Object.entries(block)) {
              style.textContent += `
        ${prop}: ${val};`;
            }
          }
          style.textContent += `
      }`;
        }
      }
    }

    content.id = 'container';
    if (cardConfig.title) {
      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = String(cardConfig.title); // HTML allowed for title
      card.appendChild(header);
    }
    card.appendChild(content);
    card.appendChild(style);
    this.shadowRoot.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    const config = this._config;
    const root = this.shadowRoot;
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

    // Build table
    const anyWidths = !!(columns && columns.some((c) => normalizeWidth(c && c.width)));
    let colgroup = '';
    if (columns) {
      colgroup += '<colgroup>';
      for (const col of columns) {
        const w = normalizeWidth(col && col.width);
        colgroup += w ? `<col style="width:${w}">` : `<col>`;
      }
      colgroup += '</colgroup>';
    }

    let card_content = `<table${anyWidths ? ' class="has-widths"' : ''}>${colgroup}<thead><tr>`;

    if (!columns) {
      // Infer columns from first row
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
        card_content += `<th class="${cls}"${w ? ` style="width:${w}"` : ''}>${String(col.title ?? col.field)}</th>`; // HTML allowed in titles
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
          card_content += `<td class="${cls}"${w ? ` style="width:${w}"` : ''}>`;

          // Link wrapper if requested
          const wrapLink = !!col.add_link;
          if (wrapLink) {
            const href = row[col.add_link];
            card_content += `<a href="${encodeURI(String(href))}" target="_blank" rel="noreferrer noopener">`;
          }

          if (col.type === 'image') {
            const imageWidth = Number(col.width) || 70;
            const imageHeight = Number(col.height) || 90;
            const data = row[col.field];
            const url = Array.isArray(data) && data[0] && data[0].url ? data[0].url : data;
            card_content += `<img src="${encodeURI(String(url))}" width="${imageWidth}" height="${imageHeight}" alt="" />`;
          } else if (col.type === 'icon') {
            const icon = row[col.field];
            card_content += `<ha-icon class="column-${cls}" icon="${escapeHtml(String(icon))}"></ha-icon>`;
          } else {
            // text (raw to preserve HTML as before)
            let text = row[col.field];
            if (col.regex) {
              const match = new RegExp(col.regex, 'u').exec(String(row[col.field] ?? ''));
              if (match) text = match[0];
            }
            if (col.prefix) text = `${col.prefix}${text ?? ''}`;
            if (col.postfix) text = `${text ?? ''}${col.postfix}`;
            card_content += String(text ?? '');
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

  getCardSize() {
    return 1;
  }
}

customElements.define('list-card', ListCard);

// ---------------------------
// Visual Editor
// ---------------------------
class ListCardEditor extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
    this._debounce = null;
  }

  setConfig(config) {
    const prevLen = (this._config && Array.isArray(this._config.columns)) ? this._config.columns.length : undefined;
    const nextLen = (config && Array.isArray(config.columns)) ? config.columns.length : undefined;
    this._config = { ...config };
    // Normalize legacy object-shaped columns to array
    if (this._config && this._config.columns && !Array.isArray(this._config.columns)) {
      this._config = { ...this._config, columns: Object.values(this._config.columns) };
    }
    if (!this._initialized || prevLen !== nextLen) {
      this._initialized = true;
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._entityPicker) this._entityPicker.hass = hass;
  }

  _emitConfig() {
    // Debounce to avoid HA recreating the editor on every keystroke
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      fireEvent(this, 'config-changed', { config: this._config });
    }, 150);
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
    `;

    const wrap = document.createElement('div');

    // Top-level fields (pure HA components with labels)
    const r1 = document.createElement('div');
    r1.className = 'row';

    const entityPicker = document.createElement('ha-entity-picker');
    entityPicker.hass = this._hass;
    entityPicker.value = this._config?.entity || '';
    entityPicker.setAttribute('label','Entity');
    entityPicker.addEventListener('value-changed', (e) => this._update('entity', (e.detail && e.detail.value) ?? e.target.value));
    entityPicker.addEventListener('change', (e) => this._update('entity', e.target.value));

    const titleInput = document.createElement('ha-textfield');
    titleInput.label = 'Title (HTML supported)';
    titleInput.value = this._config?.title || '';
    titleInput.addEventListener('value-changed', (e) => this._update('title', (e.detail && e.detail.value) ?? e.target.value));
    titleInput.addEventListener('input', (e) => this._update('title', e.target.value));

    r1.appendChild(entityPicker);
    r1.appendChild(titleInput);
    this._entityPicker = entityPicker;

    const r2 = document.createElement('div');
    r2.className = 'row';

    const feedInput = document.createElement('ha-textfield');
    feedInput.label = 'Feed attribute (optional)';
    feedInput.placeholder = 'e.g. items';
    feedInput.value = this._config?.feed_attribute || '';
    feedInput.addEventListener('value-changed', (e) => this._update('feed_attribute', (e.detail && e.detail.value) ?? e.target.value));
    feedInput.addEventListener('input', (e) => this._update('feed_attribute', e.target.value));

    const limitInput = document.createElement('ha-textfield');
    limitInput.label = 'Row limit (optional)';
    limitInput.type = 'number';
    limitInput.value = this._config?.row_limit ?? '';
    limitInput.addEventListener('value-changed', (e) => this._update('row_limit', e.detail && e.detail.value ? Number(e.detail.value) : undefined));
    limitInput.addEventListener('input', (e) => this._update('row_limit', e.target.value ? Number(e.target.value) : undefined));

    r2.appendChild(feedInput);
    r2.appendChild(limitInput);

    // Columns editor
    const colsBox = document.createElement('div');
    colsBox.className = 'columns';
    const colsTitle = document.createElement('div');
    colsTitle.innerHTML = `<strong>Columns</strong>`;
    colsBox.appendChild(colsTitle);

    const cols = Array.isArray(this._config?.columns) ? this._config.columns : [];

    const list = document.createElement('div');
    cols.forEach((col, idx) => list.appendChild(this._renderColumn(col, idx)));
    colsBox.appendChild(list);

    const addBtn = document.createElement('mwc-button');
    addBtn.raised = true;
    addBtn.label = 'Add column';
    addBtn.addEventListener('click', () => {
      const colsNow = Array.isArray(this._config?.columns) ? [...this._config.columns] : [];
      colsNow.push({ field: '', title: '', type: 'text', width: '', prefix: '', postfix: '' });
      this._update('columns', colsNow);
      this._render();
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
    const fInput = document.createElement('ha-textfield');
    fInput.label = 'Field';
    fInput.value = col.field || '';
    fInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { field: (e.detail && e.detail.value) ?? e.target.value }));
    fInput.addEventListener('input', (e) => this._updateArray('columns', idx, { field: e.target.value }));

    // title
    const tInput = document.createElement('ha-textfield');
    tInput.label = 'Title';
    tInput.value = col.title || '';
    tInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { title: (e.detail && e.detail.value) ?? e.target.value }));
    tInput.addEventListener('input', (e) => this._updateArray('columns', idx, { title: e.target.value }));

    // type
    const yWrap = document.createElement('div');
    const ySel = document.createElement('ha-select');
    ySel.label = 'Type';
    ['text', 'image', 'icon'].forEach((opt) => {
      const o = document.createElement('mwc-list-item');
      o.value = opt; o.textContent = opt; if ((col.type || 'text') === opt) o.selected = true; ySel.appendChild(o);
    });
    ySel.addEventListener('selected', () => this._updateArray('columns', idx, { type: ySel.value }));
    ySel.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { type: (e.detail && e.detail.value) ?? ySel.value }));
    yWrap.appendChild(ySel);

    row1.appendChild(fInput);
    row1.appendChild(tInput);
    row1.appendChild(yWrap);

    const row2 = document.createElement('div');
    row2.className = 'row3';

    // width
    const wInput = document.createElement('ha-textfield');
    wInput.label = 'Width';
    wInput.placeholder = 'e.g. 120px or 25%';
    wInput.value = col.width || '';
    wInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { width: (e.detail && e.detail.value) ?? e.target.value }));
    wInput.addEventListener('input', (e) => this._updateArray('columns', idx, { width: e.target.value }));

    // link
    const lInput = document.createElement('ha-textfield');
    lInput.label = 'Link (field name for href)';
    lInput.placeholder = 'e.g. url';
    lInput.value = col.add_link || '';
    lInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { add_link: (e.detail && e.detail.value) ?? e.target.value }));
    lInput.addEventListener('input', (e) => this._updateArray('columns', idx, { add_link: e.target.value }));

    // regex
    const rInput = document.createElement('ha-textfield');
    rInput.label = 'Regex (optional)';
    rInput.placeholder = '\d+';
    rInput.value = col.regex || '';
    rInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { regex: (e.detail && e.detail.value) ?? e.target.value }));
    rInput.addEventListener('input', (e) => this._updateArray('columns', idx, { regex: e.target.value }));

    row2.appendChild(wInput);
    row2.appendChild(lInput);
    row2.appendChild(rInput);

    const row3 = document.createElement('div');
    row3.className = 'row3';

    // prefix
    const pInput = document.createElement('ha-textfield');
    pInput.label = 'Prefix';
    pInput.value = col.prefix || '';
    pInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { prefix: (e.detail && e.detail.value) ?? e.target.value }));
    pInput.addEventListener('input', (e) => this._updateArray('columns', idx, { prefix: e.target.value }));

    // postfix
    const sInput = document.createElement('ha-textfield');
    sInput.label = 'Postfix';
    sInput.value = col.postfix || '';
    sInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { postfix: (e.detail && e.detail.value) ?? e.target.value }));
    sInput.addEventListener('input', (e) => this._updateArray('columns', idx, { postfix: e.target.value }));

    // image height (only relevant for image type)
    const hInput = document.createElement('ha-textfield');
    hInput.label = 'Image height (px)';
    hInput.type = 'number';
    hInput.value = col.height || '';
    hInput.addEventListener('value-changed', (e) => this._updateArray('columns', idx, { height: e.detail && e.detail.value ? Number(e.detail.value) : undefined }));
    hInput.addEventListener('input', (e) => this._updateArray('columns', idx, { height: e.target.value ? Number(e.target.value) : undefined }));

    row3.appendChild(pInput);
    row3.appendChild(sInput);
    row3.appendChild(hInput);

    const controls = document.createElement('div');
    const del = document.createElement('mwc-button');
    del.label = 'Delete column';
    del.addEventListener('click', () => {
      const next = (Array.isArray(this._config.columns) ? this._config.columns : []).filter((_, i) => i !== idx);
      this._update('columns', next);
      this._render();
    });
    controls.appendChild(del);

    item.appendChild(row1);
    item.appendChild(row2);
    item.appendChild(row3);
    item.appendChild(controls);
    return item;
  }

  _update(key, value) {
    this._config = { ...this._config, [key]: value };
    this._emitConfig();
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Card Description (for More Info → Custom Cards list)
function sanitizeHTML(input) {
  const template = document.createElement('template');
  template.innerHTML = String(input ?? '');
  const allowedTags = new Set(['A','B','I','STRONG','EM','SPAN','BR','UL','OL','LI','DIV','P','H1','H2','H3','H4','H5','H6','HR','FONT']);
  const allowedAttrs = {
    'A': new Set(['href','target','rel','title']),
    'SPAN': new Set(['class','title']),
    'FONT': new Set(['color'])
  };
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowedTags.has(el.tagName)) { toRemove.push(el); continue; }
    [...el.attributes].forEach(attr => {
      const tag = el.tagName;
      const ok = allowedAttrs[tag] && allowedAttrs[tag].has(attr.name.toLowerCase());
      if (!ok) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      const safe = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:');
      if (!safe) el.removeAttribute('href');
      el.setAttribute('rel','noreferrer noopener');
      if (!el.getAttribute('target')) el.setAttribute('target','_blank');
    }
  }
  toRemove.forEach(n => n.replaceWith(document.createTextNode(n.textContent || '')));
  return template.innerHTML;
}

function fireEvent(node, type, detail, options) {
  const ev = new CustomEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: false,
    ...(options || {}),
    detail,
  });
  node.dispatchEvent(ev);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'list-card',
  name: 'List Card',
  preview: false,
  description: 'Table from a sensor that provides list attributes. Now with visual editor, selectable text, and per-column width.'
});
