// Starts the app: loading, tabs, sign-in (shared sheet only), and phone extras.
(() => {
  const { $ } = PP;
  PP.render = () => { PP.renderBoard(); PP.renderTab(); };
  let rev = 0, saving = 0, loading = false, dirty = false;   // rev changes on every save, so a slow older fetch can't overwrite newer edits
  PP.reload = async () => {
    if (loading) return false; loading = true; const my = rev;
    try { const d = await Api.load(); if (my !== rev || saving) return false; PP.state = d; dirty = false; PP.render(); stamp(); return true; }
    catch (e) { console.error(e); return false; }
    finally { loading = false; }
  };
  PP.save = async (fn, okMsg) => {
    rev++; saving++; let failed = null;
    try { await fn(); if (okMsg) PP.toast(okMsg); dirty = false; }
    catch (err) { failed = err; PP.toast(err.code === "auth" ? "Wrong password. Please sign in again." : (err.message || "Couldn’t save. Check the connection.")); }
    finally { saving--; rev++; }
    if (failed) { await PP.reload(); PP.updateSign(); }
  };

  /* refresh: a button on Board, Reports and Budget, plus a quiet refetch every 5 seconds */
  const stamp = () => document.querySelectorAll("[data-updated]").forEach(el => { el.textContent = "Updated " + new Date().toLocaleTimeString(); });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-refresh]"); if (!b) return;
    document.querySelectorAll("[data-refresh]").forEach(x => { x.disabled = true; x.classList.add("spinning"); });
    let ok = false;
    try { for (let k = 0; k < 20 && loading; k++) await new Promise(r => setTimeout(r, 150)); ok = await PP.reload(); } finally { document.querySelectorAll("[data-refresh]").forEach(x => { x.disabled = false; x.classList.remove("spinning"); }); }
    PP.toast(ok ? "Data refreshed" : "Couldn’t refresh. Check the connection.");
  });
  // typing in the Budget / Settings forms: don't wipe it with an automatic refresh
  ["#budgetRoot", "#settingsRoot"].forEach(s => $(s).addEventListener("input", () => { dirty = true; }));
  setInterval(() => {
    if (document.hidden || !PP.state || Api.mode !== "sheet" || loading || saving) return;
    if (document.querySelector("dialog[open]")) return;
    if (dirty && (PP.tab === "budget" || PP.tab === "settings")) return;
    PP.reload();
  }, 5000);

  /* tabs */
  PP.setTab = (name) => {
    PP.tab = name;
    document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
    document.querySelectorAll(".tab").forEach(s => { s.hidden = s.id !== "tab-" + name; });
    $("main").classList.toggle("wide", name === "board");   // the board uses the full width; the other tabs stay narrow
    dirty = false; PP.renderTab(); window.scrollTo({ top: 0 });
  };
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) PP.setTab(b.dataset.tab); });

  /* sign in (only used when the list lives in a Google Sheet) */
  const ld = $("#loginDialog"), lf = $("#loginForm"); let resolveLogin = null;
  PP.clearOnInput(lf);
  PP.gate = async () => !Api.needsPass || Api.hasPass() || new Promise((res) => { resolveLogin = res; lf.reset(); PP.clearAll(lf); $("#loginError").textContent = ""; ld.showModal(); });
  ld.addEventListener("close", () => { if (resolveLogin) { const r = resolveLogin; resolveLogin = null; r(ld.returnValue === "ok"); } });
  lf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = PP.field(lf, "password");
    if (!inp.value) { PP.showError(inp.closest("label"), "Type the password first."); inp.focus(); return; }
    const btn = $("#loginGo"); btn.disabled = true; btn.textContent = "Checking…";
    try { await Api.signIn(inp.value); ld.close("ok"); PP.updateSign(); }
    catch (err) { $("#loginError").textContent = err.message || "That didn’t work."; }
    finally { btn.disabled = false; btn.textContent = "Sign in"; }
  });
  PP.updateSign = () => {
    const b = $("#signBtn"); b.hidden = !Api.needsPass;
    b.textContent = Api.hasPass() ? "Sign out" : "Sign in";
  };
  $("#signBtn").addEventListener("click", async () => {
    if (Api.hasPass()) { Api.signOut(); PP.updateSign(); PP.toast("Signed out"); } else await PP.gate();
  });

  async function start() {
    $("#listTodo").innerHTML = $("#listBought").innerHTML = `<p class="empty">Opening your list…</p>`;
    try { PP.state = await Api.load(); PP.render(); PP.updateSign(); }
    catch (err) {
      $("#listTodo").innerHTML = `<div class="loadbanner"><p>${PP.esc(err.message || "Couldn’t open the list.")}</p><button class="btn small" id="retry" type="button">Try again</button></div>`;
      $("#listBought").innerHTML = ""; $("#retry").onclick = start;
    }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && PP.state && Api.mode === "sheet" && !document.querySelector("dialog[open]")) PP.reload(); });

  // Android app: the back button closes an open window first, then leaves the app.
  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp) CapApp.addListener("backButton", () => { const open = [...document.querySelectorAll("dialog[open]")].pop(); if (open) { const ev = new Event("cancel", { cancelable: true }); open.dispatchEvent(ev); if (!ev.defaultPrevented) open.close(); } else if (PP.tab !== "board") PP.setTab("board"); else CapApp.exitApp(); });
  // On the web, let the browser offer "Add to Home screen".
  if ("serviceWorker" in navigator && !window.Capacitor && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  start();
})();
