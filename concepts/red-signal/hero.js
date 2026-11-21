/* ==========================================================================
   DIKMAN FM · קונספט A — שכבת התנועה של ה-HERO
   • Anime.js v4 – "פענוח אות": האותיות מתערבלות ונועלות אחת-אחת (createTimeline + stagger),
                   ו-glitch של פיצול צבע שקופץ מדי כמה שניות או בלחיצה על הלוגו.
   • Motion      – אותיות "מגנטיות" שנמשכות אל האצבע/העכבר בקפיץ, והלוגו שמתכווץ בגלילה (scroll).
   • Canvas      – אוסצילוסקופ שחי לפי מצב הנגן ולפי עוצמת הקונסולה (--lvl).
   בהפחתת תנועה: אין תנועה, הקו מצויר פעם אחת וזהו.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.anime, M = window.Motion;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var hero = $("#hero"), logo = $(".logo"), letters = $$(".logo-main i");
  var ghosts = $$(".logo-ghost"), audio = $("#audio"), deck = $(".deck");
  var bars = $$(".sig-bars i"), canvas = $("#scope");
  var GLYPHS = "ABCDEFGHJKLMNPRSTVXZ0123456789#%&/<>";

  // ---------- עוצמת "האות" – משותפת לסקופ, לפסי האות ולזוהר הלוגו ----------
  var level = 0;
  function targetLevel() {
    if (!audio || audio.paused) return 0.04;
    var lvl = deck ? parseFloat(getComputedStyle(deck).getPropertyValue("--lvl")) || 0 : 0;
    return 0.35 + Math.min(lvl, 1) * 0.65;
  }

  // ---------- אוסצילוסקופ ----------
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null, W = 0, H = 0, t = 0;
  function size() {
    if (!ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawScope() {
    if (!ctx || !W) return;
    ctx.clearRect(0, 0, W, H);
    var mid = H / 2, amp = (H / 2 - 4) * level;
    // קו בסיס + שנתות
    ctx.fillStyle = "rgba(255,255,255,.06)";
    for (var x = 0; x < W; x += 24) ctx.fillRect(x, mid - 3, 1, 6);
    function line(alpha, width, phase, k) {
      ctx.beginPath();
      for (var x = 0; x <= W; x += 3) {
        var u = x / W, env = Math.sin(Math.PI * u);           // נחלש בקצוות
        var y = Math.sin(u * 22 + t * 3.1 + phase) * 0.55 + Math.sin(u * 61 - t * 5.3 + phase) * 0.3 + Math.sin(u * 7 + t) * 0.15;
        ctx.lineTo(x, mid + y * amp * env * k);
      }
      ctx.strokeStyle = "rgba(255,26,60," + alpha + ")"; ctx.lineWidth = width; ctx.stroke();
    }
    ctx.shadowColor = "rgba(255,26,60,.9)"; ctx.shadowBlur = 12;
    line(1, 1.6, 0, 1);
    ctx.shadowBlur = 0;
    line(.28, 1, 1.7, .7);
  }
  function lightBars() {
    var n = Math.round(level * bars.length + .3);
    bars.forEach(function (b, i) { b.classList.toggle("on", i < n); });
  }

  size(); window.addEventListener("resize", size);
  if (REDUCE || !A || !M) { level = 0.25; drawScope(); level = 0; lightBars(); return; }

  (function loop() {
    level += (targetLevel() - level) * 0.08;
    t += 0.016;
    if (!document.hidden) { drawScope(); lightBars(); }
    logo.style.setProperty("--glow", level.toFixed(3));
    requestAnimationFrame(loop);
  })();

  // ---------- 1. פענוח האות: כל אות מתערבלת ואז ננעלת ----------
  function decode() {
    var finals = letters.map(function (l) { return l.textContent; });
    var tl = A.createTimeline({ defaults: { ease: "outExpo" } });
    letters.forEach(function (l, i) {
      var state = { p: 0 };
      tl.add(state, {
        p: [0, 1], duration: 520 + i * 90,
        onUpdate: function () { l.textContent = state.p < .92 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : finals[i]; },
        onComplete: function () { l.textContent = finals[i]; }
      }, 120 + i * 70);
    });
    tl.add(letters, {
      opacity: [0, 1], y: [function () { return A.utils.random(-60, 60); }, 0],
      scaleY: [1.8, 1], filter: ["blur(8px)", "blur(0px)"], duration: 900,
      delay: A.stagger(70, { from: "center" })
    }, 80);
    tl.add($$(".logo-fm b, .logo-rule, .brand-sub, .logo-coord"), { opacity: [0, 1], x: [-14, 0], duration: 700, delay: A.stagger(80) }, 700);
    var done = false;
    function finish() {
      if (done) return; done = true;
      letters.forEach(function (l, i) { l.textContent = finals[i]; ["opacity", "transform", "filter"].forEach(function (p) { l.style.removeProperty(p); }); });
      $$(".logo-fm b, .logo-rule, .brand-sub, .logo-coord").forEach(function (n) { n.style.removeProperty("opacity"); n.style.removeProperty("transform"); });
    }
    tl.then(function () { finish(); glitch(); });
    // רשת ביטחון: לשונית ברקע עוצרת את requestAnimationFrame – התוכן לעולם לא נשאר שקוף
    setTimeout(function () { if (!done) { tl.complete(); finish(); } }, 3500);
  }

  // ---------- 2. Glitch: פיצול צבע + חיתוך פסים ----------
  var glitching = false;
  function glitch() {
    if (glitching) return; glitching = true;
    var tl = A.createTimeline({ defaults: { duration: 60, ease: "steps(1)" }, onComplete: function () {
      ghosts.forEach(function (g) { g.style.opacity = 0; g.style.transform = ""; g.style.clipPath = ""; });
      letters.forEach(function (l) { l.style.transform = ""; });
      glitching = false;
    } });
    for (var k = 0; k < 6; k++) {
      var top = A.utils.random(0, 70), h = A.utils.random(8, 30);
      tl.add(ghosts[0], { opacity: 1, x: A.utils.random(-14, 14), clipPath: "inset(" + top + "% 0 " + (100 - top - h) + "% 0)" })
        .add(ghosts[1], { opacity: .85, x: A.utils.random(-10, 10), clipPath: "inset(" + (100 - top - h) + "% 0 " + top + "% 0)" }, "<")
        .add(letters[(Math.random() * letters.length) | 0], { x: A.utils.random(-8, 8) }, "<");
    }
    tl.add(ghosts, { opacity: 0, x: 0, duration: 120, ease: "outQuad" });
  }
  (function schedule() { setTimeout(function () { if (!document.hidden) glitch(); schedule(); }, A.utils.random(5200, 9000)); })();

  // ---------- 3. אותיות מגנטיות (Motion, קפיץ) ----------
  var SPRING = { type: "spring", stiffness: 380, damping: 18, mass: .6 };
  var fine = window.matchMedia && matchMedia("(pointer: fine)").matches;
  if (fine) {
    var raf = 0, px = 0, py = 0;
    hero.addEventListener("pointermove", function (e) {
      px = e.clientX; py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        letters.forEach(function (l) {
          var r = l.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var dx = px - cx, dy = py - cy, d = Math.sqrt(dx * dx + dy * dy), f = Math.max(0, 1 - d / 260);
          M.animate(l, { x: dx * .1 * f, y: dy * .14 * f, scaleY: 1 + .14 * f }, SPRING);
        });
      });
    });
    hero.addEventListener("pointerleave", function () { M.animate(letters, { x: 0, y: 0, scaleY: 1 }, SPRING); });
  }

  // ---------- 4. לחיצה על הלוגו: גל הלם + glitch ----------
  function burst(x, y, n, spread) {
    var sparks = [];
    for (var i = 0; i < n; i++) { var s = document.createElement("i"); s.className = "burst"; s.style.left = x + "px"; s.style.top = y + "px"; document.body.appendChild(s); sparks.push(s); }
    A.animate(sparks, {
      x: function (_, i) { return Math.cos(i / n * Math.PI * 2) * A.utils.random(spread * .6, spread); },
      y: function (_, i) { return Math.sin(i / n * Math.PI * 2) * A.utils.random(spread * .6, spread); },
      opacity: [1, 0], scale: [1.4, 0], rotate: function () { return A.utils.random(-180, 180); },
      duration: 700, ease: "outExpo",
      onComplete: function () { sparks.forEach(function (s) { s.remove(); }); }
    });
  }
  logo.addEventListener("click", function (e) {
    glitch(); burst(e.clientX, e.clientY, 14, 90);
    M.animate(letters, { scaleY: [1.25, 1], y: [-10, 0] }, { type: "spring", stiffness: 500, damping: 12, delay: M.stagger(.03, { from: "center" }) });
  });
  var play = $("#btnPlay");
  if (play) play.addEventListener("click", function () {
    var r = play.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 12, 70);
  });

  // ---------- 5. גלילה: הלוגו מתכווץ ונעשה עמום, הקונסולה נכנסת לפוקוס ----------
  if (M.scroll) {
    M.scroll(M.animate(".logo-stage", { scale: [1, .86], opacity: [1, .35], y: [0, 40] }, { ease: "linear" }),
      { target: hero, offset: ["start start", "end start"] });
  }

  // ---------- הפעלה ----------
  letters.forEach(function (l) { l.style.opacity = 0; });
  decode();
})();
