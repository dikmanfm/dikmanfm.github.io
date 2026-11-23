/* ==========================================================================
   DIKMAN FM · מחיל את התוכן מעמוד הניהול (js/content.js) על האתר
   נטען מיד אחרי config.js ו-content.js. אם content.js חסר או פגום – האתר נשאר
   בדיוק עם הערכים שב-config.js וב-HTML, כך ששום דבר לא נשבר.
   ========================================================================== */
(function () {
  "use strict";
  var C = window.DKM_CONTENT, CFG = window.RADIO_CONFIG;
  if (!C || typeof C !== "object" || !CFG) return;

  function arr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function https(u) { return typeof u === "string" && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; }

  // רשימות השירים והוידיאו
  try {
    var S = C.showcase || {};
    CFG.showcase = CFG.showcase || {};
    ["video", "arrangements", "original"].forEach(function (k) { if (arr(S[k])) CFG.showcase[k] = S[k]; });
    if (arr(C.genres) && C.genres.length) {
      var ok = C.genres.filter(function (g) { return g && typeof g.id === "string" && typeof g.name === "string" && arr(g.items); });
      if (ok.length) CFG.genres = ok;
    }
  } catch (e) {}

  // טקסטים וקישורים בדף (הסקריפט נטען בסוף ה-body, הדף כבר קיים)
  try {
    var T = C.texts || {};
    Array.prototype.forEach.call(document.querySelectorAll("[data-text]"), function (n) {
      var v = T[n.getAttribute("data-text")];
      if (typeof v === "string" && v.trim()) n.textContent = v.trim();
    });
    var hosts = { instagram: /(^|\.)instagram\.com$/, tiktok: /(^|\.)tiktok\.com$/, facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/, youtube: /(^|\.)(youtube\.com|youtu\.be)$/ };
    var labels = { instagram: "אינסטגרם", tiktok: "טיקטוק", facebook: "פייסבוק", youtube: "יוטיוב" };
    var SO = C.social || {};
    Object.keys(labels).forEach(function (k) {
      var u = https(SO[k]); if (!u) return;
      var host = ""; try { host = new URL(u).hostname.toLowerCase(); } catch (e) { return; }
      if (!hosts[k].test(host)) return;
      Array.prototype.forEach.call(document.querySelectorAll('a.soc[data-label="' + labels[k] + '"]'), function (a) { a.href = u; });
    });
  } catch (e) {}
})();
