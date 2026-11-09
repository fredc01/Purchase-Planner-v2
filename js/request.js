// "Purchase request": pick the items you want to buy, fill in the project / supplier, and download the company's
// PURCHASE REQUEST Excel form (same layout as PURCHASE_REQUEST.xlsx). The form itself is built in request-xlsx.js.
(() => {
  const { $, esc, money, fq, today } = PP;
  const DEFAULTS = { address: "24 rizal Avenue, San Isidro, Taytay Rizal", preparedBy: "J. AS-IL", approvedName: "Gerald James Cruz", approvedTitle: "CEO/President" };
  const dlg = $("#prDialog"), form = $("#prForm"), list = $("#prList"), fv = (n) => PP.field(form, n);
  const toNum = (v) => { const s = String(v ?? "").replace(/[^0-9.\-]/g, ""); return s === "" ? NaN : Number(s); };
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const q$ = (r, s) => r.querySelector(s);
  const mem = () => { const S = PP.state.settings; return S.pr || (S.pr = {}); };      // remembered between requests: { loc: { project: "place" }, requestBy, preparedBy, ... }
  let items = [], autoLoc = "";
  const rows = () => [...list.querySelectorAll(".prow")];
  const state = (r) => ({ r, item: items.find(x => x.id === r.dataset.id), on: q$(r, ".p-on").checked, qty: toNum(q$(r, ".p-qty").value), price: toNum(q$(r, ".p-price").value) });
  const picked = () => rows().map(state).filter(s => s.on);
  const total = () => picked().reduce((t, s) => t + (s.qty > 0 && s.price > 0 ? s.qty * s.price : 0), 0);

  const rowHtml = (i) => { const rem = PP.remaining(i); return `<div class="prow" data-id="${esc(i.id)}">
    <input type="checkbox" class="p-on" aria-label="Include ${esc(i.name)}">
    <div class="p-name"><b>${esc(i.name)}</b><small>${fq(rem)} ${esc(i.unit)} to buy${i.est > 0 ? ` · budget ${money(i.est)} each` : ""}${i.project ? ` · ${esc(i.project)}` : ""}</small></div>
    <div class="p-q"><input class="p-qty" inputmode="decimal" placeholder="${fq(rem)}" aria-label="Quantity to request"><span>${esc(i.unit)}</span></div>
    <input class="p-price" inputmode="decimal" placeholder="${i.est > 0 ? esc(String(i.est)) : "Price each"}" aria-label="Price each">
    <span class="p-amt">–</span></div>`; };

  // a row is shown when it matches the project that was typed (if it is one of your projects) and the search box
  function applyFilter() {
    const proj = norm(fv("project").value), known = items.some(i => norm(i.project) === proj && proj), q = norm($("#prFilter").value);
    rows().forEach(r => { const it = items.find(x => x.id === r.dataset.id); r.hidden = (known && norm(it.project) !== proj) || (!!q && !norm(it.name).includes(q)); });
    const vis = rows().filter(r => !r.hidden); $("#prAll").checked = vis.length > 0 && vis.every(r => q$(r, ".p-on").checked);
  }
  function tick(r, on) {
    const it = items.find(x => x.id === r.dataset.id); q$(r, ".p-on").checked = on;
    if (on) { if (!(toNum(q$(r, ".p-qty").value) > 0)) q$(r, ".p-qty").value = PP.remaining(it); if (!q$(r, ".p-price").value.trim() && it.est > 0) q$(r, ".p-price").value = it.est; }
  }
  function update() {
    rows().forEach(r => { const s = state(r); r.classList.toggle("on", s.on); q$(r, ".p-amt").textContent = s.on && s.qty > 0 && s.price > 0 ? money(s.qty * s.price) : "–"; });
    const n = picked().length; $("#prTotal").textContent = n ? `${n} ${n === 1 ? "item" : "items"} · Total ${money(total())}` : "";
    $("#prSave").lastChild.textContent = n ? ` Download request (${n} ${n === 1 ? "item" : "items"})` : " Download request";
    const vis = rows().filter(r => !r.hidden); $("#prAll").checked = vis.length > 0 && vis.every(r => q$(r, ".p-on").checked);
  }

  function open() {
    items = PP.state.items.filter(i => i.status === "todo" && PP.remaining(i) > 0).sort((a, b) => norm(a.project).localeCompare(norm(b.project)));   // grouped by project, otherwise in the order you added them
    if (!items.length) { PP.toast("Nothing to request. Add items to purchase first."); return; }
    const m = mem(); form.reset(); PP.clearAll(form); autoLoc = "";
    list.innerHTML = items.map(rowHtml).join("");
    fv("date").value = today(); fv("requestBy").value = m.requestBy || ""; fv("mode").value = m.mode || "CASH";
    fv("address").value = m.address || DEFAULTS.address; fv("preparedBy").value = m.preparedBy || DEFAULTS.preparedBy;
    fv("approvedName").value = m.approvedName || DEFAULTS.approvedName; fv("approvedTitle").value = m.approvedTitle || DEFAULTS.approvedTitle;
    $("#prError").textContent = ""; $("#prAll").checked = false; applyFilter(); update(); dlg.showModal();
  }

  // choosing one of your projects shows its items, ticks them all (untick what you don't want) and fills in the remembered location
  fv("project").addEventListener("change", () => {
    const proj = norm(fv("project").value); applyFilter();
    if (proj && items.some(i => norm(i.project) === proj)) rows().filter(r => !r.hidden).forEach(r => tick(r, true));
    const loc = (mem().loc || {})[proj]; if (loc && (!fv("location").value.trim() || fv("location").value === autoLoc)) { fv("location").value = loc; autoLoc = loc; }
    update();
  });
  $("#prFilter").addEventListener("input", applyFilter);
  $("#prAll").addEventListener("change", (e) => { rows().filter(r => !r.hidden).forEach(r => tick(r, e.target.checked)); update(); });
  list.addEventListener("change", (e) => { if (!e.target.matches(".p-on")) return; tick(e.target.closest(".prow"), e.target.checked); update(); });
  list.addEventListener("input", (e) => {             // typing a quantity or price ticks the row
    const t = e.target; if (!t.matches(".p-price, .p-qty")) return; t.classList.remove("bad");
    const r = t.closest(".prow"); if (t.value.trim() && !q$(r, ".p-on").checked) { tick(r, true); }
    update();
  });
  list.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || !e.target.matches(".p-price, .p-qty")) return; e.preventDefault();
    const vis = rows().filter(r => !r.hidden), nxt = vis[vis.indexOf(e.target.closest(".prow")) + 1]; if (nxt) q$(nxt, e.target.matches(".p-qty") ? ".p-qty" : ".p-price").focus();
  });
  PP.clearOnInput(form);

  // closing by accident (Esc, tapping outside, Android back) must not throw the typing away
  const dirty = () => picked().length > 0;
  const tryClose = async () => { if (!dirty() || await PP.askConfirm("Close without downloading?", "The items you ticked will be lost.", "Close", { cancel: "Keep editing" })) dlg.close(); };
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); tryClose(); });
  $("#prCancel").addEventListener("click", tryClose);

  let libP = null;
  const loadLib = () => window.ExcelJS ? Promise.resolve() : (libP = libP || new Promise((res, rej) => {     // the Excel library is big, so it is loaded only when needed
    const s = document.createElement("script"); s.src = "js/vendor/exceljs.min.js"; s.onload = res; s.onerror = () => { libP = null; rej(new Error("lib")); }; document.head.appendChild(s);
  }));
  async function deliver(buf, name) {
    const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (window.Capacitor && navigator.canShare) {          // inside the Android app: open the share sheet (save to Files, send by Viber / email ...)
      try { const f = new File([buf], name, { type }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sel = picked(), errs = []; let firstBad = null;
    sel.forEach(s => {
      const nm = s.item.name;
      if (!(s.qty > 0)) { errs.push(`${nm}: quantity must be more than 0.`); q$(s.r, ".p-qty").classList.add("bad"); firstBad = firstBad || q$(s.r, ".p-qty"); }
      const raw = q$(s.r, ".p-price").value.trim(); if (raw && !(toNum(raw) >= 0)) { errs.push(`${nm}: price can’t be negative.`); q$(s.r, ".p-price").classList.add("bad"); firstBad = firstBad || q$(s.r, ".p-price"); }
    });
    if (!sel.length) errs.push("Tick the items you want on this purchase request.");
    if (!form.elements.date.value) errs.push("Pick the date.");
    $("#prError").textContent = errs.slice(0, 3).join(" ") + (errs.length > 3 ? ` (+${errs.length - 3} more)` : "");
    if (errs.length) { if (firstBad) firstBad.focus(); return; }

    const btn = $("#prSave"); btn.disabled = true;
    try {
      await loadLib();
      const data = { address: fv("address").value.trim(), project: fv("project").value.trim(), location: fv("location").value.trim(), supplier: fv("supplier").value.trim(),
        mode: fv("mode").value.trim(), details: fv("details").value.trim(), date: fv("date").value, requestBy: fv("requestBy").value.trim(), preparedBy: fv("preparedBy").value.trim(),
        approvedName: fv("approvedName").value.trim(), approvedTitle: fv("approvedTitle").value.trim(),
        lines: sel.map(s => ({ qty: s.qty, unit: s.item.unit, name: s.item.name, price: s.price > 0 ? s.price : 0 })) };
      const buf = await window.PR_BUILD(window.ExcelJS, data);
      const part = (data.project || data.supplier || "").replace(/[\\/:*?"<>|]+/g, "-").trim();
      await deliver(buf, `PURCHASE REQUEST${part ? ` - ${part}` : ""} - ${data.date}.xlsx`);
      PP.toast("Purchase request ready");
      // remember the project's location and the names for next time (only when saving is allowed without asking for the password)
      const m = mem(), key = norm(data.project); m.loc = m.loc || {}; if (key && data.location && data.location !== "-") m.loc[key] = data.location;
      Object.assign(m, { requestBy: data.requestBy, mode: data.mode, address: data.address, preparedBy: data.preparedBy, approvedName: data.approvedName, approvedTitle: data.approvedTitle });
      if (!Api.needsPass || Api.hasPass()) { try { await Api.saveSettings(PP.state.settings); } catch { /* not important */ } }
    } catch (err) {
      $("#prError").textContent = err && err.message === "lib" ? "Couldn’t load the Excel maker. Check your internet connection and try again." : "Couldn’t make the file. Please try again.";
    } finally { btn.disabled = false; }
  });

  PP.openRequest = open;
  $("#prBtn").addEventListener("click", open);
})();
