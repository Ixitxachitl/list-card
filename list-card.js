/*
  List Card with Visual Editor
  - Keeps original behavior
  - Adds per-column width option (px or %)
  - Provides a Home Assistant Visual Editor via <ha-form>
*/

/* eslint no-console: 0 */
console.info(
  "%c list-card %cVersion: 0.0.2",
  "color: rebeccapurple; font-weight: bold;",
  ""
);

class ListCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static getConfigElement() {
    return document.createElement("list-card-editor");
  }

  static getStubConfig(hass, entities) {
    const first = entities && entities.length ? entities[0] : undefined;
    return {
      title: "List Card",
      entity: first || "sensor.example",
      row_limit: 5,
      columns: [
        { title: "Title", field: "title" },
        { title: "Subtitle", field: "subtitle" }
      ]
    };
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
    card.classList.add("ha-list-card");

    const content = document.createElement("div");
    content.id = "container";

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
      img#image {
        object-fit: cover;
        border-radius: 4px;
      }
    `;

    // Go through columns and add CSS styling to each column that is defined
    if (columns) {
      for (let i in columns) {
        if (!Object.prototype.hasOwnProperty.call(columns, i)) continue;
        const col = columns[i];
        const field = col.field;
        if (!field) continue;

        // Support original `style` object/array
        if (col.hasOwnProperty("style")) {
          const styles = col.style;
          if (Array.isArray(styles)) {
            styles.forEach((obj) => {
              if (!obj) return;
              for (let s in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, s)) continue;
                style.textContent += `\n.${field} { ${s}: ${obj[s]}; }`;
              }
            });
          } else if (styles && typeof styles === "object") {
            for (let s in styles) {
              if (!Object.prototype.hasOwnProperty.call(styles, s)) continue;
              style.textContent += `\n.${field} { ${s}: ${styles[s]}; }`;
            }
          }
        }

        // NEW: optional width per column (percent or pixels)
        if (col.width !== undefined && col.width !== null && col.width !== "") {
          let w = String(col.width).trim();
          if (/^\d+$/.test(w)) {
            // bare number => pixels
            w = `${w}px`;
          }
          // apply to both header and data cells
          style.textContent += `\nth.${field}, td.${field} { width: ${w}; max-width: ${w}; }`;
        }
      }
    }

    if (cardConfig.title) card.header = cardConfig.title;

    card.appendChild(content);
    card.appendChild(style);
    root.appendChild(card);
    this._config = cardConfig;
  }

  set hass(hass) {
    const config = this._config;
    const root = this.shadowRoot;

    if (!config || !root || !root.lastChild) return;

    const card = root.lastChild;

    if (hass.states[config.entity]) {
      const feed = config.feed_attribute
        ? hass.states[config.entity].attributes[config.feed_attribute]
        : hass.states[config.entity].attributes;

      const columns = config.columns;
      this.style.display = "block";
      const rowLimit = config.row_limit ? config.row_limit : (Array.isArray(feed) ? feed.length : Object.keys(feed || {}).length);
      let rows = 0;

      if (feed !== undefined && ((Array.isArray(feed) && feed.length > 0) || (typeof feed === "object" && Object.keys(feed).length > 0))) {
        let card_content = `<table>`;

        // Add a <colgroup> for widths if columns are defined
        if (columns && Array.isArray(columns) && columns.length) {
          card_content += `<colgroup>`;
          for (let i in columns) {
            if (!Object.prototype.hasOwnProperty.call(columns, i)) continue;
            const col = columns[i];
            let w = col && col.width !== undefined && col.width !== null && col.width !== "" ? String(col.width).trim() : "";
            if (w && /^\d+$/.test(w)) w = `${w}px`;
            card_content += w ? `<col style="width:${w}">` : `<col>`;
          }
          card_content += `</colgroup>`;
        }

        card_content += `<thead><tr>`;

        if (!columns) {
          // headers from first row keys
          const first = Array.isArray(feed) ? feed[0] : feed[Object.keys(feed)[0]];
          for (let column in first) {
            if (Object.prototype.hasOwnProperty.call(first, column)) {
              card_content += `<th>${this._escape(first[column])}</th>`;
            }
          }
        } else {
          for (let i in columns) {
            if (!Object.prototype.hasOwnProperty.call(columns, i)) continue;
            const col = columns[i];
            const cls = col.field ? ` class="${col.field}"` : "";
            card_content += `<th${cls}>${this._escape(col.title)}</th>`;
          }
        }

        card_content += `</tr></thead><tbody>`;

        const entries = Array.isArray(feed) ? feed : Object.values(feed);
        for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
          if (rows >= rowLimit) break;
          const entry = entries[entryIndex];
          if (!columns) {
            card_content += `<tr>`;
            for (let field in entry) {
              if (Object.prototype.hasOwnProperty.call(entry, field)) {
                card_content += `<td>${this._escape(entry[field])}</td>`;
              }
            }
            card_content += `</tr>`;
            ++rows;
            continue;
          }

          // Ensure all required fields exist
          let has_field = true;
          for (let i in columns) {
            if (!Object.prototype.hasOwnProperty.call(columns, i)) continue;
            const col = columns[i];
            if (!entry.hasOwnProperty(col.field)) { has_field = false; break; }
          }
          if (!has_field) continue;

          card_content += `<tr>`;

          for (let i in columns) {
            if (!Object.prototype.hasOwnProperty.call(columns, i)) continue;
            const col = columns[i];
            const cls = col.field ? ` class="${col.field}"` : "";
            card_content += `<td${cls}>`;

            let inner = "";
            if (col.hasOwnProperty("type")) {
              if (col.type === "image") {
                const image_width = col.hasOwnProperty("width") && typeof col.width === "number" ? col.width : (col.width && String(col.width).endsWith("px") ? parseInt(col.width, 10) : 70);
                const image_height = col.hasOwnProperty("height") ? col.height : 90;
                let url;
                const v = entry[col.field];
                if (Array.isArray(v) && v[0] && v[0].hasOwnProperty("url")) {
                  url = v[0].url;
                } else {
                  url = v;
                }
                inner += `<img id="image" src="${this._escapeAttr(url)}" width="${this._escapeAttr(image_width)}" height="${this._escapeAttr(image_height)}">`;
              } else if (col.type === "icon") {
                inner += `<ha-icon class="column-${this._escapeAttr(col.field)}" icon="${this._escapeAttr(entry[col.field])}"></ha-icon>`;
              }
            }

            if (!inner) {
              let newText = entry[col.field];
              if (col.hasOwnProperty("regex") && col.regex) {
                try {
                  const m = new RegExp(col.regex, "u").exec(String(entry[col.field]));
                  if (m) newText = m[0];
                } catch (e) {
                  // ignore regex errors
                }
              }
              if (col.hasOwnProperty("prefix")) newText = `${col.prefix}${newText}`;
              if (col.hasOwnProperty("postfix")) newText = `${newText}${col.postfix}`;
              inner = this._escape(String(newText));
            }

            if (col.hasOwnProperty("add_link") && entry[col.add_link]) {
              card_content += `<a href="${this._escapeAttr(entry[col.add_link])}" target="_blank">${inner}</a>`;
            } else {
              card_content += inner;
            }

            card_content += `</td>`;
          }

          card_content += `</tr>`;
          ++rows;
        }

        card_content += `</tbody></table>`;
        root.getElementById("container").innerHTML = card_content;
      } else {
        this.style.display = "none";
      }
    } else {
      this.style.display = "none";
    }
  }

  _escape(input) {
    if (input === null || input === undefined) return "";
    const s = String(input);
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _escapeAttr(input) {
    return this._escape(input);
  }

  getCardSize() {
    return 1;
  }
}

customElements.define("list-card", ListCard);

// --- Visual Editor (Home Assistant standard: ha-form) ---
class ListCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._schema = [
      { name: "title", selector: { text: {} } },
      { name: "entity", selector: { entity: {} } },
      { name: "feed_attribute", selector: { text: {} } },
      { name: "row_limit", selector: { number: { min: 1 } } },
      {
        name: "columns",
        type: "array",
        schema: [
          { name: "title", selector: { text: {} } },
          { name: "field", selector: { text: {} } },
          { name: "type", selector: { select: { mode: "dropdown", options: [
            { label: "Text", value: "text" },
            { label: "Icon", value: "icon" },
            { label: "Image", value: "image" }
          ] } } },
          { name: "prefix", selector: { text: {} } },
          { name: "postfix", selector: { text: {} } },
          { name: "regex", selector: { text: {} } },
          { name: "add_link", selector: { text: {} } },
          // NEW: width per column (px or %)
          { name: "width", selector: { text: { suffix: "px / %" } } },
          // Keep original custom inline styles structure (object)
          { name: "style", selector: { object: {} } },
          // Optional image-specific helpers
          { name: "height", selector: { number: { min: 0 } } }
        ],
        // Provide a compact summary for array rows
        grid_columns: 2
      }
    ];
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;
    // Clear
    while (this.shadowRoot.firstChild) this.shadowRoot.removeChild(this.shadowRoot.firstChild);

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      ha-form { padding: 8px 0; }
    `;

    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config || {};
    form.schema = this._schema;
    form.computeLabel = (schema) => {
      const capital = (s) => s && (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " "));
      if (schema.name === "columns") return "Columns";
      return capital(schema.name);
    };

    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const newConfig = ev.detail.value;
      this._config = newConfig;
      this.dispatchEvent(
        new CustomEvent("config-changed", { detail: { config: newConfig } })
      );
    });

    this.shadowRoot.append(style, form);
  }

  // For HA to know how tall editor is
  get value() {
    return this._config;
  }
}

customElements.define("list-card-editor", ListCardEditor);

// Lovelace card description (for HACS & card picker)
window.customCards = window.customCards || [];
window.customCards.push({
  type: "list-card",
  name: "List Card",
  preview: false,
  description: "The List Card generates a table from a sensor that provides a list of attributes. Now includes a visual editor and optional column widths (px or %)."
});
