/* ==========================================================================
   DIKMAN FM – לוגיקת האפליקציה
   JavaScript רגיל, בלי פריימוורק ובלי בנייה: עובד גם בדפדפנים ישנים
   של טלפונים כשרים ומסוננים (Android WebView 60+, iOS Safari 12+).

   המנוע (שידור חי / שידורים חוזרים / ארכיון / שבת / Media Session / מקשים)
   זהה לגרסה הקודמת. השתנתה רק שכבת התצוגה: "הקול הוא הממשק".
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.RADIO_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var audio = $("audio");
  var root = document.documentElement;

  // ---------- אחסון מקומי (עמיד לשגיאות) ----------
  function load(key, def) { try { var v = localStorage.getItem("ngn." + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem("ngn." + key, JSON.stringify(val)); } catch (e) {} }

  var state = {
    mode: null,          // "live" | "replay" | "ep"
    item: null,
    queue: [],
    episodes: [],
    cat: "הכל",
    q: "",
    tab: "live",
    favs: load("favs", []),
    pos: load("pos", {}),
    auto: false,
    bag: load("bag", []),
    liveDownUntil: 0,
    wasLive: false,
    liveTitle: "",
    pendingRadio: false,
    channel: null,
    manualLive: false,
    stopping: false,
    retries: 0,
    closed: null,
    level: [0, 0],       // עוצמת הצליל עכשיו (0..1) לכל ערוץ – מזינה את צורת הגל
    listen: load("listen", {})
  };

  // ---------- עזרים ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }
  function fmtDuration(sec) {
    var m = Math.round(sec / 60);
    if (m < 60) return m + " דק׳";
    return Math.floor(m / 60) + ":" + pad(m % 60) + " שע׳";
  }
  var dateFmt = null, thisYear = new Date().getFullYear();
  try { dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }); } catch (e) {}
  function fmtDate(s) {
    var p = s.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (+p[0] !== thisYear) return (+p[2]) + "." + p[1] + "." + p[0].slice(2);
    return dateFmt ? dateFmt.format(d) : d.getDate() + "/" + (d.getMonth() + 1);
  }
  // כותרת נקייה לתצוגה: בלי התאריך שבתחילת הפוסט (הוא מוצג בנפרד)
  function cleanTitle(t) {
    return String(t || "").replace(/^\s*\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\s*[-–:|]?\s*/, "").replace(/\s*\|\s*האזינו\s*>+\s*$/, "").trim() || t;
  }
  function gematria(n) {
    if (n === 15) return "ט״ו"; if (n === 16) return "ט״ז";
    var tens = ["", "י", "כ", "ל"], ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
    var s = tens[Math.floor(n / 10)] + ones[n % 10];
    return s.length > 1 ? s.slice(0, -1) + "״" + s.slice(-1) : s + "׳";
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }

  // ---------- שעון ותאריך עברי (תמיד שעון ישראל) ----------
  var hebFmt = null, clockFmt = null;
  try { hebFmt = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long" }); } catch (e) {}
  try { clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); } catch (e) {}
  function tickClock() {
    var now = new Date();
    $("clock").textContent = clockFmt ? clockFmt.format(now) : pad(now.getHours()) + ":" + pad(now.getMinutes());
    if (hebFmt && hebFmt.formatToParts) {
      $("hebdate").textContent = hebFmt.formatToParts(now).map(function (p) { return p.type === "day" ? gematria(+p.value) : p.value; }).join("");
    }
  }

  // ---------- עוצמת הצליל (מזינה את צורת הגל ב-voice.js) ----------
  var analysers = null, actx = null;
  function setupAnalysers() {
    if (analysers || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      var src = actx.createMediaElementSource(audio);
      var split = actx.createChannelSplitter(2);
      var l = actx.createAnalyser(), r = actx.createAnalyser();
      l.fftSize = r.fftSize = 1024;
      src.connect(split); split.connect(l, 0); split.connect(r, 1);
      src.connect(actx.destination);
      analysers = [l, r];
    } catch (e) { analysers = null; }
  }
  var buf = new Float32Array(1024);
  function rms(an) {
    if (an.getFloatTimeDomainData) an.getFloatTimeDomainData(buf);
    var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  function levelLoop(t) {
    var playing = !audio.paused && !audio.ended && audio.readyState > 2;
    for (var ch = 0; ch < 2; ch++) {
      var target = 0;
      if (playing) {
        if (analysers) {
          var db = 20 * Math.log(Math.max(rms(analysers[ch]), 1e-5)) / Math.LN10 + 18;
          target = Math.max(0, Math.min(1, (db + 24) / 27));
        } else {
          // תנועה מדומה (בלי CORS אין גישה לנתוני השמע): פעימה, משפט, נשימה
          var x = t / 1000 + ch * .9;
          var beat = Math.pow(Math.max(0, Math.sin(x * Math.PI * 2 * 1.05)), 6) * .22;
          target = .46 + .16 * Math.sin(x * 2.1) + .09 * Math.sin(x * 5.3 + ch) + beat + (Math.random() - .5) * .14;
          target = Math.max(0, Math.min(1, target));
        }
      }
      var k = target > state.level[ch] ? .4 : .09;
      state.level[ch] += (target - state.level[ch]) * k;
    }
    requestAnimationFrame(levelLoop);
  }

  // ---------- התצוגה הראשית ----------
  function setHeadline(text) {
    var h = $("headline");
    if (h.getAttribute("data-text") === text) return;
    h.setAttribute("data-text", text);
    if (window.FX && FX.swapHeadline) FX.swapHeadline(h, text);
    else h.innerHTML = "<span>" + esc(text) + "</span>";
    // כותרת ארוכה – גופן קטן יותר, כדי שתמיד תיכנס בשתי שורות לכל היותר
    h.classList.toggle("long", text.length > 12);
    h.classList.toggle("xlong", text.length > 20);
  }

  var STATUS = { live: "משדר חי", replay: "שידור חוזר", ep: "מהארכיון" };
  function updateDeck() {
    var it = state.item, m = state.mode, st = schedStatus();
    root.setAttribute("data-mode", m || (st.live ? "idle-live" : "idle"));
    if (!it) {
      $("kicker").textContent = st.live ? CFG.live.stationLabel : CFG.stationName + " · שידורים חוזרים";
      setHeadline(st.live ? "שידור חי" : "המיטב מהארכיון");
      $("subline").textContent = st.live ? CFG.live.program + " · הקישו על נגן" : "הקישו על נגן כדי להאזין";
    } else if (m === "live") {
      $("kicker").textContent = CFG.live.stationLabel;
      setHeadline("שידור חי");
      $("subline").textContent = state.liveTitle || CFG.live.program;
    } else {
      $("kicker").textContent = (m === "replay" ? "שידור חוזר · " : "") + fmtDate(it.date) + " · " + fmtDuration(it.duration);
      setHeadline(it.category || CFG.stationName);
      $("subline").textContent = cleanTitle(it.title);
    }
    var showWave = (m === "ep" || m === "replay") && !!it;
    $("seekwave").hidden = !showWave;
    if (showWave) buildSeekWave(it.id);
    $("btnBack").disabled = $("btnFwd").disabled = !showWave;
    markActive();
    markSources();
    setMediaSession();
    setPlayUI();
    updateMini();
  }

  function setPlayUI() {
    var playing = !audio.paused, m = state.mode, liveNow = schedStatus().live;
    [$("btnPlay"), $("miniPlay")].forEach(function (b) {
      b.classList.toggle("is-playing", playing);
      b.setAttribute("aria-label", playing ? "השהה" : "נגן");
    });
    root.classList.toggle("is-playing", playing);
    var liveOn = playing && m === "live";
    $("status").classList.toggle("is-live", liveOn || (!playing && liveNow));
    $("statusText").textContent = playing ? (STATUS[m] || "מנגן") : liveNow ? "חי עכשיו" : "מוכן";
    try { document.dispatchEvent(new CustomEvent("radio:update")); } catch (e) {}
  }
  function setLoading(on) { $("btnPlay").classList.toggle("is-loading", !!on); }

  // ---------- צורת הגל של ההקלטה = פס ההתקדמות ----------
  function hashId(id) {
    var h = 2166136261, s = String(id);
    for (var c = 0; c < s.length; c++) { h ^= s.charCodeAt(c); h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619) | 0; }
    return h;
  }
  // צורת גל קבועה לכל הקלטה (נגזרת מהמזהה). n עמודות, גובה 0..1
  function waveData(id, n) {
    var h = hashId(id), out = [];
    for (var i = 0; i < n; i++) {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      var env = .5 + .5 * Math.sin(i / (n - 1) * Math.PI);
      var phr = .75 + .25 * Math.sin(i / n * Math.PI * 7 + (hashId(id) % 7));
      out.push(Math.max(.12, env * phr * (.4 + ((h >>> 0) % 1000) / 1650)));
    }
    return out;
  }
  function waveSVG(id, n, h) {
    var d = waveData(id, n), bars = "";
    for (var i = 0; i < n; i++) {
      var bh = (d[i] * h).toFixed(1);
      // RTL: העמודה הראשונה (תחילת ההקלטה) בימין
      bars += '<rect x="' + ((n - 1 - i) * 3) + '" y="' + ((h - bh) / 2).toFixed(1) + '" width="1.8" height="' + bh + '" rx=".9"/>';
    }
    return '<svg viewBox="0 0 ' + (n * 3 - 1.2) + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>';
  }
  var builtWave = "";
  function buildSeekWave(id) {
    if (builtWave === id) return;
    builtWave = id;
    var svg = waveSVG(id, 110, 40);
    $("swDim").innerHTML = svg; $("swLit").innerHTML = svg;
    updateProgress();
  }
  function updateProgress() {
    if (state.mode === "live" || !state.item) return;
    var d = audio.duration, c = audio.currentTime;
    if (!isFinite(d) || d <= 0) { d = state.item.duration || 0; c = audio.currentTime || state.pos[state.item.id] || 0; }
    var p = d > 0 ? Math.min(100, c / d * 100) : 0;
    $("swLit").style.clipPath = "inset(0 0 0 " + (100 - p).toFixed(2) + "%)";
    $("swLit").style.webkitClipPath = $("swLit").style.clipPath;
    $("swHead").style.insetInlineStart = p.toFixed(2) + "%";
    $("swHead").style.right = p.toFixed(2) + "%";
    $("swTrack").setAttribute("aria-valuenow", Math.round(p));
    $("swTrack").setAttribute("aria-valuetext", fmtTime(c) + " מתוך " + fmtTime(d));
    $("tCur").textContent = fmtTime(c);
    $("tDur").textContent = fmtTime(d);
  }

  // ---------- לוח שידורים ----------
  function schedStatus() {
    var st = window.Schedule.status(CFG);
    if (location.hash === "#live-preview") { st.live = true; st.endsInMin = 45; }
    return st;
  }
  function liveAvailable() { return !!(CFG.live.url || CFG.demo) && Date.now() > state.liveDownUntil; }

  // ---------- השמעה ----------
  function srcFor(ep) { return ep.url || (CFG.demo ? window.DemoAudio.url(ep.id, 44) : ""); }

  function start(src, opts) {
    state.stopping = false;
    audio.loop = !!(opts && opts.loop);
    audio.src = src;
    setLoading(true);
    if (CFG.realMeters || src.indexOf("blob:") === 0) setupAnalysers();
    if (actx && actx.state === "suspended") actx.resume();
    var p = audio.play();
    if (p && p.catch) p.catch(function (err) {
      setLoading(false);
      if (err && err.name === "NotAllowedError") toast("הקישו על נגן כדי להתחיל");
      else if (err && err.name !== "AbortError") toast("לא ניתן לנגן כרגע");
    });
  }

  function liveSrc() {
    if (!CFG.live.url) return window.DemoAudio.url("live-demo", 32);
    var u = CFG.live.url;
    if (/\.m3u8(\?|$)/.test(u) && !audio.canPlayType("application/vnd.apple.mpegurl")) {
      toast("פורמט HLS דורש תמיכה נוספת במכשיר זה");
    }
    return u + (u.indexOf("?") > -1 ? "&" : "?") + "_=" + Date.now();
  }

  function playRadio() {
    if (guardClosed()) return;
    state.channel = null; state.manualLive = false;
    if (schedStatus().live && liveAvailable()) playLiveNow();
    else playReplayNext();
  }

  function playLiveNow(manual) {
    if (guardClosed()) return;
    state.mode = "live"; state.auto = !manual; state.retries = 0; state.manualLive = !!manual;
    if (manual) state.channel = null;
    state.item = { id: "live", title: CFG.live.program };
    updateDeck();
    start(liveSrc(), { loop: !CFG.live.url });
  }

  function rotationPool() {
    var c = state.channel || CFG.rotation.category;
    return state.episodes.filter(function (ep) { return !c || ep.category === c; });
  }
  function nextFromBag() {
    var pool = rotationPool();
    if (!pool.length) return null;
    var ids = pool.map(function (e) { return e.id; });
    state.bag = state.bag.filter(function (id) { return ids.indexOf(id) > -1; });
    if (!state.bag.length) {
      state.bag = ids.slice();
      if (CFG.rotation.shuffle) for (var i = state.bag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = state.bag[i]; state.bag[i] = state.bag[j]; state.bag[j] = t; }
      if (state.bag.length > 1 && state.item && state.bag[0] === state.item.id) state.bag.push(state.bag.shift());
    }
    var id = state.bag.shift(); save("bag", state.bag);
    return pool.filter(function (e) { return e.id === id; })[0];
  }

  function playReplayNext(tries) {
    if (guardClosed()) return;
    tries = typeof tries === "number" ? tries : 0;
    var ep = nextFromBag();
    if (!ep) { toast("הארכיון עדיין נטען…"); state.pendingRadio = true; return; }
    var src = srcFor(ep);
    if (!src) {
      state.item = ep;
      if (tries < rotationPool().length) playReplayNext(tries + 1);
      else { setLoading(false); toast("אין כרגע הקלטות זמינות להשמעה"); }
      return;
    }
    state.mode = "replay"; state.auto = true; state.item = ep; state.queue = rotationPool();
    updateDeck();
    start(src);
  }

  function playEpisode(ep, queue, opts) {
    if (guardClosed()) return;
    var src = srcFor(ep);
    if (!src) { toast("הקובץ עדיין לא זמין"); return; }
    state.mode = "ep"; state.auto = false; state.item = ep; state.queue = queue || state.episodes;
    state.autoNext = !!(opts && opts.autoNext);
    updateDeck();
    var resume = state.pos[ep.id] || 0;
    var once = function () {
      audio.removeEventListener("loadedmetadata", once);
      if (resume > 5 && isFinite(audio.duration) && resume < audio.duration - 10) audio.currentTime = resume;
    };
    audio.addEventListener("loadedmetadata", once);
    start(src);
  }

  function stopAudio() {
    state.stopping = true;
    audio.pause();
    if (state.mode === "live" && CFG.live.url) { audio.removeAttribute("src"); audio.load(); }
  }

  function togglePlay() {
    if (!audio.paused) { stopAudio(); return; }
    if (guardClosed()) return;
    var st = schedStatus();
    if (!state.item || state.mode === "live" || (state.auto && st.live && liveAvailable())) {
      if (state.mode === "live" && state.manualLive) { playLiveNow(true); return; }
      playRadio(); return;
    }
    if (actx && actx.state === "suspended") actx.resume();
    var p = audio.play(); if (p && p.catch) p.catch(function () {});
  }

  function seek(delta) {
    if (state.mode === "live" || !isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration - 0.5, audio.currentTime + delta));
  }

  function step(dir) {
    if (state.mode === "live") return;
    if (state.mode === "replay" && dir > 0) { playReplayNext(); return; }
    var q = state.queue, i = q.indexOf(state.item);
    if (i < 0 || !q.length) return;
    playEpisode(q[(i + dir + q.length) % q.length], q, { autoNext: state.autoNext });
  }

  // מעבר אוטומטי בין שידור חי לשידורים חוזרים – נבדק כל 10 שניות
  function tickSchedule() {
    var st = schedStatus(), playing = !audio.paused || $("btnPlay").classList.contains("is-loading");
    var liveNow = st.live && liveAvailable();
    if (playing) {
      if (liveNow && state.mode !== "live" && (state.auto || !state.wasLive)) {
        toast("עוברים לשידור החי");
        playLiveNow();
      } else if (!st.live && state.mode === "live" && !state.manualLive) {
        toast("השידור החי הסתיים – ממשיכים בשידורים חוזרים");
        playReplayNext();
      }
    }
    state.wasLive = st.live;
    renderNow(st);
    if (!state.item) updateDeck();
    setPlayUI();
  }

  // אירועי נגן
  audio.addEventListener("playing", function () { setLoading(false); state.retries = 0; setPlayUI(); });
  audio.addEventListener("pause", setPlayUI);
  audio.addEventListener("waiting", function () { setLoading(true); });
  audio.addEventListener("canplay", function () { setLoading(false); });
  var lastSave = 0;
  audio.addEventListener("timeupdate", function () {
    updateProgress();
    if (state.mode === "ep" && Date.now() - lastSave > 4000) {
      lastSave = Date.now();
      state.pos[state.item.id] = Math.floor(audio.currentTime);
      save("pos", state.pos);
      var bar = document.querySelector('.track.is-active .tw');
      if (bar && audio.duration) bar.style.setProperty("--p", (audio.currentTime / audio.duration * 100).toFixed(1) + "%");
    }
  });

  // ---------- יומן האזנה (רק במכשיר, מזין את לשונית "נתונים") ----------
  var lastTick = 0, lastListenSave = 0;
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function logListen() {
    var now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (audio.paused || !state.item || dt <= 0 || dt > 3) return;
    var k = dayKey(new Date()), day = state.listen[k] || (state.listen[k] = { t: 0, c: {} });
    var src = state.mode === "live" ? "LIVE" : (state.item.category || "אחר");
    day.t += dt; day.c[src] = (day.c[src] || 0) + dt;
    if (now - lastListenSave > 10000) {
      lastListenSave = now;
      var keys = Object.keys(state.listen).sort();
      while (keys.length > 90) delete state.listen[keys.shift()];
      save("listen", state.listen);
    }
  }
  audio.addEventListener("timeupdate", logListen);
  audio.addEventListener("playing", function () { lastTick = Date.now(); });
  audio.addEventListener("pause", function () { save("listen", state.listen); });

  audio.addEventListener("ended", function () {
    if (state.mode === "ep") { delete state.pos[state.item.id]; save("pos", state.pos); }
    if (state.mode === "ep" && state.autoNext) {
      var qi = state.queue.indexOf(state.item);
      if (qi > -1 && qi < state.queue.length - 1) { playEpisode(state.queue[qi + 1], state.queue, { autoNext: true }); return; }
      state.autoNext = false;
    }
    if (state.mode !== "live") {
      if (state.channel && !(schedStatus().live && liveAvailable())) playReplayNext(); else playRadio();
    }
  });
  audio.addEventListener("error", function () {
    if (state.stopping || !state.item) return;
    setLoading(false);
    if (state.mode === "live") {
      if (state.retries < 3) {
        state.retries++;
        toast("מתחבר מחדש לשידור…");
        setTimeout(function () { if (!state.stopping && state.mode === "live") start(liveSrc()); }, 1500 * state.retries);
      } else {
        state.liveDownUntil = Date.now() + 120000;
        toast("השידור החי אינו זמין כרגע – ממשיכים בשידורים חוזרים");
        playReplayNext();
      }
    } else if (state.mode === "replay") {
      playReplayNext();
    } else {
      toast("לא ניתן לטעון את ההקלטה");
      setPlayUI();
    }
  });

  // ---------- Media Session (מסך נעילה, אוזניות, רכב) ----------
  function setMediaSession() {
    if (!("mediaSession" in navigator) || !state.item) return;
    var live = state.mode === "live", it = state.item;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: live ? (state.liveTitle || CFG.live.program) : cleanTitle(it.title),
        artist: live ? CFG.live.stationLabel : CFG.stationName,
        album: live ? "שידור חי" : (state.mode === "replay" ? "שידור חוזר" : it.category),
        artwork: [{ src: new URL("icons/icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }]
      });
    } catch (e) {}
  }
  if ("mediaSession" in navigator) {
    var ms = navigator.mediaSession;
    var set = function (a, fn) { try { ms.setActionHandler(a, fn); } catch (e) {} };
    set("play", togglePlay); set("pause", togglePlay); set("stop", stopAudio);
    set("previoustrack", function () { step(-1); }); set("nexttrack", function () { step(1); });
    set("seekbackward", function () { seek(-15); }); set("seekforward", function () { seek(15); });
  }

  // ---------- מקור ההאזנה (במקום המיקסר) ----------
  function currentSource() {
    if (!state.item) return "auto";
    if (state.mode === "live") return state.manualLive ? "live" : "auto";
    if (state.mode === "replay") return state.channel || "auto";
    return "";                              // הקלטה שנבחרה מהארכיון
  }
  function markSources() {
    var cur = currentSource();
    Array.prototype.forEach.call(document.querySelectorAll(".src"), function (b) {
      b.setAttribute("aria-checked", b.getAttribute("data-src") === cur);
    });
  }
  document.querySelector(".sources").addEventListener("click", function (e) {
    var b = e.target.closest("[data-src]"); if (!b) return;
    var s = b.getAttribute("data-src");
    if (s === currentSource() && state.item) { togglePlay(); return; }
    if (s === "auto") playRadio();
    else if (s === "live") playLiveNow(true);
    else { if (guardClosed()) return; state.channel = s; state.bag = []; state.manualLive = false; playReplayNext(); }
  });

  // ---------- היום ברצועה אחת ----------
  var DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  function hm(min) { min = Math.round(min) % 1440; return pad(Math.floor(min / 60)) + ":" + pad(min % 60); }
  function countdown(min) {
    min = Math.ceil(min);
    if (min < 60) return "בעוד " + min + " דק׳";
    if (min < 1440) return "בעוד " + Math.floor(min / 60) + ":" + pad(min % 60) + " שע׳";
    var d = Math.floor(min / 1440);
    return d === 1 ? "בעוד יום" : "בעוד " + d + " ימים";
  }
  function whenLabel(w, nowMin) {
    var today = Math.floor(nowMin / 1440), from = w.start % 1440;
    if (w.day === today) return "היום ב-" + hm(from);
    if (w.day === (today + 1) % 7) return (from < 360 ? "הלילה ב-" : "מחר ב-") + hm(from);
    return "ביום " + DAY_NAMES[w.day] + " ב-" + hm(from);
  }
  function rowTitle(w) { var from = w.start % 1440; return from < 360 ? "ליל " + DAY_NAMES[(w.day + 6) % 7] : "יום " + DAY_NAMES[w.day]; }

  (function buildDayScale() {
    var ticks = "", labels = "";
    for (var h = 0; h <= 24; h++) {
      var p = (h / 24 * 100).toFixed(3) + "%";
      ticks += '<i class="' + (h % 6 === 0 ? "major" : "") + '" style="inset-inline-start:' + p + '"></i>';
      if (h % 6 === 0) labels += '<span style="inset-inline-start:' + p + '">' + pad(h) + '</span>';
    }
    $("dayHours").innerHTML = ticks;
    $("dayLabels").innerHTML = labels;
  })();

  var WEEK_MIN = 7 * 1440, dayKeyStr = "";
  function renderNow(st) {
    st = st || schedStatus();
    var m = window.Schedule.weekMinute();
    var ws = window.Schedule.windows(CFG).sort(function (a, b) { return a.start - b.start; });
    var today = Math.floor(m / 1440), d0 = today * 1440, d1 = d0 + 1440;
    $("dayName").textContent = "יום " + DAY_NAMES[today];
    $("nextLive").innerHTML = st.live ? "<b>חי עכשיו</b> · מסתיים " + esc(countdown(st.endsInMin)) :
      st.next ? "החי הבא <b>" + esc(whenLabel(st.next, m)) + "</b> · " + esc(countdown(st.nextInMin)) : "";
    var bands = [];
    ws.forEach(function (w) {
      [-WEEK_MIN, 0, WEEK_MIN].forEach(function (shift) {
        var s = Math.max(w.start + shift, d0), e = Math.min(w.end + shift, d1);
        if (e > s) bands.push({ s: s - d0, e: e - d0, state: m >= w.start + shift && m < w.end + shift ? "on" : m >= w.end + shift ? "past" : "next" });
      });
    });
    var key = bands.map(function (b) { return b.s + "-" + b.e + b.state; }).join("|");
    if (key !== dayKeyStr) {
      dayKeyStr = key;
      $("dayBands").innerHTML = bands.map(function (b) {
        return '<span class="band ' + b.state + '" style="inset-inline-start:' + (b.s / 14.4).toFixed(3) + '%;width:' + ((b.e - b.s) / 14.4).toFixed(3) + '%"><em class="mono">' + hm(b.s) + '</em></span>';
      }).join("");
      $("day").setAttribute("aria-label", "השידורים של היום: " + (bands.length ? bands.map(function (b) { return "שידור חי " + hm(b.s) + " עד " + hm(b.e); }).join(", ") : "אין שידור חי היום, שידורים חוזרים כל היום"));
    }
    var p = (m - d0) / 14.4;
    $("dayNow").style.insetInlineStart = p.toFixed(3) + "%";
    $("dayNow").style.right = p.toFixed(3) + "%";
    $("dayNow").setAttribute("data-t", hm(m));
    $("schedList").innerHTML = ws.map(function (w) {
      var on = m >= w.start && m < w.end, isNext = !st.live && st.next === w;
      return '<li class="' + (on ? "on" : isNext ? "next" : "") + '"><span>' + esc(rowTitle(w)) + '</span><span class="mono">' + hm(w.start % 1440) + '–' + hm(w.end % 1440) + '</span><em>' + (on ? "חי עכשיו" : isNext ? "הבא" : "") + '</em></li>';
    }).join("");
  }

  // "מתנגן עכשיו" בשידור החי (Icecast)
  function pollNowPlaying() {
    if (!CFG.live.nowPlaying || !window.fetch) return;
    fetch(CFG.live.nowPlaying, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      var src = j.icestats && j.icestats.source; if (Array.isArray(src)) src = src[0];
      var title = src && src.title;
      if (title && title !== state.liveTitle) { state.liveTitle = title; if (state.mode === "live") updateDeck(); }
    }).catch(function () {});
  }

  // ---------- ארכיון: יומן לפי שנים, כל הקלטה עם צורת הגל שלה ----------
  var ICON_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2l2.3 4.8 5.2.7-3.8 3.7.9 5.2L12 16.1l-4.6 2.5.9-5.2-3.8-3.7 5.2-.7z"/></svg>';
  var waveCache = {};
  function miniWave(id) { return waveCache[id] || (waveCache[id] = waveSVG(id, 48, 18)); }
  function trackHTML(ep) {
    var fav = state.favs.indexOf(ep.id) > -1;
    var pos = state.pos[ep.id] || 0, pct = ep.duration ? Math.min(100, pos / ep.duration * 100) : 0;
    var w = miniWave(ep.id);
    return '<li class="track" data-ep="' + esc(ep.id) + '">' +
      '<button class="track-main" data-nav data-act="play">' +
        '<span class="td mono">' + esc(fmtDate(ep.date)) + '</span>' +
        '<span class="tt">' + esc(cleanTitle(ep.title)) + '</span>' +
        '<span class="tm"><b data-cat="' + esc(ep.category) + '">' + esc(ep.category) + '</b> · ' + fmtDuration(ep.duration) + (pct > 1 && pct < 99 ? ' · <i>הושמעו ' + Math.round(pct) + '%</i>' : '') + '</span>' +
        '<span class="tw" style="--p:' + pct.toFixed(1) + '%">' + w + '<span class="tw-lit">' + w + '</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
      '</button>' +
      '<button class="fav" data-nav data-act="fav" aria-pressed="' + fav + '" aria-label="' + (fav ? "הסרה מהשמורים" : "שמירה") + '">' + ICON_STAR + '</button>' +
      '</li>';
  }
  // שורות עם כותרת שנה כשהשנה מתחלפת
  function listHTML(list) {
    var out = "", year = "";
    list.forEach(function (ep) {
      var y = (ep.date || "").slice(0, 4);
      if (y !== year) { year = y; out += '<li class="yr" aria-hidden="true"><span>' + esc(y) + '</span></li>'; }
      out += trackHTML(ep);
    });
    return out;
  }
  function filtered() {
    var q = state.q.trim();
    return state.episodes.filter(function (ep) {
      return (state.cat === "הכל" || ep.category === state.cat) && (!q || ep.title.indexOf(q) > -1 || ep.category.indexOf(q) > -1 || (ep.date || "").indexOf(q) > -1);
    });
  }
  var PAGE = 60, shown = PAGE;
  function renderArchive(keep) {
    if (!keep) shown = PAGE;
    var list = filtered(), page = list.slice(0, shown);
    $("trackList").innerHTML = listHTML(page) || '<li class="empty"><b>לא נמצאו הקלטות</b><span>נסו מילה אחרת, או בחרו "הכל".</span></li>';
    var meta = $("archiveMeta");
    if (!list.length) meta.innerHTML = "";
    else if (list.length > shown) meta.innerHTML = '<button class="more" id="btnMore" data-nav>עוד הקלטות</button><span>' + shown + ' מתוך ' + list.length.toLocaleString("he-IL") + '</span>';
    else meta.innerHTML = '<span>' + list.length.toLocaleString("he-IL") + ' הקלטות</span>';
    markActive();
    document.dispatchEvent(new CustomEvent("radio:list", { detail: $("trackList") }));
  }
  $("archiveMeta").addEventListener("click", function (e) {
    if (!e.target.closest("#btnMore")) return;
    shown += PAGE; renderArchive(true);
  });
  function favEpisodes() {
    return state.favs.map(function (id) { return state.episodes.filter(function (ep) { return ep.id === id; })[0]; }).filter(Boolean);
  }
  function renderFavs() {
    var list = favEpisodes();
    $("favList").innerHTML = list.map(trackHTML).join("") ||
      '<li class="empty"><b>עוד אין כאן הקלטות</b><span>הקישו על הכוכב ליד הקלטה בארכיון, והיא תחכה לכם כאן, מוכנה לניגון ברצף.</span>' +
      '<button class="more" data-nav data-goto="archive">לארכיון</button></li>';
    $("btnFavPlay").hidden = !list.length;
    var total = list.reduce(function (s, ep) { return s + (ep.duration || 0); }, 0);
    $("favMeta").textContent = list.length ? list.length.toLocaleString("he-IL") + (list.length === 1 ? " הקלטה" : " הקלטות") + " · " + fmtDuration(total) : "";
    markActive();
  }
  $("favList").addEventListener("click", function (e) { if (e.target.closest("[data-goto=archive]")) setTab("archive", true); });
  $("btnFavPlay").addEventListener("click", function () {
    var list = favEpisodes(); if (!list.length) return;
    playEpisode(list[0], list, { autoNext: true });
    toast("מנגנים את השמורים ברצף");
  });
  function renderChips() {
    var cats = ["הכל"];
    state.episodes.forEach(function (ep) { if (cats.indexOf(ep.category) < 0) cats.push(ep.category); });
    $("chips").innerHTML = cats.map(function (c) {
      var n = c === "הכל" ? state.episodes.length : state.episodes.filter(function (e) { return e.category === c; }).length;
      return '<button class="chip" data-nav data-cat="' + esc(c) + '" aria-pressed="' + (c === state.cat) + '">' + esc(c) + '<small class="mono">' + n + '</small></button>';
    }).join("");
  }
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cat]"); if (!b) return;
    state.cat = b.getAttribute("data-cat"); renderChips(); renderArchive();
  });
  var qTimer;
  $("q").addEventListener("input", function (e) { clearTimeout(qTimer); qTimer = setTimeout(function () { state.q = e.target.value; renderArchive(); }, 150); });

  function onTrackClick(e, getQueue) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var id = b.closest("[data-ep]").getAttribute("data-ep");
    var ep = state.episodes.filter(function (x) { return x.id === id; })[0]; if (!ep) return;
    if (b.getAttribute("data-act") === "fav") {
      var i = state.favs.indexOf(id);
      if (i > -1) state.favs.splice(i, 1); else state.favs.unshift(id);
      save("favs", state.favs);
      b.setAttribute("aria-pressed", i < 0);
      b.setAttribute("aria-label", i < 0 ? "הסרה מהשמורים" : "שמירה");
      toast(i < 0 ? "נשמר בשמורים" : "הוסר מהשמורים");
      if (state.tab === "fav") {
        var row = b.closest(".track");
        if (window.FX && FX.leave && row) FX.leave(row, renderFavs); else renderFavs();
      }
      return;
    }
    if (state.item === ep) togglePlay(); else playEpisode(ep, getQueue());
  }
  $("trackList").addEventListener("click", function (e) { onTrackClick(e, filtered); });
  $("favList").addEventListener("click", function (e) { onTrackClick(e, favEpisodes); });

  function markActive() {
    var id = state.item && state.item.id;
    Array.prototype.forEach.call(document.querySelectorAll(".track"), function (li) {
      li.classList.toggle("is-active", (state.mode === "ep" || state.mode === "replay") && li.getAttribute("data-ep") === id);
    });
  }

  function loadEpisodes() {
    var cached = load("episodes", null);
    if (cached) { state.episodes = cached; renderChips(); renderArchive(); }
    if (!window.fetch) return;
    fetch(CFG.episodesUrl, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      state.episodes = (j.items || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      save("episodes", state.episodes);
      renderChips(); renderArchive(); if (state.tab === "fav") renderFavs();
      document.dispatchEvent(new CustomEvent("radio:data"));
      if (state.pendingRadio) { state.pendingRadio = false; playRadio(); }
    }).catch(function () { if (!cached) $("archiveMeta").textContent = "הארכיון אינו זמין כרגע"; });
  }

  // ---------- נגן מוקטן (בשאר הלשוניות) ----------
  function updateMini() {
    var it = state.item, show = !!it && state.tab !== "live";
    $("mini").hidden = !show;
    root.classList.toggle("has-mini", show);
    if (!it) return;
    $("miniTitle").textContent = state.mode === "live" ? "שידור חי · " + CFG.live.stationLabel : it.category || CFG.stationName;
    $("miniSub").textContent = state.mode === "live" ? (state.liveTitle || CFG.live.program) : cleanTitle(it.title);
  }
  $("miniPlay").addEventListener("click", togglePlay);
  $("miniOpen").addEventListener("click", function () { setTab("live", true); });

  // ---------- לשוניות ----------
  var TABS = ["live", "archive", "fav", "stats"];
  function setTab(name, focus) {
    var prev = state.tab;
    state.tab = name;
    TABS.forEach(function (t) {
      var b = $("tab-" + t), on = t === name;
      b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
      $("panel-" + t).hidden = !on;
      if (on && focus) b.focus();
    });
    root.setAttribute("data-tab", name);
    if (name === "fav") renderFavs();
    if (name === "stats") document.dispatchEvent(new CustomEvent("radio:data"));
    updateMini();
    save("tab", name);
    if (prev !== name) { try { document.dispatchEvent(new CustomEvent("radio:tab", { detail: name })); } catch (e) {} }
    if (prev !== name && window.scrollTo) window.scrollTo(0, 0);
  }
  document.querySelector(".tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) setTab(b.getAttribute("data-tab")); });
  document.querySelector(".tabs").addEventListener("keydown", function (e) {
    var i = TABS.indexOf(state.tab);
    if (e.key === "ArrowLeft") { setTab(TABS[(i + 1) % TABS.length], true); e.preventDefault(); }
    if (e.key === "ArrowRight") { setTab(TABS[(i + TABS.length - 1) % TABS.length], true); e.preventDefault(); }
  });

  // ---------- פקדים ----------
  $("btnPlay").addEventListener("click", togglePlay);
  $("btnBack").addEventListener("click", function () { seek(-15); });
  $("btnFwd").addEventListener("click", function () { seek(15); });

  var track = $("swTrack");
  function seekFromPointer(x) {
    var r = track.getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (r.right - x) / r.width)); // RTL: תחילת ההקלטה בימין
    if (isFinite(audio.duration)) { audio.currentTime = f * audio.duration; updateProgress(); }
  }
  var dragging = false;
  track.addEventListener("pointerdown", function (e) { dragging = true; try { track.setPointerCapture(e.pointerId); } catch (x) {} seekFromPointer(e.clientX); });
  track.addEventListener("pointermove", function (e) { if (dragging) seekFromPointer(e.clientX); });
  track.addEventListener("pointerup", function () { dragging = false; });
  track.addEventListener("pointercancel", function () { dragging = false; });
  track.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { seek(5); e.preventDefault(); e.stopPropagation(); }
    if (e.key === "ArrowRight") { seek(-5); e.preventDefault(); e.stopPropagation(); }
  });

  // עוצמה. ב-iOS העוצמה נשלטת רק מכפתורי המכשיר – לכן מסתירים אותה.
  var vol = $("vol");
  function applyVol() {
    audio.volume = vol.value / 100;
    $("volVal").textContent = vol.value;
    vol.style.setProperty("--p", vol.value + "%");
    save("vol", +vol.value);
  }
  vol.value = load("vol", 85);
  vol.addEventListener("input", applyVol);
  applyVol();
  (function detectFixedVolume() {
    var before = audio.volume; audio.volume = 0.5;
    var fixed = audio.volume !== 0.5; audio.volume = before;
    if (fixed) { $("volume").hidden = true; root.classList.add("fixed-volume"); }
  })();

  // ---------- מקלדת / מקשי טלפון כשר ----------
  function navItems() {
    return Array.prototype.filter.call(document.querySelectorAll("[data-nav], .tabs [aria-selected=true], .play, .tbtn, #q, #vol, #swTrack, .mini-play"), function (n) {
      return !n.disabled && n.offsetParent !== null;
    });
  }
  document.addEventListener("keydown", function (e) {
    var tag = e.target.tagName, typing = tag === "INPUT" && e.target.type !== "range";
    if (e.key === "MediaPlayPause") { togglePlay(); return; }
    if (typing) { if (e.key === "Escape") e.target.blur(); return; }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey) { setTab("archive"); $("q").focus(); e.preventDefault(); return; }
    switch (e.key) {
      case "5": case " ": if (e.target.tagName !== "BUTTON" || e.key === "5") { togglePlay(); e.preventDefault(); } break;
      case "4": seek(-15); break;
      case "6": seek(15); break;
      case "2": step(-1); break;
      case "8": step(1); break;
      case "ArrowDown": case "ArrowUp":
        if (tag === "INPUT") return;
        var items = navItems(), i = items.indexOf(document.activeElement);
        var n = items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
        if (n) { n.focus(); if (n.scrollIntoView) n.scrollIntoView({ block: "nearest" }); }
        e.preventDefault();
        break;
    }
  });

  // ---------- שבת וחג ----------
  function guardClosed() {
    if (state.closed) { toast("השידורים מושבתים כעת"); return true; }
    return false;
  }
  // החסימה לפי האזור של הגולש (ישראל / ניו יורק) – js/zmanim.js
  function checkClosed() {
    var Z = window.Zmanim, st = Z.current(CFG.shabbat), was = !!state.closed, el = $("shabbat");
    state.closed = st;
    root.classList.toggle("is-closed", !!st);
    if (!st) {
      if (was && !el.hidden) {   // צאת שבת: המסך נעלם בעדינות, והאפליקציה חוזרת לפעול
        el.classList.add("is-leaving");
        setTimeout(function () { if (!state.closed) { el.hidden = true; el.classList.remove("is-leaving"); } }, 700);
      } else el.hidden = true;
      return;
    }
    el.classList.remove("is-leaving");
    el.hidden = false;
    if (!was || !audio.paused) stopAudio();      // כניסת שבת: עוצרים מיד כל ניגון
    var holiday = st.kind === "holiday";
    var inT = Z.hm(st.realSince || st.since, st.tz), outT = Z.hm(st.realUntil || st.until, st.tz);
    $("shabbatTitle").textContent = holiday ? "חג שמח" : "שבת שלום";
    $("shabbatText").textContent = holiday ? "השידורים מושבתים בחג" + (st.name ? " " + st.name : "") + " ויחודשו בצאת החג." : "השידורים מושבתים בשבת ויחודשו במוצאי שבת.";
    $("shabbatTime").textContent = (holiday ? "בצאת החג, " : "במוצאי שבת, ") + outT;
    var reg = $("shabbatRegion");
    if (reg) reg.innerHTML = "<b>" + esc(st.regionName) + "</b><i></i>" + (holiday ? "כניסת החג " : "כניסת שבת ") + '<span dir="ltr">' + inT + "</span><i></i>" + (holiday ? "צאת החג " : "צאת שבת ") + '<span dir="ltr">' + outT + "</span>";
    tickShabbat();
  }
  (function buildShabbatTicks() {
    var g = $("shTicks"), out = "";
    for (var i = 0; i < 60; i++) {
      var a = i / 60 * Math.PI * 2, r1 = i % 5 ? 91 : 87, r2 = 94;
      out += '<line x1="' + (110 + r1 * Math.sin(a)).toFixed(1) + '" y1="' + (110 - r1 * Math.cos(a)).toFixed(1) +
        '" x2="' + (110 + r2 * Math.sin(a)).toFixed(1) + '" y2="' + (110 - r2 * Math.cos(a)).toFixed(1) + '"' + (i % 5 ? "" : ' class="major"') + '/>';
    }
    g.innerHTML = out;
  })();
  function tickShabbat() {
    var st = state.closed; if (!st) return;
    var t = window.Zmanim.now().getTime(), left = Math.max(0, st.until - t);
    if (left === 0 && !st.preview) { checkClosed(); return; }
    var s = Math.floor(left / 1000);
    $("shabbatCount").textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60);
    if (st.since) {
      var f = Math.max(0, Math.min(1, (t - st.since) / (st.until - st.since)));
      $("shArc").style.setProperty("--f", f.toFixed(4));
    }
  }
  setInterval(function () { if (state.closed) tickShabbat(); }, 1000);
  window.addEventListener("hashchange", checkClosed);

  // ---------- התקנה כאפליקציה ----------
  function isInstalled() {
    try { if (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: minimal-ui)").matches) return true; } catch (e) {}
    return window.navigator.standalone === true;
  }
  if (isInstalled()) root.classList.add("is-app");
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    if ($("installBtn") || isInstalled()) return;
    var b = document.createElement("button");
    b.id = "installBtn"; b.className = "install"; b.textContent = "התקנה";
    b.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (c) { if (c && c.outcome === "accepted") b.remove(); }).catch(function () {});
      deferredPrompt = null;
    });
    document.querySelector(".top").appendChild(b);
  });
  window.addEventListener("appinstalled", function () {
    var b = $("installBtn"); if (b) b.remove();
    deferredPrompt = null;
    toast("DIKMAN FM הותקנה");
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
  }

  // ---------- ממשק לקבצים האחרים (voice.js, fx.js, stats.js) ----------
  window.RadioApp = {
    state: state, cfg: CFG, audio: audio,
    schedStatus: schedStatus,
    playRadio: playRadio,
    playLive: function () { playLiveNow(true); },
    playChannel: function (cat) { if (guardClosed()) return; state.channel = cat; state.bag = []; state.manualLive = false; playReplayNext(); },
    toggle: togglePlay, stop: stopAudio, seek: seek, next: function () { step(1); },
    toast: toast,
    level: function () { return (state.level[0] + state.level[1]) / 2; },
    setVolume: function (v) { vol.value = Math.round(v); applyVol(); },
    getVolume: function () { return +vol.value; }
  };

  // ---------- הפעלה ----------
  loadEpisodes();
  var savedTab = load("tab", "live"); setTab(TABS.indexOf(savedTab) > -1 ? savedTab : "live");
  updateDeck(); setPlayUI();
  tickClock(); setInterval(tickClock, 15000);
  checkClosed(); setInterval(checkClosed, 15000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) checkClosed(); });
  state.wasLive = schedStatus().live;
  tickSchedule(); setInterval(tickSchedule, 10000);
  pollNowPlaying(); setInterval(pollNowPlaying, 30000);
  window.addEventListener("hashchange", function () { tickSchedule(); updateDeck(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tickSchedule(); });
  requestAnimationFrame(levelLoop);
})();
