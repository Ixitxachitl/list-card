// list-card-editor.js — visual config editor for List Card
(() => {
  const fireConfig = (editor, config) =>
    editor.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );

  /* ── MDI icon SVG paths ───────────────────────────────── */
  const mdiDrag =
    'M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z';
  const mdiDelete =
    'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z';
  const mdiPlus = 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z';
  const mdiArrowUp =
    'M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z';
  const mdiArrowDown =
    'M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z';

  /* ================================================================
     ListCardEditor
     ================================================================ */
  class ListCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {};
      this._hass = null;
      this._dragSrcIdx = null;
    }

    /* ── HA lifecycle ── */

    set hass(hass) {
      this._hass = hass;
      const f = this.shadowRoot?.getElementById('entity-form');
      if (f) f.hass = hass;
    }

    setConfig(config) {
      this._config = JSON.parse(JSON.stringify(config || {}));
      this._build();
    }

    get value() {
      return this._config;
    }

    /* ── Field helpers ─────────────────────────────────── */

    _text(label, value, onChange, hint) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const tf = document.createElement('ha-textfield');
      tf.label = label;
      tf.value = value || '';
      const commit = () => onChange(tf.value || '');
      tf.addEventListener('change', commit);
      tf.addEventListener('blur', commit);
      wrap.appendChild(tf);
      if (hint) {
        const h = document.createElement('span');
        h.className = 'helper';
        h.innerHTML = hint;
        wrap.appendChild(h);
      }
      return wrap;
    }

    _number(label, value, onChange, hint) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const tf = document.createElement('ha-textfield');
      tf.label = label;
      tf.type = 'number';
      tf.value = value == null ? '' : String(value);
      const commit = () => {
        const v = tf.value;
        onChange(v === '' || isNaN(Number(v)) ? null : Number(v));
      };
      tf.addEventListener('change', commit);
      tf.addEventListener('blur', commit);
      wrap.appendChild(tf);
      if (hint) {
        const h = document.createElement('span');
        h.className = 'helper';
        h.innerHTML = hint;
        wrap.appendChild(h);
      }
      return wrap;
    }

    _select(label, value, options, onChange, hint) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const sel = document.createElement('ha-select');
      sel.label = label;
      sel.value = value || '';
      sel.fixedMenuPosition = true;
      sel.naturalMenuWidth = true;

      // Prevent parent dialog from closing when the dropdown menu closes
      const swallow = (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation?.();
      };
      sel.addEventListener('opened', swallow);
      sel.addEventListener('closed', swallow);

      for (const [val, text] of options) {
        const it = document.createElement('mwc-list-item');
        it.value = val;
        it.textContent = text;
        if (val === (value || '')) it.selected = true;
        sel.appendChild(it);
      }

      sel.addEventListener('selected', () =>
        setTimeout(() => onChange(sel.value || ''), 0)
      );

      wrap.appendChild(sel);
      if (hint) {
        const h = document.createElement('span');
        h.className = 'helper';
        h.textContent = hint;
        wrap.appendChild(h);
      }
      return wrap;
    }

    _iconBtn(path, label, onClick) {
      const btn = document.createElement('ha-icon-button');
      btn.label = label;
      btn.title = label;
      const icon = document.createElement('ha-svg-icon');
      icon.path = path;
      btn.appendChild(icon);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return btn;
    }

    /* ── Main build ────────────────────────────────────── */

    _build() {
      const root = this.shadowRoot;
      root.innerHTML = '';

      /* ── Scoped styles ── */
      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; }

        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
        }

        ha-expansion-panel {
          --expansion-panel-summary-padding: 0 16px;
          --expansion-panel-content-padding: 0 16px 16px;
          display: block;
        }

        .section-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 12px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .field ha-textfield,
        .field ha-select { width: 100%; }

        .helper {
          font-size: 12px;
          line-height: 1.4;
          color: var(--secondary-text-color);
          padding: 0 16px;
        }
        .helper code {
          background: var(--secondary-background-color);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 11px;
        }

        /* ── Column list ── */
        .columns-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .column-item {
          display: flex;
          align-items: stretch;
          transition: opacity 180ms ease;
        }
        .column-item.dragging { opacity: 0.35; }
        .column-item.drag-over > ha-expansion-panel {
          border-color: var(--primary-color) !important;
          box-shadow: 0 0 0 1px var(--primary-color);
        }
        .column-item ha-expansion-panel {
          flex: 1;
          min-width: 0;
        }

        .drag-handle {
          display: flex;
          align-items: center;
          padding: 0 2px 0 0;
          cursor: grab;
          color: var(--secondary-text-color);
          --mdc-icon-size: 20px;
        }
        .drag-handle:active { cursor: grabbing; }

        .col-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 4px;
          padding-top: 4px;
          border-top: 1px solid var(--divider-color, #e0e0e0);
          margin-top: 8px;
        }

        .add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          border: 1px dashed var(--divider-color, #e0e0e0);
          border-radius: 12px;
          background: none;
          color: var(--primary-color);
          font: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 150ms, color 150ms;
          --mdc-icon-size: 18px;
        }
        .add-btn:hover {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
        }
        .add-btn ha-svg-icon { pointer-events: none; }

        ha-form { width: 100%; }
      `;
      root.appendChild(style);

      const editor = document.createElement('div');
      editor.className = 'editor';

      /* ── Entity picker ── */
      const entityForm = document.createElement('ha-form');
      entityForm.id = 'entity-form';
      entityForm.schema = [{ name: 'entity', selector: { entity: {} } }];
      entityForm.data = { entity: this._config.entity || '' };
      entityForm.computeLabel = (s) => (s.name === 'entity' ? 'Entity' : '');
      entityForm.computeHelper = () => '';
      if (this._hass) entityForm.hass = this._hass;
      entityForm.addEventListener('value-changed', (e) => {
        const next = e.detail?.value?.entity || '';
        if (this._config.entity === next) return;
        this._config.entity = next;
        entityForm.data = { entity: next };
        fireConfig(this, this._config);
      });
      editor.appendChild(entityForm);

      /* ── Card Settings (collapsible) ── */
      const settingsPanel = document.createElement('ha-expansion-panel');
      settingsPanel.outlined = true;
      settingsPanel.header = 'Card Settings';
      settingsPanel.expanded = true;

      const sc = document.createElement('div');
      sc.className = 'section-content';

      sc.appendChild(
        this._text(
          'Title',
          this._config.title,
          (v) => {
            if ((this._config.title || '') === v) return;
            if (v) this._config.title = v;
            else delete this._config.title;
            fireConfig(this, this._config);
          },
          'Optional. Supports HTML (&lt;a&gt;, &lt;strong&gt;, &lt;em&gt;, etc.).'
        )
      );

      sc.appendChild(
        this._text(
          'Feed attribute',
          this._config.feed_attribute,
          (v) => {
            const t = v.trim();
            if ((this._config.feed_attribute || '') === t) return;
            if (t) this._config.feed_attribute = t;
            else delete this._config.feed_attribute;
            fireConfig(this, this._config);
          },
          'Attribute containing the list. Defaults to <code>feed</code> or entity attributes.'
        )
      );

      sc.appendChild(
        this._number(
          'Row limit',
          this._config.row_limit,
          (n) => {
            if (this._config.row_limit === n) return;
            if (n == null) delete this._config.row_limit;
            else this._config.row_limit = n;
            fireConfig(this, this._config);
          },
          'Maximum rows to display.'
        )
      );

      settingsPanel.appendChild(sc);
      editor.appendChild(settingsPanel);

      /* ── Columns (collapsible, with draggable items) ── */
      const colCount = (this._config.columns || []).length;
      const colPanel = document.createElement('ha-expansion-panel');
      colPanel.outlined = true;
      colPanel.id = 'columns-panel';
      colPanel.header = `Columns (${colCount})`;
      colPanel.expanded = true;

      const cc = document.createElement('div');
      cc.className = 'section-content';

      const colList = document.createElement('div');
      colList.className = 'columns-list';
      colList.id = 'columns-list';
      cc.appendChild(colList);

      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.type = 'button';
      const addIcon = document.createElement('ha-svg-icon');
      addIcon.path = mdiPlus;
      addBtn.append(addIcon, document.createTextNode(' Add column'));
      addBtn.addEventListener('click', () => {
        if (!Array.isArray(this._config.columns)) this._config.columns = [];
        this._config.columns.push({ field: '', title: '' });
        fireConfig(this, this._config);
        this._refreshColumns(this._config.columns.length - 1);
      });
      cc.appendChild(addBtn);

      colPanel.appendChild(cc);
      editor.appendChild(colPanel);

      root.appendChild(editor);
      this._refreshColumns();

      // Nudge the entity picker once HA finishes upgrading it
      queueMicrotask(() => {
        const f = root.getElementById('entity-form');
        if (f && this._hass) {
          f.hass = this._hass;
          f.data = { entity: this._config.entity || '' };
        }
      });
    }

    /* ── Column list builder ───────────────────────────── */

    _refreshColumns(forceExpandIdx) {
      const container = this.shadowRoot?.getElementById('columns-list');
      if (!container) return;

      // Preserve which panels are currently expanded
      const expanded = new Set();
      container.querySelectorAll('.column-item').forEach((el) => {
        const p = el.querySelector('ha-expansion-panel');
        if (p?.expanded) expanded.add(Number(el.dataset.index));
      });
      if (forceExpandIdx != null) expanded.add(forceExpandIdx);

      container.innerHTML = '';

      const cols = Array.isArray(this._config.columns)
        ? this._config.columns
        : [];

      // Update outer panel header count
      const cp = this.shadowRoot?.getElementById('columns-panel');
      if (cp) cp.header = `Columns (${cols.length})`;

      cols.forEach((col, idx) => {
        const item = document.createElement('div');
        item.className = 'column-item';
        item.dataset.index = String(idx);

        /* ── Drag handle ── */
        const handle = document.createElement('div');
        handle.className = 'drag-handle';
        handle.draggable = true;
        const hIcon = document.createElement('ha-svg-icon');
        hIcon.path = mdiDrag;
        handle.appendChild(hIcon);

        handle.addEventListener('dragstart', (e) => {
          this._dragSrcIdx = idx;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx));
          requestAnimationFrame(() => item.classList.add('dragging'));
        });

        handle.addEventListener('dragend', () => {
          this._dragSrcIdx = null;
          container
            .querySelectorAll('.column-item')
            .forEach((el) => el.classList.remove('dragging', 'drag-over'));
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (this._dragSrcIdx !== idx) item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () =>
          item.classList.remove('drag-over')
        );
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drag-over');
          const from = this._dragSrcIdx;
          if (from == null || from === idx) return;
          const arr = this._config.columns;
          const [moved] = arr.splice(from, 1);
          arr.splice(idx, 0, moved);
          fireConfig(this, this._config);
          this._refreshColumns(idx);
        });

        /* ── Expansion panel per column ── */
        const panel = document.createElement('ha-expansion-panel');
        panel.outlined = true;
        const label = col.field
          ? `Column ${idx + 1}: ${col.field}`
          : `Column ${idx + 1}`;
        panel.header = label;
        if (expanded.has(idx)) panel.expanded = true;

        const content = document.createElement('div');
        content.className = 'section-content';

        /* Field */
        content.appendChild(
          this._text(
            'Field',
            col.field,
            (v) => {
              if (cols[idx].field === v) return;
              cols[idx].field = v;
              panel.header = v
                ? `Column ${idx + 1}: ${v}`
                : `Column ${idx + 1}`;
              fireConfig(this, this._config);
            },
            'Attribute key in each list item (e.g. "title", "image").'
          )
        );

        /* Header title */
        content.appendChild(
          this._text(
            'Header title',
            col.title,
            (v) => {
              if ((cols[idx].title || '') === v) return;
              cols[idx].title = v;
              fireConfig(this, this._config);
            },
            'Column header text. HTML allowed.'
          )
        );

        /* Type */
        content.appendChild(
          this._select(
            'Type',
            col.type || '',
            [
              ['', 'None (text)'],
              ['image', 'Image'],
              ['icon', 'Icon'],
            ],
            (v) => {
              if ((cols[idx].type || '') === v) return;
              if (v) cols[idx].type = v;
              else delete cols[idx].type;
              fireConfig(this, this._config);
              this._refreshColumns(idx);
            },
            'Leave as "None" for plain text.'
          )
        );

        /* Link field */
        content.appendChild(
          this._text(
            'Link field',
            col.add_link,
            (v) => {
              const t = v.trim();
              if ((cols[idx].add_link || '') === t) return;
              if (t) cols[idx].add_link = t;
              else delete cols[idx].add_link;
              fireConfig(this, this._config);
            },
            'Field containing a URL to wrap the cell content.'
          )
        );

        /* Column width */
        content.appendChild(
          this._text(
            'Column width',
            col.col_width,
            (v) => {
              const t = v.trim();
              if ((cols[idx].col_width || '') === t) return;
              if (t) cols[idx].col_width = t;
              else delete cols[idx].col_width;
              fireConfig(this, this._config);
            },
            'Any CSS width (e.g. 120px, 25%, 10rem).'
          )
        );

        /* Image width / height — only shown when type = image */
        if (col.type === 'image') {
          content.appendChild(
            this._number(
              'Image width',
              col.width,
              (n) => {
                if (cols[idx].width === n) return;
                if (n == null) delete cols[idx].width;
                else cols[idx].width = n;
                fireConfig(this, this._config);
              },
              'Default 70.'
            )
          );
          content.appendChild(
            this._number(
              'Image height',
              col.height,
              (n) => {
                if (cols[idx].height === n) return;
                if (n == null) delete cols[idx].height;
                else cols[idx].height = n;
                fireConfig(this, this._config);
              },
              'Default 90.'
            )
          );
        }

        /* ── Column actions (move / delete) ── */
        const actions = document.createElement('div');
        actions.className = 'col-actions';

        if (idx > 0) {
          actions.appendChild(
            this._iconBtn(mdiArrowUp, 'Move up', () => {
              const [m] = cols.splice(idx, 1);
              cols.splice(idx - 1, 0, m);
              fireConfig(this, this._config);
              this._refreshColumns(idx - 1);
            })
          );
        }
        if (idx < cols.length - 1) {
          actions.appendChild(
            this._iconBtn(mdiArrowDown, 'Move down', () => {
              const [m] = cols.splice(idx, 1);
              cols.splice(idx + 1, 0, m);
              fireConfig(this, this._config);
              this._refreshColumns(idx + 1);
            })
          );
        }
        actions.appendChild(
          this._iconBtn(mdiDelete, 'Remove column', () => {
            cols.splice(idx, 1);
            fireConfig(this, this._config);
            this._refreshColumns();
          })
        );

        content.appendChild(actions);
        panel.appendChild(content);
        item.append(handle, panel);
        container.appendChild(item);
      });
    }
  }

  customElements.define('list-card-editor', ListCardEditor);
})();
