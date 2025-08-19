console.log(`%clist-card\n%cVersion: ${'0.3.6'}`, 'color: rebeccapurple; font-weight: bold;', '');

/* =========================
   List Card (runtime)
   ========================= */
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

    // Title: plain text -> native header; otherwise (contains HTML tags) render safely inside card
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

    // Reduce gesture conflicts so text selection behaves
    const stop = (e) => e.stopPropagation();
    content.addEventListener('mousedown', stop);
    content.addEventListener('mouseup', stop);
    content.addEventListener('touchstart', stop, { passive: true });
    content.addEventListener('touchmove', stop, { passive: true });
    content.addEventListener('touchend', stop, { passive: true });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        user-select: text !important;
        -webkit-user-select: text !important;
        -webkit-touch-callout: default;
        touch-action: auto;
      }
      .selectable, .selectable * {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      a, img { -webkit-user-drag: none; user-drag: none; }
      .title-html { padding: 16px 16px 0 16px; }
      table {
        width: 100%;
        padding: 0 16px 16px 16px; /* original spacing */
      }
      thead th { text-align: left; }
      tbody tr:nth-child(odd)  { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td, th { cursor: text; }
      td a {
        color: var(--primary-text-color);
        text-decoration: none;
        font-weight: normal;
        cursor: pointer;
      }
    `;

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

    let html = '<table>';

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
        // Allow HTML in headers (original behavior of injecting strings)
        html += `<th class="col-${cls}" data-field="${col.field ?? ''}">${title}</th>`;
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
          html += `<td>${this._raw(entry[key])}</td>`;
        }
      } else {
        if (!columns.every(c => Object.prototype.hasOwnProperty.call(entry, c.field))) {
          continue;
        }

        for (const col of columns) {
          const field = col.field;
          const cls = String(field || '').trim().replace(/[^\w-]/g, '_');
          const addLinkField = col.add_link;
          const linkHref = addLinkField ? (entry[addLinkField] ?? '') : '';
          const openLink = linkHref ? `<a href="${linkHref}" draggable="false" target="_blank" rel="noopener noreferrer">` : '';
          const closeLink = linkHref ? '</a>' : '';

          html += `<td class="col-${cls} ${field || ''}" data-field="${field || ''}">`;

          if (col.type === 'image') {
            const imgW = Number.isFinite(col.width) ? col.width : 70;
            const imgH = Number.isFinite(col.height) ? col.height : 90;
            const val = entry[field];
            const url = (Array.isArray(val) && val[0]?.url) ? val[0].url : val;
            html += `${openLink}<img src="${url}" draggable="false" width="${imgW}" height="${imgH}" />${closeLink}`;
          } else if (col.type === 'icon') {
            const icon = entry[field];
            html += `<ha-icon class="column-${field || ''}" icon="${icon}"></ha-icon>`;
          } else {
            // preserve raw HTML in cells
            html += `${openLink}${this._raw(entry[field])}${closeLink}`;
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

/* =========================
   Visual Editor (HA-native)
   ========================= */

ListCard.getConfigElement = function () { return document.createElement('list-card-editor'); };
ListCard.getStubConfig = function () { return { entity: '', title: '', row_limit: 5 }; };

function lc_fireConfigChanged(el, config) {
  el.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
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

  setConfig(config) { this._config = JSON.parse(JSON.stringify(config || {})); this._render(); }
  get value() { return this._config; }

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
        ha-textfield, ha-select { width: 100%; }
        input, select {
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

      // Prefer HA entity picker; fallback to native <select>
      let entityInput;
      if (customElements.get('ha-entity-picker')) {
        entityInput = document.createElement('ha-entity-picker');
        entityInput.label = 'Entity';
        entityInput.id = 'entity';
        entityInput.allowCustomEntity = true;
        entityInput.value = this._config.entity || '';
        if (this._hass) entityInput.hass = this._hass;
        entityInput.addEventListener('value-changed', (e) => {
          const next = e.detail.value || '';
          if ((this._config.entity || '') === next) return;
          this._config.entity = next;
          lc_fireConfigChanged(this, this._config);
        });
      } else {
        entityInput = document.createElement('select');
        entityInput.id = 'entity-fallback';
        entityInput.addEventListener('change', (e) => {
          const next = e.target.value || '';
          if ((this._config.entity || '') === next) return;
          this._config.entity = next;
          lc_fireConfigChanged(this, this._config);
        });
      }
      entityWrap.append(entityInput);

      // Title (supports HTML at runtime; here we just edit as text)
      const titleInput = this._mkTextfield('Title (text or HTML)', this._config.title || '', (val) => {
        const curr = this._config.title || '';
        const next = val || '';
        if (curr === next) return;
        if (next) this._config.title = next; else delete this._config.title;
        lc_fireConfigChanged(this, this._config);
      });
      titleWrap.append(titleInput);
      row1.append(entityWrap, titleWrap);

      // Row 2: row_limit + feed_attribute
      const row2 = document.createElement('div');
      row2.className = 'row';

      const limitWrap = document.createElement('div');
      const limitInput = this._mkNumberfield('row_limit (optional)', (this._config.row_limit != null ? this._config.row_limit : ''), (num) => {
        const curr = this._config.row_limit;
        if ((curr == null && num == null) || curr === num) return;
        if (num == null) delete this._config.row_limit; else this._config.row_limit = num;
        lc_fireConfigChanged(this, this._config);
      });
      limitWrap.append(limitInput);

      const feedWrap = document.createElement('div');
      const feedInput = this._mkTextfield('feed_attribute (optional)', this._config.feed_attribute || '', (val) => {
        const curr = this._config.feed_attribute || '';
        const next = val || '';
        if (curr === next) return;
        if (next) this._config.feed_attribute = next; else delete this._config.feed_attribute;
        lc_fireConfigChanged(this, this._config);
      });
      feedWrap.append(feedInput);

      row2.append(limitWrap, feedWrap);

      // Columns editor
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

      form.append(row1, row2, colsFs);
      root.append(style, form);

      this._built = true;
    }

    // keep picker synced if value was set programmatically
    const entity = this.shadowRoot.querySelector('#entity');
    if (entity && !entity.value) entity.value = this._config.entity || '';

    this._rebuildColumns(this.shadowRoot.querySelector('.cols'));
    this._refreshEntityFallbackOptions();
  }

  /* ----- HA-native inputs: commit on blur/change only ----- */
  _mkTextfield(label, value, onCommit) {
    if (customElements.get('ha-textfield')) {
      const tf = document.createElement('ha-textfield');
      tf.label = label;
      tf.value = value || '';
      const commit = () => onCommit(tf.value || '');
      tf.addEventListener('blur', commit);
      tf.addEventListener('change', commit);
      return tf;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = label;
    input.value = value || '';
    const commit = (e) => onCommit(e.target.value || '');
    input.addEventListener('blur', commit);
    input.addEventListener('change', commit);
    return input;
  }

  _mkNumberfield(label, value, onCommit) {
    if (customElements.get('ha-textfield')) {
      const tf = document.createElement('ha-textfield');
      tf.label = label;
      tf.type = 'number';
      tf.value = value || '';
      const commit = () => {
        const v = tf.value;
        if (v === '' || isNaN(Number(v))) onCommit(null);
        else onCommit(Number(v));
      };
      tf.addEventListener('blur', commit);
      tf.addEventListener('change', commit);
      return tf;
    }
    const input = document.createElement('input');
    input.type = 'number';
    input.placeholder = label;
    input.value = value || '';
    const commit = (e) => {
      const v = e.target.value;
      if (v === '' || isNaN(Number(v))) onCommit(null);
      else onCommit(Number(v));
    };
    input.addEventListener('blur', commit);
    input.addEventListener('change', commit);
    return input;
  }

  _mkTypeSelect(col, idx, container) {
    const cols = this._config.columns;
    const TYPES = ['', 'image', 'icon'];
    const prev = col.type || '';

    const commitIfChanged = (val) => {
      const v = (val ?? '').trim();
      const curr = cols[idx].type || '';
      if (v === curr) return;
      if (v) cols[idx].type = v; else delete cols[idx].type;
      lc_fireConfigChanged(this, this._config);
      const target = container?.isConnected ? container : this.shadowRoot?.querySelector('.cols');
      if (target) this._rebuildColumns(target);
    };

    if (customElements.get('ha-select') && customElements.get('mwc-list-item')) {
      const sel = document.createElement('ha-select');
      sel.label = 'type (optional)';
      sel.value = prev;
      sel._open = false;

      TYPES.forEach((t) => {
        const item = document.createElement('mwc-list-item');
        item.value = t;
        item.textContent = t === '' ? '(none)' : t;
        if (t === prev) item.selected = true;
        sel.append(item);
      });

      sel.addEventListener('opened', (e) => { sel._open = true; e.stopPropagation(); });
      // Only commit when user actually picks a new value while menu is open
      sel.addEventListener('selected', (e) => {
        if (!sel._open) return;
        e.stopPropagation();
        // Defer to ensure sel.value is updated
        setTimeout(() => commitIfChanged(sel.value), 0);
      });
      // Also handle 'change' (keyboard selection) but not 'closed'/'blur'
      sel.addEventListener('change', (e) => { if (sel._open) { e.stopPropagation(); setTimeout(() => commitIfChanged(sel.value), 0); } });
      // Prevent the 'closed' event from bubbling up and closing the whole editor
      sel.addEventListener('closed', (e) => { sel._open = false; e.stopPropagation(); });
      sel.addEventListener('blur', (e) => { sel._open = false; e.stopPropagation(); });
      return sel;
    }

    // Native fallback
    const select = document.createElement('select');
    TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t === '' ? '(none)' : t;
      if (prev === t) opt.selected = true;
      select.append(opt);
    });
    select.addEventListener('change', () => commitIfChanged(select.value));
    // No commit on blur for native either
    return select;
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
      const fieldInput = this._mkTextfield('field (attribute name)', col.field || '', (val) => {
        const curr = cols[idx].field || '';
        const next = val || '';
        if (curr === next) return;
        cols[idx].field = next;
        lc_fireConfigChanged(this, this._config);
      });

      const titleInput = this._mkTextfield('title (header text or HTML)', col.title || '', (val) => {
        const curr = cols[idx].title || '';
        const next = val || '';
        if (curr === next) return;
        cols[idx].title = next;
        lc_fireConfigChanged(this, this._config);
      });
      r1.append(fieldInput, titleInput);

      // type / add_link
      const r2 = document.createElement('div');
      r2.className = 'row';
      const typeSelect = this._mkTypeSelect(col, idx, container);

      const linkInput = this._mkTextfield('add_link (URL field, optional)', col.add_link || '', (val) => {
        const curr = cols[idx].add_link || '';
        const next = val || '';
        if (curr === next) return;
        if (next) cols[idx].add_link = next; else delete cols[idx].add_link;
        lc_fireConfigChanged(this, this._config);
      });
      r2.append(typeSelect, linkInput);

      // image width/height (only for type=image)
      const r3 = document.createElement('div');
      r3.className = 'row';
      if ((col.type || '') === 'image') {
        const w = this._mkNumberfield('image width (default 70)', (col.width != null ? col.width : ''), (num) => {
          const curr = cols[idx].width;
          if ((curr == null && num == null) || curr === num) return;
          if (num == null) delete cols[idx].width; else cols[idx].width = num;
          lc_fireConfigChanged(this, this._config);
        });
        const h = this._mkNumberfield('image height (default 90)', (col.height != null ? col.height : ''), (num) => {
          const curr = cols[idx].height;
          if ((curr == null && num == null) || curr === num) return;
          if (num == null) delete cols[idx].height; else cols[idx].height = num;
          lc_fireConfigChanged(this, this._config);
        });
        r3.append(w, h);
      }

      // column width
      const r4 = document.createElement('div');
      r4.className = 'row single';
      const widthInput = this._mkTextfield('col_width (e.g., 120px or 25%)', col.col_width || '', (val) => {
        const curr = (cols[idx].col_width || '').trim();
        const next = (val || '').trim();
        if (curr === next) return;
        if (next) cols[idx].col_width = next; else delete cols[idx].col_width;
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
