/* ==========================================================================
   DIKMAN FM · Orbit · וידיאו הופעות לייב
   מסך ראשי עם נגן יוטיוב מוטמע + כרטיסים לבחירה. הרשימה ב-RADIO_CONFIG.showcase.video.
   - נגן "בלי עוגיות" (youtube-nocookie) ובלי סקריפט חיצוני: מדברים עם הנגן ב-postMessage.
   - כשסרטון מתחיל: שולחים לרדיו (גם בלשונית אחרת) הודעה לעצור.
   - סרטון שחסום להטמעה: הודעה ברורה + פתיחה ביוטיוב.
   ========================================================================== */
(function () {
  "use strict";
  var CFG = window.RADIO_CONFIG || {};
  var list = ((CFG.showcase || {}).video || []).filter(function (v) { return v && typeof v.youtube === "string" && /^[\w-]{11}$/.test(v.youtube); });
  var host = document.getElementById("items");
  if (!host || !list.length) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var YT_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function svg(d) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.appendChild(p); return s;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function thumb(id, size) { return "https://i.ytimg.com/vi/" + id + "/" + (size || "hqdefault") + ".jpg"; }
  function watchUrl(id) { return "https://www.youtube.com/watch?v=" + id; }

  // ---------- עצירת הרדיו ----------
  var bc = null; try { bc = new BroadcastChannel("dikman-fm"); } catch (e) {}
  function hushRadio() { try { if (bc) bc.postMessage({ type: "media-start", from: "video" }); } catch (e) {} }
  // השידור החי התחיל בראש העמוד: עוצרים את הסרטון וחוזרים לתמונה שלו
  if (bc) bc.onmessage = function (e) { if (e.data && e.data.type === "media-start" && e.data.from === "live" && frame) poster(cur); };

  // ---------- שבת ----------
  var notice = document.getElementById("notice");
  function closedNow() {
    var st = null; try { st = window.Zmanim ? window.Zmanim.current(CFG.shabbat) : null; } catch (e) {}
    if (!st) return false;
    notice.hidden = false;
    notice.textContent = (st.kind === "shabbat" ? "שבת שלום. הצפייה חוזרת במוצאי שבת." : "חג שמח. הצפייה חוזרת במוצאי החג.");
    return true;
  }

  // ---------- מבנה ----------
  var stage = el("section", "card stage"); stage.setAttribute("aria-label", "הנגן");
  var screen = el("div", "screen");
  var meta = el("div", "stage-meta");
  var stN = el("span", "stage-n mono"); stN.dir = "ltr";
  var stT = el("h2", "stage-title"), stS = el("p", "stage-sub");
  var out = el("a", "yt-out"); out.target = "_blank"; out.rel = "noopener noreferrer";
  out.appendChild(svg("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"));
  out.appendChild(el("span", null, "פתיחה ביוטיוב"));
  var metaText = el("div", "stage-text"); metaText.appendChild(stN); metaText.appendChild(stT); metaText.appendChild(stS);
  meta.appendChild(metaText); meta.appendChild(out);
  stage.appendChild(screen); stage.appendChild(meta);
  host.appendChild(stage);

  var h = el("h2", "sec-h"); h.appendChild(document.createTextNode("כל ההופעות ")); var hc = el("small", "mono", pad(list.length)); hc.dir = "ltr"; h.appendChild(hc);
  host.appendChild(h);
  var ol = el("ol", "vlist");
  var cards = list.map(function (v, i) {
    var li = el("li"), b = el("button", "card vcard");
    b.type = "button"; b.setAttribute("aria-label", "ניגון: " + v.title);
    var th = el("span", "vc-thumb");
    var img = el("img"); img.src = thumb(v.youtube, "mqdefault"); img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.width = 320; img.height = 180;
    th.appendChild(img);
    var pb = el("span", "vc-play"); pb.appendChild(svg("M8 5.5v13l10-6.5z")); th.appendChild(pb);
    var now = el("span", "vc-now mono", "NOW PLAYING"); now.dir = "ltr"; th.appendChild(now);
    var tx = el("span", "vc-text");
    var n = el("span", "vc-n mono", pad(i + 1)); n.dir = "ltr";
    tx.appendChild(n); tx.appendChild(el("b", null, v.title)); if (v.sub) tx.appendChild(el("small", null, v.sub));
    b.appendChild(th); b.appendChild(tx);
    b.addEventListener("click", function () {
      play(i);
      stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    li.appendChild(b); ol.appendChild(li);
    return b;
  });
  host.appendChild(ol);

  // ---------- נגן ----------
  var cur = -1, frame = null, handshake = null, heard = false;

  function setMeta(i) {
    var v = list[i];
    stN.textContent = "LIVE · " + pad(i + 1) + "/" + pad(list.length);
    stT.textContent = v.title; stS.textContent = v.sub || ""; out.href = watchUrl(v.youtube);
    cards.forEach(function (c, k) { if (k === i) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current"); });
    // נתיב מלא: ה-<base> של הדף מפנה לשורש האתר
    try { history.replaceState(null, "", location.pathname + location.search + "#v=" + v.youtube); } catch (e) {}
  }
  function clearScreen() {
    if (handshake) { clearInterval(handshake); handshake = null; }
    frame = null; screen.textContent = "";
  }
  function poster(i) {
    clearScreen(); cur = i; setMeta(i);
    var v = list[i], b = el("button", "poster");
    b.type = "button"; b.setAttribute("aria-label", "ניגון: " + v.title);
    var img = el("img"); img.src = thumb(v.youtube); img.alt = ""; img.decoding = "async";
    b.appendChild(img);
    var pb = el("span", "big-play"); pb.appendChild(svg("M8 5.5v13l10-6.5z")); b.appendChild(pb);
    b.addEventListener("click", function () { play(i); });
    screen.appendChild(b);
  }
  function play(i) {
    if (closedNow()) { poster(i); return; }
    clearScreen(); cur = i; setMeta(i); heard = false;
    hushRadio();
    var v = list[i];
    frame = document.createElement("iframe");
    frame.className = "vframe";
    frame.title = v.title;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.setAttribute("allowfullscreen", "");
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.src = "https://www.youtube-nocookie.com/embed/" + v.youtube + "?autoplay=1&rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
    frame.addEventListener("load", listen);
    screen.appendChild(frame);
  }
  // "לחיצת יד" עם הנגן: אחריה הוא שולח מצב ניגון ושגיאות
  function listen() {
    var tries = 0, f = frame;
    if (handshake) clearInterval(handshake);
    handshake = setInterval(function () {
      if (!f || f !== frame || heard || ++tries > 40) { clearInterval(handshake); handshake = null; return; }
      try { f.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "dkm", channel: "widget" }), "*"); } catch (e) {}
    }, 250);
  }
  function blocked(i) {
    clearScreen();
    var v = list[i], box = el("div", "blocked");
    box.setAttribute("role", "alert");
    var ic = el("span", "blocked-ic"); ic.appendChild(svg("M12 8v5M12 16.5v.01M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z")); box.appendChild(ic);
    box.appendChild(el("b", null, "הסרטון הזה לא זמין לניגון באתר"));
    box.appendChild(el("span", null, "בעל הערוץ חסם את הצפייה בו מחוץ ליוטיוב. אפשר לצפות בו ישירות שם."));
    var a = el("a", "blocked-btn"); a.href = watchUrl(v.youtube); a.target = "_blank"; a.rel = "noopener noreferrer";
    a.appendChild(svg("M8 5.5v13l10-6.5z")); a.appendChild(el("span", null, "צפייה ביוטיוב"));
    box.appendChild(a);
    screen.appendChild(box);
  }

  window.addEventListener("message", function (e) {
    if (YT_ORIGINS.indexOf(e.origin) < 0 || !frame || e.source !== frame.contentWindow) return;
    var d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    if (!d || !d.event) return;
    heard = true;
    if (d.event === "onError") { blocked(cur); return; }
    var state = d.event === "onStateChange" ? d.info : (d.event === "infoDelivery" && d.info ? d.info.playerState : null);
    if (state === 1) hushRadio();   // מתנגן
  });

  // התחלה: הסרטון מהכתובת (#v=…) או הראשון
  var m = /#v=([\w-]{11})/.exec(location.hash), start = 0;
  if (m) list.forEach(function (v, k) { if (v.youtube === m[1]) start = k; });
  poster(start);
  closedNow();
})();
