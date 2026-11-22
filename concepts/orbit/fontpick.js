/* ==========================================================================
   DIKMAN FM · Orbit — בדיקת פונטים ללוגו (רק בסקיצה)
   נפתח מדף הפונטים עם ?font=<id>. סרגל קטן בתחתית מדפדף בין הפונטים,
   והלוגו מתכווץ אוטומטית כך שפונטים רחבים לא יחרגו מהמסך.
   ========================================================================== */
(function () {
  "use strict";
  var F = window.DKMFonts; if (!F) return;
  var id = new URLSearchParams(location.search).get("font");
  if (!id) return;

  var logo = document.querySelector(".logo-b"), stage = document.querySelector(".orbit-stage");
  var list = F.list, idx = Math.max(0, list.indexOf(F.get(id)));

  function fit() {
    logo.style.removeProperty("--size");
    var room = stage.clientWidth * .94, w = logo.scrollWidth;
    if (w > room) {
      var base = parseFloat(getComputedStyle(logo).fontSize);
      logo.style.setProperty("--size", (base * room / w).toFixed(1) + "px");
    }
  }
  function set(i) {
    idx = (i + list.length) % list.length;
    var f = F.apply(logo, list[idx].id);
    name.textContent = f.name; num.textContent = (idx < 10 ? "0" : "") + idx + "/" + (list.length - 1);
    var u = new URL(location.href); u.searchParams.set("font", f.id); history.replaceState(null, "", u);
    fit();
    if (document.fonts && document.fonts.load) document.fonts.load("40px \"" + f.family + "\"").then(fit, fit);
  }

  var bar = document.createElement("div");
  bar.className = "fontbar";
  bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "בדיקת פונט ללוגו");
  bar.innerHTML =
    '<button type="button" class="fb-btn" data-d="-1" aria-label="הפונט הקודם"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>' +
    '<div class="fb-mid"><small>פונט הלוגו <span class="fb-num mono" dir="ltr"></span></small><b class="fb-name" dir="ltr" aria-live="polite"></b></div>' +
    '<button type="button" class="fb-btn" data-d="1" aria-label="הפונט הבא"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
    '<a class="fb-all" href="concepts/fonts/">כל הפונטים</a>';
  document.body.appendChild(bar);
  document.body.style.paddingBottom = "76px";   // שהסרגל לא יסתיר את סוף הדף
  var name = bar.querySelector(".fb-name"), num = bar.querySelector(".fb-num");
  bar.addEventListener("click", function (e) { var b = e.target.closest("[data-d]"); if (b) set(idx + (+b.getAttribute("data-d"))); });
  document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key === "[") set(idx - 1); if (e.key === "]") set(idx + 1);
  });
  window.addEventListener("resize", fit);
  set(idx);
})();
