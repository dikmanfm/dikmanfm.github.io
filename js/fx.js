/* ==========================================================================
   שכבת תנועה מתקדמת – Anime.js v4 + Motion (שתיהן מקומיות, בתיקיית vendor/)

   חלוקת העבודה:
   • Anime.js – כוריאוגרפיה: רצף "הדלקת האולפן" (createTimeline), ציור קווי
     הלוגו (svg.createDrawable), ציר התדרים שנבנה כשהוא נכנס למסך (onScroll + stagger).
   • Motion  – מעברים חיים בממשק: שורות ארכיון שנחשפות בגלילה (inView),
     גלולת הסינון שמחליקה בקפיץ, ואייקון הנגינה שמתחלף בקפיץ.

   אם אחת הספריות לא נטענה (דפדפן ישן) או שהמשתמש ביקש "הפחתת תנועה" –
   הקובץ לא עושה כלום, ו-motion.js ממשיך עם השכבה הבסיסית.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.anime, M = window.Motion;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!A || !M || !A.createTimeline || !M.animate || !Element.prototype.animate || REDUCE) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 1 };
  var SOFT = { type: "spring", stiffness: 210, damping: 26 };

  // ---------- 1. הדלקת האולפן – רצף אחד מתוזמן (Anime.js timeline) ----------
  function powerOn() {
    document.documentElement.classList.add("motion-ready");
    var deck = $(".deck"), lcd = $(".lcd");
    var intro = $$(".topbar > *"), content = $$(".seg, .panel:not([hidden]) > *");
    var screws = $$(".screw"), strips = $$(".strip");
    var all = intro.concat(content, screws, strips, deck ? [deck] : []);
    A.utils.set(all, { opacity: 0 });

    var done = false;
    function finish() {
      if (done) return; done = true;
      // ניקוי: מחזירים את השליטה ל-CSS (ההטיה בעכבר, ההילה שנושמת). --lvl נשאר.
      all.forEach(function (n) { n.style.removeProperty("opacity"); n.style.removeProperty("transform"); });
    }

    var drawables = A.svg.createDrawable($$(".brand-mark circle, .brand-mark path"));
    var tl = A.createTimeline({ defaults: { ease: "outExpo", duration: 900 }, onComplete: finish });

    tl.add(intro, { opacity: [0, 1], y: [-12, 0], delay: A.stagger(90) }, 0)
      .add(drawables, { draw: ["0 0", "0 1"], duration: 1100, ease: "inOutQuad", delay: A.stagger(70) }, 60)
      .add(deck, { opacity: [0, 1], y: [34, 0], scale: [.955, 1], rotateX: [9, 0], duration: 1300, ease: "outQuart" }, 80)
      .add(screws, { rotate: [-200, 0], scale: [.3, 1], opacity: [0, 1], duration: 800, delay: A.stagger(70) }, 300)
      .add(strips, { opacity: [0, 1], y: [16, 0], duration: 800, delay: A.stagger(60, { from: "first" }) }, 520)
      .add(content, { opacity: [0, 1], y: [16, 0], duration: 900, delay: A.stagger(70) }, 620);

    // רשת ביטחון: בלשונית ברקע הדפדפן עוצר את requestAnimationFrame –
    // אם הרצף לא הסתיים תוך 3 שניות, קופצים לסוף כדי שהתוכן לעולם לא יישאר שקוף.
    setTimeout(function () { if (!done) { tl.complete(); finish(); } }, 3000);

    // הצג "נדלק": הבהוב של שפופרת + קו סריקה. מחוגי ה-VU – בדיקת מערכת.
    // אלה רצים ב-WAAPI ישירות, כי לולאת המחוגים כותבת style.transform בכל פריים.
    if (lcd) {
      lcd.animate([
        { filter: "brightness(0)" }, { filter: "brightness(0)", offset: .3 },
        { filter: "brightness(1.9)", offset: .42 }, { filter: "brightness(.5)", offset: .5 },
        { filter: "brightness(1.35)", offset: .62 }, { filter: "brightness(1)" }
      ], { duration: 1100, delay: 380, easing: "linear", fill: "backwards" });
      var sweep = document.createElement("i"); sweep.className = "lcd-sweep"; lcd.appendChild(sweep);
      var a = sweep.animate([{ transform: "translateY(-30%)", opacity: 0 }, { opacity: 1, offset: .15 }, { transform: "translateY(520%)", opacity: 0 }],
        { duration: 900, delay: 720, easing: "cubic-bezier(.5,0,.5,1)" });
      a.onfinish = function () { sweep.remove(); };
    }
    $$(".vu .needle").forEach(function (n, i) {
      n.animate([
        { transform: "rotate(-50deg)" }, { transform: "rotate(50deg)", offset: .45 },
        { transform: "rotate(38deg)", offset: .58 }, { transform: "rotate(-50deg)" }
      ], { duration: 1500, delay: 620 + i * 90, easing: "cubic-bezier(.45,0,.2,1)" });
    });
  }

  // ---------- 2. ציר התדרים – נבנה כשהוא נכנס למסך (Anime.js onScroll) ----------
  function dial() {
    var box = $("#dial"), needle = $("#dialNeedle"); if (!box || !needle) return;
    var played = false;
    function play() {
      if (played || !box.offsetParent) return; played = true;
      var target = parseFloat(needle.style.getPropertyValue("--np")) || 0, pos = { p: 0 };
      var tl = A.createTimeline({ defaults: { ease: "outExpo" } });
      tl.add($$(".dial-ticks i", box), {
          scaleY: [0, 1], opacity: [0, 1], duration: 700,
          delay: A.stagger(6, { from: "first" })
        }, 0)
        .add($$(".dial-band", box), { scaleX: [0, 1], opacity: [0, 1], duration: 900, delay: A.stagger(120) }, 250)
        .add($$(".dial-labels span", box), { opacity: [0, 1], y: [6, 0], duration: 600, delay: A.stagger(60) }, 200)
        // המחוג "מכוון" את עצמו מחצות ועד עכשיו, עם עצירה קפיצית
        .add(pos, {
          p: target, duration: 1600, ease: "outElastic(1, .85)",
          onUpdate: function () { needle.style.setProperty("--np", pos.p.toFixed(3) + "%"); },
          onComplete: function () { needle.style.setProperty("--np", target.toFixed(3) + "%"); }
        }, 150);
      tl.then(function () { A.utils.cleanInlineStyles(tl); });
    }
    // נכנס למסך (בטלפון – אחרי גלילה מתחת לקונסולה)
    A.onScroll({ target: box, enter: "bottom-=40 top", onEnter: play });
    // ואם הלשונית "עכשיו" נפתחת מאוחר יותר
    var panel = box.closest(".panel");
    if (panel) new MutationObserver(function () { if (!panel.hidden) requestAnimationFrame(function () {
      var r = box.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) play();
    }); }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    // רצועה חדשה (שידור התחיל/נגמר) – נכנסת בעדינות
    new MutationObserver(function () {
      if (!played) return;
      M.animate($$(".dial-band", box), { opacity: [0, 1], scaleX: [.6, 1] }, SOFT);
    }).observe($("#dialBands"), { childList: true });
  }

  // ---------- 3. ארכיון: שורות נחשפות בגלילה (Motion inView) ----------
  function revealRows() {
    var batch = 0, raf = 0;
    function watch(li) {
      if (!li.classList.contains("track") || li._fx) return; li._fx = 1;
      li.style.opacity = "0";
      M.inView(li, function () {
        var i = batch++;
        if (!raf) raf = requestAnimationFrame(function () { batch = 0; raf = 0; });
        M.animate(li, { opacity: [0, 1], y: [14, 0] }, { duration: .55, delay: Math.min(i, 12) * .035, ease: [.16, 1, .3, 1] })
          .then(function () { li.style.transform = ""; });
      }, { margin: "0px 0px -4% 0px" });
    }
    ["trackList", "favList"].forEach(function (id) {
      var list = document.getElementById(id); if (!list) return;
      $$(".track", list).forEach(watch);
      new MutationObserver(function (recs) {
        recs.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes, function (n) { if (n.nodeType === 1) watch(n); }); });
      }).observe(list, { childList: true });
    });
  }

  // ---------- 4. סינון: גלולה מתכתית שמחליקה בקפיץ (Motion) ----------
  function chipIndicator() {
    var box = $("#chips"); if (!box) return;
    var ind = null, last = null;
    function place() {
      var on = $('.chip[aria-pressed="true"]', box); if (!on) return;
      if (!ind || !ind.isConnected) { ind = document.createElement("span"); ind.className = "chip-ind"; ind.setAttribute("aria-hidden", "true"); box.insertBefore(ind, box.firstChild); }
      box.classList.add("has-ind");
      var to = { x: on.offsetLeft, w: on.offsetWidth };
      if (last && (last.x !== to.x || last.w !== to.w) && box.offsetParent) {
        M.animate(ind, { x: [last.x, to.x], width: [last.w, to.w] }, SPRING);
      } else {
        M.animate(ind, { x: to.x, width: to.w }, { duration: 0 });
      }
      last = to;
    }
    new MutationObserver(function (recs) {
      // מתעלמים מהשינוי שאנחנו עצמנו גרמנו (הוספת הגלולה)
      if (recs.every(function (r) { return Array.prototype.every.call(r.addedNodes, function (n) { return n === ind; }); })) return;
      place();
    }).observe(box, { childList: true });
    var panel = box.closest(".panel");
    if (panel) new MutationObserver(function () { if (!panel.hidden) requestAnimationFrame(function () { last = null; place(); }); })
      .observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", function () { last = null; place(); });
    place();
  }

  // ---------- 5. כפתור הנגינה: האייקון מתחלף בקפיץ (Motion) ----------
  function playMorph() {
    var b = $("#btnPlay"); if (!b) return;
    var was = b.classList.contains("is-playing");
    new MutationObserver(function () {
      var now = b.classList.contains("is-playing"); if (now === was) return; was = now;
      var ic = $(now ? ".ic-pause" : ".ic-play", b);
      M.animate(ic, { scale: [.4, 1], rotate: [now ? -90 : 90, 0], opacity: [0, 1] }, { type: "spring", stiffness: 380, damping: 18 })
        .then(function () { ic.style.removeProperty("transform"); ic.style.removeProperty("opacity"); });
    }).observe(b, { attributes: true, attributeFilter: ["class"] });

    var cta = $("#btnRadio");
    if (cta) new MutationObserver(function () {
      M.animate($(".cta-ic", cta), { scale: [.7, 1] }, { type: "spring", stiffness: 420, damping: 14 });
    }).observe(cta, { attributes: true, attributeFilter: ["class"] });
  }

  window.FX = { active: true, powerOn: powerOn };
  function start() { dial(); revealRows(); chipIndicator(); playMorph(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
