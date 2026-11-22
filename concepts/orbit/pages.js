/* ==========================================================================
   DIKMAN FM · Orbit · דפי "עוד מיואלי"
   התוכן מגיע מ-RADIO_CONFIG.showcase[<דף>]. בלי תוכן מוצג מצב "בקרוב".
   ========================================================================== */
(function () {
  "use strict";
  var CFG = window.RADIO_CONFIG || {}, page = document.body.getAttribute("data-page");
  var items = ((CFG.showcase || {})[page] || []).slice();
  var host = document.getElementById("items");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!host) return;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function svg(d, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); if (cls) s.setAttribute("class", cls);
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.appendChild(p); return s;
  }
  function https(u) { return typeof u === "string" && u.slice(0, 8).toLowerCase() === "https://" ? u : ""; }
  // קובץ שמע: https, או קובץ מהאתר עצמו (נתיב יחסי פשוט, בלי "..")
  function audioSrc(u) { return https(u) || (typeof u === "string" && /^[\w\-\/.]+\.(mp3|m4a|aac|ogg|wav)$/i.test(u) && u.indexOf("..") < 0 && u.charAt(0) !== "/" ? u : ""); }
  function mmss(sec) { sec = Math.round(sec || 0); if (!sec) return ""; var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function heDate(d) { if (!d) return ""; var p = String(d).split("-"); return p.length === 3 ? +p[2] + "." + +p[1] + "." + p[0] : d; }

  // שבת: אותה נעילה של הרדיו, לפי האזור של המאזין
  function closed() { try { return window.Zmanim ? window.Zmanim.current(CFG.shabbat) : null; } catch (e) { return null; } }
  var notice = document.getElementById("notice");
  function guard() {
    var st = closed();
    if (!st) return false;
    notice.hidden = false;
    notice.textContent = (st.kind === "shabbat" ? "שבת שלום. " : "חג שמח. ") + "הניגון חוזר במוצאי " + (st.kind === "shabbat" ? "שבת" : "החג") + ".";
    stopAll();
    return true;
  }

  // ---------- מצב ריק ----------
  if (!items.length) {
    var box = el("div", "card empty");
    var ring = el("span", "ring"); ring.appendChild(el("i")); box.appendChild(ring);
    box.appendChild(el("b", null, "התוכן בדרך"));
    box.appendChild(el("span", null, document.body.getAttribute("data-empty")));
    host.appendChild(box);
    var gh = el("div", "ghosts"); gh.setAttribute("aria-hidden", "true");
    for (var g = 0; g < 3; g++) gh.appendChild(el("div", page === "video" ? "ghost" : "ghost row"));
    host.appendChild(gh);
    return;
  }

  // ---------- וידיאו ----------
  var audio = null, current = null;
  function stopAll() {
    if (audio) { audio.pause(); }   // הנגן העליון (שיר) – נעצר
    if (current) { current.classList.remove("is-playing"); current = null; }
    Array.prototype.forEach.call(document.querySelectorAll("video"), function (v) { v.pause(); });
    Array.prototype.forEach.call(document.querySelectorAll("iframe.vframe"), function (f) { f.src = "about:blank"; });
  }

  if (page === "video") return;   // הוידיאו מטופל ב-video.js

  // ---------- שירים (עיבודים ולחנים / יואלי מקורי) ----------
  // השירים מתנגנים בנגן שבראש הדף (minihero.js): שם השיר מופיע שם, והלחצן הגדול עוצר/ממשיך.
  var H = window.DKMHero;
  if (!H) {   // גיבוי, אם הנגן העליון לא נטען: נגן פשוט בדף עצמו
    var own = new Audio(); own.preload = "none";
    H = { audio: own, playTrack: function (src) { if (own.getAttribute("src") !== src) own.src = src; own.play().catch(function () {}); return true; },
          isTrack: function (src) { return own.getAttribute("src") === src; } };
  }
  audio = H.audio;
  function mark(li) {
    Array.prototype.forEach.call(document.querySelectorAll(".tracks .item.is-playing"), function (n) { if (n !== li) n.classList.remove("is-playing"); });
    if (li) li.classList.add("is-playing");
  }
  var ol = el("ol", "tracks");
  items.forEach(function (it, i) {
    var src = audioSrc(it.url); if (!src) return;
    var title = it.title || "שיר " + (i + 1);
    var li = el("li", "card item"), btn = el("button", "play");
    li._src = src;
    btn.type = "button"; btn.setAttribute("aria-label", "ניגון: " + title);
    btn.appendChild(svg("M8 5.5v13l10-6.5z", "i-play")); btn.appendChild(svg("M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", "i-pause"));
    var main = el("div", "t-main");
    main.appendChild(el("b", null, title));
    var sub = [it.artist, it.note].filter(Boolean).join(" · ");
    if (sub) main.appendChild(el("span", null, sub));
    var tag = el("span", "t-tag", it.role || mmss(it.duration) || ""); if (!tag.textContent) tag.style.visibility = "hidden";
    var prog = el("div", "t-prog"); prog.appendChild(el("i"));
    li.appendChild(btn); li.appendChild(main); li.appendChild(tag); li.appendChild(prog);
    btn.addEventListener("click", function () {
      if (current === li && H.isTrack(src) && !audio.paused) { audio.pause(); return; }
      if (guard()) return;
      if (current && current !== li) current.querySelector(".t-prog i").style.width = "0";
      current = li;
      H.playTrack(src, title);
      // גוללים לראש הדף רק אם הנגן לא נראה, כדי שיראו את שם השיר
      var top = document.querySelector(".mh");
      if (top && top.getBoundingClientRect().bottom < 0 && top.scrollIntoView) top.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    ol.appendChild(li);
  });
  host.appendChild(ol);

  // מצב הלחצנים ברשימה עוקב אחרי הנגן העליון
  function sync() {
    var on = current && H.isTrack(current._src) && !audio.paused;
    mark(on ? current : null);
    Array.prototype.forEach.call(ol.children, function (li) {
      var t = li.querySelector(".t-main b").textContent;
      li.querySelector(".play").setAttribute("aria-label", (on && li === current ? "השהיה: " : "ניגון: ") + t);
    });
  }
  audio.addEventListener("play", sync);
  audio.addEventListener("pause", sync);
  // חזרה לשידור החי: אף שיר לא מסומן
  document.addEventListener("dkm:live", function () { if (current) current.querySelector(".t-prog i").style.width = "0"; current = null; sync(); });

  audio.addEventListener("timeupdate", function () {
    if (!current || !H.isTrack(current._src) || !isFinite(audio.duration)) return;
    current.querySelector(".t-prog i").style.width = (audio.currentTime / audio.duration * 100).toFixed(2) + "%";
  });
  audio.addEventListener("ended", function () {
    if (!current || !H.isTrack(current._src)) return;
    // ממשיך לשיר הבא ברשימה
    var next = current.nextElementSibling;
    current.querySelector(".t-prog i").style.width = "0";
    if (next) next.querySelector(".play").click(); else { current = null; sync(); }
  });
  setInterval(function () { if (current && !audio.paused) guard(); }, 30000);

  if (!reduce && window.Motion && Motion.animate) {
    Array.prototype.forEach.call(ol.children, function (n, i) {
      Motion.animate(n, { opacity: [0, 1], transform: ["translateY(10px)", "translateY(0)"] }, { duration: .4, delay: .05 * i, easing: [.2, .8, .2, 1] });
    });
  }
})();
