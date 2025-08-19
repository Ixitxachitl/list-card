console.log(`%clist-card\n%cVersion: ${'0.2.0'}`, 'color: rebeccapurple; font-weight: bold;', '');

class ListCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error('Please define an entity');

    const root = this.shadowRoot;
    root.innerHTML = '';

    const cardConfig = { ...config };
    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    content.id = 'container';

    const style = document.createElement('style');
    style.textContent = `
      :host, ha-card, table, th, td, a, img, div { -webkit-user-select: text; user-select: text; }
      ha-card { }
      .title-html { padding: 16px 16px 0; }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
        padding: 0 16px 16px 16px;
      }
      thead th { text-align: left; }
      tbody tr:nth-child(odd)  { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td a {
        color: var(--primary-text-color);
        text-decoration: none;
        font-weight: normal;
      }
    `;

    // optional rich title (HTML)
    if (cardConfig.title_html) {
      const t = document.createElement('div');
      t.className = 'title-html';
      t.innerHTML = cardConfig.title || '';
      card.appendChild(t);
    } else if (cardConfig.title) {
      card.header = cardConfig.title; // plain header text
    }

    card.appendChild(content);
    card.appendChild(style);
    root.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    this._hass = hass;
    const config = this._config;
    if (!config || !config.entity || !hass?.states?.[config.entity]) {
      this.style.display = 'none';
      return;
    }

    const root = this.shadowRoot;
    const content = root.getElementById('container');
    const stateObj = hass.states[config.entity];

    // Determine feed (array of row objects)
    const feed = config.feed_attribute
      ? stateObj.attributes?.[config.feed_attribute]
      : stateObj.attributes?.['feed'] ?? stateObj.attributes;

    const rowsArr = Array.isArray(feed) ? feed : [];
    if (!rowsArr.length) {
      this.style.display = 'none';
      return;
    }

    this.style.display = 'block';
    const columns = Array.isArray(config.columns) ? config.columns : null;
    const rowLimit = Number.isFinite(config.row_limit) ? config.row_limit : rowsArr.length;

    // Build table HTML (preserve raw HTML in values)
    let html = '<table>';

    // <colgroup> to help widths when provided
    if (columns) {
      html += '<colgroup>';
      for (const col of columns) {
        const width = (col?.col_width ?? '').toString().trim();
        html += width ? `<col style="width:${width}">` : '<col>';
      }
      html += '</colgroup>';
    }

    html += '<thead><tr>';
    if (!columns) {
      const keys = Object.keys(rowsArr[0] || {});
      for (const key of keys) html += `<th>${key}</th>`;
    } else {
      for (const col of columns) {
        const title = (col?.title ?? col?.field ?? '').toString();
        const cls = (col?.field ?? '').toString().trim().replace(/[^\w-]/g, '_');
        html += `<th class="col-${cls}" data-field="${col.field ?? ''}">${title}</th>`; // allow HTML-ish titles if you pass title_html + put title as header? keep plain here
      }
    }
    html += '</tr></thead><tbody>';

    let rendered = 0;
    for (const entry of rowsArr) {
      if (rendered >= rowLimit) break;
      if (typeof entry !== 'object' || entry == null) continue;

      html += '<tr>';

      if (!columns) {
        for (const key of Object.keys(entry)) {
          html += `<td>${this._renderValue(entry[key])}</td>`;
        }
      } else {
        // Ensure all required fields exist
        if (!columns.every(c => Object.prototype.hasOwnProperty.call(entry, c.field))) {
          continue;
        }

        for (const col of columns) {
          const field = col.field;
          const cls = String(field || '').trim().replace(/[^\w-]/g, '_');
          const addLinkField = col.add_link;
          const linkHref = addLinkField ? (entry[addLinkField] ?? '') : '';
          const openLink = linkHref ? `<a href="${linkHref}" target="_blank" rel="noopener noreferrer">` : '';
          const closeLink = linkHref ? '</a>' : '';

          html += `<td class="col-${cls} ${field || ''}" data-field="${field || ''}">`;

          if (col.type === 'image') {
            const imgW = Number.isFinite(col.width) ? col.width : 70;
            const imgH = Number.isFinite(col.height) ? col.height : 90;
            const val = entry[field];
            const url = (Array.isArray(val) && val[0]?.url) ? val[0].url : val;
            html += `${openLink}<img src="${url}" width="${imgW}" height="${imgH}" />${closeLink}`;
          } else if (col.type === 'icon') {
            const icon = entry[field];
            html += `<ha-icon class="column-${field || ''}" icon="${icon}"></ha-icon>`;
          } else {
            // TEXT/HTML: preserve raw HTML (no escaping) to match original behavior
            html += `${openLink}${this._renderValue(entry[field], /*allowHTML*/ true)}${closeLink}`;
          }

          html += '</td>';
        }
      }

      html += '</tr>';
      rendered++;
    }

    html += '</tbody></table>';
    content.innerHTML = html;
  }

  getCardSize() {
    return 1;
  }

  _renderValue(v, allowHTML = false) {
    if (v == null) return '';
    if (allowHTML) return typeof v === 'string' ? v : JSON.stringify(v);
    // default path (not used for configured columns): keep compatibility with original (raw)
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
}

customElements.define('list-card', ListCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'list-card',
  name: 'List Card',
  preview: false,
  description: 'Generate a table from a sensor that provides a list of attributes.',
});

/* ------------------------------
   Visual Editor (simplified)
   ------------------------------ */

ListCard.getConfigElement = function () {
  return document.createElement('list-card-editor');
};
ListCard.getStubConfig = function () {
  return {
    entity: '',
    title: '',
    title_html: false, // set true to allow HTML title rendered inside card body
    row_limit: 5,
    // columns: [{ field, title, type, add_link, width, height, col_width }]
  };
};

function lc_fireConfigChanged(el, config) {
  el.dispatchEvent(new CustomEvent('config-changed', {
    detail: { config },
    bubbles: true,
    composed: true,
  }));
}

class ListCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    const picker = this.shadowRoot && this.shadowRoot.querySelector('#entity');
    if (picker && 'hass' in picker) picker.hass = hass;
    this._refreshEntityFallbackOptions();
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    this._render();
  }

  get value() {
    return this._config;
  }

  _render() {
    const root = this.shadowRoot;
    if (!this._built) {
      root.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; }
        .form { padding: 12px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .row.single { grid-template-columns: 1fr; }
        fieldset { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px; padding: 12px; margin: 0 0 12px 0; }
        legend { padding: 0 6px; font-weight: 600; color: var(--secondary-text-color); }
        .cols { margin-top: 8px; }
        .col-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        button { cursor: pointer; }
        input[type="text"], input[type="number"], select, textarea {
          width: 100%; box-sizing: border-box; padding: 8px;
          border: 1px solid var(--divider-color, #ccc); border-radius: 6px; background: var(--card-background-color);
          color: var(--primary-text-color);
        }
      `;

      const form = document.createElement('div');
      form.className = 'form';

      // Row 1: entity + title
      const row1 = document.createElement('div');
      row1.className = 'row';
      const entityWrap = document.createElement('div');
      const titleWrap = document.createElement('div');

      // Prefer HA entity picker
      let entityInput;
      if (customElements.get('ha-entity-picker')) {
        entityInput = document.createElement('ha-entity-picker');
        entityInput.label = 'Entity';
        entityInput.id = 'entity';
        entityInput.allowCustomEntity = true;
        entityInput.value = this._config.entity || '';
        if (this._hass) entityInput.hass = this._hass;
        entityInput.addEventListener('value-changed', (e) => {
          this._config.entity = e.detail.value || '';
          lc_fireConfigChanged(this, this._config);
        });
      } else {
        // Fallback populated select from hass.states
        entityInput = document.createElement('select');
        entityInput.id = 'entity-fallback';
        entityInput.addEventListener('change', (e) => {
          this._config.entity = e.target.value || '';
          lc_fireConfigChanged(this, this._config);
        });
      }
      entityWrap.append(entityInput);

      // title (string; when title_html=true it's treated as HTML inside card)
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'Title (text or HTML when "title_html" is on)';
      titleInput.value = this._config.title || '';
      titleInput.addEventListener('input', (e) => {
        const v = e.target.value;
        if (v) this._config.title = v; else delete this._config.title;
        lc_fireConfigChanged(this, this._config);
      });
      titleWrap.append(titleInput);
      row1.append(entityWrap, titleWrap);

      // Row 2: title_html toggle + row_limit
      const row2 = document.createElement('div');
      row2.className = 'row';

      const titleHtmlWrap = document.createElement('div');
      const titleHtmlLabel = document.createElement('label');
      const titleHtmlChk = document.createElement('input');
      titleHtmlChk.type = 'checkbox';
      titleHtmlChk.checked = !!this._config.title_html;
      titleHtmlChk.addEventListener('change', (e) => {
        this._config.title_html = !!e.target.checked;
        lc_fireConfigChanged(this, this._config);
      });
      titleHtmlLabel.append(titleHtmlChk, document.createTextNode(' Render title as HTML in card body'));
      titleHtmlWrap.append(titleHtmlLabel);

      const limitWrap = document.createElement('div');
      const limitInput = document.createElement('input');
      limitInput.type = 'number';
      limitInput.min = '1';
      limitInput.placeholder = 'row_limit (optional)';
      limitInput.value = (this._config.row_limit != null ? this._config.row_limit : '');
      limitInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val === '' || isNaN(Number(val))) {
          delete this._config.row_limit;
        } else {
          this._config.row_limit = Number(val);
        }
        lc_fireConfigChanged(this, this._config);
      });
      limitWrap.append(limitInput);

      row2.append(titleHtmlWrap, limitWrap);

      // Row 3: feed_attribute
      const row3 = document.createElement('div');
      row3.className = 'row single';
      const feedInput = document.createElement('input');
      feedInput.type = 'text';
      feedInput.placeholder = 'feed_attribute (optional)';
      feedInput.value = this._config.feed_attribute || '';
      feedInput.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (v) this._config.feed_attribute = v; else delete this._config.feed_attribute;
        lc_fireConfigChanged(this, this._config);
      });
      row3.append(feedInput);

      // Columns editor (minimal)
      const colsFs = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Columns';
      colsFs.append(legend);

      const colsHead = document.createElement('div');
      colsHead.className = 'col-head';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = 'Add column';
      addBtn.addEventListener('click', () => {
        if (!Array.isArray(this._config.columns)) this._config.columns = [];
        this._config.columns.push({ field: '', title: '' });
        lc_fireConfigChanged(this, this._config);
        this._rebuildColumns(colsWrap);
      });
      colsHead.append(addBtn);
      colsFs.append(colsHead);

      const colsWrap = document.createElement('div');
      colsWrap.className = 'cols';
      colsFs.append(colsWrap);

      form.append(row1, row2, row3, colsFs);
      root.append(style, form);

      this._built = true;
    }

    // sync entity value if present
    const entity = this.shadowRoot.querySelector('#entity');
    if (entity && !entity.value) entity.value = this._config.entity || '';

    this._rebuildColumns(this.shadowRoot.querySelector('.cols'));
    this._refreshEntityFallbackOptions();
  }

  _rebuildColumns(container) {
    if (!container) return;
    container.innerHTML = '';

    const cols = Array.isArray(this._config.columns) ? this._config.columns : [];

    cols.forEach((col, idx) => {
      const fs = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = `Column ${idx + 1}`;
      fs.append(legend);

      // field / title
      const r1 = document.createElement('div');
      r1.className = 'row';
      const fieldInput = document.createElement('input');
      fieldInput.type = 'text';
      fieldInput.placeholder = 'field (attribute name)';
      fieldInput.value = col.field || '';
      fieldInput.addEventListener('input', (e) => {
        cols[idx].field = e.target.value;
        lc_fireConfigChanged(this, this._config);
      });

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'title (header text or HTML)';
      titleInput.value = col.title || '';
      titleInput.addEventListener('input', (e) => {
        cols[idx].title = e.target.value;
        lc_fireConfigChanged(this, this._config);
      });
      r1.append(fieldInput, titleInput);

      // type / add_link
      const r2 = document.createElement('div');
      r2.className = 'row';
      const typeSelect = document.createElement('select');
      ['', 'image', 'icon'].forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t === '' ? 'type (optional)' : t;
        if ((col.type || '') === t) opt.selected = true;
        typeSelect.append(opt);
      });
      typeSelect.addEventListener('change', (e) => {
        const v = e.target.value;
        if (v) cols[idx].type = v; else delete cols[idx].type;
        lc_fireConfigChanged(this, this._config);
        this._rebuildColumns(container);
      });

      const linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.placeholder = 'add_link (URL field, optional)';
      linkInput.value = col.add_link || '';
      linkInput.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (v) cols[idx].add_link = v; else delete cols[idx].add_link;
        lc_fireConfigChanged(this, this._config);
      });
      r2.append(typeSelect, linkInput);

      // image width/height (only for type=image)
      const r3 = document.createElement('div');
      r3.className = 'row';
      if ((col.type || '') === 'image') {
        const w = document.createElement('input');
        w.type = 'number';
        w.placeholder = 'image width (default 70)';
        w.value = (col.width != null ? col.width : '');
        w.addEventListener('input', (e) => {
          const val = e.target.value;
          if (val === '' || isNaN(Number(val))) delete cols[idx].width;
          else cols[idx].width = Number(val);
          lc_fireConfigChanged(this, this._config);
        });

        const h = document.createElement('input');
        h.type = 'number';
        h.placeholder = 'image height (default 90)';
        h.value = (col.height != null ? col.height : '');
        h.addEventListener('input', (e) => {
          const val = e.target.value;
          if (val === '' || isNaN(Number(val))) delete cols[idx].height;
          else cols[idx].height = Number(val);
          lc_fireConfigChanged(this, this._config);
        });
        r3.append(w, h);
      }

      // column width
      const r4 = document.createElement('div');
      r4.className = 'row single';
      const widthInput = document.createElement('input');
      widthInput.type = 'text';
      widthInput.placeholder = 'col_width (e.g., 120px or 25%)';
      widthInput.value = col.col_width || '';
      widthInput.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (v) cols[idx].col_width = v; else delete cols[idx].col_width;
        lc_fireConfigChanged(this, this._config);
      });
      r4.append(widthInput);

      // actions
      const actions = document.createElement('div');
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove column';
      removeBtn.addEventListener('click', () => {
        cols.splice(idx, 1);
        lc_fireConfigChanged(this, this._config);
        this._rebuildColumns(container);
      });
      actions.append(removeBtn);

      fs.append(r1, r2, r3, r4, actions);
      container.append(fs);
    });
  }

  _refreshEntityFallbackOptions() {
    const sel = this.shadowRoot && this.shadowRoot.querySelector('#entity-fallback');
    if (!sel) return;
    const current = this._config.entity || '';
    sel.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select entity…';
    sel.append(placeholder);

    if (this._hass?.states) {
      const byDomain = {};
      for (const eid of Object.keys(this._hass.states)) {
        const domain = eid.split('.', 1)[0] || 'other';
        (byDomain[domain] ||= []).push(eid);
      }
      Object.keys(byDomain).sort().forEach(domain => {
        const group = document.createElement('optgroup');
        group.label = domain;
        byDomain[domain].sort().forEach(eid => {
          const opt = document.createElement('option');
          opt.value = eid;
          const name = this._hass.states[eid]?.attributes?.friendly_name || eid;
          opt.textContent = name;
          if (eid === current) opt.selected = true;
          group.append(opt);
        });
        sel.append(group);
      });
    }
    if (!current) sel.value = '';
  }
}

customElements.define('list-card-editor', ListCardEditor);
