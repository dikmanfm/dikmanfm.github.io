/* ==========================================================================
   DIKMAN FM · Orbit · לחצן השידור החי בדפים הפנימיים
   מנגן את השידור החי (RADIO_CONFIG.live.url), מכבד את נעילת השבת,
   ומתואם עם שאר הנגנים באתר בערוץ "dikman-fm": מי שמתחיל לנגן עוצר את האחרים.
   ========================================================================== */
(function () {
  "use strict";
  var CFG = window.RADIO_CONFIG || {};
  var key = document.getElementById("heroLive"), label = document.getElementById("heroLiveLabel"), sr = document.getElementById("heroLiveSr");
  if (!key) return;
  var url = CFG.live && typeof CFG.live.url === "string" && CFG.live.url.slice(0, 8).toLowerCase() === "https://" ? CFG.live.url : "";
  var audio = new Audio(); audio.preload = "none";
  var on = false, loading = false;

  var bc = null; try { bc = new BroadcastChannel("dikman-fm"); } catch (e) {}
  function announce() { try { if (bc) bc.postMessage({ type: "media-start", from: "live" }); } catch (e) {} }
  if (bc) bc.onmessage = function (e) { if (e.data && e.data.type === "media-start" && e.data.from !== "live" && on) stop(); };

  function ui() {
    key.classList.toggle("is-on", on && !loading);
    key.classList.toggle("is-loading", loading);
    key.setAttribute("aria-pressed", on ? "true" : "false");
    if (sr) sr.textContent = on ? "עצירת השידור החי" : "הפעלת השידור החי";
    if (label) label.textContent = on ? "משדרים חי · לחצו לעצירה" : "לחצו פליי לשידור החי";
  }
  function closed() {
    var st = null; try { st = window.Zmanim ? window.Zmanim.current(CFG.shabbat) : null; } catch (e) {}
    if (!st) return false;
    var n = document.getElementById("notice");
    if (n) { n.hidden = false; n.textContent = st.kind === "shabbat" ? "שבת שלום. השידור חוזר במוצאי שבת." : "חג שמח. השידור חוזר במוצאי החג."; }
    return true;
  }
  function play() {
    if (!url || closed()) return;
    on = true; loading = true; ui();
    announce();                                // עוצר רדיו/וידיאו/שיר שמנגנים במקום אחר
    audio.src = url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();   // תמיד מהרגע הנוכחי של השידור
    audio.play().catch(function () { stop(); });
  }
  function stop() {
    on = false; loading = false;
    try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch (e) {}
    ui();
  }
  audio.addEventListener("playing", function () { loading = false; ui(); });
  audio.addEventListener("waiting", function () { if (on) { loading = true; ui(); } });
  audio.addEventListener("error", function () { if (on) stop(); });
  key.addEventListener("click", function () { if (on) stop(); else play(); });
  // שבת נכנסה בזמן ההאזנה
  setInterval(function () { if (on && closed()) stop(); }, 30000);
  ui();
})();
