/* ==========================================================================
   תנועה – Anime.js v4 + Motion (מקומיות, vendor/)
   • Anime.js – כוריאוגרפיה: הפתיחה (createTimeline + stagger), והחלפת הכותרת
     הענקית אות אחר אות כשהתוכנית מתחלפת.
   • Motion – מעברים בממשק: כניסת לשונית, שורות ארכיון, הסרה מהשמורים.
   בדפדפן ישן או ב"הפחתת תנועה" הקובץ לא עושה כלום, והכול מוצג מיד.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.anime, M = window.Motion;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!A || !A.createTimeline || !A.animate || !M || !M.animate || REDUCE) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // מילים שלמות לא נשברות; כל אות בתוך span משלה
  function splitHTML(text) {
    return String(text).split(" ").map(function (w) {
      return '<span class="w" style="display:inline-block;white-space:nowrap">' +
        w.split("").map(function (c) { return '<span class="ch">' + esc(c) + "</span>"; }).join("") + "</span>";
    }).join(" ");
  }

  var swapping = null;
  function swapHeadline(h, text) {
    var old = $$(".ch", h);
    function enter() {
      h.innerHTML = splitHTML(text);
      A.animate($$(".ch", h), {
        y: ["0.55em", "0em"], opacity: [0, 1], duration: 620, ease: "outExpo",
        delay: A.stagger(24, { from: "first" })
      });
    }
    if (swapping) swapping.pause();
    if (!old.length) { enter(); return; }
    swapping = A.animate(old, {
      y: ["0em", "-0.35em"], opacity: [1, 0], duration: 200, ease: "inQuad",
      delay: A.stagger(10), onComplete: function () { swapping = null; enter(); }
    });
  }

  // ---------- פתיחה ----------
  function intro() {
    var h = $("#headline");
    if (h && !$(".ch", h)) h.innerHTML = splitHTML(h.textContent);
    var topEls = $$(".top > *"), chars = $$("#headline .ch");
    var lines = $$(".kicker, .subline, .hebdate");
    var after = $$(".panel:not([hidden]) .seekwave:not([hidden]), .panel:not([hidden]) .day, .panel:not([hidden]) .transport, .panel:not([hidden]) .src, .panel:not([hidden]) .volume");
    var scope = $("#scope");
    var all = topEls.concat(chars, lines, after, scope ? [scope] : []);
    A.utils.set(all, { opacity: 0 });
    var done = false;
    function finish() { if (done) return; done = true; all.forEach(function (n) { n.style.removeProperty("opacity"); n.style.removeProperty("transform"); }); }
    var tl = A.createTimeline({ defaults: { ease: "outExpo", duration: 800 }, onComplete: finish });
    tl.add(topEls, { opacity: [0, 1], y: [-10, 0], delay: A.stagger(70) }, 0)
      .add(scope, { opacity: [0, 1], duration: 1400, ease: "outQuad" }, 100)
      .add(chars, { opacity: [0, 1], y: ["0.6em", "0em"], duration: 900, delay: A.stagger(28) }, 180)
      .add(lines, { opacity: [0, 1], y: [10, 0], delay: A.stagger(80) }, 420)
      .add(after, { opacity: [0, 1], y: [14, 0], delay: A.stagger(50) }, 560);
    // בלשונית ברקע הדפדפן עוצר אנימציות – אחרי 3 שניות קופצים לסוף, כדי ששום דבר לא יישאר שקוף
    setTimeout(function () { if (!done) { tl.complete(); finish(); } }, 3000);
  }

  // ---------- מעבר בין לשוניות ----------
  document.addEventListener("radio:tab", function (e) {
    var panel = $("#panel-" + e.detail); if (!panel) return;
    var kids = Array.prototype.slice.call(panel.children, 0, 6);
    M.animate(kids, { opacity: [0, 1], y: [12, 0] }, { duration: .45, delay: M.stagger ? M.stagger(.04) : 0, ease: [.2, .8, .2, 1] });
  });

  // ---------- שורות הארכיון נכנסות במדורג ----------
  document.addEventListener("radio:list", function (e) {
    var list = e.detail; if (!list || list.closest("[hidden]")) return;
    var rows = Array.prototype.slice.call(list.children, 0, 14);
    M.animate(rows, { opacity: [0, 1], y: [8, 0] }, { duration: .35, delay: M.stagger ? M.stagger(.025) : 0 });
  });

  // ---------- הסרה מהשמורים: השורה מתקפלת, ואז הרשימה מתעדכנת ----------
  function leave(row, cb) {
    var h = row.offsetHeight;
    row.style.overflow = "hidden";
    M.animate(row, { opacity: [1, 0], height: [h + "px", "0px"] }, { duration: .32, ease: [.4, 0, .2, 1] }).then(cb, cb);
  }

  window.FX = { swapHeadline: swapHeadline, leave: leave };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", intro); else intro();
})();
