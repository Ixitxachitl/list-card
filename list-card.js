console.log(`%clist-card\n%cVersion: ${'0.0.1'}`, 'color: rebeccapurple; font-weight: bold;', '');

class ListCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // ------- NEW: Visual editor hooks -------
  static getConfigElement() {
    return document.createElement('list-card-editor');
  }
  static getStubConfig() {
    return {
      title: 'List Card',
      entity: '',
      columns: [
        // { title: 'Title', field: 'title', column_width: '30%' },
        // { title: 'Icon', field: 'icon', type: 'icon', column_width: '80px' },
      ],
    };
  }
  // ----------------------------------------

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

    // Go through columns and add CSS styling to each column that is defined
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

        // ------- NEW: Per-column width via `column_width` (px or %) -------
        if (columns.hasOwnProperty(column) && columns[column].hasOwnProperty('column_width')) {
          let cw = columns[column].column_width;
          // If number provided, treat as pixels.
          if (typeof cw === 'number') {
            cw = `${cw}px`;
          }
          if (cw) {
            style.textContent += `
              th.${columns[column].field},
              td.${columns[column].field} {
                width: ${cw};
              }`;
          }
        }
        // -------------------------------------------------------------------
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

// Keep existing registration
customElements.define('list-card', ListCard);

// ---------------------------------------------------------------------------
// NEW: Visual Editor implementation using Home Assistant standards (ha-form)
// ---------------------------------------------------------------------------
const ListCardBase = customElements.get('ha-panel-lovelace')
  ? Object.getPrototypeOf(customElements.get('ha-panel-lovelace'))
  : Object.getPrototypeOf(customElements.get('hui-view'));

const LitElement = ListCardBase;
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

function fireEvent(node, type, detail, options) {
  options = options || {};
  const event = new Event(type, {
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    cancelable: Boolean(options.cancelable),
    composed: options.composed === undefined ? true : options.composed,
  });
  event.detail = detail || {};
  node.dispatchEvent(event);
  return event;
}

class ListCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  setConfig(config) {
    this._config = { ...config };
  }

  get _schema() {
    return [
      { name: 'title', selector: { text: {} } },
      { name: 'entity', selector: { entity: {} } },
      { name: 'feed_attribute', selector: { text: {} } },
      { name: 'row_limit', selector: { number: { min: 0 } } },
      {
        name: 'columns',
        type: 'array',
        schema: [
          { name: 'title', selector: { text: {} } },
          { name: 'field', selector: { text: {} } },
          { name: 'type', selector: { select: { options: [
              { value: '', label: 'text (default)' },
              { value: 'image', label: 'image' },
              { value: 'icon', label: 'icon' },
            ] } } },
          // NEW: column width (px or %) without changing image sizing semantics
          { name: 'column_width', selector: { text: {} } },
          { name: 'add_link', selector: { text: {} } },
          { name: 'prefix', selector: { text: {} } },
          { name: 'postfix', selector: { text: {} } },
          { name: 'regex', selector: { text: {} } },
          // Keep image sizing options available when type === 'image'
          { name: 'width', selector: { number: { min: 1 } } },
          { name: 'height', selector: { number: { min: 1 } } },
          // Optional: free-form style map (advanced users)
          // { name: 'style', selector: { object: {} } },
        ],
      },
    ];
  }

  _computeLabel = (schema) => {
    const labels = {
      title: 'Title',
      entity: 'Entity',
      feed_attribute: 'Feed attribute',
      row_limit: 'Row limit',
      columns: 'Columns',
      field: 'Field',
      type: 'Type',
      column_width: 'Column width (e.g., 120px or 25%)',
      add_link: 'Add link (attribute key with URL)',
      prefix: 'Prefix',
      postfix: 'Postfix',
      regex: 'Regex (JS pattern)',
      width: 'Image width (px)',
      height: 'Image height (px)',
      // style: 'Styles (object)',
    };
    return labels[schema.name] || schema.name;
  };

  render() {
    if (!this._config) return html``;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${this._schema}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  _valueChanged(ev) {
    this._config = ev.detail.value;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }
}

customElements.define('list-card-editor', ListCardEditor);

// Preserve your card catalog entry
window.customCards = window.customCards || [];
window.customCards.push({
  type: "list-card",
  name: "List Card",
  preview: false,
  description: "The List Card generate table with data from sensor that provides data as a list of attributes."
});
