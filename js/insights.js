// The Reports, Budget and Settings tabs.
(() => {
  const { $, esc, money, today, fq } = PP;
  let range = "month";
  const RANGES = [["month", "This month"], ["30", "Last 30 days"], ["90", "Last 3 months"], ["year", "This year"], ["all", "All time"]];
  const PRI = { high: 0, medium: 1, low: 2 };
  // every purchase on every card, as { i: the item, l: the purchase, amt: qty × price }
  const allLines = () => PP.state.items.flatMap(i => PP.lines(i).filter(l => l.date).map(l => ({ i, l, amt: PP.lineAmt(l) })));
  const sumA = (rows) => rows.reduce((s, r) => s + r.amt, 0);
  const group = (list, keyFn) => { const m = {}; list.forEach(r => { const k = keyFn(r); if (k) (m[k] ||= []).push(r); }); return m; };
  const bar = (label, value, max, color, extra = "") => `<li><div class="bar-row"><span class="bar-label">${label}</span><span class="bar-val">${money(value)}${extra}</span></div>
    <div class="bar"><i style="width:${max ? Math.max(2, value / max * 100) : 0}%;background:${color}"></i></div></li>`;
  const more = (n) => `<p class="empty-s">+ ${n} more</p>`;

  function inRange(d) {
    const t = today();
    if (range === "all") return true;
    if (range === "month") return d.slice(0, 7) === t.slice(0, 7);
    if (range === "year") return d.slice(0, 4) === t.slice(0, 4);
    const from = new Date(); from.setDate(from.getDate() - (range === "30" ? 30 : 90));
    return d >= PP.iso(from) && d <= t;
  }

  /* ---------- Reports ---------- */
  function renderReports() {
    const rows = allLines().filter(r => inRange(r.l.date)), spent = sumA(rows);
    const open = PP.state.items.filter(i => i.status === "todo").sort((a, b) => (PRI[a.priority] - PRI[b.priority]) || (a.needed || "9999").localeCompare(b.needed || "9999"));
    const outstanding = open.reduce((s, i) => s + PP.remaining(i) * (Number(i.est) || 0), 0);
    const saved = rows.reduce((s, r) => s + (r.i.est > 0 ? r.l.qty * r.i.est - r.amt : 0), 0);
    const pct = (v) => spent ? Math.round(v / spent * 100) : 0;
    const top = (g, n) => Object.entries(g).map(([k, v]) => [k, sumA(v), v.length]).sort((a, b) => b[1] - a[1]).slice(0, n);
    const cats = top(group(rows, r => r.i.category), 8), sups = top(group(rows, r => r.l.supplier || "No supplier"), 6), projs = top(group(rows, r => r.i.project), 6);
    const biggest = [...rows].sort((a, b) => b.amt - a.amt).slice(0, 5);
    const log = [...rows].sort((a, b) => b.l.date.localeCompare(a.l.date) || b.amt - a.amt), LOG_MAX = 50;
    // last 6 months
    const months = [], now = new Date(), every = allLines();
    for (let k = 5; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString(undefined, { month: "short" }) }); }
    const perMonth = months.map(m => sumA(every.filter(r => r.l.date.slice(0, 7) === m.key))), maxM = Math.max(...perMonth, 1);
    const cap = !window.Capacitor;
    $("#reportsRoot").innerHTML = `
      <div class="seg" id="rangeSeg" role="group" aria-label="Report period">${RANGES.map(([k, l]) => `<button type="button" data-range="${k}" aria-pressed="${k === range}">${l}</button>`).join("")}</div>
      <div class="kpis">
        <div class="kpi"><span>Total spent</span><strong>${money(spent)}</strong></div>
        <div class="kpi"><span>Paid from COH</span><strong>${money(rows.reduce((s, r) => s + PP.lineCoh(r.l), 0))}</strong></div>
        <div class="kpi"><span>Paid from BANK</span><strong>${money(rows.reduce((s, r) => s + PP.lineBank(r.l), 0))}</strong></div>
        <div class="kpi"><span>Purchases recorded</span><strong>${rows.length}</strong></div>
        <div class="kpi ${saved >= 0 ? "good" : "bad"}"><span>${saved >= 0 ? "Saved vs budget" : "Over budget"}</span><strong>${money(Math.abs(saved))}</strong></div>
        <div class="kpi"><span>Items still to purchase</span><strong>${open.length}</strong></div>
        <div class="kpi"><span>Budget left to buy</span><strong>${money(outstanding)}</strong></div>
      </div>
      <div class="grid2">
        <section class="panel"><h3>Spending by category</h3>${cats.length ? `<ul class="bars">${cats.map(([k, v]) => bar(`${PP.catIcon(PP.catOf(k))} ${esc(k)}`, v, cats[0][1], PP.catColor(k), ` <small>${pct(v)}%</small>`)).join("")}</ul>` : `<p class="empty-s">No purchases in this period.</p>`}</section>
        <section class="panel"><h3>Spending by supplier</h3>${sups.length ? `<ul class="bars">${sups.map(([k, v, n]) => bar(esc(k), v, sups[0][1], "var(--teal)", ` <small>${n} ${n === 1 ? "purchase" : "purchases"}</small>`)).join("")}</ul>` : `<p class="empty-s">No purchases in this period.</p>`}</section>
        <section class="panel"><h3>Spending by month <small>(last 6 months)</small></h3>
          <div class="cols">${months.map((m, i) => `<div class="colbar"><span class="cv">${perMonth[i] ? money(perMonth[i]) : ""}</span><i style="height:${perMonth[i] ? Math.max(4, perMonth[i] / maxM * 100) : 0}%"></i><span class="cl">${m.label}</span></div>`).join("")}</div></section>
        <section class="panel"><h3>Still to purchase</h3>${open.length ? `<ol class="rank">${open.slice(0, 8).map(i => `<li><span>${esc(i.name)}<small>${fq(PP.remaining(i))} of ${fq(i.qty)} ${esc(i.unit)} left${i.needed ? ` · needed ${PP.fmtDate(i.needed)}` : ""}</small></span><b>${i.est > 0 ? money(PP.remaining(i) * i.est) : "–"}</b></li>`).join("")}</ol>${open.length > 8 ? more(open.length - 8) : ""}` : `<p class="empty-s">Everything on the list is purchased.</p>`}</section>
        ${projs.length ? `<section class="panel"><h3>Spending by project / area</h3><ul class="bars">${projs.map(([k, v]) => bar(`<svg class="ti" aria-hidden="true"><use href="#ti-map-pin"/></svg> ${esc(k)}`, v, projs[0][1], "var(--amber)", ` <small>${pct(v)}%</small>`)).join("")}</ul></section>` : ""}
        <section class="panel"><h3>Biggest purchases</h3>${biggest.length ? `<ol class="rank">${biggest.map(r => `<li><span>${esc(r.i.name)}<small>${esc(r.l.supplier || "No supplier")} · ${PP.fmtDate(r.l.date)}</small></span><b>${money(r.amt)}</b></li>`).join("")}</ol>` : `<p class="empty-s">Nothing yet.</p>`}</section>
        <section class="panel wide"><h3>Purchase log <small>(${rows.length} ${rows.length === 1 ? "purchase" : "purchases"} in this period)</small></h3>
          ${log.length ? `<div class="tablewrap"><table class="log"><thead><tr><th>Date</th><th>Item</th><th>Supplier</th><th class="r">Qty</th><th class="r">Price each</th><th class="r">Total</th><th>Paid from</th><th>Receipt</th></tr></thead><tbody>
            ${log.slice(0, LOG_MAX).map(r => `<tr><td>${PP.fmtDate(r.l.date)}</td><td>${esc(r.i.name)}</td><td>${esc(r.l.supplier || "–")}</td><td class="r">${fq(r.l.qty)} ${esc(r.i.unit)}</td><td class="r">${money(r.l.price)}</td><td class="r"><b>${money(r.amt)}</b></td><td>${r.l.coh == null ? "–" : `<span class="pay ${PP.payClass(r.l)}">${PP.payLabel(r.l)}</span>`}</td><td>${esc(r.l.ref || "")}</td></tr>`).join("")}</tbody></table></div>
            ${log.length > LOG_MAX ? `<p class="empty-s">Showing the latest ${LOG_MAX}. Copy the CSV below to get all of them.</p>` : ""}` : `<p class="empty-s">No purchases in this period.</p>`}</section>
      </div>
      <div class="export">
        <button class="btn" id="copyLog" type="button"><svg class="ti" aria-hidden="true"><use href="#ti-clipboard"/></svg> Copy purchase log (CSV)</button><button class="btn" id="copyNeeds" type="button"><svg class="ti" aria-hidden="true"><use href="#ti-clipboard"/></svg> Copy items list (CSV)</button>
        ${cap ? `<button class="btn" id="dlLog" type="button"><svg class="ti" aria-hidden="true"><use href="#ti-download"/></svg> Download purchase log</button><button class="btn" id="dlNeeds" type="button"><svg class="ti" aria-hidden="true"><use href="#ti-download"/></svg> Download items list</button>` : ""}</div>`;
  }
  $("#reportsRoot").addEventListener("click", async (e) => {
    const r = e.target.closest("[data-range]");
    if (r) { range = r.dataset.range; renderReports(); return; }
    const kinds = { copyLog: [logCsv, "purchase-log"], dlLog: [logCsv, "purchase-log"], copyNeeds: [needsCsv, "items-list"], dlNeeds: [needsCsv, "items-list"] };
    const b = e.target.closest("button[id]"), k = b && kinds[b.id]; if (!k) return;
    if (b.id.startsWith("copy")) { try { await navigator.clipboard.writeText(k[0]()); PP.toast("Copied. Paste it into Excel or Sheets."); } catch { PP.toast("Couldn’t copy. Try the download button."); } }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([k[0]()], { type: "text/csv" })); a.download = `${k[1]}-${today()}.csv`; a.click(); URL.revokeObjectURL(a.href); }
  });
  const csvOf = (rows) => rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  function logCsv() {   // one row per purchase
    const rows = [["Date", "Item", "Category", "Project / area", "Supplier", "Qty", "Unit", "Price each", "Total", "Paid from COH", "Paid from BANK", "Receipt / DR no.", "Budget each"]];
    allLines().sort((a, b) => a.l.date.localeCompare(b.l.date)).forEach(({ i, l, amt }) => rows.push([l.date, i.name, i.category, i.project, l.supplier, l.qty, i.unit, l.price, amt, PP.lineCoh(l), PP.lineBank(l), l.ref, i.est]));
    return csvOf(rows);
  }
  function needsCsv() {  // one row per item needed
    const rows = [["Item", "Category", "Project / area", "Unit", "Qty needed", "Qty purchased", "Qty remaining", "Budget each", "Budget total", "Total paid", "Priority", "Needed by", "Status", "Notes"]];
    PP.state.items.forEach(i => rows.push([i.name, i.category, i.project, i.unit, i.qty, PP.boughtQty(i), PP.remaining(i), i.est, PP.budget(i), PP.paid(i), i.priority, i.needed, i.status === "bought" ? "Purchased" : "To purchase", i.notes]));
    return csvOf(rows);
  }

  /* ---------- Budget ---------- */
  function renderBudget() {
    const S = PP.state.settings, month = today().slice(0, 7), thisMonth = allLines().filter(r => r.l.date.slice(0, 7) === month), spent = sumA(thisMonth);
    const d = new Date(), left = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
    const planned = PP.state.items.filter(i => i.status === "todo").reduce((s, i) => s + PP.remaining(i) * (Number(i.est) || 0), 0);
    const b = S.budget || 0, remain = b - spent, pct = b ? spent / b * 100 : 0;
    const byCat = group(thisMonth, r => r.i.category);
    const F = PP.funds(), r2 = (n) => Math.round(n * 100) / 100, fund = (cls, label, v, left) =>
      `<div class="fund ${cls}"><span>${label}</span><strong>${F.set ? money(v) : "–"}</strong><small>${F.set ? `Remaining after purchases: <b class="${left < 0 ? "bad-t" : ""}">${money(left)}</b>` : "Not set yet"}</small></div>`;
    $("#budgetRoot").innerHTML = `
      <section class="panel big">
        <h3>Cash &amp; bank</h3>
        <div class="funds">${fund("coh", "COH Balance", F.balCoh, F.coh)}${fund("bank", "BANK Balance", F.balBank, F.bank)}${fund("all", "Total balance", F.balCoh + F.balBank, F.coh + F.bank)}</div>
        <form id="fundsForm" class="inline wrap" novalidate>
          <label>COH Balance<input name="coh" type="number" step="0.01" inputmode="decimal" value="${F.set ? r2(F.balCoh) : ""}" placeholder="Available cash on hand"></label>
          <label>BANK Balance<input name="bank" type="number" step="0.01" inputmode="decimal" value="${F.set ? r2(F.balBank) : ""}" placeholder="Available bank balance"></label>
          <button class="btn primary" type="submit">Save balances</button></form>
        <p class="hint">Type the cash on hand and the bank balance you have available. The Board shows what is remaining: these balances minus every card in Purchased, taken from COH, BANK or both as chosen on each purchase.</p>
      </section>
      <section class="panel big">
        <h3>Monthly budget</h3>
        <form id="budgetForm" class="inline" novalidate><label>Budget for this month<input name="budget" type="number" min="0" step="0.01" inputmode="decimal" value="${b || ""}" placeholder="e.g. 600000"></label><button class="btn primary" type="submit">Save</button></form>
        ${b ? `<div class="meter ${pct > 100 ? "over" : pct > 85 ? "warn" : ""}"><i style="width:${Math.min(100, pct)}%"></i></div>
          <p class="meter-text"><b>${money(spent)}</b> spent of ${money(b)} · ${remain >= 0 ? `<b>${money(remain)}</b> left` : `<b class="bad-t">${money(-remain)} over</b>`}</p>
          <p class="hint">${remain > 0 ? `${left} ${left === 1 ? "day" : "days"} left this month, about ${money(remain / left)} a day.` : "You’ve used the whole budget for this month."}
          ${planned > 0 ? ` What is still to purchase adds about ${money(planned)} at budget prices, which would bring the month to ${money(spent + planned)} (${Math.round((spent + planned) / b * 100)}%).` : ""}</p>`
          : `<p class="hint">Set a monthly budget to see how much is left.</p>`}
      </section>
      <section class="panel big"><h3>Limits by category <small>(this month)</small></h3>
        <form id="limitForm" novalidate>
          <ul class="limits">${S.categories.map(c => { const s = sumA(byCat[c.name] || []), p = c.limit ? s / c.limit * 100 : 0; return `<li>
            <div class="bar-row"><span class="bar-label">${PP.catIcon(c)} ${esc(c.name)}</span><span class="bar-val">${money(s)}${c.limit ? ` / ${money(c.limit)}` : ""}</span></div>
            ${c.limit ? `<div class="meter sm ${p > 100 ? "over" : p > 85 ? "warn" : ""}"><i style="width:${Math.min(100, p)}%"></i></div>` : ""}
            <label class="lim">Limit<input name="lim" data-cat="${esc(c.name)}" type="number" min="0" step="0.01" inputmode="decimal" value="${c.limit || ""}" placeholder="No limit"></label></li>`; }).join("")}</ul>
          <button class="btn primary" type="submit">Save limits</button>
        </form></section>`;
  }
  $("#budgetRoot").addEventListener("input", (e) => { const w = e.target.closest("label"); if (w) PP.clearError(w); });
  $("#budgetRoot").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (e.target.id === "fundsForm") {
      const ci = e.target.elements.namedItem("coh"), bi = e.target.elements.namedItem("bank"), c = ci.value === "" ? 0 : PP.num(ci.value), b = bi.value === "" ? 0 : PP.num(bi.value);
      if (isNaN(c)) { PP.showError(ci.closest("label"), "Type an amount."); ci.focus(); return; }
      if (isNaN(b)) { PP.showError(bi.closest("label"), "Type an amount."); bi.focus(); return; }
      if (!(await PP.gate())) return;
      Object.assign(PP.state.settings, { coh: c, bank: b, balAt: new Date().toISOString() }); renderBudget(); PP.save(() => Api.saveSettings(PP.state.settings), "Balances saved");
    } else if (e.target.id === "budgetForm") {
      const inp = e.target.elements.namedItem("budget"), v = inp.value === "" ? 0 : PP.num(inp.value);
      if (isNaN(v) || v < 0) { PP.showError(inp.closest("label"), "Type an amount of 0 or more."); inp.focus(); return; }
      if (!(await PP.gate())) return;
      PP.state.settings.budget = v; renderBudget(); PP.save(() => Api.saveSettings(PP.state.settings), "Budget saved");
    } else if (e.target.id === "limitForm") {
      const inputs = [...e.target.querySelectorAll("input[data-cat]")]; let bad = null;
      inputs.forEach(inp => { const v = inp.value === "" ? 0 : PP.num(inp.value); if (isNaN(v) || v < 0) { PP.showError(inp.closest("label"), "Type 0 or more."); bad = bad || inp; } });
      if (bad) { bad.focus(); return; }
      if (!(await PP.gate())) return;
      inputs.forEach(inp => { const c = PP.state.settings.categories.find(x => x.name === inp.dataset.cat); if (c) c.limit = inp.value === "" ? 0 : PP.num(inp.value); });
      renderBudget(); PP.save(() => Api.saveSettings(PP.state.settings), "Limits saved");
    }
  });

  /* ---------- Settings ---------- */
  function renderSettings() {
    const S = PP.state.settings;
    $("#settingsRoot").innerHTML = `
      <section class="panel big"><h3>Currency</h3>
        <form id="curForm" class="inline" novalidate><label>Symbol shown before prices<input name="currency" maxlength="4" value="${esc(S.currency)}" placeholder="₱"></label><button class="btn primary" type="submit">Save</button></form></section>
      <section class="panel big"><h3>Categories</h3>
        <ul class="catlist">${S.categories.map(c => `<li><span class="chip cat" style="--c:${PP.catColor(c.name)}">${PP.catIcon(c)} ${esc(c.name)}</span>
          ${c.name === "Other" ? `<small class="muted">always kept</small>` : `<button class="icon-btn" data-delcat="${esc(c.name)}" type="button" aria-label="Remove ${esc(c.name)}"><svg class="ti" aria-hidden="true"><use href="#ti-x"/></svg></button>`}</li>`).join("")}</ul>
        <form id="catForm" class="inline" novalidate><label>New category<input name="cat" maxlength="24" placeholder="e.g. Glass & Windows"></label><button class="btn primary" type="submit">Add</button></form></section>
      <section class="panel big"><h3>Your data</h3>
        ${Api.mode === "local" ? `<p class="hint">Your list is saved on this device only. To share it between your phone and computer, connect a Google Sheet (see README.md). The sample items can be cleared to start fresh.</p>
          <button class="btn danger" id="clearDemo" type="button">Clear all items (start fresh)</button>`
          : `<p class="hint">Your list is saved in your Google Sheet and shared with everyone who has the password.</p><button class="btn" id="signOut" type="button">Sign out on this device</button>`}</section>`;
  }
  $("#settingsRoot").addEventListener("input", (e) => { const w = e.target.closest("label"); if (w) PP.clearError(w); });
  $("#settingsRoot").addEventListener("submit", async (e) => {
    e.preventDefault(); const S = PP.state.settings;
    if (e.target.id === "curForm") {
      const inp = e.target.elements.namedItem("currency"), v = inp.value.trim();
      if (!v) { PP.showError(inp.closest("label"), "Type a symbol, like ₱, $ or €."); inp.focus(); return; }
      if (!(await PP.gate())) return;
      S.currency = v; PP.render(); PP.save(() => Api.saveSettings(S), "Currency saved");
    } else if (e.target.id === "catForm") {
      const inp = e.target.elements.namedItem("cat"), v = inp.value.trim();
      if (!v) { PP.showError(inp.closest("label"), "Type a category name first."); inp.focus(); return; }
      if (S.categories.some(c => c.name.toLowerCase() === v.toLowerCase())) { PP.showError(inp.closest("label"), "You already have that category."); inp.focus(); return; }
      if (!(await PP.gate())) return;
      S.categories.splice(Math.max(0, S.categories.findIndex(c => c.name === "Other")), 0, { name: v, icon: "tag", limit: 0 });
      PP.render(); PP.save(() => Api.saveSettings(S), "Category added");
    }
  });
  $("#settingsRoot").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-delcat]");
    if (del) {
      if (!(await PP.gate())) return; const name = del.dataset.delcat, n = PP.state.items.filter(i => i.category === name).length;
      if (!(await PP.askConfirm("Remove this category?", n ? `${n} ${n === 1 ? "item" : "items"} in “${name}” will move to “Other”.` : `“${name}” will be removed.`, "Remove"))) return;
      const moved = PP.state.items.filter(i => i.category === name).map(i => ({ ...i, category: "Other" }));
      PP.state.items = PP.state.items.map(i => i.category === name ? { ...i, category: "Other" } : i);
      PP.state.settings.categories = PP.state.settings.categories.filter(c => c.name !== name);
      PP.render(); PP.save(async () => { await Api.saveSettings(PP.state.settings); for (const m of moved) await Api.saveItem(m); }, "Category removed");
    }
    if (e.target.closest("#clearDemo")) {
      if (!(await PP.askConfirm("Clear everything?", "All items on both sides of the board, with their purchases, will be removed from this device.", "Clear all"))) return;
      PP.state.items = []; PP.render(); PP.save(() => Api.clearAll(), "All cleared");
    }
    if (e.target.closest("#signOut")) { Api.signOut(); PP.updateSign(); PP.toast("Signed out"); }
  });

  PP.renderTab = () => { if (PP.tab === "reports") renderReports(); else if (PP.tab === "budget") renderBudget(); else if (PP.tab === "settings") renderSettings(); };
})();
