/* ==========================================================================
   DIKMAN FM · קונספט B — שכבת התנועה של ה-HERO
   • Anime.js v4 – כניסה: השנתות נדלקות בסיבוב (stagger), הלוגו עולה מתוך מסכה,
                   בלוק ה-FM נפתח; טבעות שמסתובבות בלולאה, ומהירותן עולה עם העוצמה (anim.speed).
   • Motion      – שכבות הטבעות זזות בעומק לפי העכבר (קפיץ), והטבעות מסתובבות עם הגלילה (scroll).
   • הלוגו הוא מד עוצמה: גובה המילוי האדום (--fill) עוקב אחרי השמע.
   בהפחתת תנועה: הכל סטטי, הלוגו מלא.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.anime, M = window.Motion;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NS = "http://www.w3.org/2000/svg";

  var hero = $("#hero"), stage = $(".orbit-stage"), logo = $(".logo-b");
  var audio = $("#audio"), deck = $(".deck"), onair = $("#onair");
  var roSig = $("#roSig"), roMode = $("#roMode"), roTime = $("#roTime");

  // ---------- שנתות החוגה: 72 שנתות, 12 ראשיות עם תדרים ----------
  var tickG = $("#orbitTicks");
  for (var i = 0; i < 72; i++) {
    var major = i % 6 === 0, a = i * 5;
    var g = document.createElementNS(NS, "g");
    g.setAttribute("transform", "rotate(" + a + " 300 300)");
    var ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", 300); ln.setAttribute("x2", 300);
    ln.setAttribute("y1", major ? 34 : 42); ln.setAttribute("y2", 52);
    if (major) ln.setAttribute("class", "major");
    g.appendChild(ln);
    if (major) {
      var k = i / 6, tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", 300); tx.setAttribute("y", 70);
      tx.textContent = k === 0 ? "107.6" : String(86 + k * 2);
      g.appendChild(tx);
    }
    g.setAttribute("class", "tick");
    tickG.appendChild(g);
  }
  var ticks = $$(".tick", tickG);

  // ---------- שעון וקריאות ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock() {
    var d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    roTime.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    var live = onair && onair.classList.contains("is-live");
    roMode.textContent = live ? "LIVE" : "REPLAY"; roMode.classList.toggle("live", !!live);
  }
  clock(); setInterval(clock, 1000);

  // ---------- לחצן השידור החי במרכז המכ"ם ----------
  var R = window.RadioApp, liveKey = $("#heroLive"), liveLabel = $("#heroLiveLabel"), liveSr = $("#heroLiveSr");
  var plRail = $("#plRail"), plBtns = $$(".pl", plRail), myQueue = null, loading = false;
  var CAT_LABEL = { archive: "ארכיון תוכניות", replay: "שידור חוזר" };

  function liveOn() { return R && !audio.paused && R.state.mode === "live"; }
  function syncLive() {
    var on = liveOn();
    liveKey.classList.toggle("is-on", on);
    liveKey.classList.toggle("is-loading", loading && R && R.state.mode === "live");
    liveKey.setAttribute("aria-pressed", on);
    liveSr.textContent = on ? "עצירת השידור החי" : "הפעלת השידור החי";
    liveLabel.textContent = on ? "משדרים חי · לחצו לעצירה" : "לחצו פליי לשידור החי";
  }
  // איזה פלייליסט מתנגן עכשיו – נגזר ממצב הנגן, כך שגם המיקסר והארכיון מעדכנים את הבחירה
  function activePl() {
    if (!R || audio.paused && !loading) return null;
    var s = R.state;
    if (s.mode === "replay") return s.channel || "replay";
    if (s.mode === "ep" && myQueue && s.queue === myQueue.list) return myQueue.id;
    return null;
  }
  function syncPl() {
    var a = activePl();
    plBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-pl") === a); });
  }
  function sync() { syncLive(); syncPl(); }

  if (R && liveKey) {
    audio.addEventListener("waiting", function () { loading = true; sync(); });
    audio.addEventListener("playing", function () { loading = false; sync(); });
    audio.addEventListener("pause", function () { loading = false; sync(); });
    // עצירת שידור חי מנתקת את המקור (load()), וזה מבטל את אירוע ה-pause שבתור – לכן גם emptied
    ["error", "emptied", "abort"].forEach(function (ev) { audio.addEventListener(ev, function () { loading = false; sync(); }); });
    document.addEventListener("radio:update", sync);

    liveKey.addEventListener("click", function () {
      if (liveOn()) { R.stop(); loading = false; sync(); return; }
      loading = true; R.playLive(); sync();
      if (M && !REDUCE) M.animate(liveKey, { scale: [.86, 1] }, { type: "spring", stiffness: 520, damping: 14 });
    });

    plRail.addEventListener("click", function (e) {
      var b = e.target.closest(".pl"); if (!b) return;
      var id = b.getAttribute("data-pl");
      // לחיצה על הפלייליסט שכבר מתנגן = עצירה
      if (activePl() === id && !audio.paused) { R.stop(); loading = false; sync(); return; }
      var name = CAT_LABEL[id] || id, list;
      loading = true;
      if (id === "replay") { R.showArchive("הכל"); R.playChannel(""); myQueue = null; }
      else {
        list = R.playList(id === "archive" ? "הכל" : id);
        if (!list) { loading = false; return; }
        myQueue = { id: id, list: R.state.queue };
      }
      R.toast("מנגנים: " + name + (list ? " · " + list.length + " הקלטות" : ""));
      sync();
      if (M && !REDUCE) M.animate(b, { scale: [.95, 1] }, { type: "spring", stiffness: 500, damping: 16 });
    });

    // מספר ההקלטות בכל פלייליסט – אחרי שהארכיון נטען
    (function counts(n) {
      var eps = R.state.episodes || [];
      if (!eps.length) { if (n < 40) setTimeout(function () { counts(n + 1); }, 400); return; }
      plBtns.forEach(function (b) {
        var id = b.getAttribute("data-pl"), m = b.querySelector("[data-meta]");
        if (id === "replay") return;
        var c = id === "archive" ? eps.length : eps.filter(function (x) { return x.category === id; }).length;
        m.textContent = c.toLocaleString("he-IL") + " הקלטות" + (id === "archive" ? " · מהחדשה" : "");
      });
    })(0);
    sync();
  }

  // ---------- עוצמה ----------
  var level = 0;
  function targetLevel() {
    if (!audio || audio.paused) return 0;
    var lvl = deck ? parseFloat(getComputedStyle(deck).getPropertyValue("--lvl")) || 0 : 0;
    return 0.35 + Math.min(lvl, 1) * 0.65;
  }

  if (REDUCE || !A || !M) { roSig.textContent = "---"; return; }

  // ---------- טבעות מסתובבות (Anime.js, לולאה) ----------
  var spins = [
    A.animate(".r-ticks", { rotate: 360, duration: 90000, ease: "linear", loop: true }),
    A.animate(".r-dash", { rotate: -360, duration: 50000, ease: "linear", loop: true }),
    A.animate(".sweep", { rotate: 360, duration: 6000, ease: "linear", loop: true }),
    A.animate(".sat", { rotate: 360, duration: 24000, ease: "linear", loop: true })
  ];

  // לולאת עוצמה: מילוי הלוגו, מהירות הטבעות, קריאת SIGNAL
  var t = 0;
  (function loop() {
    level += (targetLevel() - level) * 0.1;
    t += 0.016;
    var playing = level > 0.02;
    // עצור = לוגו מלא ודומיננטי. מתנגן = המילוי "קופץ" עם השמע כמו מד VU
    var fill = playing ? 38 + level * 52 + Math.sin(t * 9) * 6 * level + Math.sin(t * 23) * 4 * level : 100;
    logo.style.setProperty("--fill", Math.max(0, Math.min(100, fill)).toFixed(1) + "%");
    var sp = 1 + level * 5;
    spins.forEach(function (s) { s.speed = sp; });
    roSig.textContent = ("00" + Math.round(level * 100)).slice(-3) + "%";
    requestAnimationFrame(loop);
  })();

  // ---------- כניסה ----------
  var lines = $$(".lb-line"), fm = $(".lb-fm"), ro = $$(".ro"), sub = $(".brand-sub"), keyWrap = $(".live-key-wrap"), pls = $$(".pl");
  A.utils.set(lines, { y: "105%" });
  A.utils.set([fm, keyWrap].concat(ro, [sub], pls), { opacity: 0 });
  A.utils.set(ticks, { opacity: 0 });
  var tl = A.createTimeline({ defaults: { ease: "outExpo" } });
  tl.add(ticks, { opacity: [0, 1], scale: [.6, 1], duration: 500, delay: A.stagger(9), ease: "outQuad" }, 0)
    .add(lines, { y: ["105%", "0%"], duration: 1100, delay: A.stagger(60) }, 250)
    .add(fm, { opacity: [0, 1], scaleX: [0, 1], duration: 700 }, 750)
    .add(ro, { opacity: [0, 1], x: function (el) { return [el.classList.contains("ro-tl") || el.classList.contains("ro-bl") ? -20 : 20, 0]; }, duration: 700, delay: A.stagger(80) }, 850)
    .add(keyWrap, { opacity: [0, 1], scale: [.6, 1], duration: 900, ease: "outElastic(1, .7)" }, 950)
    .add(sub, { opacity: [0, 1], y: [10, 0], duration: 700 }, 1000)
    .add(pls, { opacity: [0, 1], y: [16, 0], duration: 700, delay: A.stagger(70) }, 1100);
  var done = false;
  function finish() {
    if (done) return; done = true;
    lines.concat([fm, sub, keyWrap], ro, ticks, pls).forEach(function (n) { n.style.removeProperty("opacity"); n.style.removeProperty("transform"); });
  }
  tl.then(finish);
  setTimeout(function () { if (!done) { tl.complete(); finish(); } }, 3500);

  // ---------- עומק לפי העכבר (Motion) ----------
  var SPRING = { type: "spring", stiffness: 140, damping: 20 };
  if (window.matchMedia && matchMedia("(pointer: fine)").matches) {
    var layers = [[".r-outer", 8], [".r-inner", 26], [".orbit", 12], [".core", -10]];
    hero.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
      layers.forEach(function (l) { var el = $(l[0]); if (el) M.animate(el, { x: nx * l[1], y: ny * l[1] }, SPRING); });
    });
    hero.addEventListener("pointerleave", function () { layers.forEach(function (l) { var el = $(l[0]); if (el) M.animate(el, { x: 0, y: 0 }, SPRING); }); });
  }

  // ---------- לחיצה על הלוגו: גל הלם מהמרכז + הבזק מילוי ----------
  logo.addEventListener("click", function () {
    for (var k = 0; k < 3; k++) {
      var s = document.createElement("i"); s.className = "shock"; stage.appendChild(s);
      (function (s, k) {
        A.animate(s, { scale: [0, 16], opacity: [.9, 0], borderWidth: ["3px", "0.5px"], duration: 1200, delay: k * 140, ease: "outExpo", onComplete: function () { s.remove(); } });
      })(s, k);
    }
    A.animate(".lb-fill", { opacity: [.2, 1], duration: 600, ease: "outQuad" });
    M.animate(fm, { scale: [1.18, 1] }, { type: "spring", stiffness: 500, damping: 14 });
  });

  // ---------- גלילה: הטבעות מסתובבות והלוגו מתרחק ----------
  if (M.scroll) {
    M.scroll(M.animate(".orbit", { rotate: [0, 50], scale: [1, 1.25], opacity: [1, .25] }, { ease: "linear" }), { target: hero, offset: ["start start", "end start"] });
    M.scroll(M.animate(".logo-b", { scale: [1, .82], opacity: [1, .4] }, { ease: "linear" }), { target: hero, offset: ["start start", "end start"] });
  }
})();
