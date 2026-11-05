// Bulk entry, so nobody has to add things one by one:
//  1. "Add many items": an Excel-style table. Type, press Enter for the next row, or paste rows copied from Excel.
//  2. "Record purchases": one supplier / one receipt, many items. Type a price per item, or paste a whole column of prices.
(() => {
  const { $, esc, money, fq, today } = PP;

  /* ---------- helpers ---------- */
  const toNum = (v) => { const s = String(v ?? "").replace(/[^0-9.\-]/g, ""); const n = s === "" ? NaN : Number(s); return n; };   // "₱1,305.00" -> 1305
  const posOrBlank = (v) => { const n = toNum(v); return Number.isFinite(n) && n > 0 ? String(n) : ""; };                       // "₱0.00" -> ""
  const parseTable = (txt) => {                      // text copied from Excel: rows split by new line, cells by tab
    const rows = String(txt).replace(/\r\n?/g, "\n").split("\n");
    while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
    return rows.map(r => r.split("\t").map(c => c.trim().replace(/^"([\s\S]*)"$/, "$1").trim()));
  };
  const isMulti = (txt) => /[\t\n]/.test(String(txt).replace(/\r/g, "").replace(/\n+$/, ""));   // more than one cell? then it is a table paste
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const UNITS = new Set(("pcs pc bags bag sheets sheet rolls roll lengths length sets set boxes box pails pail gallons gallon gal liters liter l ltr " +
    "kg kgs m mtr meters meter ft pair pairs pack packs bundle bundles tube tubes can cans lot sq.m cu.m sqm cum").split(" "));

  // One typed line -> { qty, unit, name, est }.  "12 m Stranded Wire THHN 14mm @ 198.5"   "2 pcs Solderless 150mm"   "Hole saw"
  const parseLine = (line) => {
    line = line.trim(); if (!line) return null;
    if (line.includes("\t")) { const c = line.split("\t").map(s => s.trim()); return { qty: posOrBlank(c[0]), unit: c[1] || "", name: c[2] || "", est: posOrBlank(c[3]) }; }
    let est = "", m = line.match(/\s*[@=]\s*[₱P$]?\s*([\d,]+(?:\.\d+)?)\s*$/);
    if (m) { est = posOrBlank(m[1]); line = line.slice(0, m.index).trim(); }
    const mq = line.match(/^(\d+(?:\.\d+)?)(\s*)(.*)$/);
    if (!mq) return { qty: "", unit: "", name: line, est };
    const [, q, gap, rest] = mq, t = rest.match(/^(\S+)\s+(\S[\s\S]*)$/);
    if (t && UNITS.has(t[1].toLowerCase().replace(/\.$/, ""))) return { qty: q, unit: t[1].replace(/\.$/, ""), name: t[2].trim(), est };
    if (gap && rest) return { qty: q, unit: "", name: rest, est };       // "10 Portland cement"
    return { qty: "", unit: "", name: line, est };                       // "14mm wire" – the number belongs to the name
  };

  // Closing a big entry window by accident (Esc, tapping outside, Android back button) must not throw the typing away.
  const guardClose = (dlg, cancelBtn, dirty) => {
    const tryClose = async () => { if (!dirty() || await PP.askConfirm("Discard what you typed?", "Everything you entered in this window will be lost.", "Discard", { cancel: "Keep editing" })) dlg.close(); };
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); tryClose(); });
    cancelBtn.addEventListener("click", tryClose);
  };

  /* ================= 1. Add many items ================= */
  const bi = $("#bulkItemDialog"), bif = $("#bulkItemForm"), grid = $("#biGrid"), fv = (n) => PP.field(bif, n);
  const COLS = ["qty", "unit", "name", "est", "category"];
  let catOpts = "";
  let last = { category: "", project: "", priority: "medium" }, existing = new Set();
  const rowEls = () => [...grid.querySelectorAll(".brow")];
  const cell = (r, c) => r.querySelector(`[data-col="${c}"]`);
  const used = (r) => [0, 2, 3].some(c => cell(r, c).value.trim());            // the unit alone doesn't make a row "filled"
  const lastUnit = () => { const r = rowEls().pop(); return (r && cell(r, 1).value.trim()) || "pcs"; };

  function addRow(v = {}) {
    const r = document.createElement("div"); r.className = "brow";
    r.innerHTML = `<span class="bn"></span>
      <input data-col="0" inputmode="decimal" placeholder="Qty" aria-label="Quantity" autocomplete="off">
      <input data-col="1" list="unitList" placeholder="Unit" aria-label="Unit" maxlength="16" autocomplete="off">
      <input data-col="2" placeholder="Item / material" aria-label="Item" maxlength="80" autocomplete="off">
      <input data-col="3" inputmode="decimal" placeholder="Budget each" aria-label="Budget price each" autocomplete="off">
      <select data-col="4" aria-label="Category">${catOpts}</select>
      <button class="icon-btn sm" type="button" data-del aria-label="Remove this row"><svg class="ti" aria-hidden="true"><use href="#ti-x"/></svg></button>`;
    COLS.forEach((k, c) => { cell(r, c).value = c === 4 ? (v.category ?? fv("category").value) : (v[k] ?? ""); });
    grid.appendChild(r); return r;
  }
  const ensureRows = (n) => { while (rowEls().length < n) addRow({ unit: lastUnit() }); };
  function refresh() {
    let n = 0, dups = 0;
    rowEls().forEach((r, i) => {
      r.querySelector(".bn").textContent = i + 1;
      const u = used(r), dup = u && existing.has(norm(cell(r, 2).value)); r.classList.toggle("dup", dup);
      if (u) { n++; if (dup) dups++; }
    });
    $("#biSave").textContent = n ? `Add ${n} ${n === 1 ? "item" : "items"}` : "Add items";
    $("#biNote").textContent = dups ? `${dups} ${dups === 1 ? "is" : "are"} already on your list (marked yellow).` : "";
  }
  // put a table (array of rows of cells) into the grid, starting at row `start`, column `col`
  function fillTable(start, col, table) {
    ensureRows(start + table.length);
    const rows = rowEls();
    table.forEach((cells, k) => cells.forEach((v, j) => {
      const c = col + j; if (c > 4) return;
      const el = cell(rows[start + k], c);
      if (c === 4) { const m = PP.state.settings.categories.find(x => norm(x.name) === norm(v)); if (m) el.value = m.name; }   // category name from Excel; unknown names keep the default
      else el.value = (c === 0 || c === 3) ? posOrBlank(v) : v;
    }));
    refresh();
  }

  async function openItems() {
    if (!(await PP.gate())) return;
    bif.reset(); PP.clearAll(bif); $("#biError").textContent = ""; $("#biQuick").value = "";
    const cats = PP.state.settings.categories;
    catOpts = cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    fv("category").innerHTML = catOpts;
    fv("category").value = cats.some(c => c.name === last.category) ? last.category : cats[0].name;
    fv("project").value = last.project; fv("priority").value = last.priority;
    existing = new Set(PP.state.items.map(i => norm(i.name)));
    grid.innerHTML = ""; for (let i = 0; i < 6; i++) addRow({ unit: "pcs" });
    $("#biQuickBox").open = false; refresh(); bi.showModal(); cell(rowEls()[0], 0).focus();
  }

  grid.addEventListener("input", (e) => { e.target.classList.remove("bad"); refresh(); });
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    b.closest(".brow").remove(); if (!rowEls().length) addRow({ unit: "pcs" }); refresh();
  });
  grid.addEventListener("keydown", (e) => {          // Enter = same column, next row (new row at the end)
    if (e.key !== "Enter" || e.isComposing || !e.target.matches("input")) return;
    e.preventDefault();
    const rows = rowEls(), i = rows.indexOf(e.target.closest(".brow")), c = e.target.dataset.col;
    if (i === rows.length - 1) { addRow({ unit: lastUnit() }); refresh(); }
    cell(rowEls()[i + 1], c).focus();
  });
  grid.addEventListener("paste", (e) => {            // copy rows in Excel, click a cell, Ctrl+V
    const t = e.target; if (!t.matches || !t.matches("input")) return;
    const txt = (e.clipboardData || window.clipboardData).getData("text"); if (!isMulti(txt)) return;   // one value: normal paste
    e.preventDefault();
    const table = parseTable(txt), col = Number(t.dataset.col);
    if (col === 0 && table.length > 1 && /^(qty|quantity)$/i.test(table[0][0])) table.shift();           // skip an Excel header row
    fillTable(rowEls().indexOf(t.closest(".brow")), col, table);
    PP.toast(`Pasted ${table.length} ${table.length === 1 ? "row" : "rows"}`);
  });
  // the "Default category" box: new and still-empty rows follow it; "Set all rows" pushes it onto every row
  fv("category").addEventListener("change", () => { rowEls().forEach(r => { if (!used(r)) cell(r, 4).value = fv("category").value; }); });
  $("#biApplyCat").addEventListener("click", () => { rowEls().forEach(r => { cell(r, 4).value = fv("category").value; }); PP.toast("Category applied to every row. You can still change any row."); });
  $("#biMore").addEventListener("click", () => { for (let i = 0; i < 5; i++) addRow({ unit: lastUnit() }); refresh(); });

  // "Paste or type a list": one line per item, for phones or plain text
  $("#biQuickGo").addEventListener("click", () => {
    const list = $("#biQuick").value.split(/\r?\n/).map(parseLine).filter(Boolean);
    if (!list.length) { PP.toast("Type or paste at least one line first."); return; }
    let start = rowEls().findIndex(r => !used(r)); if (start < 0) start = rowEls().length;
    ensureRows(start + list.length);
    list.forEach((v, k) => COLS.forEach((key, c) => { if (key === "category") return; cell(rowEls()[start + k], c).value = key === "unit" ? (v.unit || "pcs") : (v[key] || ""); }));
    $("#biQuick").value = ""; $("#biQuickBox").open = false; refresh();
    PP.toast(`${list.length} ${list.length === 1 ? "line" : "lines"} added to the table`);
  });

  guardClose(bi, $("#biCancel"), () => rowEls().some(used));
  bif.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rows = rowEls().filter(used), errs = []; let firstBad = null;
    const bad = (el, msg) => { el.classList.add("bad"); errs.push(msg); firstBad = firstBad || el; };
    const items = [], base = { project: fv("project").value.trim(), priority: fv("priority").value, needed: fv("needed").value };
    rows.forEach((r) => {
      const n = rowEls().indexOf(r) + 1, v = (c) => cell(r, c).value.trim(), name = v(2), qRaw = v(0), eRaw = v(3), q = qRaw ? toNum(qRaw) : 1, est = eRaw ? toNum(eRaw) : 0;
      if (!name) bad(cell(r, 2), `Row ${n}: type the item name.`);
      if (!(Number.isFinite(q) && q > 0)) bad(cell(r, 0), `Row ${n}: the quantity must be more than 0.`);
      if (!(Number.isFinite(est) && est >= 0)) bad(cell(r, 3), `Row ${n}: the budget price can’t be negative.`);
      items.push({ name, qty: q, unit: v(1) || "pcs", est: Number.isFinite(est) && est > 0 ? est : 0, category: v(4) || fv("category").value });
    });
    if (!rows.length) { $("#biError").textContent = "Add at least one item first. Type in the table or paste rows from Excel."; return; }
    $("#biError").textContent = errs.slice(0, 3).join(" ") + (errs.length > 3 ? ` (+${errs.length - 3} more)` : "");
    if (firstBad) { firstBad.focus(); return; }

    const dupNames = items.filter(i => existing.has(norm(i.name))).map(i => i.name);
    if (dupNames.length && !(await PP.askConfirm("Some are already on your list",
      `${dupNames.slice(0, 3).join(", ")}${dupNames.length > 3 ? ` and ${dupNames.length - 3} more` : ""} ${dupNames.length === 1 ? "is" : "are"} already in your items. Add ${dupNames.length === 1 ? "it" : "them"} again anyway?`, "Add anyway", { good: true, cancel: "Go back" }))) return;

    last = { category: fv("category").value, project: base.project, priority: base.priority };
    const made = items.map(i => ({ id: PP.uid(), ...i, ...base, notes: "", status: "todo", created: today(), purchases: [] }));
    PP.state.items = [...PP.state.items, ...made];
    bi.close(); PP.render();
    PP.save(() => Api.saveItems(made), `${made.length} ${made.length === 1 ? "item" : "items"} added to To purchase`);
  });
  $("#bulkItemsBtn").addEventListener("click", openItems);

  /* ================= 2. Record purchases for many items (one supplier, one receipt) ================= */
  const bp = $("#bulkBuyDialog"), bpf = $("#bulkBuyForm"), list = $("#bpList"), pv = (n) => PP.field(bpf, n);
  let pItems = [];
  const prowEls = () => [...list.querySelectorAll(".prow")];
  const q$ = (r, s) => r.querySelector(s);
  const rowState = (r) => ({ r, item: pItems.find(x => x.id === r.dataset.id), on: q$(r, ".p-on").checked, qty: toNum(q$(r, ".p-qty").value), price: toNum(q$(r, ".p-price").value) });
  const selected = () => prowEls().map(rowState).filter(s => s.on);
  const grand = () => selected().reduce((t, s) => t + (s.qty > 0 && s.price >= 0 ? s.qty * s.price : 0), 0);
  const r2 = (x) => Math.round(x * 100) / 100;

  const prow = (i) => { const rem = PP.remaining(i); return `<div class="prow" data-id="${esc(i.id)}">
    <input type="checkbox" class="p-on" aria-label="Bought ${esc(i.name)}">
    <div class="p-name"><b>${esc(i.name)}</b><small>${fq(rem)} ${esc(i.unit)} to buy${i.est > 0 ? ` · budget ${money(i.est)} each` : ""}${i.project ? ` · ${esc(i.project)}` : ""}</small></div>
    <div class="p-q"><input class="p-qty" inputmode="decimal" placeholder="${fq(rem)}" aria-label="Quantity bought"><span>${esc(i.unit)}</span></div>
    <input class="p-price" inputmode="decimal" placeholder="${i.est > 0 ? esc(String(i.est)) : "Price each"}" aria-label="Price each">
    <span class="p-amt">–</span></div>`; };

  // how much of the whole receipt came from COH (0-100), or null while nothing valid is chosen
  const share = () => {
    const s = pv("source").value; if (s === "coh") return 100; if (s === "bank") return 0;
    const c = PP.num(pv("cohAmt").value), t = grand();
    return s === "split" && t > 0 && Number.isFinite(c) && c > 0 && c < t ? c / t * 100 : null;
  };
  function update() {
    prowEls().forEach(r => {
      const s = rowState(r); r.classList.toggle("on", s.on);
      q$(r, ".p-amt").textContent = s.on && s.qty > 0 && s.price >= 0 ? money(s.qty * s.price) : "–";
    });
    const sel = selected(), t = grand(), src = pv("source").value;
    $("#bpSplit").hidden = src !== "split";
    if (src === "split") { const c = PP.num(pv("cohAmt").value); if (Number.isFinite(c) && t > 0) pv("bankAmt").value = r2(t - c); }
    let msg = sel.length ? `${sel.length} ${sel.length === 1 ? "item" : "items"} · Grand total ${money(t)}` : "";
    const c = share();
    if (sel.length && c != null) {
      const fromCoh = t * c / 100, fromBank = t - fromCoh, F = PP.funds();
      msg += ` (COH ${money(fromCoh)} · BANK ${money(fromBank)})`;
      if (F.set) { const low = [fromCoh > F.coh + 0.005 ? `COH (available ${money(F.coh)})` : "", fromBank > F.bank + 0.005 ? `BANK (available ${money(F.bank)})` : ""].filter(Boolean); if (low.length) msg += `. Not enough ${low.join(" and ")}.`; }
    }
    $("#bpTotal").textContent = msg;
    $("#bpSave").textContent = sel.length ? `Record ${sel.length} ${sel.length === 1 ? "purchase" : "purchases"}` : "Record purchases";
  }
  // set one row from pasted / typed values. price blank or 0 = this supplier doesn't have it, so the row is un-ticked
  function setRow(r, qty, price) {
    const item = pItems.find(x => x.id === r.dataset.id), rem = PP.remaining(item), p = toNum(price);
    if (qty !== undefined && toNum(qty) > 0) q$(r, ".p-qty").value = toNum(qty);
    if (Number.isFinite(p) && p > 0) { q$(r, ".p-price").value = p; q$(r, ".p-on").checked = true; if (!(toNum(q$(r, ".p-qty").value) > 0)) q$(r, ".p-qty").value = rem; }
    else if (price !== undefined) { q$(r, ".p-price").value = ""; q$(r, ".p-on").checked = false; }
  }

  async function openBuy() {
    if (!(await PP.gate())) return;
    pItems = PP.state.items.filter(i => i.status === "todo" && PP.remaining(i) > 0);
    if (!pItems.length) { PP.toast("Nothing left to buy. Add items first."); return; }
    bpf.reset(); PP.clearAll(bpf); $("#bpError").textContent = ""; $("#bpFilter").value = "";
    pv("date").value = today(); list.innerHTML = pItems.map(prow).join(""); update(); bp.showModal(); pv("supplier").focus();
  }

  list.addEventListener("change", (e) => {           // ticking a row fills in what is left to buy, and the budget price if there is one
    if (!e.target.matches(".p-on")) return;
    const r = e.target.closest(".prow"), item = pItems.find(x => x.id === r.dataset.id);
    if (e.target.checked) {
      if (!(toNum(q$(r, ".p-qty").value) > 0)) q$(r, ".p-qty").value = PP.remaining(item);
      if (!(toNum(q$(r, ".p-price").value) >= 0) || !q$(r, ".p-price").value.trim()) { if (item.est > 0) q$(r, ".p-price").value = item.est; else q$(r, ".p-price").focus(); }
    }
    update();
  });
  list.addEventListener("input", (e) => {            // typing a price (or quantity) ticks the row for you
    const t = e.target; if (!t.matches(".p-price, .p-qty")) return;
    t.classList.remove("bad"); const r = t.closest(".prow");
    if (t.value.trim()) {
      q$(r, ".p-on").checked = true;
      if (t.matches(".p-price") && !q$(r, ".p-qty").value.trim()) q$(r, ".p-qty").value = PP.remaining(pItems.find(x => x.id === r.dataset.id));
    }
    update();
  });
  list.addEventListener("keydown", (e) => {          // Enter = next item's price
    if (e.key !== "Enter" || e.isComposing || !e.target.matches(".p-price, .p-qty")) return;
    e.preventDefault();
    const rows = prowEls().filter(r => !r.hidden), i = rows.indexOf(e.target.closest(".prow")), nxt = rows[i + 1];
    if (nxt) q$(nxt, e.target.matches(".p-qty") ? ".p-qty" : ".p-price").focus();
  });
  list.addEventListener("paste", (e) => {            // copy a supplier's price column in Excel, click the first price cell, Ctrl+V
    const t = e.target; if (!t.matches || !t.matches(".p-price, .p-qty")) return;
    const txt = (e.clipboardData || window.clipboardData).getData("text"); if (!isMulti(txt)) return;
    e.preventDefault();
    const rows = prowEls().filter(r => !r.hidden), start = rows.indexOf(t.closest(".prow")), onQty = t.matches(".p-qty"), table = parseTable(txt);
    table.forEach((cells, k) => { const r = rows[start + k]; if (r) setRow(r, onQty ? cells[0] : undefined, onQty ? cells[1] : cells[0]); });
    update(); PP.toast(`Filled ${Math.min(table.length, rows.length - start)} rows`);
  });
  $("#bpFilter").addEventListener("input", () => { const q = norm($("#bpFilter").value); prowEls().forEach(r => { r.hidden = !!q && !norm(pItems.find(x => x.id === r.dataset.id).name).includes(q); }); });
  bpf.addEventListener("input", (e) => {
    if (e.target.name === "cohAmt" || e.target.name === "bankAmt") {       // COH + BANK always add up to the receipt total
      const t = grand(), v = PP.num(e.target.value);
      if (t > 0 && Number.isFinite(v)) pv(e.target.name === "cohAmt" ? "bankAmt" : "cohAmt").value = r2(t - v);
    }
    update();
  });
  PP.clearOnInput(bpf);

  guardClose(bp, $("#bpCancel"), () => selected().length > 0 || prowEls().some(r => q$(r, ".p-price").value.trim()));
  bpf.addEventListener("submit", (e) => {
    e.preventDefault();
    const supplier = pv("supplier").value.trim(), date = pv("date").value, src = pv("source").value, sel = selected(), t = grand();
    const okHead = PP.checks(bpf, [["supplier", !!supplier, "Who did you buy from?"], ["date", !!date, "Pick the date you bought them."],
      ["source", !!src, "Choose where the payment came from: COH, BANK or both."],
      ...(src === "split" ? [["cohAmt", share() != null, `Type how much is from COH and how much from BANK. Both must be more than 0 and add up to ${money(t)}.`]] : [])]);
    list.querySelectorAll(".bad").forEach(x => x.classList.remove("bad"));
    const errs = []; let firstBad = null;
    if (!sel.length) errs.push("Tick the items you bought, or type their prices.");
    sel.forEach(s => {
      if (!(s.qty > 0)) { q$(s.r, ".p-qty").classList.add("bad"); errs.push(`${s.item.name}: type how many you bought.`); firstBad = firstBad || q$(s.r, ".p-qty"); }
      if (!(Number.isFinite(s.price) && s.price >= 0)) { q$(s.r, ".p-price").classList.add("bad"); errs.push(`${s.item.name}: type the price each.`); firstBad = firstBad || q$(s.r, ".p-price"); }
    });
    $("#bpError").textContent = errs.slice(0, 3).join(" ") + (errs.length > 3 ? ` (+${errs.length - 3} more)` : "");
    if (!okHead || errs.length) { if (okHead && firstBad) firstBad.focus(); return; }

    const coh = share(), at = new Date().toISOString(), ref = pv("ref").value.trim(); let moved = 0;
    const changed = sel.map(s => {
      const line = { id: PP.uid(), supplier, qty: s.qty, price: s.price, date, ref, coh, at };
      let item = { ...s.item, purchases: [...PP.lines(s.item), line] };
      if (PP.autoDone(item)) { item = { ...item, status: "bought" }; moved++; }
      return item;
    });
    const byId = new Map(changed.map(i => [i.id, i]));
    PP.state.items = PP.state.items.map(i => byId.get(i.id) || i);
    bp.close(); PP.render();
    PP.save(() => Api.saveItems(changed), `${changed.length} ${changed.length === 1 ? "purchase" : "purchases"} recorded` + (moved ? `. ${moved} fully purchased, moved to Purchased ✓` : ""));
  });
  $("#bulkBuyBtn").addEventListener("click", openBuy);

  /* ================= 3. Add many purchases to ONE item (the same item from several suppliers) ================= */
  const mb = $("#manyBuyDialog"), mbf = $("#manyBuyForm"), mgrid = $("#mbGrid"), mv = (n) => PP.field(mbf, n);
  let mItem = null;
  const mrows = () => [...mgrid.querySelectorAll(".mrow")];
  const mc = (r, c) => r.querySelector(`[data-mc="${c}"]`);                       // 0 supplier, 1 qty, 2 price, 3 receipt no.
  const mUsed = (r) => [0, 1, 2, 3].some(c => mc(r, c).value.trim());
  const mShare = () => { const s = mv("source").value; return s === "coh" ? 100 : s === "bank" ? 0 : null; };
  function mAdd() {
    const r = document.createElement("div"); r.className = "mrow";
    r.innerHTML = `<span class="bn"></span>
      <input data-mc="0" list="supplierList" placeholder="Supplier" aria-label="Supplier" maxlength="60" autocomplete="off">
      <input data-mc="1" inputmode="decimal" placeholder="${fq(PP.remaining(mItem))}" aria-label="Quantity bought" autocomplete="off">
      <input data-mc="2" inputmode="decimal" placeholder="${mItem.est > 0 ? esc(String(mItem.est)) : "Price each"}" aria-label="Price each" autocomplete="off">
      <input data-mc="3" placeholder="Receipt / DR no." aria-label="Receipt or DR number" maxlength="30" autocomplete="off">
      <span class="p-amt">–</span>
      <button class="icon-btn sm" type="button" data-del aria-label="Remove this row"><svg class="ti" aria-hidden="true"><use href="#ti-x"/></svg></button>`;
    mgrid.appendChild(r); return r;
  }
  function mUpdate() {
    let n = 0, qty = 0, total = 0;
    mrows().forEach((r, i) => {
      r.querySelector(".bn").textContent = i + 1;
      const q = toNum(mc(r, 1).value), p = toNum(mc(r, 2).value), ok = q > 0 && p >= 0;
      r.querySelector(".p-amt").textContent = ok ? money(q * p) : "–";
      if (mUsed(r)) { n++; if (ok) { qty += q; total += q * p; } }
    });
    const rem = PP.remaining(mItem), left = Math.round((rem - qty) * 1000) / 1000, u = mItem.unit;
    let msg = n ? `${n} ${n === 1 ? "purchase" : "purchases"} · ${fq(qty)} ${u} · Grand total ${money(total)} · ` + (left > 0 ? `${fq(left)} ${u} still to go` : left < 0 ? `${fq(-left)} ${u} more than needed` : "Everything needed is covered") : "";
    const c = mShare();
    if (n && c != null && total > 0) {
      const fromCoh = total * c / 100, fromBank = total - fromCoh, F = PP.funds();
      if (F.set) { const low = [fromCoh > F.coh + 0.005 ? `COH (available ${money(F.coh)})` : "", fromBank > F.bank + 0.005 ? `BANK (available ${money(F.bank)})` : ""].filter(Boolean); if (low.length) msg += `. Not enough ${low.join(" and ")}.`; }
    }
    $("#mbTotal").textContent = msg;
    $("#mbSave").textContent = n ? `Save ${n} ${n === 1 ? "purchase" : "purchases"}` : "Save purchases";
  }
  PP.openBuyMany = (item) => {
    mItem = item; mbf.reset(); PP.clearAll(mbf); $("#mbError").textContent = "";
    const rem = PP.remaining(item);
    $("#mbName").textContent = `${item.name} · need ${fq(item.qty)} ${item.unit}` + (rem > 0 ? `, ${fq(rem)} still to buy` : ", all bought already");
    mv("date").value = today(); mgrid.innerHTML = ""; for (let i = 0; i < 3; i++) mAdd();
    mUpdate(); mb.showModal(); mc(mrows()[0], 0).focus();
  };
  mgrid.addEventListener("input", (e) => { e.target.classList.remove("bad"); mUpdate(); });
  mbf.addEventListener("input", (e) => { if (e.target.name === "source") mUpdate(); });
  PP.clearOnInput(mbf);
  mgrid.addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; b.closest(".mrow").remove(); if (!mrows().length) mAdd(); mUpdate(); });
  mgrid.addEventListener("keydown", (e) => {        // Enter = same column, next row (new row at the end)
    if (e.key !== "Enter" || e.isComposing || !e.target.matches("input")) return;
    e.preventDefault();
    const rows = mrows(), i = rows.indexOf(e.target.closest(".mrow")), c = e.target.dataset.mc;
    if (i === rows.length - 1) { mAdd(); mUpdate(); }
    mc(mrows()[i + 1], c).focus();
  });
  mgrid.addEventListener("paste", (e) => {          // columns: Supplier, Qty, Price each, Receipt no.
    const t = e.target; if (!t.matches || !t.matches("input")) return;
    const txt = (e.clipboardData || window.clipboardData).getData("text"); if (!isMulti(txt)) return;
    e.preventDefault();
    const table = parseTable(txt), col = Number(t.dataset.mc);
    if (col === 0 && table.length > 1 && /^supplier$/i.test(table[0][0])) table.shift();
    const start = mrows().indexOf(t.closest(".mrow"));
    while (mrows().length < start + table.length) mAdd();
    const rows = mrows();
    table.forEach((cells, k) => cells.forEach((v, j) => { const c = col + j; if (c > 3) return; mc(rows[start + k], c).value = (c === 1 || c === 2) ? posOrBlank(v) : v; }));
    mUpdate(); PP.toast(`Pasted ${table.length} ${table.length === 1 ? "row" : "rows"}`);
  });
  $("#mbMore").addEventListener("click", () => { for (let i = 0; i < 3; i++) mAdd(); mUpdate(); });

  guardClose(mb, $("#mbCancel"), () => mrows().some(mUsed));
  mbf.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = mv("date").value, src = mv("source").value, rows = mrows().filter(mUsed), errs = []; let firstBad = null;
    const okHead = PP.checks(mbf, [["date", !!date, "Pick the date you bought them."], ["source", !!src, "Choose where the payment came from: COH or BANK."]]);
    mgrid.querySelectorAll(".bad").forEach(x => x.classList.remove("bad"));
    const bad = (el, msg) => { el.classList.add("bad"); errs.push(msg); firstBad = firstBad || el; };
    if (!rows.length) errs.push("Add at least one supplier, with quantity and price.");
    const lines = rows.map(r => {
      const n = mrows().indexOf(r) + 1, supplier = mc(r, 0).value.trim(), qty = toNum(mc(r, 1).value), price = toNum(mc(r, 2).value);
      if (!supplier) bad(mc(r, 0), `Row ${n}: who did you buy from?`);
      if (!(qty > 0)) bad(mc(r, 1), `Row ${n}: type how many you bought.`);
      if (!(Number.isFinite(price) && price >= 0)) bad(mc(r, 2), `Row ${n}: type the price each.`);
      return { id: PP.uid(), supplier, qty, price, date, ref: mc(r, 3).value.trim(), coh: mShare(), at: new Date().toISOString() };
    });
    $("#mbError").textContent = errs.slice(0, 3).join(" ") + (errs.length > 3 ? ` (+${errs.length - 3} more)` : "");
    if (!okHead || errs.length) { if (okHead && firstBad) firstBad.focus(); return; }
    let item = { ...mItem, purchases: [...PP.lines(mItem), ...lines] }; const moved = PP.autoDone(item); if (moved) item = { ...item, status: "bought" };
    PP.state.items = PP.state.items.map(x => x.id === item.id ? item : x);
    mb.close(); PP.render();
    PP.save(() => Api.saveItem(item), `${lines.length} ${lines.length === 1 ? "purchase" : "purchases"} added` + (moved ? ". Fully purchased, moved to Purchased ✓" : ""));
  });
})();
