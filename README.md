# Purchase Planner

Plan the construction materials you need to buy, record every purchase per supplier, and see where the money goes. Works as a website and as an Android app (APK).

## What it does
- **Board**: **To purchase** cards on the left, **Purchased** cards on the right. Every card is one thing the site needs, and it is split in two:
  - **Left: Need to purchase.** The item, how many you need (with unit: bags, pcs, sheets, m, cu.m …), the budget price, project or area, priority and needed-by date.
  - **Right: Purchase items.** One line for each purchase, so the same item can come from different suppliers. For example 10 pcs from Supplier 1 and 15 pcs from Supplier 2. Each line keeps the supplier, quantity, price each, date and receipt / DR number. A progress bar shows how much of the quantity is bought and how many are still to go.
  - Press **+ Add purchase** on a card to add a line. When the lines add up to the quantity needed, the card moves to **Purchased** by itself. If you stop short, press **✓ Mark purchased** to close it anyway. **↩ Move back** puts it back on the To purchase side (you can also drag cards across on a computer).
  - Search by item, project or supplier, filter by category, and sort at the top. On a phone the two sides are shown one at a time with a switch at the top.
- **Add many at once** (no more one by one):
  - **＋ Add many items**: an Excel-style table. Type and press **Enter** for the next row, or copy rows from Excel (columns Qty, Unit, Item, Budget each) and paste them into the first cell. Every row has its own category (pick a default category and press **Set all rows to the default category**, then change the rows that differ; a Category column pasted from Excel is matched by name). Project, priority and needed-by are set once for all rows. On a phone, open **Paste or type a list instead** and type one item per line, like `12 m Stranded Wire THHN 14mm @ 198.50`.
  - **🧾 Record purchases**: one supplier, one receipt, many items. Fill in the supplier, date, receipt no. and where the money came from once, then type the price each for every item you bought. The quantity fills in with what is left to buy. You can also copy a supplier's price column from Excel and paste it into the first price box; empty or ₱0.00 prices are skipped. The Grand Total shows at the bottom, like in your Excel.
  - **+ Add many** (on every card): the same item bought from several suppliers. One row per supplier (supplier, quantity, price each, receipt no.), with the date and how it was paid (COH, BANK or paid by other person) chosen once. Rows can be pasted from Excel.
- **Reports**: total spent, purchases recorded, saved or over budget, spending by category, supplier, month and project, what is still to purchase, biggest purchases, and the full purchase log. Pick the period (this month, last 30 days, 3 months, this year, all time). Copy or download the purchase log and the items list as CSV.
- **Paid from:** every purchase line says where the money came from: **COH** (cash on hand), **BANK**, **Paid by other person**, or a **Split payment**.
  - **Paid by other person**: type the person's name. The whole purchase is counted as paid by them, so it does **not** take anything out of your COH or BANK balance. Names you used before are suggested as you type.
  - **Split payment**: type how much came from **COH**, how much from **BANK** and how much was **paid by another person** (with their name). The amounts must add up to the purchase total and at least two of them must be more than 0. Type any two and the third fills in for you.
  - The card shows it on each line, and the card totals show how much came out of COH and BANK and how much others paid. In Reports there is a **Paid by other person** total, and the purchase log CSV has the amount and the person's name.
  - Purchases saved before this option existed (COH, BANK or COH / BANK splits) are not changed and still work the same.
- **Budget**: the **COH Balance** and **BANK Balance** are locked. Press **+ Add COH balance** or **+ Add BANK balance** to put money in (amount, date, optional note). Every addition is kept in the balance history, and a mistaken one can be removed there. The Board shows the **Remaining** COH and BANK: the balance minus every card in **Purchased**, using the COH / BANK choice on each of its purchase lines (the purchase form warns when one runs short). Money paid by another person is never taken out of COH, BANK or the monthly budget; it is only recorded for Reports. Cards still on the To purchase side do not take money out yet; moving a card back gives it back.
  - The **monthly budget** is worked out for you: total balance minus what you spent from COH and BANK in earlier months. It shows what is left this month and what you can spend per day. Optional limits for each category, with warning colours when you get close.
- **Settings**: currency symbol, your own categories, and your data options.

Every message and confirmation is styled inside the app. There are no plain browser popups.

## Where your data is saved
- **Default: this device only.** Nothing to set up. The app starts with sample construction items so you can try it. Go to **Settings > Clear all items** to start fresh.
- **Optional: a Google Sheet,** so your phone and computer (or two people) share the same list. Do this once:
  1. Go to https://sheets.new and create a blank sheet.
  2. **Extensions > Apps Script**. Delete the sample code, paste everything from `apps-script/Code.gs`, and change `change-me` on the `PASSWORD` line to your own password. Press **Save**.
  3. Pick **setup** in the function drop-down and press **Run**. Allow the permissions Google asks for (Advanced > Go to project > Allow).
  4. **Deploy > New deployment > Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Press **Deploy** and copy the Web app URL.
  5. Paste that URL between the quotes in `js/config.js` (`SCRIPT_URL`), save, and upload the change to GitHub.
  
  If you set up a sheet with the earlier version of this app, delete its **Items** tab first, then run **setup** again. The columns changed (each item now holds its list of purchases).

  After that the app asks for the password the first time you add or change something. Never put your real password in the `Code.gs` file that you upload to GitHub; only the copy inside Apps Script needs it. Anyone with the website link can read the list, but only people with the password can change it.

## Put it online (GitHub Pages)
1. Create a repository on GitHub and upload everything in this folder (use GitHub Desktop if the browser upload complains about the number of files).
2. **Settings > Pages**: Source **Deploy from a branch**, branch `main`, folder `/ (root)`. After a minute or two your site is live at `https://YOUR-NAME.github.io/REPO-NAME/`.
3. On a phone, open that address in Chrome and choose **Add to Home screen** to install it like an app.

## Android app
See **BUILD-APK.md**. GitHub builds the APK for you.

## Folders
```
index.html                    the page
css/style.css                 the look
js/config.js                  your Google Sheet link (optional)
js/api.js                     saving: this device, or the Google Sheet
js/ui.js                      shared helpers, themed messages
js/board.js                   Board tab
js/bulk.js                    Add many items / Record purchases (bulk entry)
js/insights.js                Reports, Budget and Settings tabs
js/main.js                    starts the app, tabs, sign-in
manifest.webmanifest, sw.js   lets phones install the site as an app
icons/                        app icons
apps-script/Code.gs           optional Google Sheet backend
app/                          Android app wrapper (Capacitor)
.github/workflows/            the recipe GitHub uses to build the APK
```
