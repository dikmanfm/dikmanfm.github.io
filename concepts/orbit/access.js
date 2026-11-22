/* ==========================================================================
   DIKMAN FM · Orbit · נגישות ותאימות לטלפונים כשרים, חצי-טאץ' ומסוננים
   נטען ראשון ב-<head> בכל דף. קטן, בלי תלויות, עובד גם בדפדפנים ישנים (ES5).

   1. "גרסה קלה" (html.lite): בלי אנימציות, בלי אפקטים כבדים, בלי ספריות התנועה.
      נדלקת לבד כשהמכשיר חלש/מסונן/בלי מסך מגע מלא, או ידנית מהקישור בתחתית הדף.
      ?lite=1 מדליק, ?lite=0 מכבה (הבחירה נשמרת במכשיר).
   2. ניווט במקשים (חצים / 2-8 / Enter) בכל הדפים, עם מסגרת פוקוס בולטת.
   ========================================================================== */
(function () {
  "use strict";
  var d = document.documentElement, KEY = "dkm-lite", saved = null;
  d.className += " js";

  function mm(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }

  // ---------- 1. גרסה קלה ----------
  var m = /[?&]lite=(1|0)\b/.exec(location.search);
  try { if (m) localStorage.setItem(KEY, m[1]); saved = localStorage.getItem(KEY); } catch (e) { saved = m ? m[1] : null; }

  var ua = navigator.userAgent || "", c = navigator.connection || {}, scr = window.screen || {};
  var auto =
    // דפדפנים של טלפונים כשרים / מקשים / דפדפני חיסכון
    /KAIOS|Opera Mini|UCBrowser|UCWEB|Puffin|MAUI|Series ?(40|60)|Symbian|MIDP|J2ME|BlackBerry|BB10|IEMobile|Windows Phone|Nokia/i.test(ua) ||
    // המשתמש ביקש לחסוך בנתונים / רשת איטית מאוד
    c.saveData === true || /(^|-)2g$/.test(c.effectiveType || "") ||
    // מכשיר חלש מאוד
    (navigator.deviceMemory && navigator.deviceMemory <= 1) ||
    // בלי מגע ובלי עכבר: מכשיר מקשים
    mm("(pointer: none)") ||
    // מסך קטן מאוד (טלפון כשר עם מסך זעיר)
    (scr.width && Math.min(scr.width, scr.height || scr.width) < 300) ||
    // דפדפן שלא תומך ביכולות הבסיסיות של השכבה המתקדמת
    !window.Promise || !window.IntersectionObserver || !Element.prototype.animate || !(window.CSS && CSS.supports);

  var lite = saved === "1" || (saved !== "0" && !!auto);
  window.DKM_LITE = lite;
  if (lite) {
    d.className += " lite";
    // כל רכיבי התנועה באתר כבר מכבדים "הפחתת תנועה": בגרסה הקלה הם מקבלים את אותה תשובה
    var mq = window.matchMedia;
    if (mq) window.matchMedia = function (q) {
      if (/prefers-reduced-motion:\s*reduce/.test(q)) return { matches: true, media: q, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} };
      return mq.call(window, q);
    };
  }

  // ---------- 2. ניווט במקשים ----------
  var NAV_KEYS = { ArrowUp: -1, ArrowDown: 1, Up: -1, Down: 1, "2": -1, "8": 1 };
  function visible(n) {
    if (n.disabled || n.hidden || n.getAttribute("aria-hidden") === "true" || n.tabIndex < 0) return false;
    if (!n.offsetWidth && !n.offsetHeight && !(n.getClientRects && n.getClientRects().length)) return false;
    for (var p = n; p && p !== document.body; p = p.parentNode) if (p.hidden) return false;
    return true;
  }
  function focusables() {
    var dlg = document.querySelector("dialog[open]");
    var root = dlg || document;
    var list = root.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [tabindex]");
    var out = [];
    for (var i = 0; i < list.length; i++) if (visible(list[i])) out.push(list[i]);
    return out;
  }
  function move(dir) {
    var items = focusables(); if (!items.length) return;
    var i = -1; for (var k = 0; k < items.length; k++) if (items[k] === document.activeElement) { i = k; break; }
    var n = items[i < 0 ? (dir > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, i + dir))];
    try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
    if (n.scrollIntoView) { try { n.scrollIntoView({ block: "center" }); } catch (e) { n.scrollIntoView(false); } }
  }

  document.addEventListener("keydown", function (e) {
    var t = e.target || {}, tag = t.tagName;
    if (e.key === "Tab" || NAV_KEYS[e.key]) { if (d.className.indexOf("kbd-nav") < 0) d.className += " kbd-nav"; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
    if (t.getAttribute && t.getAttribute("role") === "slider") return;
    // 2/8 הם גם קיצורי נגן בדף הראשי (הקודם/הבא) – שם הם נשארים לנגן
    if ((e.key === "2" || e.key === "8") && document.getElementById("btnPlay")) return;
    var dir = NAV_KEYS[e.key];
    if (!dir) return;
    move(dir); e.preventDefault();
  });
  // חזרה למגע/עכבר: מסגרת הפוקוס הבולטת נעלמת
  document.addEventListener("pointerdown", function () { d.className = d.className.replace(/\s*kbd-nav\b/g, ""); }, true);

  // ---------- 3. קישור "גרסה קלה / גרסה מלאה" ----------
  function wire() {
    var links = document.querySelectorAll("[data-lite-toggle]");
    for (var i = 0; i < links.length; i++) {
      links[i].hidden = false;
      links[i].href = location.pathname + "?lite=" + (lite ? "0" : "1") + location.hash;
      links[i].textContent = lite ? "מעבר לגרסה המלאה" : "גרסה קלה למכשירים כשרים";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
