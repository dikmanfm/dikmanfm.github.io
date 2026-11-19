/* ==========================================================================
   "הקול הוא הממשק" – צורת הגל החיה
   • מאחורי הכותרת: רצועת קול שזורמת. "עכשיו" בצד שמאל, העבר נמשך ימינה
     (כמו כל צירי הזמן באפליקציה – RTL, ההתחלה בימין).
   • הכותרת עצמה "נושמת" עם עוצמת הצליל (--lvl).
   • בנגן המוקטן: אותה רצועה, קטנה.
   כשאין נגינה – קו שקט שנושם לאט. "הפחתת תנועה" – ציור סטטי, בלי זרימה.
   ========================================================================== */
(function () {
  "use strict";
  var R = window.RadioApp; if (!R) return;
  var root = document.documentElement;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function Scope(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext && canvas.getContext("2d");
    this.bar = opts.bar; this.gap = opts.gap; this.hist = []; this.w = 0; this.h = 0;
    this.fade = opts.fade;
  }
  Scope.prototype.size = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width) return false;
    if (r.width !== this.w || r.height !== this.h) {
      this.w = r.width; this.h = r.height;
      this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return true;
  };
  Scope.prototype.push = function (v) {
    var n = Math.ceil(this.w / (this.bar + this.gap)) + 2;
    this.hist.unshift(v);
    if (this.hist.length > n) this.hist.length = n;
  };
  Scope.prototype.draw = function (colLit, colDim, playing, t) {
    var g = this.ctx, W = this.w, H = this.h, step = this.bar + this.gap, mid = H / 2;
    g.clearRect(0, 0, W, H);
    var n = Math.ceil(W / step);
    for (var i = 0; i < n; i++) {
      var v = this.hist[i] || 0;
      // כשאין נגינה: גל שקט ונושם
      if (!playing) v = .035 + .02 * Math.sin(t / 900 + i * .22);
      var hgt = Math.max(1.5, v * H * .92);
      var x = i * step;                                   // i=0 = עכשיו, בצד שמאל
      var a = this.fade ? Math.max(.08, 1 - i / n * .9) : 1;
      g.globalAlpha = a;
      g.fillStyle = i < 3 && playing ? colLit : colDim;
      g.fillRect(x, mid - hgt / 2, this.bar, hgt);
    }
    g.globalAlpha = 1;
  };

  var big = new Scope(document.getElementById("scope"), { bar: 3, gap: 3, fade: true });
  var mini = new Scope(document.getElementById("miniScope"), { bar: 2, gap: 2, fade: true });
  if (!big.ctx) return;

  var colors = { lit: "#1fc8ee", dim: "#2c343e" };
  function readColors() {
    var cs = getComputedStyle(root);
    colors.lit = (cs.getPropertyValue("--cue") || colors.lit).trim();
    colors.dim = (cs.getPropertyValue("--scope") || colors.dim).trim();
  }
  readColors();
  if (window.matchMedia) { try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors); } catch (e) {} }

  var last = 0, acc = 0, lvlShown = 0;
  function frame(t) {
    var playing = !R.audio.paused;
    var dt = t - last; last = t; acc += dt;
    var v = R.level();
    // דגימה כל ~45ms – הרצועה זזה בקצב קבוע בכל מכשיר
    var tick = acc > 45; if (tick) acc = 0;
    if (!document.hidden) {
      if (big.size() && (tick || !playing)) { if (tick && !REDUCE) big.push(v); big.draw(colors.lit, colors.dim, playing || REDUCE, t); }
      if (!document.getElementById("mini").hidden && mini.size() && tick) { if (!REDUCE) mini.push(v); mini.draw(colors.lit, colors.dim, playing, t); }
      if (!REDUCE) {
        lvlShown += ((playing ? v : 0) - lvlShown) * .25;
        root.style.setProperty("--lvl", lvlShown.toFixed(3));
      }
    }
    requestAnimationFrame(frame);
  }
  // בהפחתת תנועה: גל סטטי עם צורה (לא קו ריק) כדי שהמסך לא ייראה מת
  if (REDUCE) { big.size(); for (var i = 0; i < 400; i++) big.hist.push(.25 + .2 * Math.abs(Math.sin(i * .37)) * Math.abs(Math.cos(i * .11))); }
  requestAnimationFrame(frame);
})();
