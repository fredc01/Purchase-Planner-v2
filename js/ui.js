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
  PP.catOf = (name) => (PP.state.settings.categories.find(c => c.name === name)) || { name, icon: "tag", limit: 0 };

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

  /* ---- where each purchase was paid from ----
         coh = % paid from cash on hand, oth = % paid by another person (othBy = their name), the rest is BANK.
         coh = null means "not chosen yet". Purchases saved before "paid by other person" have no oth, which counts as 0. ---- */
  const EPS = 1e-6, r2 = (x) => Math.round(x * 100) / 100;
  PP.shares = (l) => {
    if (l.coh == null) return { coh: 0, oth: 0, bank: 0 };
    const coh = Math.min(100, Math.max(0, Number(l.coh) || 0)), oth = Math.min(100 - coh, Math.max(0, Number(l.oth) || 0));
    return { coh, oth, bank: Math.max(0, 100 - coh - oth) };
  };
  PP.lineCoh = (l) => PP.lineAmt(l) * PP.shares(l).coh / 100;
  PP.lineOth = (l) => PP.lineAmt(l) * PP.shares(l).oth / 100;
  PP.lineBank = (l) => PP.lineAmt(l) * PP.shares(l).bank / 100;
  PP.lineOwn = (l) => PP.lineAmt(l) - PP.lineOth(l);   // what the purchase cost you (everything except what another person paid)
  PP.otherName = (l) => String(l.othBy || "").trim() || "Other person";
  PP.payKind = (l) => {          // "" (not chosen) | coh | bank | other | split
    if (l.coh == null) return "";
    const s = PP.shares(l);
    return s.coh >= 100 - EPS ? "coh" : s.oth >= 100 - EPS ? "other" : s.bank >= 100 - EPS ? "bank" : "split";
  };
  PP.payClass = PP.payKind;
  PP.payDetail = (l) => {        // every part that is more than 0, e.g. "COH ₱500 · Juan ₱300"
    const parts = [];
    if (PP.lineCoh(l) > 0.004) parts.push(`COH ${PP.money(PP.lineCoh(l))}`);
    if (PP.lineBank(l) > 0.004) parts.push(`BANK ${PP.money(PP.lineBank(l))}`);
    if (PP.lineOth(l) > 0.004) parts.push(`${PP.otherName(l)} ${PP.money(PP.lineOth(l))}`);
    return parts.join(" · ");
  };
  PP.payLabel = (l) => { const k = PP.payKind(l); return k === "coh" ? "COH" : k === "bank" ? "BANK" : k === "other" ? `Paid by ${PP.otherName(l)}` : k === "split" ? PP.payDetail(l) : ""; };

  /* ---- the "Paid from" part of a form: COH / BANK / Paid by other person / Split payment.
         Used by Add purchase, Record purchases and Add many. The form needs: select[name=source], input[name=othBy] inside .pay-other,
         and (when split is offered) .pay-split holding inputs cohAmt, bankAmt, othAmt. ---- */
  const pf = (form, n) => form.elements.namedItem(n);
  const amt0 = (form, n) => { const e = pf(form, n), x = e ? PP.num(e.value) : NaN; return Number.isFinite(x) ? x : 0; };
  // show / hide the extra fields for the chosen way of paying. total = what this purchase (or receipt) adds up to.
  PP.payUI = (form, total) => {
    const s = pf(form, "source").value, sp = form.querySelector(".pay-split"), ot = form.querySelector(".pay-other"), full = form.querySelector(".oth-full");
    if (sp) sp.hidden = s !== "split";
    ot.hidden = !(s === "other" || (s === "split" && amt0(form, "othAmt") > 0));
    if (full) { full.hidden = s !== "other"; if (s === "other") pf(form, "othFull").value = total > 0 ? PP.money(total) : ""; }
  };
  // keeps COH + BANK + other person adding up to the total: type any amount and BANK (or COH, when you type BANK) fills in the rest
  PP.payBalance = (form, changed, total) => {
    if (!pf(form, "cohAmt") || pf(form, "source").value !== "split" || !(total > 0)) return;
    const left = (skip) => r2(Math.max(0, total - amt0(form, skip[0]) - amt0(form, skip[1])));
    if (changed === "bankAmt") pf(form, "cohAmt").value = left(["bankAmt", "othAmt"]);
    else if (changed === "cohAmt" || changed === "othAmt" || (changed === "total" && (pf(form, "cohAmt").value.trim() || pf(form, "othAmt").value.trim()))) pf(form, "bankAmt").value = left(["cohAmt", "othAmt"]);
  };
  // what the person chose, as { ok, coh, oth, othBy } (coh / oth are % of the total). When not ok: { field, msg } for the themed error.
  PP.readPay = (form, total) => {
    const s = pf(form, "source").value, name = pf(form, "othBy").value.trim();
    if (s === "coh") return { ok: true, coh: 100, oth: 0, othBy: "" };
    if (s === "bank") return { ok: true, coh: 0, oth: 0, othBy: "" };
    if (s === "other") return name ? { ok: true, coh: 0, oth: 100, othBy: name } : { ok: false, field: "othBy", msg: "Type the name of the person who paid." };
    if (s === "split") {
      const c = amt0(form, "cohAmt"), b = amt0(form, "bankAmt"), o = amt0(form, "othAmt");
      if (!(total > 0) || c < 0 || b < 0 || o < 0 || Math.abs(c + b + o - total) > 0.005 || [c, b, o].filter(x => x > 0.004).length < 2)
        return { ok: false, field: "cohAmt", msg: `Type how much each one paid. The amounts must add up to ${PP.money(total)}, and at least two must be more than 0.` };
      if (o > 0.004 && !name) return { ok: false, field: "othBy", msg: "Type the name of the person who paid their part." };
      return { ok: true, coh: c / total * 100, oth: o / total * 100, othBy: o > 0.004 ? name : "" };
    }
    return { ok: false, field: "source", msg: "Choose where the payment came from: COH, BANK, another person or a split." };
  };
  // " (COH ₱500 · Juan paid ₱300)" plus a warning when COH or BANK would run short. Money paid by another person never touches COH or BANK.
  PP.payText = (p, total, excludeId) => {
    const c = total * p.coh / 100, o = total * p.oth / 100, b = Math.max(0, total - c - o), F = PP.funds(excludeId), parts = [];
    if (c > 0.004) parts.push(`COH ${PP.money(c)}`);
    if (b > 0.004) parts.push(`BANK ${PP.money(b)}`);
    if (o > 0.004) parts.push(`${p.othBy} paid ${PP.money(o)}`);
    let t = parts.length ? ` (${parts.join(" · ")})` : "";
    if (F.set) { const low = [c > F.coh + 0.005 ? `COH (available ${PP.money(F.coh)})` : "", b > F.bank + 0.005 ? `BANK (available ${PP.money(F.bank)})` : ""].filter(Boolean); if (low.length) t += `. Not enough ${low.join(" and ")}.`; }
    return t;
  };
  // fill the Paid from fields when editing an existing purchase (line = null: leave everything empty)
  PP.fillPay = (form, line) => {
    const k = line ? PP.payKind(line) : "";
    pf(form, "source").value = k; pf(form, "othBy").value = line && line.othBy ? line.othBy : "";
    ["cohAmt", "bankAmt", "othAmt"].forEach(n => { if (pf(form, n)) pf(form, n).value = ""; });
    if (k === "split") {
      pf(form, "cohAmt").value = r2(PP.lineCoh(line)); pf(form, "bankAmt").value = r2(PP.lineBank(line));
      if (PP.lineOth(line) > 0.004) pf(form, "othAmt").value = r2(PP.lineOth(line));
    }
  };
  // Balance = what you typed in Budget. Remaining = balance minus every purchase line on cards that are in "Purchased" (any date).
  // excludeId: leave one purchase out (used while editing it).
  PP.funds = (excludeId) => {
    const S = PP.state.settings, balCoh = Number(S.coh) || 0, balBank = Number(S.bank) || 0; let coh = balCoh, bank = balBank, oth = 0;
    PP.state.items.filter(i => i.status === "bought").forEach(i => PP.lines(i).forEach(l => { if (l.id !== excludeId) { coh -= PP.lineCoh(l); bank -= PP.lineBank(l); oth += PP.lineOth(l); } }));
    return { coh, bank, balCoh, balBank, oth, set: !!S.balAt };   // oth = paid by other people: shown for information, never taken out of COH or BANK
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
