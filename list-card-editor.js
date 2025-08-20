// list-card-editor.js
// Single-purpose editor module that waits for HA's editor elements to be registered
// (no direct imports of Home Assistant internals).

(function () {
    const CHANGE_EVT = 'config-changed';

    function fireConfigChanged(el, config) {
        el.dispatchEvent(new CustomEvent(CHANGE_EVT, { detail: { config }, bubbles: true, composed: true }));
    }

    class ListCardEditor extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._config = {};
            this._built = false;
            this._ready = false;
            this._bootPromise = null;
        }

        connectedCallback() {
            if (!this._bootPromise) this._bootPromise = this._boot();
        }

        set hass(hass) {
            this._hass = hass;
            // Keep picker in sync once stamped
            const p = this.shadowRoot?.getElementById('entity');
            if (p && 'hass' in p) p.hass = hass;
        }

        setConfig(config) {
            this._config = JSON.parse(JSON.stringify(config || {}));
            // render only after the HA controls are defined
            if (this._ready) this._render();
            else if (this._bootPromise) this._bootPromise.then(() => this._render());
        }

        get value() {
            return this._config;
        }

        /* ---------- Boot: wait for HA editor controls to be registered ---------- */
        async _waitFor(tag) {
            if (customElements.get(tag)) return;
            try { await window.loadCardHelpers?.(); } catch (_) { }
            await customElements.whenDefined(tag);
        }
        async _boot() {
            // Wait for the HA components we rely on (no direct imports)
            await this._waitFor('ha-entity-picker');
            await this._waitFor('ha-textfield');
            await this._waitFor('ha-select');
            // ha-select pulls in mwc-list-item internally
            this._ready = true;
            this._render();
        }

        /* ---------- UI Builders (commit on blur/change only) ---------- */
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
            const cols = this._config.columns;
            const TYPES = ['', 'image', 'icon'];
            const wrap = document.createElement('div');
            wrap.className = 'lc-field';

            const label = document.createElement('div');
            label.className = 'lc-label';
            label.textContent = 'type (optional)';

            const sel = document.createElement('ha-select');
            sel.classList.add('lc-type');
            sel.value = col.type || '';

            // Populate menu items now that ha-select is defined
            TYPES.forEach((t) => {
                const it = document.createElement('mwc-list-item');
                it.value = t;
                it.textContent = t === '' ? '(none)' : t;
                if (t === sel.value) it.selected = true;
                sel.append(it);
            });

            const commitIfChanged = () => {
                const v = sel.value || '';
                const curr = cols[idx].type || '';
                if (v === curr) return;
                if (v) cols[idx].type = v; else delete cols[idx].type;
                fireConfigChanged(this, this._config);
                // Rebuild to show/hide image size fields
                const target = container?.isConnected ? container : this.shadowRoot?.getElementById('cols');
                if (target) this._rebuildColumns(target);
            };

            // Only commit on actual selection changes
            sel.addEventListener('selected', () => setTimeout(commitIfChanged, 0));

            wrap.append(label, sel);
            return wrap;
        }

        /* ---------- Render ---------- */
        _render() {
            const root = this.shadowRoot;
            if (!this._built) {
                root.innerHTML = `
          <style>
            :host { display: block; }
            .form { padding: 12px; display: grid; grid-template-columns: 1fr; gap: 18px; }
            fieldset {
              border: 1px solid var(--divider-color, #e0e0e0);
              border-radius: 10px;
              padding: 18px 16px;
              margin: 0;
              background: var(--card-background-color);
            }
            fieldset > * + * { margin-top: 12px; }
            legend { padding: 0 6px; font-weight: 600; color: var(--secondary-text-color); }
            .row { display: grid; grid-template-columns: 1fr; gap: 12px; }
            .cols { display: grid; grid-auto-rows: min-content; gap: 18px; }
            .actions { display: flex; gap: 8px; padding-top: 4px; }
            button { cursor: pointer; }
            ha-textfield, ha-select, ha-entity-picker { width: 100%; }
            .lc-field { display: flex; flex-direction: column; gap: 6px; }
            .lc-label {
              font-size: var(--paper-font-body1_-_font-size, 0.875rem);
              color: var(--secondary-text-color);
              font-weight: 600;
              line-height: 1.2;
            }
            /* Roomier menu rows */
            ha-select.lc-type {
              --mdc-list-vertical-padding: 8px;
              --mdc-menu-item-height: 40px;
            }
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

                // Entity row (native HA picker)
                const rowEntity = root.getElementById('row-entity');
                const picker = document.createElement('ha-entity-picker');
                picker.id = 'entity';
                picker.label = 'Entity';
                picker.allowCustomEntity = true;
                if (this._hass) { try { picker.hass = this._hass; } catch (_) { } }
                picker.value = this._config.entity || '';
                picker.addEventListener('value-changed', (e) => {
                    const next = e.detail?.value || '';
                    if ((this._config.entity || '') === next) return;
                    this._config.entity = next;
                    fireConfigChanged(this, this._config);
                });
                rowEntity.append(picker);

                // Title, feed, limit rows
                const rowTitle = root.getElementById('row-title');
                rowTitle.append(this._mkTextfield('Title (text or HTML)', this._config.title || '', (val) => {
                    const curr = this._config.title || '';
                    const next = val || '';
                    if (curr === next) return;
                    if (next) this._config.title = next; else delete this._config.title;
                    fireConfigChanged(this, this._config);
                }));

                const rowFeed = root.getElementById('row-feed');
                rowFeed.append(this._mkTextfield('feed_attribute (optional)', this._config.feed_attribute || '', (val) => {
                    const curr = this._config.feed_attribute || '';
                    const next = val.trim();
                    if (curr === next) return;
                    if (next) this._config.feed_attribute = next; else delete this._config.feed_attribute;
                    fireConfigChanged(this, this._config);
                }));

                const rowLimit = root.getElementById('row-limit');
                rowLimit.append(this._mkNumberfield('row_limit (optional)', (this._config.row_limit != null ? this._config.row_limit : ''), (num) => {
                    const curr = this._config.row_limit;
                    if ((curr == null && num == null) || curr === num) return;
                    if (num == null) delete this._config.row_limit; else this._config.row_limit = num;
                    fireConfigChanged(this, this._config);
                }));

                // Columns editor
                root.getElementById('add').addEventListener('click', () => {
                    if (!Array.isArray(this._config.columns)) this._config.columns = [];
                    this._config.columns.push({ field: '', title: '' });
                    fireConfigChanged(this, this._config);
                    this._rebuildColumns(root.getElementById('cols'));
                });

                this._rebuildColumns(root.getElementById('cols'));
                this._built = true;
            }

            // Keep picker value synced if config changed externally
            const picker = this.shadowRoot.getElementById('entity');
            if (picker && picker.value !== (this._config.entity || '')) picker.value = this._config.entity || '';
            // Rebuild columns (idempotent) to reflect latest config
            this._rebuildColumns(this.shadowRoot.getElementById('cols'));
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
                    fireConfigChanged(this, this._config);
                }));

                // title
                const rTitle = document.createElement('div');
                rTitle.className = 'row';
                rTitle.append(this._mkTextfield('title (header text or HTML)', col.title || '', (val) => {
                    const curr = cols[idx].title || '';
                    const next = val || '';
                    if (curr === next) return;
                    cols[idx].title = next;
                    fireConfigChanged(this, this._config);
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
                    fireConfigChanged(this, this._config);
                }));

                // image width/height (only for type === 'image')
                if ((col.type || '') === 'image') {
                    const rW = document.createElement('div');
                    rW.className = 'row';
                    rW.append(this._mkNumberfield('image width (default 70)', (col.width != null ? col.width : ''), (num) => {
                        const curr = cols[idx].width;
                        if ((curr == null && num == null) || curr === num) return;
                        if (num == null) delete cols[idx].width; else cols[idx].width = num;
                        fireConfigChanged(this, this._config);
                    }));

                    const rH = document.createElement('div');
                    rH.className = 'row';
                    rH.append(this._mkNumberfield('image height (default 90)', (col.height != null ? col.height : ''), (num) => {
                        const curr = cols[idx].height;
                        if ((curr == null && num == null) || curr === num) return;
                        if (num == null) delete cols[idx].height; else cols[idx].height = num;
                        fireConfigChanged(this, this._config);
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
                    fireConfigChanged(this, this._config);
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
                    fireConfigChanged(this, this._config);
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
