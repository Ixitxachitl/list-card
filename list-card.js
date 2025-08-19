console.log(`%clist-card\n%cVersion: ${'0.0.1'}`, 'color: rebeccapurple; font-weight: bold;', '');

class ListCard extends HTMLElement {

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
      if (!config.entity) {
        throw new Error('Please define an entity');
      }

      const root = this.shadowRoot;
      if (root.lastChild) root.removeChild(root.lastChild);

      const cardConfig = Object.assign({}, config);
      const columns = cardConfig.columns;
      const card = document.createElement('ha-card');
      const content = document.createElement('div');
      const style = document.createElement('style');
      style.textContent = `
            ha-card {
              /* sample css */
            }
            table {
              width: 100%;
              padding: 0 16px 16px 16px;
            }
            thead th {
              text-align: left;
            }
            tbody tr:nth-child(odd) {
              background-color: var(--paper-card-background-color);
            }
            tbody tr:nth-child(even) {
              background-color: var(--secondary-background-color);
            }
            .button {
              overflow: auto;
              padding: 16px;
            }
            paper-button {
              float: right;
            }
            td a {
              color: var(--primary-text-color);
              text-decoration-line: none;
              font-weight: normal;
            }
          `;

      // Go through columns and add CSS sytling to each column that is defined
      if (columns) {
        for (let column in columns) {
          if (columns.hasOwnProperty(column) && columns[column].hasOwnProperty('style')) {
            let styles = columns[column]['style'];

            style.textContent += `
              .${columns[column].field} {`

            for (let index in styles) {
              if (styles.hasOwnProperty(index)) {
                for (let s in styles[index]) {
                  style.textContent += `
                  ${s}: ${styles[index][s]};`;
                }
              }
            }

            style.textContent += `}`;
          }
        }
      }

      content.id = "container";
      cardConfig.title ? card.header = cardConfig.title : null;
      card.appendChild(content);
      card.appendChild(style);
      root.appendChild(card);
      this._config = cardConfig;
    }

    set hass(hass) {
      const config = this._config;
      const root = this.shadowRoot;
      const card = root.lastChild;

      if (hass.states[config.entity]) {
        const feed = config.feed_attribute ? hass.states[config.entity].attributes[config.feed_attribute] : hass.states[config.entity].attributes;
        const columns = config.columns;
        this.style.display = 'block';
        const rowLimit = config.row_limit ? config.row_limit : Object.keys(feed).length;
        let rows = 0;

        if (feed !== undefined && Object.keys(feed).length > 0) {
          let card_content = '<table><thread><tr>';

          if (!columns) {
            card_content += `<tr>`;

            for (let column in feed[0]) {
              if (feed[0].hasOwnProperty(column)) {
                card_content += `<th>${feed[0][column]}</th>`;
              }
            }
          } else {
            for (let column in columns) {
              if (columns.hasOwnProperty(column)) {
                card_content += `<th class=${columns[column].field}>${columns[column].title}</th>`;
              }
            }
          }

          card_content += `</tr></thead><tbody>`;

          for (let entry in feed) {
            if (rows >= rowLimit) break;

            if (feed.hasOwnProperty(entry)) {
              if (!columns) {
                for (let field in feed[entry]) {
                  if (feed[entry].hasOwnProperty(field)) {
                    card_content += `<td>${feed[entry][field]}</td>`;
                  }
                }
              } else {
                let has_field = true;

                for (let column in columns) {
                  if (!feed[entry].hasOwnProperty(columns[column].field)) {
                    has_field = false;
                    break;
                  }
                }

                if (!has_field) continue;
                card_content += `<tr>`;

                for (let column in columns) {
                  if (columns.hasOwnProperty(column)) {
                    card_content += `<td class=${columns[column].field}>`;

                    if (columns[column].hasOwnProperty('add_link')) {
                      card_content +=  `<a href="${feed[entry][columns[column].add_link]}" target='_blank'>`;
                    }

                    if (columns[column].hasOwnProperty('type')) {
                      if (columns[column].type === 'image') {
                        if (columns[column].hasOwnProperty('width')) {
                          var image_width = columns[column].width;
                        } else {
                          var image_width = 70;
                        }
                        if (columns[column].hasOwnProperty('height')) {
                          var image_height = columns[column].height;
                        } else {
                          var image_height = 90;
                        }
                        if (feed[entry][columns[column].field][0].hasOwnProperty('url')) {
                            var url = feed[entry][columns[column].field][0].url
                        } else {
                          var url = feed[entry][columns[column].field]
                        }
                          card_content += `<img id="image" src="${url}" width="${image_width}" height="${image_height}">`;
                      } else if (columns[column].type === 'icon') {
                        card_content += `<ha-icon class="column-${columns[column].field}" icon=${feed[entry][columns[column].field]}></ha-icon>`;
                      }
                      // else if (columns[column].type === 'button') {
                      //   card_content += `<paper-button raised>${feed[entry][columns[column].button_text]}</paper-button>`;
                      // }
                    } else {
                      let newText = feed[entry][columns[column].field];

                      if (columns[column].hasOwnProperty('regex')) {
                        newText = new RegExp(columns[column].regex, 'u').exec(feed[entry][columns[column].field]);
                      } 
                      if (columns[column].hasOwnProperty('prefix')) {
                        newText = columns[column].prefix + newText;
                      } 
                      if (columns[column].hasOwnProperty('postfix')) {
                        newText += columns[column].postfix;
                      }

                      card_content += `${newText}`;
                    }

                    if (columns[column].hasOwnProperty('add_link')) {
                      card_content +=  `</a>`;
                    }

                    card_content += `</td>`;
                  }
                }
              }

              card_content += `</tr>`;
              ++rows;
            }
          }

          root.lastChild.hass = hass;
          card_content += `</tbody></table>`;
          root.getElementById('container').innerHTML = card_content;
        } else {
          this.style.display = 'none';
        }
      } else {
        this.style.display = 'none';
      }
    }

    getCardSize() {
      return 1;
    }
  }

  customElements.define('list-card', ListCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "list-card",
  name: "List Card",
  preview: false,
  description: "The List Card generate table with data from sensor that provides data as a list of attributes."
});

/* ------------------------------
   Visual Editor (non-breaking)
   ------------------------------ */

/* Attach visual-editor hooks without modifying the existing class body */
ListCard.getConfigElement = function () {
  return document.createElement('list-card-editor');
};
ListCard.getStubConfig = function () {
  return {
    entity: '',
    title: '',
    row_limit: 5,
    // Columns remain optional; editor helps you build them
  };
};

/* Lightweight helper */
function lc_fireConfigChanged(el, config) {
  el.dispatchEvent(new CustomEvent('config-changed', {
    detail: { config },
    bubbles: true,
    composed: true,
  }));
}

function lc_normalizeColumns(cols) {
  if (!cols) return [];
  if (Array.isArray(cols)) return cols;
  if (typeof cols === 'object') {
    // Convert {0:{...},1:{...}} or {a:{...}} → [{...}, {...}]
    return Object.keys(cols)
      .sort((a, b) => {
        // keep numeric-ish keys in order; otherwise fallback to alpha
        const na = Number(a), nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      })
      .map(k => cols[k]);
  }
  return [];
}

/* Visual Editor Element */
class ListCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    // Provide hass to HA pickers if present
    const picker = this.shadowRoot && this.shadowRoot.querySelector('#entity');
    if (picker && 'hass' in picker) picker.hass = hass;
  }

setConfig(config) {
  // Deep copy and legacy normalization
  const c = JSON.parse(JSON.stringify(config || {}));

  // Normalize legacy object-map columns to an array
  c.columns = lc_normalizeColumns(c.columns);

  // Coerce numeric fields so inputs populate immediately
  if (c.row_limit != null && c.row_limit !== '') {
    const n = Number(c.row_limit);
    if (!Number.isNaN(n)) c.row_limit = n;
  } else {
    delete c.row_limit;
  }

  // Per-column coercions and light cleanup
  c.columns.forEach(col => {
    if (col.width != null && col.width !== '') {
      const w = Number(col.width);
      if (!Number.isNaN(w)) col.width = w; else delete col.width;
    }
    if (col.height != null && col.height !== '') {
      const h = Number(col.height);
      if (!Number.isNaN(h)) col.height = h; else delete col.height;
    }
    // Ensure optional strings are really strings (prevents “undefined” showing up)
    ['field','title','type','add_link','prefix','postfix','regex'].forEach(k => {
      if (col[k] == null) delete col[k];
    });
  });

  this._config = c;

  // Build UI and immediately render columns so type-specific fields show without toggling
  this._render();
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
        .inline { display: flex; gap: 8px; align-items: center; }
        .small { width: 96px; }
        .hint { color: var(--secondary-text-color); font-size: 12px; }
        input[type="text"], input[type="number"], select, textarea {
          width: 100%; box-sizing: border-box; padding: 8px;
          border: 1px solid var(--divider-color, #ccc); border-radius: 6px; background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        textarea { min-height: 64px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      `;
      const form = document.createElement('div');
      form.className = 'form';

      // Top-level fields
      const row1 = document.createElement('div');
      row1.className = 'row';
      const entityWrap = document.createElement('div');
      const titleWrap = document.createElement('div');

      // Prefer HA entity picker if available
      let entityInput;
      if (customElements.get('ha-entity-picker')) {
        entityInput = document.createElement('ha-entity-picker');
        entityInput.label = 'Entity';
        entityInput.id = 'entity';
        entityInput.allowCustomEntity = true;
        if (this._hass) entityInput.hass = this._hass;
        entityInput.value = this._config.entity || '';
        entityInput.addEventListener('value-changed', (e) => {
          this._config.entity = e.detail.value || '';
          lc_fireConfigChanged(this, this._config);
        });
      } else {
        entityInput = document.createElement('input');
        entityInput.type = 'text';
        entityInput.placeholder = 'Entity (e.g., sensor.my_sensor)';
        entityInput.value = this._config.entity || '';
        entityInput.addEventListener('input', (e) => {
          this._config.entity = e.target.value;
          lc_fireConfigChanged(this, this._config);
        });
      }
      entityWrap.append(entityInput);

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'Title (optional)';
      titleInput.value = this._config.title || '';
      titleInput.addEventListener('input', (e) => {
        this._config.title = e.target.value;
        if (!this._config.title) delete this._config.title;
        lc_fireConfigChanged(this, this._config);
      });
      titleWrap.append(titleInput);
      row1.append(entityWrap, titleWrap);

      const row2 = document.createElement('div');
      row2.className = 'row';
      const feedWrap = document.createElement('div');
      const limitWrap = document.createElement('div');

      const feedInput = document.createElement('input');
      feedInput.type = 'text';
      feedInput.placeholder = 'feed_attribute (optional)';
      feedInput.value = this._config.feed_attribute || '';
      feedInput.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (v) this._config.feed_attribute = v; else delete this._config.feed_attribute;
        lc_fireConfigChanged(this, this._config);
      });
      feedWrap.append(feedInput);

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
      row2.append(feedWrap, limitWrap);

      // Columns editor
      const colsFs = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Columns';
      colsFs.append(legend);

      const colsHead = document.createElement('div');
      colsHead.className = 'col-head';
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Define how each column maps to a field and how it should render.';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = 'Add column';
      addBtn.addEventListener('click', () => {
        if (!Array.isArray(this._config.columns)) this._config.columns = [];
        this._config.columns.push({ field: '', title: '' });
        lc_fireConfigChanged(this, this._config);
        this._rebuildColumns(colsWrap); // refresh
      });
      colsHead.append(hint, addBtn);
      colsFs.append(colsHead);

      const colsWrap = document.createElement('div');
      colsWrap.className = 'cols';
      colsFs.append(colsWrap);

      // Optional raw JSON for styles per column (advanced)
      const advFs = document.createElement('fieldset');
      const advLegend = document.createElement('legend');
      advLegend.textContent = 'Advanced (per-column style JSON)';
      const advHint = document.createElement('div');
      advHint.className = 'hint';
      advHint.textContent = 'In each column you can set "style" as an array of CSS objects (e.g., [{"font-weight":"bold"}]).';
      advFs.append(advLegend, advHint);

      form.append(row1, row2, colsFs, advFs);
      root.append(style, form);

      this._built = true;
    }

    // Always (re)fill values
    const entity = this.shadowRoot.querySelector('#entity');
    if (entity && !entity.value) entity.value = this._config.entity || '';

    this._rebuildColumns(this.shadowRoot.querySelector('.cols'));
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
      titleInput.placeholder = 'title (column header)';
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
      const types = ['', 'image', 'icon'];
      types.forEach((t) => {
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
        // rebuild to show/hide image size fields
        this._rebuildColumns(container);
      });

      const linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.placeholder = 'add_link (field providing URL, optional)';
      linkInput.value = col.add_link || '';
      linkInput.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (v) cols[idx].add_link = v; else delete cols[idx].add_link;
        lc_fireConfigChanged(this, this._config);
      });
      r2.append(typeSelect, linkInput);

      // image width/height (only when type === 'image')
      const r3 = document.createElement('div');
      r3.className = 'row';
      if ((col.type || '') === 'image') {
        const w = document.createElement('input');
        w.type = 'number';
        w.placeholder = 'width (default 70)';
        w.value = (col.width != null ? col.width : '');
        w.addEventListener('input', (e) => {
          const val = e.target.value;
          if (val === '' || isNaN(Number(val))) {
            delete cols[idx].width;
          } else {
            cols[idx].width = Number(val);
          }
          lc_fireConfigChanged(this, this._config);
        });

        const h = document.createElement('input');
        h.type = 'number';
        h.placeholder = 'height (default 90)';
        h.value = (col.height != null ? col.height : '');
        h.addEventListener('input', (e) => {
          const val = e.target.value;
          if (val === '' || isNaN(Number(val))) {
            delete cols[idx].height;
          } else {
            cols[idx].height = Number(val);
          }
          lc_fireConfigChanged(this, this._config);
        });
        r3.append(w, h);
      }

      // prefix / postfix
      const r4 = document.createElement('div');
      r4.className = 'row';
      const pref = document.createElement('input');
      pref.type = 'text';
      pref.placeholder = 'prefix (optional)';
      pref.value = col.prefix || '';
      pref.addEventListener('input', (e) => {
        const v = e.target.value;
        if (v) cols[idx].prefix = v; else delete cols[idx].prefix;
        lc_fireConfigChanged(this, this._config);
      });

      const post = document.createElement('input');
      post.type = 'text';
      post.placeholder = 'postfix (optional)';
      post.value = col.postfix || '';
      post.addEventListener('input', (e) => {
        const v = e.target.value;
        if (v) cols[idx].postfix = v; else delete cols[idx].postfix;
        lc_fireConfigChanged(this, this._config);
      });
      r4.append(pref, post);

      // regex
      const r5 = document.createElement('div');
      r5.className = 'row single';
      const regex = document.createElement('input');
      regex.type = 'text';
      regex.placeholder = 'regex (optional, used with new RegExp(..., "u"))';
      regex.value = col.regex || '';
      regex.addEventListener('input', (e) => {
        const v = e.target.value;
        if (v) cols[idx].regex = v; else delete cols[idx].regex;
        lc_fireConfigChanged(this, this._config);
      });
      r5.append(regex);

      // style (advanced JSON array of objects)
      const r6 = document.createElement('div');
      r6.className = 'row single';
      const styleArea = document.createElement('textarea');
      styleArea.placeholder = 'style (JSON array of CSS objects, e.g. [{ "font-weight": "bold" }])';
      styleArea.value = Array.isArray(col.style) ? JSON.stringify(col.style, null, 2) : (col.style || '');
      styleArea.addEventListener('input', (e) => {
        const txt = e.target.value.trim();
        if (!txt) {
          delete cols[idx].style;
          lc_fireConfigChanged(this, this._config);
          return;
        }
        try {
          const parsed = JSON.parse(txt);
          cols[idx].style = parsed;
          styleArea.setCustomValidity('');
          lc_fireConfigChanged(this, this._config);
        } catch (err) {
          // show validation error but do not overwrite config until valid JSON
          styleArea.setCustomValidity('Invalid JSON');
          styleArea.reportValidity();
        }
      });
      r6.append(styleArea);

      // row actions
      const actions = document.createElement('div');
      actions.className = 'inline';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove column';
      removeBtn.addEventListener('click', () => {
        cols.splice(idx, 1);
        lc_fireConfigChanged(this, this._config);
        this._rebuildColumns(container);
      });
      actions.append(removeBtn);

      fs.append(r1, r2, r3, r4, r5, r6, actions);
      container.append(fs);
    });
  }

  get value() {
    return this._config;
  }
}

customElements.define('list-card-editor', ListCardEditor);
