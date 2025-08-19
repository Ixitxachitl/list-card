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
      ha-card {
        /* place to theme */
      }
      table {
        width: 100%;
        border-collapse: collapse;
        padding: 0 16px 16px 16px;
      }
      table.has-widths {
        table-layout: fixed; /* ensures widths are respected */
      }
      thead th {
        text-align: left;
        font-weight: 600;
        padding: 8px 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      tbody td {
        padding: 8px 8px;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      tbody tr:nth-child(odd) {
        background-color: var(--paper-card-background-color);
      }
      tbody tr:nth-child(even) {
        background-color: var(--secondary-background-color);
      }
      .button { overflow: auto; padding: 16px; }
      paper-button { float: right; }
      td a {
        color: var(--primary-text-color);
        text-decoration: none;
        font-weight: normal;
        cursor: pointer; /* keep links clickable even though text is selectable */
      }
    `;

    // Include per-column CSS from config.columns[*].style (back-compat)
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
    const root = this.shadowRoot;
    const card = root.lastChild;
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
        if (w) colgroup += `<col style="width:${w}">`;
        else colgroup += `<col>`;
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
        card_content += `<th class="${cls}"${w ? ` style="width:${w}"` : ''}>${escapeHtml(col.title ?? col.field)}</th>`;
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
            // text
            let text = row[col.field];
            if (col.regex) {
              const match = new RegExp(col.regex, 'u').exec(String(row[col.field] ?? ''));
              if (match) text = match[0];
            }
            if (col.prefix) text = `${col.prefix}${text ?? ''}`;
            if (col.postfix) text = `${text ?? ''}${col.postfix}`;
            card_content += `${escapeHtml(String(text ?? ''))}`;
          }

          if (wrapLink) card_content += `</a>`;

          card_content += `</td>`;
        }
      }
      card_content += `</tr>`;
      rows++;
    }

    card_content += `</tbody></table>`;
    card.hass = hass; // keep for consistency
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
  setConfig(config) {
    this._config = { ...config };
    this._render();
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
      input, select { width: 100%; box-sizing: border-box; }
      button { margin-top: 8px; }
    `;

    const wrap = document.createElement('div');

    // Top-level fields
    const r1 = document.createElement('div');
    r1.className = 'row';

    const entityWrap = document.createElement('div');
    entityWrap.innerHTML = `<label>Entity</label>`;
    const entityPicker = document.createElement('ha-entity-picker');
    entityPicker.value = this._config.entity || '';
    entityPicker.addEventListener('value-changed', (e) => this._update('entity', e.detail.value));
    entityWrap.appendChild(entityPicker);
    this._entityPicker = entityPicker;

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<label>Title</label>`;
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = this._config.title || '';
    titleInput.addEventListener('input', (e) => this._update('title', e.target.value));
    titleWrap.appendChild(titleInput);

    r1.appendChild(entityWrap);
    r1.appendChild(titleWrap);

    const r2 = document.createElement('div');
    r2.className = 'row';

    const feedWrap = document.createElement('div');
    feedWrap.innerHTML = `<label>Feed attribute (optional)</label>`;
    const feedInput = document.createElement('input');
    feedInput.type = 'text';
    feedInput.placeholder = 'e.g. items';
    feedInput.value = this._config.feed_attribute || '';
    feedInput.addEventListener('input', (e) => this._update('feed_attribute', e.target.value));
    feedWrap.appendChild(feedInput);

    const limitWrap = document.createElement('div');
    limitWrap.innerHTML = `<label>Row limit (optional)</label>`;
    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.min = '1';
    limitInput.value = this._config.row_limit || '';
    limitInput.addEventListener('input', (e) => this._update('row_limit', e.target.value ? Number(e.target.value) : undefined));
    limitWrap.appendChild(limitInput);

    r2.appendChild(feedWrap);
    r2.appendChild(limitWrap);

    // Columns editor
    const colsBox = document.createElement('div');
    colsBox.className = 'columns';
    const colsTitle = document.createElement('div');
    colsTitle.innerHTML = `<strong>Columns</strong>`;
    colsBox.appendChild(colsTitle);

    const cols = Array.isArray(this._config.columns) ? this._config.columns : [];

    const list = document.createElement('div');
    cols.forEach((col, idx) => list.appendChild(this._renderColumn(col, idx)));
    colsBox.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add column';
    addBtn.addEventListener('click', () => {
      const next = [
        ...cols,
        { field: '', title: '', type: 'text', width: '', prefix: '', postfix: '' },
      ];
      this._update('columns', next);
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
    const fWrap = document.createElement('div');
    fWrap.innerHTML = `<label>Field</label>`;
    const fInput = document.createElement('input');
    fInput.type = 'text';
    fInput.value = col.field || '';
    fInput.addEventListener('input', (e) => this._updateArray('columns', idx, { field: e.target.value }));
    fWrap.appendChild(fInput);

    // title
    const tWrap = document.createElement('div');
    tWrap.innerHTML = `<label>Title</label>`;
    const tInput = document.createElement('input');
    tInput.type = 'text';
    tInput.value = col.title || '';
    tInput.addEventListener('input', (e) => this._updateArray('columns', idx, { title: e.target.value }));
    tWrap.appendChild(tInput);

    // type
    const yWrap = document.createElement('div');
    yWrap.innerHTML = `<label>Type</label>`;
    const ySel = document.createElement('select');
    ['text', 'image', 'icon'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt; if ((col.type || 'text') === opt) o.selected = true; ySel.appendChild(o);
    });
    ySel.addEventListener('change', (e) => this._updateArray('columns', idx, { type: e.target.value }));
    yWrap.appendChild(ySel);

    row1.appendChild(fWrap);
    row1.appendChild(tWrap);
    row1.appendChild(yWrap);

    const row2 = document.createElement('div');
    row2.className = 'row3';

    // width
    const wWrap = document.createElement('div');
    wWrap.innerHTML = `<label>Width</label>`;
    const wInput = document.createElement('input');
    wInput.type = 'text';
    wInput.placeholder = 'e.g. 120px or 25%';
    wInput.value = col.width || '';
    wInput.addEventListener('input', (e) => this._updateArray('columns', idx, { width: e.target.value }));
    wWrap.appendChild(wInput);

    // link
    const lWrap = document.createElement('div');
    lWrap.innerHTML = `<label>Link (field name for href)</label>`;
    const lInput = document.createElement('input');
    lInput.type = 'text';
    lInput.placeholder = 'e.g. url';
    lInput.value = col.add_link || '';
    lInput.addEventListener('input', (e) => this._updateArray('columns', idx, { add_link: e.target.value }));
    lWrap.appendChild(lInput);

    // regex
    const rWrap = document.createElement('div');
    rWrap.innerHTML = `<label>Regex (optional)</label>`;
    const rInput = document.createElement('input');
    rInput.type = 'text';
    rInput.placeholder = 'e.g. \\d+';
    rInput.value = col.regex || '';
    rInput.addEventListener('input', (e) => this._updateArray('columns', idx, { regex: e.target.value }));
    rWrap.appendChild(rInput);

    row2.appendChild(wWrap);
    row2.appendChild(lWrap);
    row2.appendChild(rWrap);

    const row3 = document.createElement('div');
    row3.className = 'row3';

    // prefix
    const pWrap = document.createElement('div');
    pWrap.innerHTML = `<label>Prefix</label>`;
    const pInput = document.createElement('input');
    pInput.type = 'text';
    pInput.value = col.prefix || '';
    pInput.addEventListener('input', (e) => this._updateArray('columns', idx, { prefix: e.target.value }));
    pWrap.appendChild(pInput);

    // postfix
    const sWrap = document.createElement('div');
    sWrap.innerHTML = `<label>Postfix</label>`;
    const sInput = document.createElement('input');
    sInput.type = 'text';
    sInput.value = col.postfix || '';
    sInput.addEventListener('input', (e) => this._updateArray('columns', idx, { postfix: e.target.value }));
    sWrap.appendChild(sInput);

    // image height (only relevant for image type)
    const hWrap = document.createElement('div');
    hWrap.innerHTML = `<label>Image height (px)</label>`;
    const hInput = document.createElement('input');
    hInput.type = 'number';
    hInput.min = '1';
    hInput.value = col.height || '';
    hInput.addEventListener('input', (e) => this._updateArray('columns', idx, { height: e.target.value ? Number(e.target.value) : undefined }));
    hWrap.appendChild(hInput);

    row3.appendChild(pWrap);
    row3.appendChild(sWrap);
    row3.appendChild(hWrap);

    const controls = document.createElement('div');
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete column';
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
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
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
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'list-card',
  name: 'List Card',
  preview: false,
  description: 'Table from a sensor that provides list attributes. Now with visual editor, selectable text, and per-column width.'
});
