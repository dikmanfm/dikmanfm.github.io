/* ==========================================================================
   DIKMAN FM · Orbit · הפלייליסט שלך, לפי סגנון
   כל סגנון הוא שורה שנפתחת לרשימה שלו. התוכן מגיע מ-RADIO_CONFIG.genres.
   ========================================================================== */
(function () {
  "use strict";
  var R = window.RadioApp, CFG = window.RADIO_CONFIG || {};
  var host = document.getElementById("genreList");
  if (!R || !host) return;
  var genres = CFG.genres || [];
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(d) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d);
    s.appendChild(p); return s;
  }
  function mmss(sec) {
    sec = Math.round(sec || 0); if (!sec) return "";
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  // שם ומשך לכל פריט: מזהה מהארכיון או שיר בודד
  function info(it) {
    if (typeof it === "string") {
      var ep = (R.state.episodes || []).filter(function (e) { return e.id === it; })[0];
      return ep ? { title: ep.title, duration: ep.duration } : { title: "פרק מהארכיון", duration: 0 };
    }
    return { title: it.title || "שיר", duration: it.duration || 0 };
  }

  function fill(body, g) {
    body.textContent = "";
    if (!g.items || !g.items.length) {
      var empty = el("div", "genre-empty");
      empty.appendChild(el("b", null, "הרשימה בבנייה"));
      empty.appendChild(el("span", null, "בקרוב כאן: " + g.note + "."));
      body.appendChild(empty);
      return;
    }
    var all = el("button", "genre-all");
    all.type = "button";
    all.appendChild(svg("M16 5.5v13L6.5 12z"));
    all.appendChild(el("span", null, "ניגון ברצף · " + g.items.length + " שירים"));
    all.addEventListener("click", function () { R.playItems(g.items, 0); });
    body.appendChild(all);

    var ol = el("ol", "genre-tracks");
    g.items.forEach(function (it, i) {
      var meta = info(it), li = el("li"), b = el("button", "genre-track");
      b.type = "button";
      b.appendChild(el("span", "gt-n mono", (i < 9 ? "0" : "") + (i + 1)));
      b.appendChild(el("span", "gt-t", meta.title));
      var d = el("span", "gt-d mono", mmss(meta.duration)); d.dir = "ltr"; b.appendChild(d);
      b.addEventListener("click", function () { R.playItems(g.items, i); });
      li.appendChild(b); ol.appendChild(li);
    });
    body.appendChild(ol);
  }

  var rows = [];
  function close(r) {
    r.btn.setAttribute("aria-expanded", "false");
    r.li.classList.remove("is-open");
    r.body.hidden = true;
  }
  function open(r) {
    rows.forEach(function (o) { if (o !== r) close(o); });
    fill(r.body, r.g);
    r.btn.setAttribute("aria-expanded", "true");
    r.li.classList.add("is-open");
    r.body.hidden = false;
    if (!reduce && window.Motion && Motion.animate) {
      Motion.animate(r.body, { opacity: [0, 1], transform: ["translateY(-6px)", "translateY(0)"] }, { duration: .28, easing: [.2, .8, .2, 1] });
    }
  }

  genres.forEach(function (g, i) {
    var li = el("li", "genre"), id = "genre-body-" + g.id;
    var btn = el("button", "genre-head");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    var n = el("span", "genre-n mono", "0" + (i + 1)); n.dir = "ltr";
    var txt = el("span", "genre-txt");
    txt.appendChild(el("b", null, g.name));
    var en = el("small", "mono", g.en); en.dir = "ltr"; txt.appendChild(en);
    var count = el("span", "genre-count mono", g.items && g.items.length ? g.items.length + " שירים" : "בקרוב");
    btn.appendChild(n); btn.appendChild(txt); btn.appendChild(count); btn.appendChild(svg("M6 9l6 6 6-6"));
    var body = el("div", "genre-body"); body.id = id; body.hidden = true;
    body.setAttribute("role", "region"); body.setAttribute("aria-label", g.name);
    li.appendChild(btn); li.appendChild(body); host.appendChild(li);
    var r = { li: li, btn: btn, body: body, g: g };
    rows.push(r);
    btn.addEventListener("click", function () {
      if (btn.getAttribute("aria-expanded") === "true") close(r); else open(r);
    });
  });
})();
