/* ==========================================================================
   DIKMAN FM · Orbit · זיקוקי תווים עדינים מאחורי שלושת הלחצנים העגולים
   קנבס אחד מאחורי .orbs: מדי פעם "זיקוק" קטן מאחורי אחד הלחצנים, ותווים אדומים
   מתפזרים ממנו, נופלים קצת ודועכים. בלי תנועה למי שביקש פחות תנועה, בגרסה הקלה,
   וכשהאזור לא על המסך או שהלשונית מוסתרת – לא מצייר כלום (חוסך סוללה).
   ========================================================================== */
(function () {
  "use strict";
  var host = document.querySelector(".orbs");
  if (!host || !window.Path2D || !window.requestAnimationFrame) return;
  if (document.documentElement.classList.contains("lite")) return;
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (mq && mq.matches) return;

  var cv = document.createElement("canvas");
  cv.className = "orbs-fx"; cv.setAttribute("aria-hidden", "true");
  host.insertBefore(cv, host.firstChild);
  var ctx = cv.getContext("2d");
  if (!ctx) return;

  // צורות התווים (viewBox 24): שמינית, שתי שמיניות מחוברות, רבע
  var SHAPES = [
    { fill: "M7.5 19.5a3 2.3 -20 1 0 0.01 0z", stroke: "M10.3 18.6V4.5c2.2 1.4 4.6 2.2 5.8 5" },
    { fill: "M5.5 19.5a2.7 2.1 -20 1 0 0.01 0zM16.5 17a2.7 2.1 -20 1 0 0.01 0z", stroke: "M8 18.7V6.5l11-2.5v12.2M8 9.5l11-2.5" },
    { fill: "M9 19.5a3 2.3 -20 1 0 0.01 0z", stroke: "M11.8 18.6V4" }
  ].map(function (s) { return { fill: new Path2D(s.fill), stroke: new Path2D(s.stroke) }; });

  var W = 0, H = 0, dpr = 1, parts = [], running = false, visible = true, raf = 0, last = 0, nextBurst = 600;
  var PAD = 40;   // הקנבס חורג מעט מהלחצנים, כדי שהתווים יוכלו להתפזר החוצה

  function size() {
    var r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width + PAD * 2; H = r.height + PAD * 2;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
  }
  function centers() {
    var r = host.getBoundingClientRect();
    return Array.prototype.map.call(host.querySelectorAll(".orb-disc"), function (d) {
      var b = d.getBoundingClientRect();
      return { x: b.left - r.left + PAD + b.width / 2, y: b.top - r.top + PAD + b.height / 2, rad: b.width / 2 };
    });
  }
  function burst() {
    var c = centers(); if (!c.length) return;
    var o = c[Math.floor(Math.random() * c.length)];
    var n = 6 + Math.floor(Math.random() * 4), base = Math.random() * Math.PI * 2;
    for (var i = 0; i < n; i++) {
      var a = base + i / n * Math.PI * 2 + (Math.random() - .5) * .5, sp = 34 + Math.random() * 46;
      var note = Math.random() < .75;
      parts.push({
        x: o.x + Math.cos(a) * o.rad * .55, y: o.y + Math.sin(a) * o.rad * .55,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 14,
        life: 0, max: 1.5 + Math.random() * .9,
        size: note ? 9 + Math.random() * 7 : 1.2 + Math.random() * 1.3,
        rot: (Math.random() - .5) * .6, spin: (Math.random() - .5) * 1.2,
        shape: note ? SHAPES[Math.floor(Math.random() * SHAPES.length)] : null
      });
    }
  }
  function frame(t) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    nextBurst -= dt * 1000;
    if (nextBurst <= 0) { burst(); nextBurst = 1300 + Math.random() * 1500; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vx *= 1 - dt * .9; p.vy = p.vy * (1 - dt * .9) + 22 * dt;   // האטה וקצת כובד
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      var k = p.life / p.max, alpha = (k < .15 ? k / .15 : 1 - (k - .15) / .85) * .5;
      ctx.globalAlpha = alpha;
      if (!p.shape) {
        ctx.fillStyle = "#ff5a70";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
        continue;
      }
      var s = p.size / 24;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(s, s); ctx.translate(-12, -12);
      ctx.shadowColor = "rgba(255,26,60,.8)"; ctx.shadowBlur = 6;
      ctx.fillStyle = "#ff2a48"; ctx.strokeStyle = "#ff2a48"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.fill(p.shape.fill); ctx.stroke(p.shape.stroke);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function update() {
    var go = visible && !document.hidden;
    if (go && !running) { running = true; last = 0; if (!raf) raf = requestAnimationFrame(frame); }
    else if (!go && running) { running = false; parts.length = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  size();
  window.addEventListener("resize", size);
  document.addEventListener("visibilitychange", update);
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (mq.matches) { running = false; cv.remove(); } });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; update(); }).observe(host);
  }
  update();
})();
