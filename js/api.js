// All saving and loading goes through "Api".
//  - LocalApi: saved on this device only (default, works offline)
//  - SheetApi: saved in a Google Sheet so every device sees the same list
// An item = something the site needs (name, quantity, unit, budget price, ...) + its list of purchases (supplier, qty, price, date, ref).
const DEFAULT_CATEGORIES = [
  { name: "Cement & Masonry", icon: "wall", limit: 0 }, { name: "Steel & Rebar", icon: "stack-2", limit: 0 },
  { name: "Lumber & Formworks", icon: "tree", limit: 0 }, { name: "Electrical", icon: "bolt", limit: 0 },
  { name: "Plumbing", icon: "droplet", limit: 0 }, { name: "Paint & Finishes", icon: "palette", limit: 0 },
  { name: "Tiles & Flooring", icon: "layout-grid", limit: 0 }, { name: "Roofing", icon: "home", limit: 0 },
  { name: "Hardware & Fasteners", icon: "tool", limit: 0 }, { name: "Tools & Equipment", icon: "tools", limit: 0 },
  { name: "Safety & PPE", icon: "shield-check", limit: 0 }, { name: "Other", icon: "package", limit: 0 }
];

// Makes any item (from this device or from the sheet) safe to use: numbers are numbers, purchases is always a list.
function normItem(r) {
  const n = (v) => Number(String(v ?? "").replace(/,/g, "")) || 0;
  let list = r.purchases;
  if (typeof list === "string") { try { list = JSON.parse(list || "[]"); } catch { list = []; } }
  if (!Array.isArray(list)) list = [];
  return {
    id: String(r.id), name: String(r.name || ""), category: r.category || "Other", project: r.project || "", unit: r.unit || "pcs",
    qty: n(r.qty) || 1, est: n(r.est), priority: ["high", "medium", "low"].includes(r.priority) ? r.priority : "medium",
    needed: r.needed || "", notes: r.notes || "", status: r.status === "bought" ? "bought" : "todo", created: r.created || "",
    purchases: list.map(l => ({ id: String(l.id || Math.random().toString(36).slice(2)), supplier: l.supplier || "", qty: n(l.qty), price: n(l.price), date: l.date || "", ref: l.ref || "",
      coh: (l.coh === undefined || l.coh === null || l.coh === "") ? null : Math.min(100, Math.max(0, n(l.coh))), at: l.at || "" }))
  };
}

const LocalApi = (() => {
  const KEY = "purchasePlanner:v2";
  let st = null;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const buy = (id, supplier, qty, price, daysAgo, ref = "", coh = 100) => ({ id, supplier, qty, price, date: ago(daysAgo), ref, coh, at: "" });
  const item = (id, name, category, project, unit, qty, est, priority, needed, status, purchases = [], notes = "") =>
    ({ id, name, category, project, unit, qty, est, priority, needed, notes, status, created: ago(20), purchases });
  const fresh = () => ({
    settings: { currency: "₱", budget: 600000, coh: 150000, bank: 450000, balAt: new Date().toISOString(), categories: DEFAULT_CATEGORIES.map(c => ({ ...c })) },
    items: [
      item("d1", "Portland cement 40kg", "Cement & Masonry", "Block A – Slab", "bags", 120, 265, "high", ago(-3), "todo",
        [buy("l1", "Mabuhay Hardware", 50, 262, 2, "DR-1042"), buy("l2", "Holcim Depot", 40, 268, 1, "DR-3310", 20)], "Deliver to the gate on the north side"),
      item("d2", "Deformed bar 12mm × 6m", "Steel & Rebar", "Block A – Slab", "pcs", 200, 410, "high", ago(-5), "todo"),
      item("d3", "THHN wire 3.5mm²", "Electrical", "Block B – Roughing-in", "rolls", 8, 3200, "medium", ago(-12), "todo",
        [buy("l3", "Wiremaster Electrical", 3, 3150, 4, "SI-778")]),
      item("d4", "PVC pipe 4in (S1000)", "Plumbing", "Block B – Roughing-in", "pcs", 30, 520, "medium", ago(2), "todo"),
      item("d5", "Safety helmets", "Safety & PPE", "", "pcs", 20, 180, "low", "", "todo", [], "Yellow and white"),
      item("p1", "Marine plywood 3/4in", "Lumber & Formworks", "Block A – Slab", "sheets", 40, 1450, "high", "", "bought",
        [buy("l4", "Prime Lumber Trading", 25, 1420, 18, "DR-5521", 0), buy("l5", "Mabuhay Hardware", 15, 1480, 15, "DR-1011", 50)]),
      item("p2", "Hollow blocks 6in", "Cement & Masonry", "Block A – Walls", "pcs", 1500, 14, "medium", "", "bought",
        [buy("l6", "Santos Blockworks", 1000, 14, 38, "", 0), buy("l7", "Dela Cruz Blocks", 500, 15.5, 36)]),
      item("p3", "Washed sand", "Cement & Masonry", "Block A – Walls", "cu.m", 12, 1100, "medium", "", "bought",
        [buy("l8", "Santos Blockworks", 12, 1150, 40)]),
      item("p4", "Tie wire #16", "Steel & Rebar", "Block A – Slab", "rolls", 10, 1650, "low", "", "bought",
        [buy("l9", "Steelmart", 6, 1620, 70), buy("l10", "Mabuhay Hardware", 4, 1700, 69)]),
      item("p5", "Concrete nails 3in", "Hardware & Fasteners", "", "kg", 25, 95, "low", "", "bought",
        [buy("l11", "Mabuhay Hardware", 25, 92, 95)]),
      item("p6", "Gravel 3/4in", "Cement & Masonry", "Block A – Slab", "cu.m", 20, 1300, "medium", "", "bought",
        [buy("l12", "Dela Cruz Blocks", 20, 1350, 110)])
    ]
  });
  const get = () => {
    if (!st) { try { const r = localStorage.getItem(KEY); st = r ? JSON.parse(r) : fresh(); } catch { st = fresh(); } }
    return st;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { st = null; throw new Error("This device is out of storage space."); } };
  return {
    mode: "local", needsPass: false, hasPass: () => true, signIn: async () => {}, signOut: () => {},
    async load() { const d = JSON.parse(JSON.stringify(get())); d.items = d.items.map(normItem); return d; },
    async saveItem(it) { const d = get(), i = d.items.findIndex(x => x.id === it.id); if (i >= 0) d.items[i] = it; else d.items.push(it); save(); },
    async saveItems(list) { const d = get(); list.forEach(it => { const i = d.items.findIndex(x => x.id === it.id); if (i >= 0) d.items[i] = it; else d.items.push(it); }); save(); },
    async deleteItem(id) { get().items = get().items.filter(x => x.id !== id); save(); },
    async saveSettings(s) { get().settings = s; save(); },
    async clearAll() { get().items = []; save(); }
  };
})();

const SheetApi = (() => {
  const URL_ = String((window.PP_CONFIG || {}).SCRIPT_URL || "").trim();
  const KEY = "purchasePlanner:password";
  const pw = { get() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
               set(v) { try { localStorage.setItem(KEY, v); } catch {} }, clear() { try { localStorage.removeItem(KEY); } catch {} } };
  async function read(res) {
    let out;
    try { out = await res.json(); } catch { throw new Error("The sheet didn’t answer. Check the web app URL in js/config.js and that access is set to “Anyone”."); }
    if (!out.ok) { const e = new Error(out.error || "Something went wrong."); e.code = out.code; throw e; }
    return out.data;
  }
  async function call(action, payload = {}) {
    // text/plain keeps this a "simple" request, so no CORS preflight is needed (Apps Script can't answer one)
    const res = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, ...payload, password: pw.get() }) });
    try { return await read(res); }
    catch (e) { if (e.code === "auth") { pw.clear(); e.message = "Wrong password. Please sign in again."; } throw e; }
  }
  const num = (v) => Number(String(v ?? "").replace(/,/g, "")) || 0;
  return {
    mode: "sheet", needsPass: true, hasPass: () => !!pw.get(),
    async signIn(p) { pw.set(String(p)); try { await call("ping"); } catch (e) { pw.clear(); throw e; } },
    signOut() { pw.clear(); },
    async load() {
      const res = await fetch(URL_ + (URL_.includes("?") ? "&" : "?") + "t=" + Date.now());
      const d = await read(res);
      let cats = []; try { cats = JSON.parse(d.settings.categories || "[]"); } catch {}
      return {
        settings: { currency: d.settings.currency || "₱", budget: num(d.settings.budget), coh: num(d.settings.coh), bank: num(d.settings.bank), balAt: d.settings.balAt || "",
          categories: Array.isArray(cats) && cats.length ? cats : DEFAULT_CATEGORIES.map(c => ({ ...c })) },
        items: d.items.map(normItem)
      };
    },
    // the purchases list is saved as one text cell (JSON) on the item's row
    saveItem: (it) => call("saveItem", { item: { ...it, purchases: JSON.stringify(it.purchases || []) } }),
    // many items in one trip. If the Google Sheet script is the older version (no "saveItems" yet), fall back to one by one.
    async saveItems(list) {
      const pack = (it) => ({ ...it, purchases: JSON.stringify(it.purchases || []) });
      try { await call("saveItems", { items: list.map(pack) }); }
      catch (e) { if (!/unknown action/i.test(e.message || "")) throw e; for (const it of list) await call("saveItem", { item: pack(it) }); }
    },
    deleteItem: (id) => call("deleteItem", { id }),
    saveSettings: (s) => call("saveSettings", { settings: { currency: s.currency, budget: s.budget, coh: s.coh || 0, bank: s.bank || 0, balAt: s.balAt || "", categories: JSON.stringify(s.categories) } })
  };
})();

const Api = (window.PP_CONFIG && /^https:\/\/script\.google\.com\//.test(String(window.PP_CONFIG.SCRIPT_URL || ""))) ? SheetApi : LocalApi;
