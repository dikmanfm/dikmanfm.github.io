/* DIKMAN FM · דף הפונטים – בניית הכרטיסים, התאמת גודל, סגנון תצוגה */
(function () {
  "use strict";
  var grid = document.getElementById("grid");
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 5.5v13L7 12z"/></svg>';
  grid.innerHTML = DKMFonts.list.map(function (f) {
    return '<article class="card' + (f.file ? "" : " is-now") + '">' +
      '<div class="pv"><div class="logo" style="--f:\'' + esc(f.family) + '\', Heebo, sans-serif;--w:' + (f.weight || 400) + ';--t:' + (f.track || "0em") + '" aria-label="DIKMAN FM">' +
        '<span class="w">DIKMAN</span><span class="fm">FM</span></div></div>' +
      '<div class="meta"><h2><small dir="ltr">' + (f.n < 10 ? "0" : "") + f.n + '</small><span dir="ltr">' + esc(f.name) + '</span></h2>' +
        '<p>' + esc(f.note) + '</p><p class="lic">' + esc(f.src) + ' · ' + esc(f.lic) + '</p>' +
        '<a class="try" href="concepts/orbit/?font=' + f.id + '">' + PLAY + 'בדיקה ב-Orbit</a></div>' +
    '</article>';
  }).join("");

  // התאמת גודל: כל לוגו ממלא את רוחב התצוגה (פונטים רחבים מתכווצים, צרים גדלים)
  function fit() {
    Array.prototype.forEach.call(grid.querySelectorAll(".pv"), function (pv) {
      var logo = pv.querySelector(".logo");
      logo.style.setProperty("--fs", "58px");
      var room = pv.clientWidth - 36, w = logo.scrollWidth;
      if (w) logo.style.setProperty("--fs", Math.min(84, Math.max(26, 58 * room / w)).toFixed(1) + "px");
    });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fit);
  window.addEventListener("resize", fit);
  setTimeout(fit, 1200);

  document.querySelector(".tools .seg").addEventListener("click", function (e) {
    var b = e.target.closest("[data-style]"); if (!b) return;
    document.body.setAttribute("data-style", b.getAttribute("data-style"));
    Array.prototype.forEach.call(this.children, function (x) { x.setAttribute("aria-pressed", x === b); });
  });

  // כניסה מדורגת של הכרטיסים בגלילה (Motion inView)
  var M = window.Motion;
  if (M && M.inView && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var cards = grid.querySelectorAll(".card");
    M.inView(cards, function (el) {
      M.animate(el, { opacity: [0, 1], y: [18, 0] }, { duration: .5, ease: [.16, 1, .3, 1], delay: (Array.prototype.indexOf.call(cards, el) % 3) * .06 });
    }, { amount: .2 });
  }
})();
