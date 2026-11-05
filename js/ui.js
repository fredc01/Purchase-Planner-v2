// Shared helpers: formatting, themed messages (no plain browser popups), and the "PP" namespace the other files use.
const PP = { state: null, tab: "board" };
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  PP.$ = $; PP.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  PP.esc = (t) => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  PP.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  PP.iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  PP.today = () => PP.iso(new Date());
  PP.fmtDate = (d) => d ? new Date(d + "T00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  PP.num = (v) => { const s = String(v ?? "").replace(/,/g, "").trim(); return s === "" ? NaN : Number(s); };
  PP.money = (n) => {
    const v = Number(n) || 0, cur = (PP.state && PP.state.settings.currency) || "";
    return (v < 0 ? "-" : "") + cur + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: Math.abs(v % 1) > 0.0001 ? 2 : 0, maximumFractionDigits: 2 });
  };
  const PALETTE = ["#0f7c8c", "#e0892b", "#7a5cc7", "#d9486b", "#2f9e6e", "#3b82c4", "#b98a1e", "#6b7a86"];
  PP.catColor = (name) => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
  PP.catOf = (name) => (PP.state.settings.categories.find(c => c.name === name)) || { name, icon: "🏷️", limit: 0 };

  /* ---- one "item" = something the site needs. It holds the quantity needed (left side of the card)
         and a list of purchases (right side): each purchase = supplier, quantity, price each, date, receipt no. ---- */
  const r3 = (n) => Math.round(n * 1000) / 1000;
  PP.fq = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });     // 1500, 2.5
  PP.lines = (i) => (Array.isArray(i.purchases) ? i.purchases : []);
  PP.lineAmt = (l) => (Number(l.qty) || 0) * (Number(l.price) || 0);
  PP.boughtQty = (i) => r3(PP.lines(i).reduce((s, l) => s + (Number(l.qty) || 0), 0));
  PP.paid = (i) => PP.lines(i).reduce((s, l) => s + PP.lineAmt(l), 0);
  PP.budget = (i) => (Number(i.qty) || 0) * (Number(i.est) || 0);
  PP.remaining = (i) => Math.max(0, r3((Number(i.qty) || 0) - PP.boughtQty(i)));
  PP.saved = (i) => (Number(i.est) > 0 ? PP.boughtQty(i) * i.est - PP.paid(i) : 0);   // + = under budget, - = over budget

  /* ---- where each purchase was paid from: coh = % paid from cash on hand (0-100), the rest is BANK. null = not chosen yet ---- */
  PP.lineCoh = (l) => (l.coh == null ? 0 : PP.lineAmt(l) * l.coh / 100);
  PP.lineBank = (l) => (l.coh == null ? 0 : PP.lineAmt(l) * (100 - l.coh) / 100);
  PP.payLabel = (l) => (l.coh == null ? "" : l.coh >= 100 ? "COH" : l.coh <= 0 ? "BANK" : `COH ${PP.money(PP.lineCoh(l))} · BANK ${PP.money(PP.lineBank(l))}`);
  PP.payClass = (l) => (l.coh == null ? "" : l.coh >= 100 ? "coh" : l.coh <= 0 ? "bank" : "split");
  // Balance = what you typed in Budget. Remaining = balance minus every purchase line on cards that are in "Purchased" (any date).
  // excludeId: leave one purchase out (used while editing it).
  PP.funds = (excludeId) => {
    const S = PP.state.settings, balCoh = Number(S.coh) || 0, balBank = Number(S.bank) || 0; let coh = balCoh, bank = balBank;
    PP.state.items.filter(i => i.status === "bought").forEach(i => PP.lines(i).forEach(l => { if (l.id !== excludeId) { coh -= PP.lineCoh(l); bank -= PP.lineBank(l); } }));
    return { coh, bank, balCoh, balBank, set: !!S.balAt };
  };

  /* toast */
  let timer;
  PP.toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(timer); timer = setTimeout(() => t.classList.remove("show"), 3000); };

  /* themed validation: a message bubble under the field instead of the browser's plain popup */
  PP.clearError = (wrap, after) => {
    wrap.classList.remove("invalid");
    const e = after ? wrap.nextElementSibling : wrap.querySelector(":scope > .field-error");
    if (e && e.classList.contains("field-error")) e.remove();
  };
  PP.showError = (wrap, message, after) => {
    PP.clearError(wrap, after);
    wrap.classList.add("invalid");
    const p = document.createElement("p"); p.className = "field-error"; p.setAttribute("role", "alert"); p.textContent = message;
    if (after) wrap.after(p); else wrap.appendChild(p);
    wrap.classList.remove("shake"); void wrap.offsetWidth; wrap.classList.add("shake");
  };
  PP.clearAll = (form) => { form.querySelectorAll(".field-error").forEach(e => e.remove()); form.querySelectorAll(".invalid").forEach(w => w.classList.remove("invalid")); };
  PP.clearOnInput = (form) => form.addEventListener("input", (e) => { const w = e.target.closest("label"); if (w) PP.clearError(w); });
  // field(form, "name") -> the input; its label is where the message goes
  PP.field = (form, n) => form.elements.namedItem(n);
  PP.checks = (form, list) => {          // list: [name, ok, message]
    let first = null;
    list.forEach(([n, ok, msg]) => { const w = PP.field(form, n).closest("label"); if (ok) PP.clearError(w); else { PP.showError(w, msg); first = first || PP.field(form, n); } });
    if (first) first.focus();
    return !first;
  };

  /* themed "are you sure?"  opts: { good: true } for a green button, { cancel: "Not yet" } to rename Cancel */
  PP.askConfirm = (title, text, okLabel = "Delete", opts = {}) => new Promise((resolve) => {
    const d = $("#confirmDialog"), ok = $("#confirmOk");
    $("#confirmTitle").textContent = title; $("#confirmText").textContent = text;
    ok.textContent = okLabel; ok.className = "btn " + (opts.good ? "good" : "danger");
    $("#confirmCancel").textContent = opts.cancel || "Keep it";
    d.returnValue = ""; d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true }); d.showModal();
  });

  document.addEventListener("click", (e) => { if (e.target.matches("[data-close]")) e.target.closest("dialog").close(); });
  document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", (e) => { if (e.target === d && !d.hasAttribute("data-sticky")) d.close(); }));
})();
