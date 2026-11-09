// Builds the "PURCHASE REQUEST" Excel form, laid out like the company's PURCHASE_REQUEST.xlsx template:
// logo + address on top, PROJECT / PROJ. LOCATION / SUPPLIER / MODE OF PAYMENT / DATE, the item table (the PROVIDED and LACKING
// columns stay in the sheet but hidden, as in the template), a yellow TOTAL, then Request by / Prepared by / Approved by.
// Pure function: PR_BUILD(ExcelJS, data) -> Promise<ArrayBuffer>.  data = { address, project, location, supplier, mode, details,
//   date: "YYYY-MM-DD", requestBy, preparedBy, approvedName, approvedTitle, lines: [{ qty, unit, name, price }] }
window.PR_BUILD = async function (ExcelJS, d) {
  const wb = new ExcelJS.Workbook(); wb.creator = "Purchase Planner"; wb.created = new Date();
  const ws = wb.addWorksheet("PURCHASE REQUEST", { views: [{ showGridLines: false, zoomScale: 80 }] });
  ws.properties.defaultRowHeight = 15.75;
  // column widths follow the template, but UNIT and AMOUNT grow when needed (a number that doesn't fit shows as ####### in Excel)
  const L = d.lines || [], money = (n) => "₱" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const widest = L.reduce((w, l) => Math.max(w, money((Number(l.qty) || 0) * (Number(l.price) || 0)).length), 0);
  const unitLen = L.reduce((w, l) => Math.max(w, String(l.unit || "").trim().length), 0);
  const wUnit = Math.max(9.14, unitLen * 1.3 + 3), wAmt = Math.max(12.86, widest * 1.3 + 3);
  [[8.72, 0], [12.21, 0], [11.18, 1], [8.36, 1], [wUnit, 0], [52.09, 0], [20.86, 0], [wAmt, 0], [35.8, 1]].forEach(([w, hidden], i) => { const c = ws.getColumn(i + 1); c.width = w; c.hidden = !!hidden; });

  const FONT = (o = {}) => ({ name: "Calibri", size: 12, ...o });
  const THIN = { style: "thin" }, BOX = { left: THIN, right: THIN, top: THIN, bottom: THIN };
  const ACCT = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-', PESO = '[$₱-3409]#,##0.00_);[Red]\\([$₱-3409]#,##0.00\\)';
  const put = (addr, value, o = {}) => { const c = ws.getCell(addr); c.value = value; c.font = FONT(o.font); c.alignment = { vertical: "middle", ...(o.align || {}) }; if (o.fmt) c.numFmt = o.fmt; if (o.border) c.border = o.border; if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } }; return c; };
  const dash = (s) => (String(s || "").trim() || "-");
  const RIGHT = { horizontal: "right" }, CENTER = { horizontal: "center" };

  // logo (same size and place as in the template)
  if (window.PR_LOGO) { const id = wb.addImage({ base64: window.PR_LOGO, extension: "png" }); ws.addImage(id, { tl: { col: 0.077, row: 0.07 }, ext: { width: 230, height: 52 } }); }
  put("B4", d.address || "");
  put("F7", "PURCHASE REQUEST", { font: { bold: true } });

  put("B10", "PROJECT:", { font: { bold: true }, align: RIGHT });        put("E10", dash(d.project), { font: { bold: true } });
  put("G10", "DATE:", { font: { bold: true }, align: RIGHT });           const [y, m, dd] = String(d.date || "").split("-").map(Number);
  put("H10", y ? Date.UTC(y, m - 1, dd) / 86400000 + 25569 : "", {   // an Excel date is the number of days since 1900
     font: { bold: true }, align: CENTER, fmt: "dd\\-mmm\\-yy" });
  put("B11", "PROJ. LOCATION:", { font: { bold: true }, align: RIGHT }); put("E11", dash(d.location), { font: { bold: true } });
  put("B12", "SUPPLIER:", { font: { bold: true }, align: RIGHT });       put("E12", dash(d.supplier), { font: { bold: true } });
  put("B13", "MODE OF PAYMENT:", { font: { bold: true }, align: RIGHT }); put("E13", dash(d.mode), { font: { bold: true } });
  if (String(d.details || "").trim()) put("E14", String(d.details).trim(), { font: { bold: true } });   // e.g. bank or GCash number
  put("G15", "CANVASS", { font: { bold: true, color: { argb: "FFFFFFFF" } }, align: CENTER });           // white in the template, so it doesn't print

  const head = 16, first = 17, lines = d.lines || [], rows = Math.max(5, lines.length), last = first + rows - 1, total = last + 1;
  [["B", "REQ. QTY"], ["C", "PROVIDED"], ["D", "LACKING"], ["E", "UNIT"], ["F", "PARTICULARS"], ["G", "UNIT PRICE"], ["H", "AMOUNT"]]
    .forEach(([c, t]) => put(c + head, t, { font: { bold: true }, align: CENTER, border: BOX }));
  for (let r = first; r <= last; r++) {
    const l = lines[r - first], on = !!l;
    ["B", "C", "D", "E", "F", "G", "H"].forEach(c => put(c + r, null, { font: { bold: true }, align: { ...CENTER, wrapText: c === "F" }, border: BOX }));
    if (!on) continue;
    const qty = Number(l.qty) || 0, price = Number(l.price) || 0;
    ws.getCell("B" + r).value = qty;
    ws.getCell("E" + r).value = String(l.unit || "").trim().toUpperCase();
    ws.getCell("F" + r).value = String(l.name || "").trim();
    const g = ws.getCell("G" + r); g.value = price > 0 ? price : null; g.numFmt = ACCT; g.font = FONT({ bold: true, size: 11 });
    const h = ws.getCell("H" + r); h.value = { formula: `B${r}*G${r}`, result: qty * price }; h.numFmt = PESO;
    const n = Math.max(1, Math.ceil(String(l.name || "").length / 46));   // tall rows for long names (the column is 52 wide)
    if (n > 1) ws.getRow(r).height = 15.75 * n;
  }
  // total row: yellow, G:H merged, like the template
  ["B", "C", "D", "E"].forEach(c => put(c + total, null, { border: BOX }));
  put("F" + total, "TOTAL:", { font: { bold: true }, align: RIGHT, border: BOX });
  ws.mergeCells(`G${total}:H${total}`);
  const grand = lines.reduce((t, l) => t + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  put("G" + total, { formula: `SUM(H${first}:H${last})`, result: grand }, { font: { bold: true }, align: RIGHT, border: BOX, fmt: PESO, fill: "FFFFFF00" });
  ws.getCell("H" + total).border = BOX;

  put("E" + (total + 2), "Request by:", { align: RIGHT });  put("F" + (total + 2), d.requestBy || "");
  put("E" + (total + 3), "Prepared by:", { align: RIGHT });  put("F" + (total + 3), d.preparedBy || "");
  put("G" + (total + 5), "Approved by:");
  ["G", "H"].forEach(c => put(c + (total + 6), null, { border: { bottom: THIN } }));
  put("G" + (total + 7), d.approvedName || ""); put("G" + (total + 8), d.approvedTitle || "");

  const end = total + 8;
  ws.pageSetup = { paperSize: 1, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.75, right: 0.75, top: 1, bottom: 1, header: 0.5, footer: 0.5 }, printArea: `A1:H${end}` };
  return wb.xlsx.writeBuffer();
};
