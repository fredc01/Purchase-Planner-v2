// The Board tab: "To purchase" cards on the left, "Purchased" cards on the right.
// Inside each card: "Need to purchase" (left) and "Purchase items" per supplier (right).
(() => {
  const { $, esc, money, fmtDate, today, fq } = PP;
  const PRI = { high: 0, medium: 1, low: 2 }, PRI_LABEL = { high: "High", medium: "Medium", low: "Low" };
  const lastDate = (i) => PP.lines(i).reduce((m, l) => (l.date > m ? l.date : m), "");

  // Date filter. An item belongs to a day if it was added that day or any purchase on it is dated that day.
  function dateWindow() {
    const m = $("#fDate").value, t = today(), d = new Date();
    const back = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return PP.iso(x); };
    if (m === "all") return null;
    if (m === "yesterday") return [back(1), back(1)];
    if (m === "7") return [back(6), t];
    if (m === "month") return [t.slice(0, 7) + "-01", t];
    if (m === "range") { let a = $("#dFrom").value || "0000-01-01", b = $("#dTo").value || "9999-12-31"; if (a > b) [a, b] = [b, a]; return [a, b]; }
    return [t, t];
  }
  const inWin = (w, d) => !w || (d && d >= w[0] && d <= w[1]);
  const inDates = (w, i) => !w || inWin(w, i.created) || PP.lines(i).some(l => inWin(w, l.date));

  function visible(status) {
    const win = dateWindow();
    const q = ($("#q").value || "").trim().toLowerCase(), cat = $("#fCat").value, sort = $("#fSort").value;
    const list = PP.state.items.filter(i => i.status === status && inDates(win, i) && (cat === "all" || i.category === cat) &&
      (!q || [i.name, i.project, i.notes, i.category, ...PP.lines(i).map(l => `${l.supplier} ${l.ref}`)].join(" ").toLowerCase().includes(q)));
    const amt = (i) => (status === "bought" ? PP.paid(i) : PP.budget(i));
    const byDate = (a, b) => lastDate(b).localeCompare(lastDate(a)) || (b.created || "").localeCompare(a.created || "");
    const by = {
      priority: (a, b) => status === "bought" ? byDate(a, b) :
        (PRI[a.priority] - PRI[b.priority]) || (a.needed || "9999").localeCompare(b.needed || "9999") || a.name.localeCompare(b.name),
      needed: (a, b) => status === "bought" ? byDate(a, b) : (a.needed || "9999").localeCompare(b.needed || "9999") || (PRI[a.priority] - PRI[b.priority]),
      price: (a, b) => amt(b) - amt(a),
      newest: (a, b) => (b.created || "").localeCompare(a.created || "")
    };
    return list.sort(by[sort] || by.priority);
  }

  function lineRow(i, l) {
    return `<li data-line="${esc(l.id)}">
      <div class="ln-main"><b>${esc(l.supplier || "No supplier")}</b><span>${fq(l.qty)} ${esc(i.unit)} × ${money(l.price)}</span>
        ${l.coh == null ? `<span class="pay none">Paid from: not set</span>` : `<span class="pay ${PP.payClass(l)}" title="COH ${money(PP.lineCoh(l))} · BANK ${money(PP.lineBank(l))}">${PP.payLabel(l)}</span>`}</div>
      <div class="ln-amt"><b>${money(PP.lineAmt(l))}</b><small>${l.date ? fmtDate(l.date) : ""}${l.ref ? ` · ${esc(l.ref)}` : ""}</small></div>
      <div class="ln-act">
        <button class="icon-btn sm" data-act="editbuy" data-line="${esc(l.id)}" type="button" aria-label="Edit purchase from ${esc(l.supplier || "supplier")}"><svg class="ti" aria-hidden="true"><use href="#ti-pencil"/></svg></button>
        <button class="icon-btn sm" data-act="delbuy" data-line="${esc(l.id)}" type="button" aria-label="Delete purchase from ${esc(l.supplier || "supplier")}"><svg class="ti" aria-hidden="true"><use href="#ti-x"/></svg></button>
      </div></li>`;
  }

  function card(i) {
    const bought = i.status === "bought", c = PP.catOf(i.category), u = esc(i.unit);
    const got = PP.boughtQty(i), rem = PP.remaining(i), pct = i.qty ? Math.min(100, got / i.qty * 100) : 0;
    const paid = PP.paid(i), diff = PP.saved(i), lines = PP.lines(i);
    const late = !bought && i.needed && i.needed < today();
    const soon = !bought && i.needed && !late && (new Date(i.needed + "T00:00") - new Date(today() + "T00:00")) / 864e5 <= 3;
    const status = rem > 0 ? `${fq(rem)} ${u} to go` : got > i.qty ? `${fq(got - i.qty)} ${u} extra` : "Complete";

    const need = `<section class="pane need" aria-label="Need to purchase">
        <h4>Need to purchase</h4>
        <p class="need-qty"><b>${fq(i.qty)}</b> ${u}</p>
        <dl class="facts">
          ${i.est > 0 ? `<div><dt>Budget each</dt><dd>${money(i.est)}</dd></div><div><dt>Budget total</dt><dd>${money(PP.budget(i))}</dd></div>` : `<div><dt>Budget</dt><dd class="muted">Not set</dd></div>`}
          ${i.needed ? `<div><dt>Needed by</dt><dd>${fmtDate(i.needed)} ${late ? `<span class="badge late">Overdue</span>` : soon ? `<span class="badge soon">Soon</span>` : ""}</dd></div>` : ""}
        </dl>
        ${i.notes ? `<p class="notes">${esc(i.notes)}</p>` : ""}
      </section>`;

    const buys = `<section class="pane buys" aria-label="Purchase items">
        <h4>Purchase items <span class="count">${lines.length}</span></h4>
        <div class="progress ${rem === 0 ? "full" : ""}"><i style="width:${pct}%"></i></div>
        <p class="prog-text"><b>${fq(got)}</b> of ${fq(i.qty)} ${u} purchased · <span class="${rem === 0 ? "ok-t" : ""}">${status}</span></p>
        ${lines.length ? `<ul class="lines">${lines.map(l => lineRow(i, l)).join("")}</ul>` : `<p class="empty-s">No purchases yet.</p>`}
        <div class="buy-btns"><button class="btn small ${lines.length ? "" : "primary"}" data-act="addbuy" type="button">+ Add purchase</button>
          <button class="btn small" data-act="addmany" type="button" title="Add the same item from several suppliers at once">+ Add many</button></div>
        ${paid > 0 ? `<p class="paid-total">${bought ? "Total paid" : "Paid so far"} <b>${money(paid)}</b></p>
          <p class="paid-split">COH ${money(lines.reduce((s, l) => s + PP.lineCoh(l), 0))} · BANK ${money(lines.reduce((s, l) => s + PP.lineBank(l), 0))}</p>` : ""}
        ${paid > 0 && i.est > 0 && Math.abs(diff) > 0.001 ? `<p class="delta ${diff > 0 ? "save" : "over"}">${diff > 0 ? `Saved ${money(diff)} vs budget` : `Over budget by ${money(-diff)}`}${bought ? "" : " so far"}</p>` : ""}
      </section>`;

    return `<article class="card ${bought ? "is-bought" : "p-" + i.priority}" draggable="true" data-id="${esc(i.id)}">
      <header class="card-head">
        <div class="ch-main"><h3>${esc(i.name)}</h3>
          <div class="chips"><span class="chip cat" style="--c:${PP.catColor(i.category)}">${PP.catIcon(c)} ${esc(i.category)}</span>
            ${i.project ? `<span class="chip"><svg class="ti" aria-hidden="true"><use href="#ti-map-pin"/></svg> ${esc(i.project)}</span>` : ""}
            ${bought ? "" : `<span class="chip pri-${i.priority}">${PRI_LABEL[i.priority]}</span>`}</div></div>
        <div class="price"><small>${bought ? "Paid" : "Budget"}</small><strong>${(bought ? paid : PP.budget(i)) > 0 ? money(bought ? paid : PP.budget(i)) : "–"}</strong></div>
      </header>
      <div class="card-body">${need}${buys}</div>
      <footer class="card-actions">
        ${bought ? `<button class="btn small" data-act="undo" type="button"><svg class="ti" aria-hidden="true"><use href="#ti-arrow-back-up"/></svg> Move back</button>`
          : (lines.length ? `<button class="btn small good" data-act="complete" type="button"><svg class="ti" aria-hidden="true"><use href="#ti-check"/></svg> Mark purchased</button>` : "")}
        <span class="grow"></span>
        <button class="icon-btn" data-act="edit" type="button" aria-label="Edit ${esc(i.name)}"><svg class="ti" aria-hidden="true"><use href="#ti-pencil"/></svg></button>
        <button class="icon-btn" data-act="del" type="button" aria-label="Delete ${esc(i.name)}"><svg class="ti" aria-hidden="true"><use href="#ti-trash"/></svg></button>
      </footer></article>`;
  }

  function fillFilters() {
    const f = $("#fCat"), cur = f.value || "all", cats = PP.state.settings.categories;
    f.innerHTML = `<option value="all">All categories</option>` + cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    f.value = cats.some(c => c.name === cur) ? cur : "all";
    const uniq = (fn) => [...new Set(PP.state.items.flatMap(fn).filter(Boolean))].sort().map(s => `<option value="${esc(s)}">`).join("");
    $("#supplierList").innerHTML = uniq(i => PP.lines(i).map(l => l.supplier));
    $("#projectList").innerHTML = uniq(i => [i.project]);
  }

  // Remaining COH and BANK balance, always visible at the top of the board
  function renderFunds() {
    const F = PP.funds(), box = (cls, label, v) => `<div class="fund ${cls}"><span>${label}</span><strong class="${F.set && v < 0 ? "bad-t" : ""}">${F.set ? money(v) : "–"}</strong></div>`;
    $("#fundsBar").innerHTML = box("coh", "Remaining COH", F.coh) + box("bank", "Remaining BANK", F.bank) + box("all", "Total remaining", F.coh + F.bank) +
      (F.set ? "" : `<button class="btn small" type="button" id="setFunds">Set balances</button>`);
  }
  $("#fundsBar").addEventListener("click", (e) => { if (e.target.closest("#setFunds")) PP.setTab("budget"); });

  PP.renderBoard = () => {
    renderFunds();
    fillFilters();
    const todo = visible("todo"), bought = visible("bought"), n = (l) => `${l.length} ${l.length === 1 ? "item" : "items"}`;
    $("#listTodo").innerHTML = todo.map(card).join("") || `<p class="empty">Nothing to purchase for this date. Press “+ Add item to purchase”, or change the date above.</p>`;
    $("#listBought").innerHTML = bought.map(card).join("") || `<p class="empty">Nothing purchased for this date. Add a purchase on a card, or change the date above.</p>`;
    $("#sumTodo").textContent = `${n(todo)} · about ${money(todo.reduce((s, i) => s + PP.remaining(i) * (Number(i.est) || 0), 0))} left to buy`;
    $("#sumBought").textContent = `${n(bought)} · ${money(bought.reduce((s, i) => s + PP.paid(i), 0))} spent`;
    $("#cntTodo").textContent = todo.length; $("#cntBought").textContent = bought.length;
  };
  $("#fDate").addEventListener("change", () => {
    const r = $("#fDate").value === "range", box = $("#dateRange"); box.hidden = !r;
    if (r && !$("#dFrom").value) $("#dFrom").value = $("#dTo").value = today();
  });
  ["input", "change"].forEach(ev => ["#q", "#fCat", "#fSort", "#fDate", "#dFrom", "#dTo"].forEach(s => $(s).addEventListener(ev, PP.renderBoard)));
  $("#paneSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pane]"); if (!b) return;
    $("#board").dataset.pane = b.dataset.pane;
    document.querySelectorAll("#paneSwitch button").forEach(x => x.setAttribute("aria-pressed", x === b));
  });

  const replace = (item) => { PP.state.items = PP.state.items.map(x => x.id === item.id ? item : x); };
  // When everything needed has been bought, the card moves to Purchased by itself.
  const autoDone = (item) => item.status === "todo" && PP.lines(item).length > 0 && PP.boughtQty(item) >= item.qty;
  PP.autoDone = autoDone;   // bulk.js uses it too

  /* ---------- Add / edit what is needed ---------- */
  const id_ = $("#itemDialog"), f = $("#itemForm"), fv = (n) => PP.field(f, n);
  PP.clearOnInput(f);
  function openItem(item) {
    f.reset(); PP.clearAll(f); $("#itemError").textContent = "";
    fv("category").innerHTML = PP.state.settings.categories.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    $("#itemTitle").textContent = item ? "Edit item" : "Add item to purchase";
    const set = { id: item ? item.id : "", name: item ? item.name : "", category: item ? item.category : PP.state.settings.categories[0].name,
      project: item ? item.project : "", qty: item ? item.qty : 1, unit: item ? item.unit : "pcs", est: item && item.est ? item.est : "",
      priority: item ? item.priority : "medium", needed: item ? item.needed : "", notes: item ? item.notes : "" };
    Object.keys(set).forEach(k => { fv(k).value = set[k]; });
    id_.showModal();
  }
  PP.openItem = openItem;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const old = PP.state.items.find(x => x.id === fv("id").value);
    const name = fv("name").value.trim(), qty = PP.num(fv("qty").value), est = PP.num(fv("est").value), unit = fv("unit").value.trim();
    if (!PP.checks(f, [["name", !!name, "What does the site need?"], ["category", !!fv("category").value, "Pick a category."],
      ["qty", Number.isFinite(qty) && qty > 0, "Type how many are needed (more than 0)."], ["unit", !!unit, "Add a unit, like pcs, bags or m."],
      ["est", isNaN(est) || est >= 0, "The price can’t be negative."]])) return;
    let item = { id: old ? old.id : PP.uid(), name, category: fv("category").value, project: fv("project").value.trim(), unit, qty, est: isNaN(est) ? 0 : est,
      priority: fv("priority").value, needed: fv("needed").value, notes: fv("notes").value.trim(),
      status: old ? old.status : "todo", created: old ? old.created : today(), purchases: old ? old.purchases : [] };
    const moved = autoDone(item); if (moved) item = { ...item, status: "bought" };
    PP.state.items = old ? PP.state.items.map(x => x.id === old.id ? item : x) : [...PP.state.items, item];
    id_.close(); PP.render(); PP.save(() => Api.saveItem(item), moved ? "Updated. Fully purchased, moved to Purchased ✓" : old ? "Item updated" : "Added to To purchase");
  });

  /* ---------- Add / edit one purchase ---------- */
  const bd = $("#buyDialog"), bf = $("#buyForm"), bv = (n) => PP.field(bf, n); let buying = null;     // { item, line|null }
  PP.clearOnInput(bf);
  // how much of this purchase comes from COH (0-100), or null while nothing valid is chosen yet
  const cohShare = () => {
    const s = bv("source").value; if (s === "coh") return 100; if (s === "bank") return 0;
    const c = PP.num(bv("cohAmt").value), t = PP.num(bv("qty").value) * PP.num(bv("price").value);   // split: typed COH amount out of the total
    return s === "split" && t > 0 && Number.isFinite(c) && c > 0 && c < t ? c / t * 100 : null;
  };
  const showTotal = () => {
    const q = PP.num(bv("qty").value), p = PP.num(bv("price").value), s = bv("source").value, out = $("#buyTotal");
    $("#splitRow").hidden = s !== "split";
    if (!(q > 0 && p >= 0)) { out.textContent = ""; return; }
    const amt = q * p, c = cohShare(); let t = `Total for this purchase: ${money(amt)}`;
    if (c != null) {
      const fromCoh = amt * c / 100, fromBank = amt - fromCoh, F = PP.funds(buying && buying.line ? buying.line.id : null);
      t += ` (COH ${money(fromCoh)} · BANK ${money(fromBank)})`;
      if (F.set) { const low = [fromCoh > F.coh + 0.005 ? `COH (available ${money(F.coh)})` : "", fromBank > F.bank + 0.005 ? `BANK (available ${money(F.bank)})` : ""].filter(Boolean); if (low.length) t += `. Not enough ${low.join(" and ")}.`; }
    }
    out.textContent = t;
  };
  bf.addEventListener("input", (e) => {   // COH amount + BANK amount always add up to the total of this purchase
    const n = e.target.name, v = PP.num(e.target.value), t = PP.num(bv("qty").value) * PP.num(bv("price").value), r2 = (x) => Math.round(x * 100) / 100;
    if (t > 0 && Number.isFinite(v) && (n === "cohAmt" || n === "bankAmt")) bv(n === "cohAmt" ? "bankAmt" : "cohAmt").value = r2(t - v);
    else if (t > 0 && (n === "qty" || n === "price") && bv("source").value === "split" && Number.isFinite(PP.num(bv("cohAmt").value))) bv("bankAmt").value = r2(t - PP.num(bv("cohAmt").value));
    showTotal();
  });
  function openBuy(item, line) {
    buying = { item, line: line || null }; bf.reset(); PP.clearAll(bf); $("#buyError").textContent = "";
    const rem = PP.remaining(item);
    $("#buyTitle").textContent = line ? "Edit purchase" : "Add purchase";
    $("#buyName").textContent = `${item.name} · need ${fq(item.qty)} ${item.unit}` + (rem > 0 ? `, ${fq(rem)} still to buy` : ", all bought already");
    bv("supplier").value = line ? line.supplier : ""; bv("qty").value = line ? line.qty : (rem > 0 ? rem : "");
    bv("price").value = line ? line.price : (item.est || ""); bv("date").value = line ? line.date : today(); bv("ref").value = line ? line.ref : "";
    const c = line ? line.coh : null;
    bv("source").value = c == null ? "" : c >= 100 ? "coh" : c <= 0 ? "bank" : "split";
    const sp = c != null && c > 0 && c < 100, r2 = (x) => Math.round(x * 100) / 100;
    bv("cohAmt").value = sp ? r2(PP.lineCoh(line)) : ""; bv("bankAmt").value = sp ? r2(PP.lineBank(line)) : "";
    showTotal(); bd.showModal();
  }
  bf.addEventListener("submit", (e) => {
    e.preventDefault();
    const supplier = bv("supplier").value.trim(), qty = PP.num(bv("qty").value), price = PP.num(bv("price").value), date = bv("date").value;
    if (!PP.checks(bf, [["supplier", !!supplier, "Who did you buy from?"], ["qty", Number.isFinite(qty) && qty > 0, "Type how many you bought (more than 0)."],
      ["price", Number.isFinite(price) && price >= 0, "How much did you pay (each)?"], ["date", !!date, "Pick the date you bought it."],
      ["source", !!bv("source").value, "Choose where the payment came from: COH, BANK or both."],
      ...(bv("source").value === "split" ? [["cohAmt", cohShare() != null, `Type how much is from COH and how much from BANK. Both must be more than 0 and add up to ${money(qty * price)}.`]] : [])])) return;
    const { item: base, line: old } = buying;
    const line = { id: old ? old.id : PP.uid(), supplier, qty, price, date, ref: bv("ref").value.trim(), coh: cohShare(), at: old ? old.at : new Date().toISOString() };
    let item = { ...base, purchases: old ? PP.lines(base).map(l => l.id === old.id ? line : l) : [...PP.lines(base), line] };
    const moved = autoDone(item); if (moved) item = { ...item, status: "bought" };
    replace(item); bd.close(); PP.render();
    PP.save(() => Api.saveItem(item), moved ? "Fully purchased. Moved to Purchased ✓" : old ? "Purchase updated" : "Purchase added");
  });

  /* ---------- Mark purchased / move back ---------- */
  async function markDone(item) {
    if (!PP.lines(item).length) { PP.toast("Add a purchase first."); openBuy(item, null); return; }
    const rem = PP.remaining(item);
    if (rem > 0 && !(await PP.askConfirm("Mark as purchased?", `Only ${fq(PP.boughtQty(item))} of ${fq(item.qty)} ${item.unit} are bought so far. It will move to Purchased with what you have bought.`, "Mark purchased", { good: true, cancel: "Not yet" }))) return;
    const done = { ...item, status: "bought" }; replace(done); PP.render(); PP.save(() => Api.saveItem(done), "Moved to Purchased ✓");
  }
  function moveBack(item) {
    const back = { ...item, status: "todo" }; replace(back); PP.render(); PP.save(() => Api.saveItem(back), "Moved back to To purchase");
  }

  /* ---------- Card buttons ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const el = b.closest(".card"); if (!el) return;
    const item = PP.state.items.find(x => x.id === el.dataset.id); if (!item) return;
    if (!(await PP.gate())) return;
    const act = b.dataset.act, line = PP.lines(item).find(l => l.id === b.dataset.line);
    if (act === "addbuy") openBuy(item, null);
    else if (act === "addmany") PP.openBuyMany(item);
    else if (act === "editbuy" && line) openBuy(item, line);
    else if (act === "delbuy" && line) {
      if (!(await PP.askConfirm("Delete this purchase?", `${fq(line.qty)} ${item.unit} from ${line.supplier || "this supplier"} (${money(PP.lineAmt(line))}) will be removed. This can’t be undone.`))) return;
      const next = { ...item, purchases: PP.lines(item).filter(l => l.id !== line.id) }; replace(next); PP.render(); PP.save(() => Api.saveItem(next), "Purchase deleted");
    }
    else if (act === "complete") markDone(item);
    else if (act === "undo") moveBack(item);
    else if (act === "edit") openItem(item);
    else if (act === "del") {
      const n = PP.lines(item).length;
      if (!(await PP.askConfirm("Delete this item?", `“${item.name}”${n ? ` and its ${n} ${n === 1 ? "purchase" : "purchases"}` : ""} will be removed. This can’t be undone.`))) return;
      PP.state.items = PP.state.items.filter(x => x.id !== item.id); PP.render(); PP.save(() => Api.deleteItem(item.id), "Item deleted");
    }
  });
  $("#addBtn").addEventListener("click", async () => { if (await PP.gate()) openItem(null); });

  /* ---------- Drag a card to the other side (computer) ---------- */
  let dragId = null;
  document.addEventListener("dragstart", (e) => { const c = e.target.closest && e.target.closest(".card"); if (!c) return; dragId = c.dataset.id; e.dataTransfer.setData("text/plain", dragId); e.dataTransfer.effectAllowed = "move"; c.classList.add("dragging"); });
  document.addEventListener("dragend", () => { dragId = null; document.querySelectorAll(".dragging, .over").forEach(x => x.classList.remove("dragging", "over")); });
  document.querySelectorAll(".cards[data-drop]").forEach(z => {
    z.addEventListener("dragover", (e) => { if (dragId) { e.preventDefault(); z.classList.add("over"); } });
    z.addEventListener("dragleave", () => z.classList.remove("over"));
    z.addEventListener("drop", async (e) => {
      e.preventDefault(); z.classList.remove("over");
      const item = PP.state.items.find(x => x.id === dragId); if (!item || item.status === z.dataset.drop) return;
      if (!(await PP.gate())) return;
      if (z.dataset.drop === "bought") markDone(item); else moveBack(item);
    });
  });
})();
