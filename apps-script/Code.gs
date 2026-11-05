/**
 * Purchase Planner: the little server that lives inside a Google Sheet.
 * Only needed if you want one list shared between devices. Steps are in README.md.
 *
 * 1. Change PASSWORD below (the one password everyone types in the app).
 * 2. Run setup() once. 3. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * One row in "Items" = one thing the site needs. Its purchases (supplier, qty, price, date, receipt no.)
 * are kept together in the "purchases" column as text, so edit them in the app rather than by hand.
 */
const PASSWORD = "change-me";
const ITEM_COLS = ["id", "name", "category", "project", "unit", "qty", "est", "priority", "needed", "notes", "status", "created", "purchases"];

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet "' + name + '". Run setup() once.');
  return sh;
}
function text_(v) { return v instanceof Date ? Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), "yyyy-MM-dd") : String(v == null ? "" : v).trim(); }

function setup() {
  const ss = ss_();
  [["Items", ITEM_COLS], ["Settings", ["key", "value"]]].forEach(function (p) {
    let sh = ss.getSheetByName(p[0]);
    if (!sh) sh = ss.insertSheet(p[0]);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat("@");   // plain text: dates stay as typed
    if (sh.getLastRow() <= 1) sh.getRange(1, 1, 1, p[1].length).setValues([p[1]]);
    else if (sh.getRange(1, 1, 1, p[1].length).getValues()[0].map(String).join() !== p[1].join())
      Logger.log('The "' + p[0] + '" sheet has rows from an older version. Delete that sheet tab and run setup() again.');
    sh.setFrozenRows(1);
  });
  const blank = ss.getSheetByName("Sheet1");
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
  Logger.log("Setup done. Now deploy as a web app (see README).");
}

function doGet() {
  const settings = {};
  table_("Settings").forEach(function (r) { settings[text_(r.key)] = text_(r.value); });
  return json_({ ok: true, data: { settings: settings, items: table_("Items").filter(function (r) { return text_(r.id) && text_(r.name); }).map(function (r) {
    const o = {}; ITEM_COLS.forEach(function (c) { o[c] = c === "purchases" ? String(r[c] == null ? "" : r[c]) : text_(r[c]); }); return o; }) } });
}

function doPost(e) {
  let lock = null;
  try {
    if (PASSWORD === "change-me") return json_({ ok: false, code: "setup", error: "Set a password in Code.gs first." });
    const req = JSON.parse(e.postData.contents);
    if (String(req.password || "") !== PASSWORD) return json_({ ok: false, code: "auth", error: "Wrong password." });
    lock = LockService.getScriptLock(); lock.waitLock(20000);
    switch (req.action) {
      case "ping": break;
      case "saveItem": upsert_("Items", ITEM_COLS, req.item); break;
      case "saveItems": (req.items || []).forEach(function (it) { upsert_("Items", ITEM_COLS, it); }); break;   // many items in one trip (bulk add)
      case "deleteItem": { const n = rowOf_("Items", req.id); if (n) sheet_("Items").deleteRow(n); break; }
      case "saveSettings": Object.keys(req.settings).forEach(function (k) { upsertSetting_(k, req.settings[k]); }); break;
      default: throw new Error("Unknown action: " + req.action);
    }
    return json_({ ok: true, data: true });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally { if (lock) { try { lock.releaseLock(); } catch (_) {} } }
}

function table_(name) {
  const v = sheet_(name).getDataRange().getValues(), head = v.shift().map(String);
  return v.map(function (r) { const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}
function rowOf_(name, id) {
  const sh = sheet_(name), n = sh.getLastRow();
  if (n < 2) return 0;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (text_(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function upsert_(name, cols, obj) {
  if (!obj || !text_(obj.id) || !text_(obj.name)) throw new Error("An item needs a name.");
  const sh = sheet_(name), row = cols.map(function (c) { return String(obj[c] == null ? "" : obj[c]); }), n = rowOf_(name, obj.id);
  if (n) sh.getRange(n, 1, 1, cols.length).setValues([row]); else sh.appendRow(row);
}
function upsertSetting_(key, value) {
  const sh = sheet_("Settings"), v = sh.getDataRange().getValues(), val = String(value == null ? "" : value);
  for (let i = 1; i < v.length; i++) if (text_(v[i][0]) === key) { sh.getRange(i + 1, 2).setValue(val); return; }
  sh.appendRow([key, val]);
}
