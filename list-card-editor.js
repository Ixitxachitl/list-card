// list-card-editor.js

// 🔑 Top-level imports ensure HA’s editor components are DEFINED
// before <list-card-editor> is constructed (same idea as core editors).
import "../../../components/ha-entity-picker";
import "../../../components/ha-textfield";
import "../../../components/ha-select";

// If you use <mwc-list-item> in a type select:
import "@material/mwc-list/mwc-list-item.js";

function fireConfigChanged(el, config) {
  el.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
}

class ListCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    const picker = this.shadowRoot?.getElementById("entity");
    if (picker) { try { picker.hass = hass; } catch (_) {} }
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
      root.innerHTML = `
        <style>
          :host { display:block; }
          .form { padding:12px; display:grid; grid-template-columns:1fr; gap:18px; }
          fieldset { border:1px solid var(--divider-color,#e0e0e0); border-radius:10px; padding:18px 16px; margin:0; background:var(--card-background-color); }
          fieldset > * + * { margin-top:12px; }
          legend { padding:0 6px; font-weight:600; color:var(--secondary-text-color); }
          .row { display:grid; grid-template-columns:1fr; gap:12px; }
          .cols { display:grid; grid-auto-rows:min-content; gap:18px; }
          .actions { display:flex; gap:8px; }
          button { cursor:pointer; }
          ha-textfield, ha-select, ha-entity-picker { width:100%; }
          .lc-field { display:flex; flex-direction:column; gap:6px; }
          .lc-label { font-size: var(--paper-font-body1_-_font-size, 0.875rem); color: var(--secondary-text-color); font-weight:600; line-height:1.2; }
          ha-select.lc-type { --mdc-list-vertical-padding: 8px; --mdc-menu-item-height: 40px; }
        </style>
        <div class="form">
          <div class="row">
            <ha-entity-picker id="entity" label="Entity" allow-custom-entity></ha-entity-picker>
          </div>
          <div class="row">
            <ha-textfield id="title" label="Title (text or HTML)"></ha-textfield>
          </div>
          <div class="row">
            <ha-textfield id="feed" label="feed_attribute (optional)"></ha-textfield>
          </div>
          <div class="row">
            <ha-textfield id="limit" label="row_limit (optional)" type="number"></ha-textfield>
          </div>

          <fieldset>
            <legend>Columns</legend>
            <div class="actions"><button id="add">Add column</button></div>
            <div class="cols" id="cols"></div>
          </fieldset>
        </div>
      `;

      // Wire inputs (commit on blur/change only)
      const picker = root.getElementById("entity");
      const title  = root.getElementById("title");
      const feed   = root.getElementById("feed");
      const limit  = root.getElementById("limit");
      const colsEl = root.getElementById("cols");

      if (this._hass) { try { picker.hass = this._hass; } catch (_) {} }
      picker.value = this._config.entity || "";
      picker.addEventListener("value-changed", (e) => {
        const next = e.detail?.value || "";
        if ((this._config.entity || "") === next) return;
        this._config.entity = next; fireConfigChanged(this, this._config);
      });

      title.value = this._config.title || "";
      title.addEventListener("blur", () => {
        const v = title.value || "";
        if (v) this._config.title = v; else delete this._config.title;
        fireConfigChanged(this, this._config);
      });

      feed.value = this._config.feed_attribute || "";
      feed.addEventListener("blur", () => {
        const v = feed.value.trim();
        if (v) this._config.feed_attribute = v; else delete this._config.feed_attribute;
        fireConfigChanged(this, this._config);
      });

      limit.value = this._config.row_limit != null ? String(this._config.row_limit) : "";
      const commitLimit = () => {
        const v = limit.value;
        if (v === "" || isNaN(Number(v))) delete this._config.row_limit;
        else this._config.row_limit = Number(v);
        fireConfigChanged(this, this._config);
      };
      limit.addEventListener("blur", commitLimit);
      limit.addEventListener("change", commitLimit);

      root.getElementById("add").addEventListener("click", () => {
        if (!Array.isArray(this._config.columns)) this._config.columns = [];
        this._config.columns.push({ field: "", title: "" });
        fireConfigChanged(this, this._config);
        this._rebuildColumns(colsEl);
      });

      this._rebuildColumns(colsEl);
      this._built = true;
    }

    // keep entity picker synced if external changes happen
    const picker = this.shadowRoot.getElementById("entity");
    if (picker && picker.value !== (this._config.entity || "")) picker.value = this._config.entity || "";

    this._rebuildColumns(this.shadowRoot.getElementById("cols"));
  }

  _rebuildColumns(container) {
    if (!container) return;
    container.innerHTML = "";
    const cols = Array.isArray(this._config.columns) ? this._config.columns : [];

    cols.forEach((col, idx) => {
      const fs = document.createElement("fieldset");
      const lg = document.createElement("legend"); lg.textContent = `Column ${idx + 1}`; fs.append(lg);

      // field
      const rField = document.createElement("div"); rField.className = "row";
      const field = document.createElement("ha-textfield"); field.label = "field (attribute name)"; field.value = col.field || "";
      field.addEventListener("blur", () => { const v = field.value || ""; if (v !== (col.field || "")) { col.field = v; fireConfigChanged(this, this._config); }});
      rField.append(field);

      // title
      const rTitle = document.createElement("div"); rTitle.className = "row";
      const title = document.createElement("ha-textfield"); title.label = "title (header text or HTML)"; title.value = col.title || "";
      title.addEventListener("blur", () => { const v = title.value || ""; if (v !== (col.title || "")) { col.title = v; fireConfigChanged(this, this._config); }});
      rTitle.append(title);

      // type
      const rType = document.createElement("div"); rType.className = "row";
      const wrap = document.createElement("div"); wrap.className = "lc-field";
      const lbl  = document.createElement("div"); lbl.className = "lc-label"; lbl.textContent = "type (optional)";
      const sel  = document.createElement("ha-select"); sel.classList.add("lc-type"); sel.value = col.type || "";
      ["", "image", "icon"].forEach((t) => {
        const it = document.createElement("mwc-list-item"); it.value = t; it.textContent = t === "" ? "(none)" : t;
        if (t === sel.value) it.selected = true; sel.append(it);
      });
      sel.addEventListener("selected", () => {
        const v = sel.value || "";
        if (v !== (col.type || "")) { if (v) col.type = v; else delete col.type; fireConfigChanged(this, this._config); this._rebuildColumns(container); }
      });
      wrap.append(lbl, sel); rType.append(wrap);

      // add_link
      const rLink = document.createElement("div"); rLink.className = "row";
      const link = document.createElement("ha-textfield"); link.label = "add_link (URL field, optional)"; link.value = col.add_link || "";
      link.addEventListener("blur", () => { const v = link.value || ""; if (v !== (col.add_link || "")) { if (v) col.add_link = v; else delete col.add_link; fireConfigChanged(this, this._config); }});
      rLink.append(link);

      // image size (conditional)
      if ((col.type || "") === "image") {
        const rW = document.createElement("div"); rW.className = "row";
        const w  = document.createElement("ha-textfield"); w.type = "number"; w.label = "image width (default 70)"; w.value = col.width != null ? String(col.width) : "";
        w.addEventListener("blur", () => { const v = w.value; const num = v === "" || isNaN(Number(v)) ? null : Number(v); if (num == null) delete col.width; else col.width = num; fireConfigChanged(this, this._config); });
        rW.append(w);

        const rH = document.createElement("div"); rH.className = "row";
        const h  = document.createElement("ha-textfield"); h.type = "number"; h.label = "image height (default 90)"; h.value = col.height != null ? String(col.height) : "";
        h.addEventListener("blur", () => { const v = h.value; const num = v === "" || isNaN(Number(v)) ? null : Number(v); if (num == null) delete col.height; else col.height = num; fireConfigChanged(this, this._config); });
        rH.append(h);

        fs.append(rW, rH);
      }

      // col_width
      const rColWidth = document.createElement("div"); rColWidth.className = "row";
      const colw = document.createElement("ha-textfield"); colw.label = "col_width (e.g., 120px or 25%)"; colw.value = col.col_width || "";
      colw.addEventListener("blur", () => { const v = (colw.value || "").trim(); if (v !== (col.col_width || "")) { if (v) col.col_width = v; else delete col.col_width; fireConfigChanged(this, this._config); }});
      rColWidth.append(colw);

      // actions
      const actions = document.createElement("div"); actions.className = "actions";
      const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "Remove column";
      rm.addEventListener("click", () => {
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

customElements.define("list-card-editor", ListCardEditor);
