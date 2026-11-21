/* ==========================================================================
   DIKMAN FM · קונספט C — שכבת התנועה של ה-HERO
   • Anime.js v4 – כניסה: האותיות "קופצות" מהבסיס כמו פסי אקולייזר (stagger + קפיץ),
                   המדבקה מסתובבת בלולאה והטיקרים זזים; המהירות של כולם עולה עם העוצמה (anim.speed).
   • Motion      – מעבר עכבר על אות "מכה" בה בקפיץ, לחיצה על המדבקה מסובבת אותה,
                   ובגלילה הרצועה האדומה נוטה והטיקרים זזים זה נגד זה (scroll).
   • כל אות היא פס אקולייזר: scaleY לפי העוצמה, בתדר אחר לכל אות.
   בהפחתת תנועה: הכל סטטי.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.anime, M = window.Motion;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var hero = $("#hero"), letters = $$(".lc-word i"), badge = $("#fmBadge");
  var audio = $("#audio"), deck = $(".deck");

  // שכפול תוכן הטיקרים כדי שהלולאה תהיה רציפה
  var tracks = $$(".tk-track");
  tracks.forEach(function (t) { var html = t.innerHTML; t.innerHTML = html + html + html + html; });

  if (REDUCE || !A || !M) return;

  // ---------- עוצמה ----------
  var level = 0;
  function targetLevel() {
    if (!audio || audio.paused) return 0;
    var lvl = deck ? parseFloat(getComputedStyle(deck).getPropertyValue("--lvl")) || 0 : 0;
    return 0.35 + Math.min(lvl, 1) * 0.65;
  }

  // ---------- לולאות: מדבקה וטיקרים ----------
  var spin = A.animate(".fm-ring", { rotate: 360, duration: 16000, ease: "linear", loop: true });
  var tick = tracks.map(function (t, i) {
    var w = t.scrollWidth / 4;   // רוחב עותק אחד
    return A.animate(t, { x: i === 0 ? [0, -w] : [-w, 0], duration: w * 22, ease: "linear", loop: true });
  });

  // ---------- כניסה: פסי האקולייזר עולים ----------
  var ready = false;
  A.utils.set(letters, { scaleY: 0 });
  A.utils.set(badge, { scale: 0, rotate: -120 });
  var tl = A.createTimeline();
  tl.add(".band", { clipPath: ["inset(0 0 0 100% round 28px)", "inset(0 0 0 0% round 28px)"], duration: 700, ease: "inOutExpo" }, 0)
    .add(letters, { scaleY: [0, 1.25, 1], duration: 900, ease: "outElastic(1, .55)", delay: A.stagger(70) }, 420)
    .add(badge, { scale: [0, 1], rotate: [-120, 0], duration: 1000, ease: "outElastic(1, .6)" }, 760)
    .add(".tickers", { opacity: [0, 1], y: [24, 0], duration: 700, ease: "outExpo" }, 600);
  function finish() {
    if (ready) return; ready = true;
    $(".band").style.removeProperty("clip-path");
    [badge, $(".tickers")].forEach(function (n) { n.style.removeProperty("transform"); n.style.removeProperty("opacity"); });
  }
  tl.then(finish);
  setTimeout(function () { if (!ready) { tl.complete(); finish(); } }, 3500);

  // ---------- לולאת האקולייזר ----------
  var freqs = letters.map(function (_, i) { return [2.1 + i * .73, 5.3 + (i % 3) * 1.9, 11 + i * 1.3]; });
  var punch = letters.map(function () { return 0; });   // דחיפה רגעית מעכבר/לחיצה
  var t = 0;
  (function loop() {
    level += (targetLevel() - level) * 0.12;
    t += 0.016;
    if (ready) {
      letters.forEach(function (l, i) {
        var f = freqs[i];
        var wave = .5 + .5 * Math.sin(t * f[0]) * Math.sin(t * f[1] + i) + .2 * Math.sin(t * f[2]);
        var idle = .025 * Math.sin(t * 1.4 + i * .8);                  // נשימה עדינה כשעצור
        punch[i] *= .9;
        var s = 1 + idle + level * (wave * .42 - .12) + punch[i];
        l.style.transform = "scaleY(" + Math.max(.55, s).toFixed(3) + ")";
      });
    }
    var sp = 1 + level * 4;
    spin.speed = sp; tick.forEach(function (a) { a.speed = sp; });
    requestAnimationFrame(loop);
  })();

  // ---------- מכה באות (עכבר) / נגיעה ----------
  letters.forEach(function (l, i) {
    function hit() { punch[i] = .35; if (punch[i - 1] !== undefined) punch[i - 1] = Math.max(punch[i - 1], .15); if (punch[i + 1] !== undefined) punch[i + 1] = Math.max(punch[i + 1], .15); }
    l.addEventListener("pointerenter", hit);
    l.addEventListener("pointerdown", hit);
  });

  // ---------- לחיצה על המדבקה: סיבוב מהיר + גל בכל האותיות ----------
  badge.addEventListener("click", function () {
    M.animate(badge, { rotate: [0, 360], scale: [.9, 1] }, { type: "spring", stiffness: 120, damping: 14 });
    letters.forEach(function (_, i) { setTimeout(function () { punch[i] = .45; }, i * 55); });
  });

  // ---------- גלילה ----------
  if (M.scroll) {
    var opt = { target: hero, offset: ["start start", "end start"] };
    M.scroll(M.animate(".band", { rotate: [0, -2.5], scale: [1, .94], opacity: [1, .5] }, { ease: "linear" }), opt);
    M.scroll(M.animate(".ticker.t1", { x: [0, -80] }, { ease: "linear" }), opt);
    M.scroll(M.animate(".ticker.t2", { x: [0, 80] }, { ease: "linear" }), opt);
  }
})();
