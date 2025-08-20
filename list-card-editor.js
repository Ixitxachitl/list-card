// list-card-editor.js
(() => {
    const EV = 'config-changed';
    const fireCfg = (el, config) =>
        el.dispatchEvent(new CustomEvent(EV, { detail: { config }, bubbles: true, composed: true }));

    class ListCardEditor extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._config = {};
            this._built = false;
            this._data = {}; // for ha-form
        }

        set hass(hass) {
            this._hass = hass;
            // keep ha-form + picker synced when hass arrives later
            const form = this.shadowRoot?.getElementById('entity-form');
            if (form) form.hass = hass;
        }

        setConfig(config) {
            this._config = JSON.parse(JSON.stringify(config || {}));
            // keep ha-form data in sync
            this._data = {
                entity: this._config.entity || '',
            };
            this._render();
        }

        get value() { return this._config; }

        /* ---------- UI helpers (commit on blur/change only) ---------- */
        _mkTextfield(label, value, onCommit) {
            const tf = document.createElement('ha-textfield');
            tf.label = label;
            tf.value = value || '';
            const commit = () => onCommit(tf.value || '');
            tf.addEventListener('blur', commit);
            tf.addEventListener('change', commit);
            return tf;
        }

        _mkNumberfield(label, value, onCommit) {
            const tf = document.createElement('ha-textfield');
            tf.label = label;
            tf.type = 'number';
            tf.value = value == null ? '' : String(value);
            const commit = () => {
                const v = tf.value;
                if (v === '' || isNaN(Number(v))) onCommit(null);
                else onCommit(Number(v));
            };
            tf.addEventListener('blur', commit);
            tf.addEventListener('change', commit);
            return tf;
        }

        _mkTypeSelect(col, idx, container) {
            const cols = this._config.columns || [];
            const TYPES = ['', 'image', 'icon'];

            // label wrapper to avoid floating-label overlap
            const wrap = document.createElement('div');
            wrap.className = 'lc-field';
            const lbl = document.createElement('div');
            lbl.className = 'lc-label';
            lbl.textContent = 'type (optional)';

            const sel = document.createElement('ha-select');
            sel.classList.add('lc-type');
            sel.value = col.type || '';

            // populate items immediately; ha-select will upgrade and wire mwc-list-item internally
            TYPES.forEach((t) => {
                const it = document.createElement('mwc-list-item');
                it.value = t;
                it.textContent = t === '' ? '(none)' : t;
                if (t === sel.value) it.selected = true;
                sel.append(it);
            });

            const commit = () => {
                const v = sel.value || '';
                const curr = cols[idx].type || '';
                if (v === curr) return;
                if (v) cols[idx].type = v; else delete cols[idx].type;
                fireCfg(this, this._config);
                const target = container?.isConnected ? container : this.shadowRoot?.getElementById('cols');
                if (target) this._rebuildColumns(target);
            };

            sel.addEventListener('selected', () => setTimeout(commit, 0));
            wrap.append(lbl, sel);
            return wrap;
        }

        /* ---------- Render immediately (no blocking waits) ---------- */
        _render() {
            const root = this.shadowRoot;
            if (!this._built) {
                root.innerHTML = `
          <style>
            :host { display:block; }
            .form { padding:12px; display:grid; grid-template-columns:1fr; gap:18px; }
            fieldset {
              border:1px solid var(--divider-color,#e0e0e0);
              border-radius:10px;
              padding:18px 16px;
              margin:0;
              background:var(--card-background-color);
            }
            fieldset > * + * { margin-top:12px; }
            legend { padding:0 6px; font-weight:600; color:var(--secondary-text-color); }
            .row { display:grid; grid-template-columns:1fr; gap:12px; }
            .cols { display:grid; grid-auto-rows:min-content; gap:18px; }
            .actions { display:flex; gap:8px; padding-top:4px; }
            button { cursor:pointer; }
            ha-textfield, ha-select, ha-entity-picker, ha-form { width:100%; }
            .lc-field { display:flex; flex-direction:column; gap:6px; }
            .lc-label {
              font-size: var(--paper-font-body1_-_font-size, 0.875rem);
              color: var(--secondary-text-color);
              font-weight:600;
              line-height:1.2;
            }
            ha-select.lc-type { --mdc-list-vertical-padding:8px; --mdc-menu-item-height:40px; }
          </style>

          <div class="form">
            <div class="row" id="row-entity"></div>
            <div class="row" id="row-title"></div>
            <div class="row" id="row-feed"></div>
            <div class="row" id="row-limit"></div>

            <fieldset>
              <legend>Columns</legend>
              <div class="actions"><button id="add">Add column</button></div>
              <div class="cols" id="cols"></div>
            </fieldset>
          </div>
        `;

                // --- Entity row: use ha-form with selector so HA loads picker internally
                const entityRow = root.getElementById('row-entity');
                const form = document.createElement('ha-form');
                form.id = 'entity-form';
                form.schema = [{ name: 'entity', selector: { entity: {} } }];
                form.data = { entity: this._config.entity || '' };
                if (this._hass) form.hass = this._hass;

                // commit only on real changes
                form.addEventListener('value-changed', (e) => {
                    const next = e.detail?.value?.entity || '';
                    if ((this._config.entity || '') === next) return;
                    this._config.entity = next;
                    // keep local form.data in sync to avoid flicker
                    form.data = { entity: next };
                    fireCfg(this, this._config);
                });
                entityRow.append(form);

                // --- Other rows
                const titleRow = root.getElementById('row-title');
                titleRow.append(this._mkTextfield('Title (text or HTML)', this._config.title || '', (val) => {
                    const curr = this._config.title || '';
                    const next = val || '';
                    if (curr === next) return;
                    if (next) this._config.title = next; else delete this._config.title;
                    fireCfg(this, this._config);
                }));

                const feedRow = root.getElementById('row-feed');
                feedRow.append(this._mkTextfield('feed_attribute (optional)', this._config.feed_attribute || '', (val) => {
                    const curr = this._config.feed_attribute || '';
                    const next = (val || '').trim();
                    if (curr === next) return;
                    if (next) this._config.feed_attribute = next; else delete this._config.feed_attribute;
                    fireCfg(this, this._config);
                }));

                const limitRow = root.getElementById('row-limit');
                limitRow.append(this._mkNumberfield('row_limit (optional)', (this._config.row_limit != null ? this._config.row_limit : ''), (num) => {
                    const curr = this._config.row_limit;
                    if ((curr == null && num == null) || curr === num) return;
                    if (num == null) delete this._config.row_limit; else this._config.row_limit = num;
                    fireCfg(this, this._config);
                }));

                // Columns block
                root.getElementById('add').addEventListener('click', () => {
                    if (!Array.isArray(this._config.columns)) this._config.columns = [];
                    this._config.columns.push({ field: '', title: '' });
                    fireCfg(this, this._config);
                    this._rebuildColumns(root.getElementById('cols'));
                });

                this._rebuildColumns(root.getElementById('cols'));
                this._built = true;

                // After first paint, if ha-form wasn’t upgraded yet, it will upgrade later.
                // Keep hass/data up to date on upgrade:
                queueMicrotask(() => {
                    const f = this.shadowRoot?.getElementById('entity-form');
                    if (!f) return;
                    // reapply values once upgraded
                    try {
                        if (this._hass) f.hass = this._hass;
                        f.data = { entity: this._config.entity || '' };
                    } catch (_) { }
                });
            } else {
                // keep ha-form in sync on subsequent setConfig calls
                const f = this.shadowRoot.getElementById('entity-form');
                if (f) {
                    try {
                        if (this._hass) f.hass = this._hass;
                        f.data = { entity: this._config.entity || '' };
                    } catch (_) { }
                }
                this._rebuildColumns(this.shadowRoot.getElementById('cols'));
            }
        }

        _rebuildColumns(container) {
            if (!container) return;
            container.innerHTML = '';

            const cols = Array.isArray(this._config.columns) ? this._config.columns : [];

            cols.forEach((col, idx) => {
                const fs = document.createElement('fieldset');
                const lg = document.createElement('legend');
                lg.textContent = `Column ${idx + 1}`;
                fs.append(lg);

                // field
                const rField = document.createElement('div');
                rField.className = 'row';
                rField.append(this._mkTextfield('field (attribute name)', col.field || '', (val) => {
                    const curr = cols[idx].field || '';
                    const next = val || '';
                    if (curr === next) return;
                    cols[idx].field = next;
                    fireCfg(this, this._config);
                }));

                // title
                const rTitle = document.createElement('div');
                rTitle.className = 'row';
                rTitle.append(this._mkTextfield('title (header text or HTML)', col.title || '', (val) => {
                    const curr = cols[idx].title || '';
                    const next = val || '';
                    if (curr === next) return;
                    cols[idx].title = next;
                    fireCfg(this, this._config);
                }));

                // type
                const rType = document.createElement('div');
                rType.className = 'row';
                rType.append(this._mkTypeSelect(col, idx, container));

                // add_link
                const rLink = document.createElement('div');
                rLink.className = 'row';
                rLink.append(this._mkTextfield('add_link (URL field, optional)', col.add_link || '', (val) => {
                    const curr = cols[idx].add_link || '';
                    const next = val || '';
                    if (curr === next) return;
                    if (next) cols[idx].add_link = next; else delete cols[idx].add_link;
                    fireCfg(this, this._config);
                }));

                // image sizes (only for image type)
                if ((col.type || '') === 'image') {
                    const rW = document.createElement('div');
                    rW.className = 'row';
                    rW.append(this._mkNumberfield('image width (default 70)', (col.width != null ? col.width : ''), (num) => {
                        const curr = cols[idx].width;
                        if ((curr == null && num == null) || curr === num) return;
                        if (num == null) delete cols[idx].width; else cols[idx].width = num;
                        fireCfg(this, this._config);
                    }));

                    const rH = document.createElement('div');
                    rH.className = 'row';
                    rH.append(this._mkNumberfield('image height (default 90)', (col.height != null ? col.height : ''), (num) => {
                        const curr = cols[idx].height;
                        if ((curr == null && num == null) || curr === num) return;
                        if (num == null) delete cols[idx].height; else cols[idx].height = num;
                        fireCfg(this, this._config);
                    }));

                    fs.append(rW, rH);
                }

                // col_width
                const rColWidth = document.createElement('div');
                rColWidth.className = 'row';
                rColWidth.append(this._mkTextfield('col_width (e.g., 120px or 25%)', col.col_width || '', (val) => {
                    const curr = (cols[idx].col_width || '').trim();
                    const next = (val || '').trim();
                    if (curr === next) return;
                    if (next) cols[idx].col_width = next; else delete cols[idx].col_width;
                    fireCfg(this, this._config);
                }));

                // actions
                const actions = document.createElement('div');
                actions.className = 'actions';
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.textContent = 'Remove column';
                rm.addEventListener('click', () => {
                    const arr = this._config.columns || [];
                    arr.splice(idx, 1);
                    fireCfg(this, this._config);
                    this._rebuildColumns(container);
                });
                actions.append(rm);

                fs.append(rField, rTitle, rType, rLink, rColWidth, actions);
                container.append(fs);
            });
        }
    }

    customElements.define('list-card-editor', ListCardEditor);
})();
