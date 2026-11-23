/* ==========================================================================
   DIKMAN FM · Orbit · הנגן שבראש הדפים הפנימיים
   נגן אחד לכל הדף: השידור החי (RADIO_CONFIG.live.url) או שיר שנבחר מהרשימה למטה.
   כשמנגן שיר – שמו מופיע מתחת ללחצן, הלחצן עוצר/ממשיך אותו, ויש "חזרה לשידור החי".
   מכבד את נעילת השבת, ומתואם עם שאר הנגנים באתר בערוץ "dikman-fm": מי שמתחיל לנגן עוצר את האחרים.
   ממשק לשאר הדף: window.DKMHero (pages.js משתמש בו לשירים).
   ========================================================================== */
(function () {
  "use strict";
  var CFG = window.RADIO_CONFIG || {};
  var key = document.getElementById("heroLive"), label = document.getElementById("heroLiveLabel"), sr = document.getElementById("heroLiveSr");
  if (!key) return;
  var url = CFG.live && typeof CFG.live.url === "string" && CFG.live.url.slice(0, 8).toLowerCase() === "https://" ? CFG.live.url : "";
  var audio = new Audio(); audio.preload = "none";
  var mode = "live", track = null;          // mode: "live" | "track"
  var on = false, loading = false;          // on = משדר חי (במצב live)

  // "חזרה לשידור החי" – מופיע רק כשמנגן שיר
  var back = document.createElement("button");
  back.type = "button"; back.className = "mh-back-live"; back.hidden = true; back.textContent = "חזרה לשידור החי";
  if (label && label.parentNode) label.parentNode.appendChild(back);

  var bc = null; try { bc = new BroadcastChannel("dikman-fm"); } catch (e) {}
  function announce() { try { if (bc) bc.postMessage({ type: "media-start", from: mode === "live" ? "live" : "song" }); } catch (e) {} }
  // נגן אחר באתר התחיל (רדיו בלשונית אחרת / וידיאו): עוצרים
  if (bc) bc.onmessage = function (e) {
    if (!e.data || e.data.type !== "media-start" || e.data.from === "live" || e.data.from === "song") return;
    if (mode === "live") { if (on) stop(); } else audio.pause();
  };

  function playing() { return mode === "live" ? on : !audio.paused; }
  function ui() {
    var p = playing();
    key.classList.toggle("is-on", p && !loading);
    key.classList.toggle("is-loading", loading);
    key.classList.toggle("is-track", mode === "track");
    key.setAttribute("aria-pressed", p ? "true" : "false");
    if (mode === "live") {
      if (sr) sr.textContent = on ? "עצירת השידור החי" : "הפעלת השידור החי";
      if (label) { label.textContent = on ? "משדרים חי · לחצו לעצירה" : "לחצו פליי לשידור החי"; label.classList.remove("is-track"); }
      back.hidden = true;
    } else {
      var t = track.title || "שיר";
      if (sr) sr.textContent = (p ? "השהיית השיר: " : "ניגון השיר: ") + t;
      if (label) { label.textContent = (p ? "מנגן עכשיו · " : "מושהה · ") + t; label.classList.add("is-track"); }
      back.hidden = false;
    }
  }
  function closed() {
    var st = null; try { st = window.Zmanim ? window.Zmanim.current(CFG.shabbat) : null; } catch (e) {}
    if (!st) return false;
    var n = document.getElementById("notice");
    if (n) { n.hidden = false; n.textContent = st.kind === "shabbat" ? "שבת שלום. השידור חוזר במוצאי שבת." : "חג שמח. השידור חוזר במוצאי החג."; }
    return true;
  }
  function meta(title) {
    try {
      if ("mediaSession" in navigator && window.MediaMetadata)
        navigator.mediaSession.metadata = new MediaMetadata({ title: title, artist: "יואלי דיקמן", album: "DIKMAN FM" });
    } catch (e) {}
  }

  // ---------- שידור חי ----------
  function play() {
    if (!url || closed()) return;
    mode = "live"; track = null;
    on = true; loading = true; ui();
    announce();                                // עוצר רדיו/וידיאו שמנגנים במקום אחר
    audio.src = url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();   // תמיד מהרגע הנוכחי של השידור
    meta("שידור חי · DIKMAN FM");
    audio.play().catch(function () { stop(); });
    document.dispatchEvent(new CustomEvent("dkm:live"));
  }
  function stop() {
    on = false; loading = false;
    try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch (e) {}
    ui();
  }

  // ---------- שיר מהרשימה ----------
  function playTrack(src, title) {
    if (closed()) return false;
    var same = mode === "track" && track && track.src === src;
    mode = "track"; on = false; track = { src: src, title: title };
    if (!same) { audio.src = src; loading = true; }
    announce();
    meta(title);
    ui();
    audio.play().catch(function () { loading = false; ui(); });
    return true;
  }

  audio.addEventListener("playing", function () { loading = false; ui(); });
  audio.addEventListener("play", ui);
  audio.addEventListener("pause", function () { if (mode === "track") { loading = false; ui(); } });
  audio.addEventListener("waiting", function () { if (playing()) { loading = true; ui(); } });
  audio.addEventListener("ended", function () { loading = false; ui(); });
  audio.addEventListener("error", function () { if (mode === "live") { if (on) stop(); } else { loading = false; ui(); } });

  key.addEventListener("click", function () {
    if (mode === "live") { if (on) stop(); else play(); return; }
    if (audio.paused) { if (!closed()) { announce(); audio.play().catch(function () {}); } }
    else audio.pause();
  });
  back.addEventListener("click", function () { audio.pause(); play(); });

  // שבת נכנסה בזמן ההאזנה
  setInterval(function () { if (playing() && closed()) { if (mode === "live") stop(); else audio.pause(); } }, 30000);

  // מסך הנעילה / אוזניות: הרצה קדימה ואחורה בשיר (לא בשידור החי)
  try {
    if ("mediaSession" in navigator) {
      var ms = navigator.mediaSession, dur = function () { return isFinite(audio.duration) ? audio.duration : 0; };
      ms.setActionHandler("seekbackward", function (d) { if (mode === "track") audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 10)); });
      ms.setActionHandler("seekforward", function (d) { if (mode === "track" && dur()) audio.currentTime = Math.min(dur() - 0.5, audio.currentTime + ((d && d.seekOffset) || 10)); });
      ms.setActionHandler("seekto", function (d) { if (mode === "track" && d && isFinite(d.seekTime)) audio.currentTime = d.seekTime; });
    }
  } catch (e) {}

  window.DKMHero = {
    audio: audio,
    playTrack: playTrack,
    pause: function () { if (mode === "live") { if (on) stop(); } else audio.pause(); },
    isTrack: function (src) { return mode === "track" && !!track && track.src === src; }
  };
  ui();
})();
