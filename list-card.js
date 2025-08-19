console.log(`%clist-card\n%cVersion: ${'0.3.11'}`, 'color: rebeccapurple; font-weight: bold;', '');

/* ===== List Card runtime (unchanged from your working build) ===== */
class ListCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this._config = {}; }
  setConfig(config) {
    if (!config || !config.entity) throw new Error('Please define an entity');
    const root = this.shadowRoot; root.innerHTML = '';
    const cardConfig = { ...config };
    const card = document.createElement('ha-card');

    if (cardConfig.title) {
      if (/<[a-z][\s\S]*>/i.test(cardConfig.title)) {
        const t = document.createElement('div'); t.className = 'title-html'; t.innerHTML = cardConfig.title; card.appendChild(t);
      } else { card.header = cardConfig.title; }
    }

    const content = document.createElement('div'); content.id = 'container'; content.classList.add('selectable');
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
      table { width: 100%; padding: 0 16px 16px 16px; }
      thead th { text-align: left; }
      tbody tr:nth-child(odd)  { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      td, th { cursor: text; }
      td a { color: var(--primary-text-color); text-decoration: none; font-weight: normal; cursor: pointer; }
    `;
    card.append(content, style); root.appendChild(card); this._config = cardConfig;
  }
  set hass(hass) {
    this._hass = hass; const c = this._config;
    if (!c || !c.entity || !hass?.states?.[c.entity]) { this.style.display = 'none'; return; }
    const content = this.shadowRoot.getElementById('container');
    const st = hass.states[c.entity];
    const feed = c.feed_attribute ? st.attributes?.[c.feed_attribute] : st.attributes?.['feed'] ?? st.attributes;
    const rows = Array.isArray(feed) ? feed : []; if (!rows.length) { this.style.display = 'none'; return; }
    this.style.display = 'block';
    const cols = Array.isArray(c.columns) ? c.columns : null;
    const rowLimit = Number.isFinite(c.row_limit) ? c.row_limit : rows.length;

    let html = '<table>';
    if (cols) {
      html += '<colgroup>';
      for (const col of cols) { const w = (col?.col_width ?? '').toString().trim(); html += w ? `<col style="width:${w}">` : '<col>'; }
      html += '</colgroup>';
    }
    html += '<thead><tr>';
    if (!cols) {
      const keys = Object.keys(rows[0] || {}); for (const k of keys) html += `<th>${k}</th>`;
    } else {
      for (const col of cols) { const t = (col?.title ?? col?.field ?? '').toString(); const cls = (col?.field ?? '').toString().trim().replace(/[^\w-]/g, '_'); html += `<th class="col-${cls}" data-field="${col.field ?? ''}">${t}</th>`; }
    }
    html += '</tr></thead><tbody>';

    let r = 0;
    for (const entry of rows) {
      if (r >= rowLimit) break; if (typeof entry !== 'object' || entry == null) continue;
      html += '<tr>';
      if (!cols) {
        for (const k of Object.keys(entry)) html += `<td>${this._raw(entry[k])}</td>`;
      } else {
        if (!cols.every(cn => Object.prototype.hasOwnProperty.call(entry, cn.field))) { continue; }
        for (const col of cols) {
          const f = col.field, cls = String(f || '').trim().replace(/[^\w-]/g, '_');
          const href = col.add_link ? (entry[col.add_link] ?? '') : ''; const open = href ? `<a href="${href}" draggable="false" target="_blank" rel="noopener noreferrer">` : ''; const close = href ? '</a>' : '';
          html += `<td class="col-${cls} ${f || ''}" data-field="${f || ''}">`;
          if (col.type === 'image') {
            const w = Number.isFinite(col.width) ? col.width : 70; const h = Number.isFinite(col.height) ? col.height : 90;
            const val = entry[f]; const url = (Array.isArray(val) && val[0]?.url) ? val[0].url : val;
            html += `${open}<img src="${url}" draggable="false" width="${w}" height="${h}" />${close}`;
          } else if (col.type === 'icon') {
            html += `<ha-icon class="column-${f || ''}" icon="${entry[f]}"></ha-icon>`;
          } else {
            html += `${open}${this._raw(entry[f])}${close}`;
          }
          html += '</td>';
        }
      }
      html += '</tr>'; r++;
    }
    html += '</tbody></table>'; content.innerHTML = html;
  }
  getCardSize() { return 1; }
  _raw(v) { return v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v)); }
}
customElements.define('list-card', ListCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'list-card', name: 'List Card', preview: false, description: 'Generate a table from a sensor that provides a list of attributes.' });

/* ===== Visual Editor (single-column, HA-native) ===== */
ListCard.getConfigElement = () => document.createElement('list-card-editor');
ListCard.getStubConfig   = () => ({ entity: '', title: '', row_limit: 5 });

function lc_fireConfigChanged(el, config) { el.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true })); }

class ListCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this._config = {}; this._built = false; }
  connectedCallback() { this._ensureEntityPickerReady(); }
  set hass(hass) { this._hass = hass; this._ensureEntityPickerReady(); }
  setConfig(config) { this._config = JSON.parse(JSON.stringify(config || {})); this._render(); }
  get value() { return this._config; }

  async _ensureEntityPickerReady() {
    try { await window.loadCardHelpers?.(); } catch (_) {}
    const picker = this.shadowRoot?.getElementById('entity'); if (!picker) return;
    try { await customElements.whenDefined('ha-entity-picker'); } catch(_) {}
    if (!picker.isConnected) return;
    try { if (this._hass) picker.hass = this._hass; } catch(_) {}
    const current = this._config?.entity || '';
    if (picker.value !== current) picker.value = current; else requestAnimationFrame(() => { try { picker.requestUpdate?.(); } catch(_) {} });
  }

  _render() {
    const root = this.shadowRoot;
    if (!this._built) {
      root.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; }
        .form { padding: 12px; display: grid; grid-template-columns: 1fr; gap: 18px; }

        /* Column editor blocks — more space inside & between rows */
        fieldset {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 10px;
          padding: 18px 16px;       /* ↑ padding */
          margin: 0;
          background: var(--card-background-color);
        }
        fieldset > * + * { margin-top: 12px; }  /* ← vertical space between rows */

        legend { padding: 0 6px; font-weight: 600; color: var(--secondary-text-color); }
        .row { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .cols { display: grid; grid-auto-rows: min-content; gap: 18px; } /* space between column blocks */
        .actions { display: flex; gap: 8px; padding-top: 4px; }
        button { cursor: pointer; }

        ha-textfield, ha-select, ha-entity-picker, select, input { width: 100%; }

        /* Simple field wrapper + label to avoid floating-label overlap on ha-select */
        .lc-field { display: flex; flex-direction: column; gap: 6px; }
        .lc-label {
          font-size: var(--paper-font-body1_-_font-size, 0.875rem);
          color: var(--secondary-text-color);
          font-weight: 600;
          line-height: 1.2;
        }

        /* Roomier menu rows without touching label/selected text layout */
        ha-select.lc-type {
          --mdc-list-vertical-padding: 8px;
          --mdc-menu-item-height: 40px;
        }
      `;
      const form = document.createElement('div'); form.className = 'form';

      // Entity
      const entityRow = document.createElement('div');
      entityRow.className = 'row';
      
      if (!customElements.get('ha-entity-picker')) {
        // Fallback shown only during first-moment cold loads
        const sel = document.createElement('select');
        sel.id = 'entity-fallback';
        const none = document.createElement('option');
        none.value = ''; none.textContent = 'Select entity…';
        sel.append(none);
        if (this._hass?.states) {
          Object.keys(this._hass.states).sort().forEach(eid => {
            const opt = document.createElement('option');
            opt.value = eid;
            opt.textContent = this._hass.states[eid]?.attributes?.friendly_name || eid;
            if ((this._config.entity || '') === eid) opt.selected = true;
            sel.append(opt);
          });
        }
        sel.addEventListener('change', (e) => {
          const next = e.target.value || '';
          if ((this._config.entity || '') === next) return;
          this._config.entity = next;
          lc_fireConfigChanged(this, this._config);
        });
        entityRow.append(sel);
      
        // When the real picker registers, swap it in-place
        customElements.whenDefined('ha-entity-picker').then(() => {
          const picker = document.createElement('ha-entity-picker');
          picker.id = 'entity';
          picker.label = 'Entity';
          picker.allowCustomEntity = true;
          try { if (this._hass) picker.hass = this._hass; } catch(_) {}
          picker.value = this._config.entity || '';
          picker.addEventListener('value-changed', (ev) => {
            const next = ev.detail?.value || '';
            if ((this._config.entity || '') === next) return;
            this._config.entity = next;
            lc_fireConfigChanged(this, this._config);
          });
          sel.replaceWith(picker);
        });
      } else {
        const picker = document.createElement('ha-entity-picker');
        picker.id = 'entity';
        picker.label = 'Entity';
        picker.allowCustomEntity = true;
        try { if (this._hass) picker.hass = this._hass; } catch(_) {}
        picker.value = this._config.entity || '';
        picker.addEventListener('value-changed', (e) => {
          const next = e.detail?.value || '';
          if ((this._config.entity || '') === next) return;
          this._config.entity = next;
          lc_fireConfigChanged(this, this._config);
        });
        entityRow.append(picker);
      }
      
      // Title
      const titleRow = document.createElement('div'); titleRow.className = 'row';
      titleRow.append(this._mkTextfield('Title (text or HTML)', this._config.title || '', (val) => {
        const curr = this._config.title || ''; const next = val || ''; if (curr === next) return;
        if (next) this._config.title = next; else delete this._config.title; lc_fireConfigChanged(this, this._config);
      }));

      // Row limit
      const limitRow = document.createElement('div'); limitRow.className = 'row';
      limitRow.append(this._mkNumberfield('row_limit (optional)', (this._config.row_limit != null ? this._config.row_limit : ''), (num) => {
        const curr = this._config.row_limit; if ((curr == null && num == null) || curr === num) return;
        if (num == null) delete this._config.row_limit; else this._config.row_limit = num; lc_fireConfigChanged(this, this._config);
      }));

      // feed_attribute
      const feedRow = document.createElement('div'); feedRow.className = 'row';
      feedRow.append(this._mkTextfield('feed_attribute (optional)', this._config.feed_attribute || '', (val) => {
        const curr = this._config.feed_attribute || ''; const next = val || ''; if (curr === next) return;
        if (next) this._config.feed_attribute = next; else delete this._config.feed_attribute; lc_fireConfigChanged(this, this._config);
      }));

      // Columns editor
      const colsFs = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = 'Columns'; colsFs.append(legend);

      const headRow = document.createElement('div'); headRow.className = 'actions';
      const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.textContent = 'Add column';
      addBtn.addEventListener('click', () => {
        if (!Array.isArray(this._config.columns)) this._config.columns = [];
        this._config.columns.push({ field: '', title: '' });
        lc_fireConfigChanged(this, this._config); this._rebuildColumns(colsWrap);
      });
      headRow.append(addBtn); colsFs.append(headRow);

      const colsWrap = document.createElement('div'); colsWrap.className = 'cols'; colsFs.append(colsWrap);

      form.append(entityRow, titleRow, limitRow, feedRow, colsFs);
      root.append(style, form);

      this._built = true;
      this._ensureEntityPickerReady();
    }

    const picker = this.shadowRoot.getElementById('entity');
    if (picker && picker.value !== (this._config.entity || '')) picker.value = this._config.entity || '';

    this._rebuildColumns(this.shadowRoot.querySelector('.cols'));
  }

  /* ----- HA-native inputs: commit on blur/change only ----- */
  _mkTextfield(label, value, onCommit) {
    if (customElements.get('ha-textfield')) {
      const tf = document.createElement('ha-textfield'); tf.label = label; tf.value = value || '';
      const commit = () => onCommit(tf.value || ''); tf.addEventListener('blur', commit); tf.addEventListener('change', commit);
      return tf;
    }
    const input = document.createElement('input'); input.type = 'text'; input.placeholder = label; input.value = value || '';
    const commit = (e) => onCommit(e.target.value || ''); input.addEventListener('blur', commit); input.addEventListener('change', commit); return input;
  }

  _mkNumberfield(label, value, onCommit) {
    if (customElements.get('ha-textfield')) {
      const tf = document.createElement('ha-textfield'); tf.label = label; tf.type = 'number'; tf.value = value || '';
      const commit = () => { const v = tf.value; if (v === '' || isNaN(Number(v))) onCommit(null); else onCommit(Number(v)); };
      tf.addEventListener('blur', commit); tf.addEventListener('change', commit); return tf;
    }
    const input = document.createElement('input'); input.type = 'number'; input.placeholder = label; input.value = value || '';
    const commit = (e) => { const v = e.target.value; if (v === '' || isNaN(Number(v))) onCommit(null); else onCommit(Number(v)); };
    input.addEventListener('blur', commit); input.addEventListener('change', commit); return input;
  }

  _mkTypeSelect(col, idx, container) {
    const cols = this._config.columns; const TYPES = ['', 'image', 'icon']; const prev = col.type || '';

    const commitIfChanged = (val) => {
      const v = (val ?? '').trim(); const curr = cols[idx].type || ''; if (v === curr) return;
      if (v) cols[idx].type = v; else delete cols[idx].type;
      lc_fireConfigChanged(this, this._config);
      const target = container?.isConnected ? container : this.shadowRoot?.querySelector('.cols');
      if (target) this._rebuildColumns(target);
    };

    // Wrapper with our own label to avoid floating-label overlap
    const wrap = document.createElement('div'); wrap.className = 'lc-field';
    const label = document.createElement('div'); label.className = 'lc-label'; label.textContent = 'type (optional)';

    if (customElements.get('ha-select') && customElements.get('mwc-list-item')) {
      const sel = document.createElement('ha-select'); sel.classList.add('lc-type'); sel.value = prev; sel._open = false;
      TYPES.forEach((t) => { const item = document.createElement('mwc-list-item'); item.value = t; item.textContent = t === '' ? '(none)' : t; if (t === prev) item.selected = true; sel.append(item); });
      sel.addEventListener('opened',  (e) => { sel._open = true;  e.stopPropagation(); });
      sel.addEventListener('selected',(e) => { if (!sel._open) return; e.stopPropagation(); setTimeout(() => commitIfChanged(sel.value), 0); });
      sel.addEventListener('change',  (e) => { if (sel._open) { e.stopPropagation(); setTimeout(() => commitIfChanged(sel.value), 0); } });
      sel.addEventListener('closed',  (e) => { sel._open = false; e.stopPropagation(); });
      sel.addEventListener('blur',    (e) => { sel._open = false; e.stopPropagation(); });
      wrap.append(label, sel);
      return wrap;
    }

    // Native fallback
    const select = document.createElement('select'); TYPES.forEach((t) => {
      const opt = document.createElement('option'); opt.value = t; opt.textContent = t === '' ? '(none)' : t; if (prev === t) opt.selected = true; select.append(opt);
    });
    select.addEventListener('change', () => commitIfChanged(select.value));
    wrap.append(label, select);
    return wrap;
  }

  _rebuildColumns(container) {
    if (!container) return; container.innerHTML = '';
    const cols = Array.isArray(this._config.columns) ? this._config.columns : [];

    cols.forEach((col, idx) => {
      const fs = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = `Column ${idx + 1}`; fs.append(legend);

      const rField = document.createElement('div'); rField.className = 'row';
      rField.append(this._mkTextfield('field (attribute name)', col.field || '', (val) => {
        const curr = cols[idx].field || ''; const next = val || ''; if (curr === next) return;
        cols[idx].field = next; lc_fireConfigChanged(this, this._config);
      }));

      const rTitle = document.createElement('div'); rTitle.className = 'row';
      rTitle.append(this._mkTextfield('title (header text or HTML)', col.title || '', (val) => {
        const curr = cols[idx].title || ''; const next = val || ''; if (curr === next) return;
        cols[idx].title = next; lc_fireConfigChanged(this, this._config);
      }));

      const rType = document.createElement('div'); rType.className = 'row';
      rType.append(this._mkTypeSelect(col, idx, container));

      const rLink = document.createElement('div'); rLink.className = 'row';
      rLink.append(this._mkTextfield('add_link (URL field, optional)', col.add_link || '', (val) => {
        const curr = cols[idx].add_link || ''; const next = val || ''; if (curr === next) return;
        if (next) cols[idx].add_link = next; else delete cols[idx].add_link; lc_fireConfigChanged(this, this._config);
      }));

      const rW = document.createElement('div'); const rH = document.createElement('div'); rW.className = rH.className = 'row';
      if ((col.type || '') === 'image') {
        rW.append(this._mkNumberfield('image width (default 70)', (col.width != null ? col.width : ''), (num) => {
          const curr = cols[idx].width; if ((curr == null && num == null) || curr === num) return;
          if (num == null) delete cols[idx].width; else cols[idx].width = num; lc_fireConfigChanged(this, this._config);
        }));
        rH.append(this._mkNumberfield('image height (default 90)', (col.height != null ? col.height : ''), (num) => {
          const curr = cols[idx].height; if ((curr == null && num == null) || curr === num) return;
          if (num == null) delete cols[idx].height; else cols[idx].height = num; lc_fireConfigChanged(this, this._config);
        }));
      }

      const rColWidth = document.createElement('div'); rColWidth.className = 'row';
      rColWidth.append(this._mkTextfield('col_width (e.g., 120px or 25%)', col.col_width || '', (val) => {
        const curr = (cols[idx].col_width || '').trim(); const next = (val || '').trim(); if (curr === next) return;
        if (next) cols[idx].col_width = next; else delete cols[idx].col_width; lc_fireConfigChanged(this, this._config);
      }));

      const actions = document.createElement('div'); actions.className = 'actions';
      const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.textContent = 'Remove column';
      removeBtn.addEventListener('click', () => { cols.splice(idx, 1); lc_fireConfigChanged(this, this._config); this._rebuildColumns(container); });
      actions.append(removeBtn);

      fs.append(rField, rTitle, rType, rLink);
      if ((col.type || '') === 'image') fs.append(rW, rH);
      fs.append(rColWidth, actions);
      container.append(fs);
    });
  }
}
customElements.define('list-card-editor', ListCardEditor);
