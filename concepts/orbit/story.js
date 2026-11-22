/* ==========================================================================
   DIKMAN FM · Orbit · סטורי "מאחורי הקלעים באולפן של יואלי"
   התוכן: data/stories.json (מוסיפים פריטים לסוף items, שום דבר לא נמחק לבד).
   - טבעת מקוטעת: קטע לכל פריט. אדום = עוד לא נצפה אצל הצופה הזה, אפור = נצפה.
   - חלון צפייה: פסי התקדמות, הקשה משמאל = הבא / מימין = הקודם, החזקה = עצירה,
     החלקה למטה = סגירה, מקלדת (חיצים, רווח, Esc).
   - וידיאו/אודיו/יוטיוב עוצרים את הרדיו (אותו ערוץ הודעות כמו דף הווידיאו).
   ========================================================================== */
(function () {
  "use strict";
  var wrap = document.getElementById("storyWrap"), btn = document.getElementById("storyBtn");
  if (!wrap || !btn || !window.fetch) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IMAGE_MS = 6000, TEXT_MS = 6500, SEEN_KEY = "dkm-stories-seen";
  var data = null, items = [], title = "מאחורי הקלעים באולפן של יואלי", avatar = "concepts/orbit/img/yoeli-story.png";

  // ---------- עזרים ----------
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function svg(d, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); if (cls) s.setAttribute("class", cls);
    d.split("|").forEach(function (p) { var e = document.createElementNS("http://www.w3.org/2000/svg", "path"); e.setAttribute("d", p); s.appendChild(e); });
    return s;
  }
  // קובץ מהאתר עצמו: נתיב יחסי פשוט בלי ".." ובלי סכמה
  function local(u) { return typeof u === "string" && /^[\w\-\/.]+$/.test(u) && u.indexOf("..") < 0 && u.charAt(0) !== "/" ? u : ""; }
  function https(u) { return typeof u === "string" && u.slice(0, 8).toLowerCase() === "https://" ? u : ""; }
  function heDate(d) {
    if (!d) return "";
    var p = String(d).split("-"); if (p.length !== 3) return "";
    var then = new Date(+p[0], +p[1] - 1, +p[2]), now = new Date(); now.setHours(0, 0, 0, 0);
    var days = Math.round((now - then) / 864e5);
    if (days === 0) return "היום"; if (days === 1) return "אתמול";
    return +p[2] + "." + +p[1] + "." + p[0];
  }
  function seenList() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch (e) { return []; } }
  function markSeen(id) {
    var s = seenList(); if (s.indexOf(id) >= 0) return;
    s.push(id); try { localStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-500))); } catch (e) {}
  }
  var bc = null; try { bc = new BroadcastChannel("dikman-fm"); } catch (e) {}
  function hushRadio() { try { if (bc) bc.postMessage({ type: "media-start", from: "story" }); } catch (e) {} }

  // ---------- טעינה ----------
  function valid(it) {
    if (!it || typeof it.id !== "string" || !it.id) return false;
    switch (it.type) {
      case "text": return typeof it.text === "string" && !!it.text;
      case "image": return !!local(it.src);
      case "video": case "audio": return !!(local(it.src) || https(it.src));
      case "youtube": return typeof it.youtube === "string" && /^[\w-]{11}$/.test(it.youtube);
      case "link": return !!https(it.url);
    }
    return false;
  }
  fetch("data/stories.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
    data = j || {};
    items = (data.items || []).filter(valid);
    if (typeof data.title === "string" && data.title) title = data.title;
    if (local(data.avatar)) avatar = data.avatar;
    if (!items.length) return;
    var avEl = document.getElementById("storyAvatar");
    if (avatar !== "concepts/orbit/img/yoeli-story.png") { var ps = avEl.parentNode.querySelector("source"); if (ps) ps.remove(); avEl.src = avatar; }   // תמונת ברירת המחדל מגיעה מ-<picture> (WebP קל)
    wrap.hidden = false;
    drawRing();
  }).catch(function () {});

  // ---------- הטבעת ----------
  function drawRing() {
    var ring = document.getElementById("storyRing"), seen = seenList(), n = items.length;
    while (ring.firstChild) ring.removeChild(ring.firstChild);
    var r = 47, C = 2 * Math.PI * r, gap = n > 1 ? Math.min(6, C / n * .25) : 0, len = C / n - gap, unseen = 0;
    items.forEach(function (it, i) {
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", 50); c.setAttribute("cy", 50); c.setAttribute("r", r);
      var isNew = seen.indexOf(it.id) < 0; if (isNew) unseen++;
      c.setAttribute("class", isNew ? "seg-new" : "seg-seen");
      if (n > 1) { c.setAttribute("stroke-dasharray", len.toFixed(2) + " " + (C - len).toFixed(2)); c.setAttribute("stroke-dashoffset", (-(C / n) * i - gap / 2).toFixed(2)); }
      ring.appendChild(c);
    });
    btn.classList.toggle("has-new", unseen > 0);
    document.getElementById("storyNew").hidden = unseen === 0;
    document.getElementById("storySr").textContent = " · " + items.length + " פריטים" + (unseen ? ", " + unseen + " חדשים" : "");
  }

  // ---------- חלון הצפייה ----------
  var dlg, frame, bars, stage, cap, whenEl, pauseBtn, arrowPrev, arrowNext;
  var idx = 0, timer = null, started = 0, elapsed = 0, dur = 0, paused = false, media = null, ytFrame = null;

  function build() {
    dlg = el("dialog", "sv"); dlg.setAttribute("aria-label", title);
    frame = el("div", "sv-frame");
    var top = el("div", "sv-top");
    bars = el("div", "sv-bars"); bars.setAttribute("aria-hidden", "true");
    var head = el("div", "sv-head");
    var av = el("span", "sv-av"); var avi = el("img"); avi.src = (document.getElementById("storyAvatar") || {}).currentSrc || avatar; avi.alt = ""; av.appendChild(avi);
    var who = el("div", "sv-who"); who.appendChild(el("b", null, title)); whenEl = el("span"); who.appendChild(whenEl);
    pauseBtn = el("button", "sv-btn"); pauseBtn.type = "button"; pauseBtn.setAttribute("aria-label", "השהיה");
    pauseBtn.appendChild(svg("M8 5v14|M16 5v14", "i-pause")); pauseBtn.appendChild(svg("M8 5.5v13l10-6.5z", "i-play"));
    var closeBtn = el("button", "sv-btn"); closeBtn.type = "button"; closeBtn.setAttribute("aria-label", "סגירה");
    closeBtn.appendChild(svg("M6 6l12 12|M18 6L6 18"));
    head.appendChild(av); head.appendChild(who); head.appendChild(pauseBtn); head.appendChild(closeBtn);
    top.appendChild(bars); top.appendChild(head);
    stage = el("div", "sv-stage"); stage.setAttribute("aria-live", "polite");
    cap = el("div", "sv-cap");
    var zPrev = el("button", "sv-zone prev"), zNext = el("button", "sv-zone next");
    zPrev.type = zNext.type = "button"; zPrev.tabIndex = zNext.tabIndex = -1;
    zPrev.setAttribute("aria-label", "הקודם"); zNext.setAttribute("aria-label", "הבא");
    frame.appendChild(top); frame.appendChild(stage); frame.appendChild(zPrev); frame.appendChild(zNext); frame.appendChild(cap);
    arrowPrev = el("button", "sv-arrow prev"); arrowPrev.type = "button"; arrowPrev.setAttribute("aria-label", "הפריט הקודם"); arrowPrev.appendChild(svg("M9 5l7 7-7 7"));
    arrowNext = el("button", "sv-arrow next"); arrowNext.type = "button"; arrowNext.setAttribute("aria-label", "הפריט הבא"); arrowNext.appendChild(svg("M15 5l-7 7 7 7"));
    dlg.appendChild(frame); dlg.appendChild(arrowPrev); dlg.appendChild(arrowNext);
    document.body.appendChild(dlg);

    closeBtn.addEventListener("click", close);
    pauseBtn.addEventListener("click", function () { setPaused(!paused); });
    arrowPrev.addEventListener("click", function () { go(idx - 1); });
    arrowNext.addEventListener("click", function () { go(idx + 1); });
    dlg.addEventListener("close", cleanup);
    dlg.addEventListener("cancel", function () { /* Esc: הדפדפן סוגר, cleanup רץ באירוע close */ });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });   // לחיצה מחוץ למסגרת
    dlg.addEventListener("keydown", function (e) {
      // מקלדת וגם מקשי טלפון כשר: 4/6 = הקודם/הבא, 5 = עצירה, מקש מחיקה/חזרה = סגירה
      if (e.key === "ArrowLeft" || e.key === "6") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "ArrowRight" || e.key === "4") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "5" || (e.key === " " && !(e.target.closest && e.target.closest("button, a")))) { setPaused(!paused); e.preventDefault(); }
      else if (e.key === "Backspace" || e.key === "BrowserBack" || e.key === "GoBack") { close(); e.preventDefault(); }
    });

    // הקשה קצרה = מעבר, החזקה = עצירה, החלקה למטה = סגירה, החלקה לצד = מעבר
    var down = null, holdT = null, held = false;
    function onDown(e) {
      if (e.button > 0) return;
      down = { x: e.clientX, y: e.clientY, t: Date.now(), zone: e.target.classList.contains("prev") ? -1 : 1 };
      held = false;
      holdT = setTimeout(function () { held = true; setPaused(true, true); }, 260);
    }
    function onUp(e) {
      if (!down) return;
      clearTimeout(holdT);
      var dx = e.clientX - down.x, dy = e.clientY - down.y, d = down; down = null;
      if (held) { setPaused(false, true); return; }
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { close(); return; }
      if (Math.abs(dx) > 60) { go(idx + (dx < 0 ? 1 : -1) * -1); return; }   // RTL: החלקה ימינה = הבא
      go(idx + d.zone);
    }
    [zPrev, zNext].forEach(function (z) {
      z.addEventListener("pointerdown", onDown);
      z.addEventListener("pointerup", onUp);
      z.addEventListener("pointercancel", function () { clearTimeout(holdT); if (held) setPaused(false, true); down = null; });
      z.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
  }

  function open() {
    if (!items.length) return;
    if (!dlg) build();
    while (bars.firstChild) bars.removeChild(bars.firstChild);
    items.forEach(function () { var b = el("span", "sv-bar"); b.appendChild(el("i")); bars.appendChild(b); });
    var seen = seenList(), first = 0;
    for (var i = 0; i < items.length; i++) if (seen.indexOf(items[i].id) < 0) { first = i; break; }
    paused = false; dlg.classList.remove("is-paused");
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    document.documentElement.style.overflow = "hidden";
    show(first);
  }
  function close() { if (dlg && dlg.open) { if (dlg.close) dlg.close(); else { dlg.removeAttribute("open"); cleanup(); } } }
  function cleanup() {
    stopItem();
    document.documentElement.style.overflow = "";
    drawRing();
    try { btn.focus({ preventScroll: true }); } catch (e) {}
  }

  function stopItem() {
    if (timer) { cancelAnimationFrame(timer); timer = null; }
    if (media) { try { media.pause(); media.removeAttribute("src"); media.load(); } catch (e) {} media = null; }
    ytFrame = null;
    while (stage && stage.firstChild) stage.removeChild(stage.firstChild);
  }
  function go(i) {
    if (i < 0) { show(0); return; }
    if (i >= items.length) { close(); return; }
    show(i);
  }
  function setBars(i, frac) {
    Array.prototype.forEach.call(bars.children, function (b, k) {
      b.classList.toggle("done", k < i);
      b.firstChild.style.width = k === i ? (Math.min(1, frac) * 100).toFixed(2) + "%" : (k < i ? "100%" : "0");
    });
  }
  function setPaused(p, quiet) {
    paused = p;
    dlg.classList.toggle("is-paused", p);
    pauseBtn.setAttribute("aria-label", p ? "המשך" : "השהיה");
    if (media) { if (p) media.pause(); else media.play().catch(function () {}); }
    if (!media && dur) { if (p) elapsed += Date.now() - started; else started = Date.now(); }
    if (!quiet && !p && !media && dur) tick();
  }
  // טיימר לתמונות/טקסט/קישור
  function tick() {
    if (timer) cancelAnimationFrame(timer);
    (function loop() {
      if (!dlg.open) return;
      var t = paused ? elapsed : elapsed + (Date.now() - started);
      setBars(idx, t / dur);
      if (t >= dur) { go(idx + 1); return; }
      timer = requestAnimationFrame(loop);
    })();
  }

  function show(i) {
    stopItem();
    idx = i; var it = items[i];
    markSeen(it.id);
    whenEl.textContent = heDate(it.date);
    cap.textContent = it.caption || "";
    arrowPrev.disabled = i === 0;
    setBars(i, 0);
    elapsed = 0; started = Date.now(); dur = 0;

    if (it.type === "text") {
      var t = el("div", "sv-text " + (it.bg === "dark" ? "bg-dark" : "bg-red"), it.text);
      stage.appendChild(t); dur = TEXT_MS;
    } else if (it.type === "image") {
      var img = el("img"); img.src = it.src; img.alt = it.caption || ""; img.decoding = "async";
      if (it.fit === "contain") img.className = "contain";
      stage.appendChild(img); dur = IMAGE_MS;
    } else if (it.type === "link") {
      var box = el("div", "sv-text " + (it.bg === "red" ? "bg-red" : "bg-dark"));
      var inner = el("div"); inner.appendChild(el("div", null, it.text || ""));
      var a = el("a", "sv-link"); a.href = it.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.appendChild(el("span", null, it.label || "פתיחה"));
      a.appendChild(svg("M14 4h6v6|M20 4l-9 9|M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"));
      a.addEventListener("click", function () { setPaused(true); });
      inner.appendChild(a); box.appendChild(inner); stage.appendChild(box); dur = IMAGE_MS + 2000;
    } else if (it.type === "video" || it.type === "audio") {
      var m;
      if (it.type === "video") {
        m = el("video"); m.playsInline = true; m.setAttribute("playsinline", ""); m.preload = "auto";
        if (it.fit === "contain") m.className = "contain";
        stage.appendChild(m);
      } else {
        m = new Audio(); m.preload = "auto";
        var au = el("div", "sv-audio"); au.appendChild(el("span", "disc"));
        au.appendChild(el("b", null, it.title || "אודיו"));
        stage.appendChild(au);
        m.addEventListener("playing", function () { au.classList.add("playing"); });
        m.addEventListener("pause", function () { au.classList.remove("playing"); });
      }
      m.src = it.src; media = m;
      m.addEventListener("timeupdate", function () { if (isFinite(m.duration) && m.duration) setBars(idx, m.currentTime / m.duration); });
      m.addEventListener("ended", function () { if (media === m) go(idx + 1); });
      m.addEventListener("play", hushRadio);
      // הקובץ לא נטען (רשת איטית / סינון): הודעה ברורה, ואחרי רגע ממשיכים לבא
      m.addEventListener("error", function () {
        if (media !== m) return;
        var tap = el("button", "sv-tap"); tap.type = "button"; tap.appendChild(el("span", null, "הקטע לא נטען · הקישו להמשך"));
        tap.addEventListener("click", function () { go(idx + 1); });
        stage.appendChild(tap);
        var at = idx; setTimeout(function () { if (media === m && idx === at && !paused) go(idx + 1); }, 4000);
      });
      var p = m.play();
      if (p && p.catch) p.catch(function () {
        // הדפדפן חסם ניגון אוטומטי: כפתור "הקישו לניגון"
        if (media !== m) return;
        var tap = el("button", "sv-tap"); tap.type = "button"; tap.appendChild(el("span", null, "הקישו לניגון"));
        tap.addEventListener("click", function () { tap.remove(); m.play().catch(function () {}); });
        stage.appendChild(tap);
      });
      if (paused) m.pause();
      return;
    } else if (it.type === "youtube") {
      var f = document.createElement("iframe");
      f.title = it.caption || title;
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.setAttribute("allowfullscreen", "");
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.src = "https://www.youtube-nocookie.com/embed/" + it.youtube + "?autoplay=1&rel=0&playsinline=1&modestbranding=1";
      stage.appendChild(f); ytFrame = f;
      hushRadio();
      setBars(idx, 1);   // יוטיוב: בלי מעבר אוטומטי, עוברים בהקשה
      return;
    }
    if (!paused) tick(); else setBars(idx, 0);
  }

  btn.addEventListener("click", open);
  // קישור ישיר: #story פותח את הסטורי
  if (location.hash === "#story") {
    var once = setInterval(function () { if (items.length) { clearInterval(once); open(); } }, 200);
    setTimeout(function () { clearInterval(once); }, 8000);
  }
})();
