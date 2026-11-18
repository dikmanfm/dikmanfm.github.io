/* ==========================================================================
   לשונית "נתונים" – לוח מחוונים קטן בסגנון קונסולה
   • מדדים (KPI) שסופרים עד הערך – Anime.js
   • גרף ההאזנה שלי ב-7 הימים האחרונים – עמודות שצומחות במדורג (Anime.js stagger)
   • שעות שידור בארכיון לפי חודש – עמודות מוערמות לפי תוכנית
   • פס חלוקה לפי תוכנית – המקטעים מתמלאים בקפיץ (Motion)
   הגרפים הם SVG רגיל שנבנה כאן, בלי ספריית גרפים ובלי שלב בנייה.
   בלי הספריות או עם "הפחתת תנועה" – הכול מוצג מיד, בלי אנימציה.
   ציר הזמן זורם מימין לשמאל (RTL), כמו ציר התדרים בלשונית "עכשיו".
   ========================================================================== */
(function () {
  "use strict";
  var R = window.RadioApp; if (!R) return;
  var A = window.anime, M = window.Motion;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ANIM = !!(A && A.animate && A.stagger && !REDUCE);
  var SPRINGY = !!(M && M.animate && !REDUCE);
  var NS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var panel = $("panel-stats"); if (!panel) return;

  // צבעי הסדרות – סדר קבוע לפי תוכנית (נבדקו לעיוורון צבעים מול רקע הכרטיס)
  var SERIES = [
    { key: "מאסטר פליי", cls: "s1" },
    { key: "לילה מנצח", cls: "s2" }
  ];
  var OTHER = { key: "אחר", cls: "s3" };
  function seriesFor(cat) { for (var i = 0; i < SERIES.length; i++) if (SERIES[i].key === cat) return SERIES[i]; return OTHER; }

  var DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  var DAYS_LONG = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  var monthFmt = null; try { monthFmt = new Intl.DateTimeFormat("he-IL", { month: "short" }); } catch (e) {}
  var monthLongFmt = null; try { monthLongFmt = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }); } catch (e) {}

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function num(n) { return Math.round(n).toLocaleString("he-IL"); }
  // משך: "45 דק׳" / "2:05 שע׳"
  function dur(sec) {
    var m = Math.round(sec / 60);
    return m < 60 ? m + " דק׳" : Math.floor(m / 60) + ":" + pad(m % 60) + " שע׳";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // ערך עליון "עגול" לציר, ושלוש שנתות
  function niceMax(v, steps) {
    for (var i = 0; i < steps.length; i++) if (steps[i] * 2 >= v) return steps[i] * 2;
    return Math.ceil(v / steps[steps.length - 1]) * steps[steps.length - 1];
  }

  // ---------- הנתונים ----------
  function listenDays() {
    var log = R.state.listen || {}, out = [], today = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      var rec = log[dayKey(d)] || { t: 0, c: {} };
      out.push({ date: d, t: rec.t || 0, c: rec.c || {}, today: i === 0 });
    }
    return out;
  }
  function sumRange(fromAgo, toAgo) {
    var log = R.state.listen || {}, today = new Date(), s = 0;
    for (var i = fromAgo; i <= toAgo; i++) {
      var r = log[dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))];
      if (r) s += r.t || 0;
    }
    return s;
  }
  function streak() {
    var log = R.state.listen || {}, today = new Date(), n = 0;
    var start = (log[dayKey(today)] || {}).t >= 60 ? 0 : 1;          // היום עוד לא נגמר – הרצף לא נשבר
    for (var i = start; i < 400; i++) {
      var r = log[dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))];
      if (r && r.t >= 60) n++; else break;
    }
    return n;
  }
  function topSource() {
    var log = R.state.listen || {}, tot = {}, all = 0;
    Object.keys(log).forEach(function (k) {
      var c = log[k].c || {};
      Object.keys(c).forEach(function (s) { tot[s] = (tot[s] || 0) + c[s]; all += c[s]; });
    });
    var best = null;
    Object.keys(tot).forEach(function (s) { if (!best || tot[s] > tot[best]) best = s; });
    return best ? { name: best === "LIVE" ? "שידור חי" : best, share: tot[best] / all } : null;
  }
  function months() {
    var eps = R.state.episodes || [], now = new Date(), out = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ date: d, key: d.getFullYear() + "-" + pad(d.getMonth() + 1), c: {} });
    }
    eps.forEach(function (ep) {
      var k = (ep.date || "").slice(0, 7);
      for (var i = 0; i < out.length; i++) if (out[i].key === k) {
        var s = seriesFor(ep.category).key;
        out[i].c[s] = (out[i].c[s] || 0) + (ep.duration || 0);
      }
    });
    return out;
  }
  function byCategory() {
    var t = {}, all = 0;
    (R.state.episodes || []).forEach(function (ep) {
      var s = seriesFor(ep.category).key, d = ep.duration || 0;
      t[s] = t[s] || { sec: 0, n: 0 }; t[s].sec += d; t[s].n++; all += d;
    });
    return SERIES.concat([OTHER]).filter(function (s) { return t[s.key]; })
      .map(function (s) { return { s: s, sec: t[s.key].sec, n: t[s.key].n, share: all ? t[s.key].sec / all : 0 }; });
  }

  // ---------- מדדים ----------
  function renderKPIs(animate) {
    var eps = R.state.episodes || [];
    var archive = eps.reduce(function (s, e) { return s + (e.duration || 0); }, 0);
    var week = sumRange(0, 6), prev = sumRange(7, 13), st = streak(), top = topSource();
    var delta = prev > 60 ? Math.round((week - prev) / prev * 100) : null;
    var tiles = [
      { label: "שעות בארכיון", value: archive / 3600, fmt: function (v) { return num(v); }, sub: num(eps.length) + " הקלטות" },
      { label: "האזנתם השבוע", value: week, fmt: dur, sub: delta == null ? "7 הימים האחרונים" : (delta >= 0 ? "+" : "−") + Math.abs(delta) + "% משבוע שעבר", trend: delta == null ? "" : delta >= 0 ? "up" : "down" },
      { label: "רצף האזנה", value: st, fmt: function (v) { return num(v); }, unit: st === 1 ? "יום" : "ימים", sub: st ? "ימים ברצף עם האזנה" : "האזנה היום מתחילה רצף" },
      { label: "התוכנית שלכם", text: top ? top.name : "—", sub: top ? Math.round(top.share * 100) + "% מזמן ההאזנה" : "תתעדכן אחרי ההאזנה הראשונה" }
    ];
    var box = $("kpis");
    box.innerHTML = tiles.map(function (t, i) {
      return '<div class="kpi">' +
        '<span class="kpi-label">' + esc(t.label) + '</span>' +
        '<span class="kpi-value' + (t.text ? " is-text" : "") + '"><b data-i="' + i + '">' + esc(t.text || t.fmt(t.value)) + '</b>' + (t.unit ? '<small>' + esc(t.unit) + '</small>' : "") + '</span>' +
        '<span class="kpi-sub' + (t.trend ? " " + t.trend : "") + '">' + esc(t.sub) + '</span>' +
      '</div>';
    }).join("");
    if (!animate || !ANIM) return;
    // הספרות "מתגלגלות" עד הערך, כמו מונה של מכשיר
    tiles.forEach(function (t, i) {
      if (t.text || !t.value) return;
      var b = box.querySelector('b[data-i="' + i + '"]'), o = { v: 0 };
      A.animate(o, { v: t.value, duration: 1200, delay: 120 + i * 90, ease: "outExpo",
        onUpdate: function () { b.textContent = t.fmt(o.v); },
        onComplete: function () { b.textContent = t.fmt(t.value); } });
    });
    A.animate(box.querySelectorAll(".kpi"), { opacity: [0, 1], y: [10, 0], duration: 700, delay: A.stagger(70), ease: "outQuart" });
  }

  // ---------- גרף עמודות (מוערם) ----------
  // rows: [{ label, title, segs:[{cls, v, name}], hl }]; v ביחידות הציר
  function barChart(box, rows, o) {
    box.innerHTML = "";
    var W = Math.max(260, box.clientWidth || 320), H = o.height || 170;
    var padT = 18, padB = 24, padR = 40, padL = 4;              // RTL: תוויות הציר מימין
    var plotW = W - padR - padL, plotH = H - padT - padB;
    var maxV = 0;
    rows.forEach(function (r) { var s = 0; r.segs.forEach(function (g) { s += g.v; }); r.total = s; if (s > maxV) maxV = s; });
    var top = niceMax(maxV, o.steps), y = function (v) { return padT + plotH - v / top * plotH; };

    var root = svg("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": o.aria }, box);
    var grid = svg("g", { "class": "ch-grid", "aria-hidden": "true" }, root);
    [0, top / 2, top].forEach(function (v) {
      svg("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), "class": v ? "" : "base" }, grid);
      var t = svg("text", { x: W - padR + 8, y: y(v) + 4, "text-anchor": "start" }, grid);   // ב-RTL "start" = ימין
      t.textContent = o.tick(v);
    });

    var band = plotW / rows.length, bw = Math.min(o.barMax || 26, band * .56);
    var bars = svg("g", { "class": "ch-bars" }, root), groups = [];
    rows.forEach(function (r, i) {
      var cx = W - padR - (i + .5) * band;                        // הישן מימין, החדש משמאל
      var g = svg("g", { "class": "ch-bar" + (r.hl ? " hl" : "") }, bars);
      var acc = 0, segs = r.segs.filter(function (s) { return s.v > 0; });
      segs.forEach(function (s, j) {
        var isTop = j === segs.length - 1;
        var y0 = y(acc), y1 = y(acc + s.v), h = y0 - y1 - (isTop ? 0 : 2);   // רווח 2px בין מקטעים
        if (h <= 0) { acc += s.v; return; }
        var x = cx - bw / 2, rr = isTop ? Math.min(4, h, bw / 2) : 0;
        svg("path", { "class": "seg " + s.cls, d:
          "M" + x + " " + y0 + "V" + (y1 + rr) + (rr ? "Q" + x + " " + y1 + " " + (x + rr) + " " + y1 : "") +
          "H" + (x + bw - rr) + (rr ? "Q" + (x + bw) + " " + y1 + " " + (x + bw) + " " + (y1 + rr) : "") + "V" + y0 + "Z" }, g);
        acc += s.v;
      });
      if (!segs.length) svg("rect", { "class": "seg ghost", x: cx - bw / 2, y: y(0) - 2, width: bw, height: 2, rx: 1 }, g);
      // תווית ישירה – רק לעמודה המודגשת (היום / החודש הנוכחי), לא על כל עמודה
      if (r.hl && r.total > 0) { var vt = svg("text", { "class": "ch-val", x: cx, y: y(r.total) - 6, "text-anchor": "middle" }, g); vt.textContent = o.val(r.total); }
      var lt = svg("text", { "class": "ch-x" + (r.hl ? " hl" : ""), x: cx, y: H - 6, "text-anchor": "middle" }, root);
      lt.textContent = r.label;
      // אזור ריחוף גדול מהעמודה עצמה
      var hit = svg("rect", { "class": "ch-hit", x: cx - band / 2, y: padT - 8, width: band, height: plotH + 8 }, root);
      hit._row = r; hit._g = g; hit._cx = cx; hit._top = y(r.total);
      groups.push(g);
    });

    // טבלה לקוראי מסך
    var table = document.createElement("table"); table.className = "sr-only";
    table.innerHTML = "<caption>" + esc(o.aria) + "</caption><tr><th>" + esc(o.col) + "</th><th>סה״כ</th></tr>" +
      rows.map(function (r) { return "<tr><td>" + esc(r.title) + "</td><td>" + esc(o.val(r.total)) + "</td></tr>"; }).join("");
    box.appendChild(table);

    if (o.empty && maxV === 0) {
      var e = document.createElement("div"); e.className = "ch-empty"; e.innerHTML = o.empty; box.appendChild(e);
    }

    // טולטיפ
    var tip = document.createElement("div"); tip.className = "ch-tip"; tip.setAttribute("aria-hidden", "true"); box.appendChild(tip);
    var cur = null;
    function show(hit) {
      if (cur === hit) return; cur = hit;
      var r = hit._row;
      tip.innerHTML = "<b>" + esc(r.title) + "</b>" +
        (r.segs.length > 1 ? r.segs.filter(function (s) { return s.v > 0; }).map(function (s) {
          return '<span class="row"><i class="sw ' + s.cls + '"></i>' + esc(s.name) + '<em>' + esc(o.val(s.v)) + "</em></span>";
        }).join("") : "") +
        '<span class="row total">סה״כ<em>' + esc(o.val(r.total)) + "</em></span>";
      box.classList.add("is-hover");
      groups.forEach(function (g) { g.classList.toggle("dim", g !== hit._g); });
      var tw = tip.offsetWidth || 120, x = Math.max(4, Math.min(W - tw - 4, hit._cx - tw / 2)), ty = Math.max(0, hit._top - tip.offsetHeight - 10);
      if (SPRINGY && tip.classList.contains("on")) M.animate(tip, { x: x, y: ty }, { type: "spring", stiffness: 500, damping: 36 });
      else { tip.style.transform = "translate(" + x + "px," + ty + "px)"; }
      tip.classList.add("on");
    }
    function hide() {
      cur = null; tip.classList.remove("on"); box.classList.remove("is-hover");
      groups.forEach(function (g) { g.classList.remove("dim"); });
    }
    Array.prototype.forEach.call(root.querySelectorAll(".ch-hit"), function (h) {
      h.addEventListener("pointerenter", function () { show(h); });
      h.addEventListener("pointerdown", function () { show(h); });
    });
    root.addEventListener("pointerleave", hide);
    return groups;
  }

  function grow(groups, delay) {
    if (!ANIM || !groups.length) return;
    A.animate(groups, { scaleY: [0, 1], duration: 950, delay: A.stagger(55, { start: delay || 0, from: "first" }), ease: "outExpo",
      onComplete: function (a) { groups.forEach(function (g) { g.style.removeProperty("transform"); }); } });
  }

  function renderListen(animate) {
    var days = listenDays(), total = days.reduce(function (s, d) { return s + d.t; }, 0);
    $("chListenMeta").textContent = total ? "סה״כ " + dur(total) : "";
    var rows = days.map(function (d) {
      return { label: d.today ? "היום" : DAYS[d.date.getDay()], title: (d.today ? "היום, " : "") + "יום " + DAYS_LONG[d.date.getDay()] + " " + d.date.getDate() + "." + (d.date.getMonth() + 1),
        segs: [{ cls: "s0", v: d.t / 60, name: "האזנה" }], hl: d.today };
    });
    var g = barChart($("chListen"), rows, {
      aria: "דקות האזנה בכל אחד משבעת הימים האחרונים", col: "יום", height: 168,
      steps: [5, 10, 15, 30, 60, 90, 120, 180, 240, 360],
      tick: function (v) { return v >= 60 ? Math.round(v / 60 * 10) / 10 + "ש׳" : Math.round(v) + "ד׳"; },
      val: function (v) { return dur(v * 60); },
      empty: "<b>עוד לא האזנתם השבוע</b><span>הקישו על נגן, והגרף יתמלא מעצמו.</span>"
    });
    if (animate) grow(g, 200);
  }

  function renderMonths(animate) {
    var ms = months(), used = {};
    var rows = ms.map(function (m, i) {
      var segs = SERIES.concat([OTHER]).map(function (s) { if (m.c[s.key]) used[s.key] = s; return { cls: s.cls, v: (m.c[s.key] || 0) / 3600, name: s.key }; });
      return { label: monthFmt ? monthFmt.format(m.date) : (m.date.getMonth() + 1) + "", title: monthLongFmt ? monthLongFmt.format(m.date) : m.key, segs: segs, hl: i === ms.length - 1 };
    });
    var legend = SERIES.concat([OTHER]).filter(function (s) { return used[s.key]; });
    $("chMonthsLegend").innerHTML = legend.length > 1 ? legend.map(function (s) { return '<span><i class="sw ' + s.cls + '"></i>' + esc(s.key) + "</span>"; }).join("") : "";
    var g = barChart($("chMonths"), rows, {
      aria: "שעות שידור שנוספו לארכיון בכל חודש, לפי תוכנית", col: "חודש", height: 176, barMax: 30,
      steps: [1, 2, 5, 10, 20, 25, 50, 100, 200],
      tick: function (v) { return Math.round(v * 10) / 10 + "ש׳"; },
      val: function (v) { return dur(v * 3600); },
      empty: "<b>אין עדיין הקלטות בחצי השנה האחרונה</b>"
    });
    if (animate) grow(g, 320);
  }

  function renderSplit(animate) {
    var cats = byCategory(), box = $("chSplit");
    if (!cats.length) { box.innerHTML = '<p class="ch-empty static">הארכיון ייטען בעוד רגע…</p>'; return; }
    box.innerHTML = '<div class="split-bar" role="img" aria-label="' + esc(cats.map(function (c) { return c.s.key + " " + Math.round(c.share * 100) + "%"; }).join(", ")) + '">' +
      cats.map(function (c) { return '<i class="split-seg ' + c.s.cls + '" style="flex-grow:' + c.share.toFixed(4) + '"></i>'; }).join("") + "</div>" +
      '<ul class="split-legend">' + cats.map(function (c) {
        return '<li><i class="sw ' + c.s.cls + '"></i><b>' + esc(c.s.key) + '</b><span class="mono">' + Math.round(c.share * 100) + '%</span><small>' + num(c.n) + " הקלטות · " + esc(dur(c.sec)) + "</small></li>";
      }).join("") + "</ul>";
    if (!animate || !SPRINGY) return;
    // המקטעים "נשפכים" למקום בקפיץ, אחד אחרי השני
    Array.prototype.forEach.call(box.querySelectorAll(".split-seg"), function (s, i) {
      M.animate(s, { scaleX: [0, 1], opacity: [0, 1] }, { type: "spring", stiffness: 170, damping: 22, delay: .45 + i * .12 });
    });
  }

  // ---------- תזמון ----------
  var shownOnce = false, lastW = 0;
  function render(animate) {
    if (panel.hidden) return;
    renderKPIs(animate); renderListen(animate); renderMonths(animate); renderSplit(animate);
    lastW = panel.clientWidth;
  }
  // פתיחת הלשונית – אנימציה מלאה; עדכון נתונים בזמן שהיא פתוחה – בלי לקפוץ
  new MutationObserver(function () { if (!panel.hidden) requestAnimationFrame(function () { render(true); shownOnce = true; }); })
    .observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("radio:data", function () { if (!panel.hidden) requestAnimationFrame(function () { render(!shownOnce); shownOnce = true; }); });
  var rz = 0;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (!panel.hidden && panel.clientWidth !== lastW) render(false); }, 150); });
  // רענון שקט פעם בדקה כשמאזינים והלשונית פתוחה
  setInterval(function () { if (!panel.hidden && !document.hidden && R.audio && !R.audio.paused) render(false); }, 60000);
  if (!panel.hidden) requestAnimationFrame(function () { render(true); shownOnce = true; });
})();
