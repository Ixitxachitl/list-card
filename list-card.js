// list-card with visual editor + per-column width support
// Version: 0.1.0 (extends original functionality without changing formatting)
// - Adds Visual (UI) Editor using Home Assistant standards (ha-form)
// - Adds optional per-column `width` (e.g., "120px" or "20%")

console.info(
  `%c list-card\n%cVersion: ${"0.1.0"}`,
  "color: rebeccapurple; font-weight: bold;",
  ""
);

const fireEvent = (node, type, detail = {}, options = {}) => {
  const event = new Event(type, {
    bubbles: options.bubbles !== undefined ? options.bubbles : true,
    cancelable: Boolean(options.cancelable),
    composed: options.composed !== undefined ? options.composed : true,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

class ListCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static getStubConfig(hass) {
    const firstSensor = Object.keys(hass?.states || {}).find((e) => e.startsWith("sensor."));
    return {
      title: "List Card",
      entity: firstSensor || "sensor.example",
      row_limit: 10,
      columns: [
        { field: "title", title: "Title", type: "text", width: "40%" },
        { field: "subtitle", title: "Subtitle", type: "text", width: "30%" },
        { field: "icon", title: "Icon", type: "icon", width: "100px" },
      ],
    };
  }

  static getConfigElement() {
    return document.createElement("list-card-editor");
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity");
    }

    const root = this.shadowRoot;
    if (root.lastChild) root.removeChild(root.lastChild);

    const cardConfig = Object.assign({}, config);
    const columns = cardConfig.columns;

    const card = document.createElement("ha-card");
    const content = document.createElement("div");
    const style = document.createElement("style");

    style.textContent = `
      ha-card {
        /* sample css */
      }
      table {
        width: 100%;
        padding: 0 16px 16px 16px;
        border-collapse: collapse;
      }
      thead th { text-align: left; }
      tbody tr:nth-child(odd) { background-color: var(--paper-card-background-color); }
      tbody tr:nth-child(even) { background-color: var(--secondary-background-color); }
      .button { overflow: auto; padding: 16px; }
      paper-button { float: right; }
      td a { color: var(--primary-text-color); text-decoration-line: none; font-weight: normal; }
    `;

    // Go through columns and add CSS styling to each column that is defined
    if (columns) {
      for (let i in columns) {
        if (!columns.hasOwnProperty(i)) continue;
        const col = columns[i];
        if (col && col.style) {
          const styles = col.style; // array of style objects
          style.textContent += `\n.${col.field} {`;
          for (let index in styles) {
            if (styles.hasOwnProperty(index)) {
              for (let s in styles[index]) {
                if (styles[index].hasOwnProperty(s)) {
                  style.textContent += `${s}: ${styles[index][s]};`;
                }
              }
            }
          }
          style.textContent += `}`;
        }
        // NEW: column width support (percent or pixels)
        if (col && col.width) {
          style.textContent += `\n.${col.field}{ width: ${col.width}; }`;
          style.textContent += `\nth.${col.field}{ width: ${col.width}; }`;
        }
      }
    }

    content.id = "container";
    if (cardConfig.title) card.header = cardConfig.title;
    card.appendChild(content);
    card.appendChild(style);
    root.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    const config = this._config;
    if (!config) return;
    const root = this.shadowRoot;

    if (hass.states[config.entity]) {
      const feed = config.feed_attribute
        ? hass.states[config.entity].attributes[config.feed_attribute]
        : hass.states[config.entity].attributes;
      const columns = config.columns;
      this.style.display = "block";
      const rowLimit = config.row_limit ? config.row_limit : Object.keys(feed).length;
      let rows = 0;

      if (feed !== undefined && Object.keys(feed).length > 0) {
        let card_content = `<table><thead><tr>`;

        if (!columns) {
          for (let column in feed[0]) {
            if (feed[0].hasOwnProperty(column)) {
              card_content += `<th>${feed[0][column]}</th>`;
            }
          }
        } else {
          for (let i in columns) {
            if (columns.hasOwnProperty(i)) {
              const col = columns[i];
              const cls = col.field;
              card_content += `<th class="${cls}">${col.title}</th>`;
            }
          }
        }

        card_content += `</tr></thead><tbody>`;

        for (let entry in feed) {
          if (rows >= rowLimit) break;
          if (!feed.hasOwnProperty(entry)) continue;

          if (!columns) {
            card_content += `<tr>`;
            for (let field in feed[entry]) {
              if (feed[entry].hasOwnProperty(field)) {
                card_content += `<td>${feed[entry][field]}</td>`;
              }
            }
            card_content += `</tr>`;
            ++rows;
            continue;
          }

          // Verify row has all required fields
          let has_field = true;
          for (let i in columns) {
            if (!columns.hasOwnProperty(i)) continue;
            if (!feed[entry].hasOwnProperty(columns[i].field)) { has_field = false; break; }
          }
          if (!has_field) continue;

          card_content += `<tr>`;
          for (let i in columns) {
            if (!columns.hasOwnProperty(i)) continue;
            const col = columns[i];
            card_content += `<td class="${col.field}">`;

            const maybeOpenLink = () => (col.hasOwnProperty('add_link') ? `<a href="${feed[entry][col.add_link]}" target="_blank">` : "");
            const maybeCloseLink = () => (col.hasOwnProperty('add_link') ? `</a>` : "");

            if (col.hasOwnProperty('type')) {
              if (col.type === 'image') {
                const image_width = col.hasOwnProperty('width') && String(col.width).match(/px$/) ? parseInt(col.width, 10) : (col.width ? col.width : 70);
                const image_height = col.hasOwnProperty('height') ? col.height : 90;
                const val = feed[entry][col.field];
                const url = Array.isArray(val) && val[0] && val[0].url ? val[0].url : val;
                card_content += `${maybeOpenLink()}<img id="image" src="${url}" width="${image_width}" height="${image_height}">${maybeCloseLink()}`;
              } else if (col.type === 'icon') {
                const icon = feed[entry][col.field];
                card_content += `${maybeOpenLink()}<ha-icon class="column-${col.field}" icon="${icon}"></ha-icon>${maybeCloseLink()}`;
              } else {
                // Default text
                let newText = feed[entry][col.field];
                if (col.hasOwnProperty('regex')) {
                  const match = new RegExp(col.regex, 'u').exec(String(feed[entry][col.field]));
                  newText = match ? match[0] : '';
                }
                if (col.hasOwnProperty('prefix')) newText = `${col.prefix}${newText}`;
                if (col.hasOwnProperty('postfix')) newText = `${newText}${col.postfix}`;
                card_content += `${maybeOpenLink()}${newText}${maybeCloseLink()}`;
              }
            } else {
              // No type specified -> render as text
              let newText = feed[entry][col.field];
              if (col.hasOwnProperty('regex')) {
                const match = new RegExp(col.regex, 'u').exec(String(feed[entry][col.field]));
                newText = match ? match[0] : '';
              }
              if (col.hasOwnProperty('prefix')) newText = `${col.prefix}${newText}`;
              if (col.hasOwnProperty('postfix')) newText = `${newText}${col.postfix}`;
              card_content += `${maybeOpenLink()}${newText}${maybeCloseLink()}`;
            }

            card_content += `</td>`;
          }
          card_content += `</tr>`;
          ++rows;
        }

        root.lastChild.hass = hass;
        card_content += `</tbody></table>`;
        root.getElementById("container").innerHTML = card_content;
      } else {
        this.style.display = "none";
      }
    } else {
      this.style.display = "none";
    }
  }

  getCardSize() {
    return 1;
  }
}

customElements.define("list-card", ListCard);

// Register in the UI catalog
window.customCards = window.customCards || [];
window.customCards.push({
  type: "list-card",
  name: "List Card",
  preview: false,
  description: "The List Card generates a table from a sensor that provides a list of attributes.",
});

// ===== Visual Editor (UI) =====
// Uses Home Assistant's ha-form component for a standard look and feel.
// Provides column-level `width` (text input that accepts values like "120px" or "25%").

let LitPkg;
try {
  // Prefer HA's own copy of lit
  LitPkg = window.Lit || window.litHtml || {};
} catch (e) {
  LitPkg = {};
}

// Fallback to module import if available environment supports it
let LitElementRef = window.LitElement;
let htmlRef = window.html;
let cssRef = window.css;

// If globals are not present, try dynamic import of 'lit' (HA supports modules for resources)
(async () => {
  if (!LitElementRef || !htmlRef) {
    try {
      const mod = await import("https://unpkg.com/lit@2.8.0/index.js?module");
      LitElementRef = mod.LitElement;
      htmlRef = mod.html;
      cssRef = mod.css;
    } catch (e) {
      // If lit cannot be loaded, the editor will not render, but card still works.
      // Avoid throwing to keep legacy behavior.
    }
  }
})();

class ListCardEditor extends (LitElementRef || HTMLElement) {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  setConfig(config) {
    this._config = {
      title: config.title,
      entity: config.entity,
      feed_attribute: config.feed_attribute,
      row_limit: config.row_limit,
      columns: config.columns || [],
    };
  }

  get _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "entity", required: true, selector: { entity: {} } },
      { name: "feed_attribute", selector: { text: {} } },
      { name: "row_limit", selector: { number: { min: 1 } } },
      {
        name: "columns",
        type: "array",
        title: "Columns",
        schema: [
          { name: "field", required: true, selector: { text: {} } },
          { name: "title", selector: { text: {} } },
          { name: "type", selector: { select: { options: [
            { value: "text", label: "Text" },
            { value: "image", label: "Image" },
            { value: "icon", label: "Icon" },
          ] } } },
          { name: "add_link", selector: { text: {} }, description: "Attribute key that contains a URL to wrap the cell value in a link" },
          { name: "prefix", selector: { text: {} } },
          { name: "postfix", selector: { text: {} } },
          { name: "regex", selector: { text: {} }, description: "JavaScript regex applied to the field value" },
          { name: "width", selector: { text: {} }, description: "Column width (e.g., '120px' or '25%')" },
          // Expose raw style as object for power users. Original behavior expects an array of objects.
          { name: "style", selector: { object: {} }, description: "Advanced: CSS declarations as array of objects" },
        ],
      },
    ];
  }

  _handleValueChanged(ev) {
    const newConfig = ev.detail.value;
    // Preserve unknown keys from the original config (do not change other functionality)
    const merged = Object.assign({}, this._config || {}, newConfig);
    this._config = merged;
    fireEvent(this, "config-changed", { config: merged });
  }

  render() {
    if (!htmlRef) {
      // lit not available yet; render nothing to avoid breaking the dialog
      return (this.innerHTML = "");
    }
    return htmlRef`
      <div class="card-editor">
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${this._schema}
          @value-changed=${this._handleValueChanged.bind(this)}
        ></ha-form>
      </div>
    `;
  }

  static get styles() {
    if (!cssRef) return undefined;
    return cssRef`
      .card-editor { padding: 8px 0; }
    `;
  }
}

if (!customElements.get("list-card-editor")) {
  customElements.define("list-card-editor", ListCardEditor);
}
