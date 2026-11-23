/* ==========================================================================
   DIKMAN FM · עמוד הניהול
   כל פעולה עוברת דרך שרת הניהול (Cloudflare Worker): כניסה בסיסמה, העלאת קבצים
   ל-R2 בחלקים (עמיד לסלולר), ושמירת התוכן ל-GitHub – שממנו האתר מתעדכן לבד.
   ========================================================================== */
(function () {
  "use strict";
  var API = window.DKM_ADMIN_API;
  var $ = function (id) { return document.getElementById(id); };
  var S = { token: null, exp: 0, data: {}, sha: {}, mediaBase: "", busy: false, genre: null };
  var STORE = "dkm-admin-session";

  // ---------- עזרים ----------
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function icon(d) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    d.split("|").forEach(function (x) { var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", x); s.appendChild(p); });
    return s;
  }
  var I = {
    moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
    mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z|M5 11a7 7 0 0 0 14 0|M12 18v3",
    notes: "M9 18V5.5l11-2.5v12.5|M6.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z|M17.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    clef: "M10.2 20.6c.4 1.2 2.6 1.3 2.6-.6L11.4 3.6c0-1.4 1.2-2.3 2.2-1.6 1.1.8.6 3-1 4.6L8.6 10.5c-2 2-1.9 5.2.4 6.2 2.2 1 5 .2 5.6-2 .6-2-.8-3.8-2.8-3.8-1.7 0-2.9 1.3-2.6 2.9",
    video: "M2.5 6h13v12h-13z|M15.5 10.5l6-3.5v10l-6-3.5",
    list: "M8 6h13|M8 12h13|M8 18h13|M3.5 6h.01|M3.5 12h.01|M3.5 18h.01",
    camera: "M4 8h3l2-3h6l2 3h3v11H4z|M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    text: "M4 6h16|M4 12h10|M4 18h13",
    up: "M12 19V5|M6 11l6-6 6 6", down: "M12 5v14|M6 13l6 6 6-6",
    edit: "M4 20h4L19 9l-4-4L4 16z", trash: "M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3",
    plus: "M12 5v14|M5 12h14", upload: "M12 16V4|M6 10l6-6 6 6|M4 20h16", check: "M5 12.5l4.5 4.5L19 7"
  };
  function toast(msg, kind) {
    var t = $("toast"); t.textContent = msg; t.className = "toast " + (kind || ""); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, kind === "err" ? 7000 : 4200);
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function uid(p) { return (p || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function mmss(s) { s = Math.round(s || 0); if (!s) return ""; var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function youtubeId(v) {
    v = String(v || "").trim();
    if (/^[\w-]{11}$/.test(v)) return v;
    var m = v.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : "";
  }
  function httpsUrl(v) { v = String(v || "").trim(); return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : ""; }

  // ---------- שרת ----------
  function api(path, opt) {
    opt = opt || {};
    var h = { "Content-Type": "application/json" };
    if (S.token) h.Authorization = "Bearer " + S.token;
    return fetch(API + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && path !== "/api/login") { logout("פג תוקף הכניסה. צריך להיכנס שוב."); throw { handled: true }; }
          if (!r.ok) throw { status: r.status, error: j.error, detail: j.detail };
          return j;
        });
      });
  }
  function netErr(e) {
    if (e && e.handled) return;
    if (e && e.status === 409) return toast("מישהו אחר שמר שינוי באותו זמן. טענתי את המצב העדכני – נסי שוב.", "err");
    if (e && e.status) return toast("השמירה נכשלה (" + (e.error || e.status) + "). נסי שוב.", "err");
    toast("אין חיבור לשרת. בדקי את האינטרנט ונסי שוב.", "err");
  }

  // ---------- כניסה ----------
  function saveSession() { try { localStorage.setItem(STORE, JSON.stringify({ t: S.token, e: S.exp })); } catch (e) {} }
  function loadSession() { try { var s = JSON.parse(localStorage.getItem(STORE) || "null"); if (s && s.e > Date.now() + 60e3) { S.token = s.t; S.exp = s.e; } } catch (e) {} }
  function logout(msg) {
    S.token = null; try { localStorage.removeItem(STORE); } catch (e) {}
    show("login"); $("loginMsg").textContent = msg || "";
    if (location.hash) history.replaceState(null, "", location.pathname);
  }
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("password").value, btn = this.querySelector("button"), msg = $("loginMsg");
    if (!pw) { msg.textContent = "צריך להקליד סיסמה."; return; }
    btn.disabled = true; msg.className = "msg"; msg.textContent = "בודק…";
    api("/api/login", { method: "POST", body: { password: pw } }).then(function (j) {
      S.token = j.token; S.exp = j.exp; saveSession(); $("password").value = ""; msg.textContent = "";
      return loadAll().then(route);
    }).catch(function (err) {
      msg.textContent = err && err.status === 401 ? "הסיסמה לא נכונה." :
        err && err.status === 429 ? "יותר מדי ניסיונות. חכי דקה ונסי שוב." :
        err && err.status === 503 ? "השרת עוד לא הוגדר (חסרה סיסמה בשרת)." : "אין חיבור לשרת. בדקי את האינטרנט.";
    }).then(function () { btn.disabled = false; });
  });
  $("logout").addEventListener("click", function () { logout("יצאת מהניהול."); });

  // ---------- נתונים ----------
  function loadAll() {
    return api("/api/data").then(function (j) {
      ["content", "episodes", "stories"].forEach(function (k) { S.data[k] = j[k].data; S.sha[k] = j[k].sha; });
      S.mediaBase = j.mediaBase;
      var c = S.data.content || {};
      c.texts = c.texts || {}; c.social = c.social || {}; c.showcase = c.showcase || {};
      ["video", "arrangements", "original"].forEach(function (k) { c.showcase[k] = c.showcase[k] || []; });
      c.genres = c.genres || [];
      S.data.content = c;
      S.data.episodes = S.data.episodes || { items: [] }; S.data.episodes.items = S.data.episodes.items || [];
      S.data.stories = S.data.stories || { items: [] }; S.data.stories.items = S.data.stories.items || [];
    });
  }
  // שומר מסמך אחד. change(copy) משנה עותק; רק אם השמירה הצליחה – העותק נכנס למצב
  function commit(doc, message, change) {
    var copy = clone(S.data[doc]);
    change(copy);
    if (doc === "content") copy.updated = new Date().toISOString();
    return api("/api/save", { method: "POST", body: { doc: doc, data: copy, sha: S.sha[doc], message: message } }).then(function (j) {
      S.data[doc] = copy; S.sha[doc] = j.sha;
      toast("נשמר. האתר יתעדכן תוך דקה-שתיים.", "ok");
    }).catch(function (e) {
      netErr(e);
      if (e && e.status === 409) return loadAll().then(function () { throw e; });
      throw e;
    });
  }

  // ---------- העלאת קבצים (בחלקים, עם ניסיונות חוזרים) ----------
  function shrinkImage(file) {
    // תמונות מהטלפון גדולות מאוד (ואייפון שולח לפעמים HEIC): מקטינים ל-2000px ושומרים כ-JPEG
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return Promise.resolve(file);
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b && b.size < file.size ? Object.assign(b, { name: "photo.jpg" }) : file); }, "image/jpeg", .86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }
  function audioDuration(file) {
    return new Promise(function (res) {
      var a = document.createElement("audio"), url = URL.createObjectURL(file), done = false;
      function fin(v) { if (done) return; done = true; URL.revokeObjectURL(url); res(v && isFinite(v) ? Math.round(v) : 0); }
      a.preload = "metadata"; a.onloadedmetadata = function () { fin(a.duration); }; a.onerror = function () { fin(0); };
      setTimeout(function () { fin(0); }, 10000); a.src = url;
    });
  }
  function typeOf(f) {
    if (f.type) return f.type;
    var ext = (f.name.match(/\.(\w+)$/) || [])[1] || "";
    return ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime" })[ext.toLowerCase()] || "";
  }
  function putPart(q, blob, onp) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open("PUT", API + "/api/upload/part?" + q);
      x.setRequestHeader("Authorization", "Bearer " + S.token);
      x.upload.onprogress = function (e) { if (e.lengthComputable) onp(e.loaded); };
      x.onload = function () { var j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} if (x.status === 200 && j.etag) res(j); else rej({ status: x.status }); };
      x.onerror = x.ontimeout = function () { rej({ status: 0 }); };
      x.timeout = 180000;
      x.send(blob);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function upload(file, area, onp) {
    var type = typeOf(file);
    if (!/^(audio|image|video)\//.test(type)) return Promise.reject({ msg: "סוג הקובץ לא נתמך." });
    var lock = null;
    try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { lock = l; }).catch(function () {}); } catch (e) {}
    S.busy = true;
    return api("/api/upload/start", { method: "POST", body: { area: area, name: file.name || "file", type: type, size: file.size } }).then(function (st) {
      var size = st.partSize, total = Math.ceil(file.size / size), parts = [], sent = 0;
      var q = "key=" + encodeURIComponent(st.key) + "&uploadId=" + encodeURIComponent(st.uploadId);
      function one(n, tries) {
        var blob = file.slice((n - 1) * size, Math.min(file.size, n * size));
        return putPart(q + "&n=" + n, blob, function (l) { onp((sent + l) / file.size); }).then(function (j) {
          sent += blob.size; onp(sent / file.size); parts.push({ n: n, etag: j.etag });
        }).catch(function (e) {
          if (e.status === 401) throw e;
          if (tries >= 5) throw e;
          return wait([1000, 3000, 6000, 10000, 15000][tries]).then(function () { return one(n, tries + 1); });
        });
      }
      var chain = Promise.resolve();
      for (var n = 1; n <= total; n++) (function (n) { chain = chain.then(function () { return one(n, 0); }); })(n);
      return chain.then(function () {
        return api("/api/upload/complete", { method: "POST", body: { key: st.key, uploadId: st.uploadId, parts: parts } });
      }).catch(function (e) {
        api("/api/upload/abort", { method: "POST", body: { key: st.key, uploadId: st.uploadId } }).catch(function () {});
        throw e;
      });
    }).then(function (j) { return j.url; }).finally(function () { S.busy = false; try { if (lock) lock.release(); } catch (e) {} });
  }
  window.addEventListener("beforeunload", function (e) { if (S.busy) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- טופס כללי ----------
  // field: { k, label, type: text|textarea|date|select|file|youtube|url, req, opts, accept, hint, when(v) }
  function buildForm(spec, item, done, cancel) {
    var f = el("form", "card form"); f.noValidate = true;
    f.appendChild(el("h3", null, item ? "עריכה" : spec.addTitle));
    var inputs = {}, file = null, wraps = [];
    var vals = function () { var v = {}; Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].value; }); return v; };
    spec.fields.forEach(function (fd) {
      var w;
      if (fd.type === "file") {
        w = el("label", "pick");
        w.appendChild(icon(I.upload));
        var b = el("b", null, item ? "החלפת הקובץ (לא חובה)" : fd.label), s = el("span", null, fd.hint || "לחצי לבחירה מהטלפון");
        var inp = el("input"); inp.type = "file"; inp.accept = typeof fd.accept === "function" ? fd.accept(vals()) : fd.accept;
        inp.setAttribute("aria-label", fd.label);
        inp.addEventListener("change", function () {
          file = inp.files && inp.files[0] || null;
          w.classList.toggle("has-file", !!file);
          s.textContent = file ? "⁨" + file.name + "⁩ · " + (file.size / 1048576).toFixed(1) + "MB" : (fd.hint || "לחצי לבחירה מהטלפון");
          var old = f.querySelector(".preview"); if (old) old.remove();
          if (file && /^image\//.test(file.type)) { var im = el("img", "preview"); im.alt = ""; im.src = URL.createObjectURL(file); w.after(im); }
          if (file && inputs.title && !inputs.title.value) inputs.title.value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
        });
        w.appendChild(b); w.appendChild(s); w.appendChild(inp);
        w._file = fd; w._inp = inp;
      } else {
        w = el("label", "field"); w.appendChild(el("span", null, fd.label + (fd.req ? "" : " (לא חובה)")));
        var c;
        if (fd.type === "textarea") c = el("textarea");
        else if (fd.type === "select") { c = el("select"); fd.opts.forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; c.appendChild(op); }); }
        else { c = el("input"); c.type = fd.type === "date" ? "date" : fd.type === "url" || fd.type === "youtube" ? "url" : "text"; if (c.type === "url") { c.dir = "ltr"; c.inputMode = "url"; c.autocapitalize = "off"; } }
        c.name = fd.k;
        var start = item ? (fd.type === "youtube" ? (item.youtube ? "https://youtu.be/" + item.youtube : "") : item[fd.k]) : fd.def ? fd.def() : "";
        c.value = start == null ? "" : start;
        if (fd.type === "select" && !c.value) c.selectedIndex = 0;
        w.appendChild(c); inputs[fd.k] = c;
        if (fd.hint) w.appendChild(el("small", null, fd.hint));
      }
      w._fd = fd; wraps.push(w); f.appendChild(w);
    });
    function refresh() {
      var v = vals();
      wraps.forEach(function (w) {
        w.hidden = !!(w._fd.when && !w._fd.when(v));
        if (w._inp && typeof w._fd.accept === "function") w._inp.accept = w._fd.accept(v);
      });
    }
    f.addEventListener("change", refresh); refresh();

    var prog = el("div", "progress"); prog.hidden = true;
    var tr = el("div", "track"), fill = el("div", "fill"), pl = el("span"); tr.appendChild(fill); prog.appendChild(tr); prog.appendChild(pl);
    f.appendChild(prog);
    var msg = el("p", "msg"); msg.setAttribute("role", "alert"); f.appendChild(msg);
    var acts = el("div", "form-actions");
    var ok = el("button", "btn primary big"); ok.type = "submit"; ok.appendChild(icon(item ? I.check : I.upload)); ok.appendChild(el("span", null, item ? "שמירה" : spec.addVerb || "הוספה לאתר"));
    var no = el("button", "btn big"); no.type = "button"; no.textContent = "ביטול"; no.style.width = "auto";
    no.addEventListener("click", function () { if (!S.busy) cancel(); });
    acts.appendChild(ok); acts.appendChild(no); f.appendChild(acts);

    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (S.busy) return;
      var v = vals(); msg.textContent = "";
      for (var i = 0; i < spec.fields.length; i++) {
        var fd = spec.fields[i]; if (fd.when && !fd.when(v)) continue;
        if (fd.type === "file") { if (fd.req && !item && !file) { msg.textContent = "צריך לבחור קובץ."; return; } continue; }
        var val = String(v[fd.k] || "").trim();
        if (fd.req && !val) { msg.textContent = "חסר: " + fd.label; inputs[fd.k].focus(); return; }
        if (fd.type === "youtube" && val && !youtubeId(val)) { msg.textContent = "זה לא נראה כמו קישור ליוטיוב."; inputs[fd.k].focus(); return; }
        if (fd.type === "url" && val && !httpsUrl(val)) { msg.textContent = "הקישור צריך להתחיל ב-https://"; inputs[fd.k].focus(); return; }
      }
      ok.disabled = true; no.disabled = true;
      var fileField = spec.fields.filter(function (x) { return x.type === "file" && (!x.when || x.when(v)); })[0];
      var job = Promise.resolve({});
      if (file && fileField) {
        prog.hidden = false; pl.textContent = "מכין את הקובץ…";
        job = Promise.all([/^audio\//.test(typeOf(file)) ? audioDuration(file) : 0, /^image\//.test(typeOf(file)) ? shrinkImage(file) : file]).then(function (r) {
          var up = r[1];
          if (/hei[cf]/i.test(typeOf(up))) throw { msg: "הטלפון שמר את התמונה בפורמט HEIC שהאתר לא מציג. שמרי אותה כ-JPG (או צלמי מסך) ונסי שוב." };
          pl.textContent = "מעלה… 0%";
          return upload(up, spec.area, function (p) { var pc = Math.min(100, Math.round(p * 100)); fill.style.width = pc + "%"; pl.textContent = "מעלה… " + pc + "%"; })
            .then(function (url) { pl.textContent = "הקובץ עלה. שומר…"; return { url: url, duration: r[0], type: typeOf(up) }; });
        });
      }
      job.then(function (up) {
        var clean = {}; Object.keys(v).forEach(function (k) { clean[k] = String(v[k]).trim(); });
        return done(clean, up);
      }).then(function () { cancel(true); }).catch(function (err) {
        if (err && err.msg) msg.textContent = err.msg;
        else if (err && err.handled) return;
        else if (!(err && err.status === 409)) msg.textContent = "משהו נכשל בדרך. הקובץ לא נשמר – נסי שוב (כדאי בחיבור יציב).";
        ok.disabled = false; no.disabled = false; prog.hidden = true;
      });
    });
    return f;
  }

  // ---------- הגדרת האזורים ----------
  var fFile = function (accept, label, hint) { return { k: "_file", type: "file", req: true, accept: accept, label: label, hint: hint }; };
  var AUDIO = "audio/*,.mp3,.m4a,.aac,.wav";
  var ROLES = [["עיבוד", "עיבוד"], ["לחן", "לחן"], ["עיבוד ולחן", "עיבוד ולחן"]];
  function episodeArea(id, name, ic, cat) {
    return {
      id: id, name: name, icon: ic, doc: "episodes", area: id, addTitle: "פרק חדש ל" + name, sub: "פרקים שהועלו מכאן",
      note: "הפרקים מטלגרם נכנסים לבד כל שעה. כאן מוסיפים פרקים ידנית.",
      fields: [fFile(AUDIO, "בחירת קובץ שמע", "MP3 / M4A – מ\"קבצים\" או מהאחסון"), { k: "title", label: "שם הפרק", type: "text", req: true }, { k: "date", label: "תאריך", type: "date", req: true, def: today }],
      list: function (d) { return d.items.filter(function (e) { return e.category === cat; }); },
      sorted: true,
      make: function (v, up, old) { var o = old || { id: uid("manual-"), category: cat }; o.title = v.title; o.date = v.date; if (up.url) { o.url = up.url; o.duration = up.duration || 0; } return o; },
      label: function (e) { return [e.title, (e.date || "") + (e.duration ? " · " + mmss(e.duration) : "")]; }
    };
  }
  function showcaseArea(id, name, ic, key, extra) {
    return Object.assign({
      id: id, name: name, icon: ic, doc: "content", area: id, addTitle: "שיר חדש",
      list: function (c) { return c.showcase[key]; },
      label: function (e) { return [e.title, [e.artist, e.role || e.note, mmss(e.duration)].filter(Boolean).join(" · ")]; }
    }, extra);
  }
  var AREAS = [
    episodeArea("laila", "לילה מנצח", I.moon, "לילה מנצח"),
    episodeArea("master", "מאסטר פליי", I.mic, "מאסטר פליי"),
    showcaseArea("arrangements", "עיבודים ולחנים", I.notes, "arrangements", {
      fields: [fFile(AUDIO, "בחירת קובץ שמע"), { k: "title", label: "שם השיר", type: "text", req: true }, { k: "artist", label: "מבצע", type: "text" }, { k: "role", label: "מה יואלי עשה", type: "select", opts: ROLES }],
      make: function (v, up, old) { var o = old || {}; o.title = v.title; o.artist = v.artist || undefined; o.role = v.role; if (up.url) { o.url = up.url; o.duration = up.duration || 0; } return o; }
    }),
    showcaseArea("original", "יואלי מקורי", I.clef, "original", {
      fields: [fFile(AUDIO, "בחירת קובץ שמע"), { k: "title", label: "שם השיר", type: "text", req: true }, { k: "note", label: "שורה קצרה מתחת לשם", type: "text" }],
      make: function (v, up, old) { var o = old || {}; o.title = v.title; o.note = v.note || undefined; if (up.url) { o.url = up.url; o.duration = up.duration || 0; } return o; }
    }),
    showcaseArea("video", "וידיאו הופעות לייב", I.video, "video", {
      addTitle: "סרטון חדש מיוטיוב", addVerb: "הוספה לאתר",
      fields: [{ k: "youtube", label: "קישור ליוטיוב", type: "youtube", req: true, hint: "מעתיקים את הקישור מאפליקציית יוטיוב (שיתוף ← העתקת קישור)" }, { k: "title", label: "שם השיר", type: "text", req: true }, { k: "sub", label: "שורת משנה", type: "text" }],
      make: function (v, up, old) { var o = old || {}; o.youtube = youtubeId(v.youtube); o.title = v.title; o.sub = v.sub || undefined; return o; },
      label: function (e) { return [e.title, e.sub || ""]; }
    }),
    { id: "genres", name: "הפלייליסט שלך", icon: I.list, special: "genres" },
    { id: "stories", name: "מאחורי הקלעים", icon: I.camera, doc: "stories", area: "stories", addTitle: "פריט חדש לסטורי",
      note: "הסטורי קבוע: פריטים לא נמחקים לבד. חדשים נכנסים לסוף.",
      fields: [
        { k: "type", label: "סוג", type: "select", req: true, opts: [["image", "תמונה"], ["video", "וידיאו"], ["audio", "הקלטה"], ["text", "טקסט"], ["youtube", "סרטון יוטיוב"]] },
        { k: "_file", type: "file", req: true, label: "בחירת קובץ", when: function (v) { return /^(image|video|audio)$/.test(v.type); },
          accept: function (v) { return v.type === "video" ? "video/*" : v.type === "audio" ? AUDIO : "image/*"; } },
        { k: "text", label: "הטקסט", type: "textarea", req: true, when: function (v) { return v.type === "text"; } },
        { k: "youtube", label: "קישור ליוטיוב", type: "youtube", req: true, when: function (v) { return v.type === "youtube"; } },
        { k: "caption", label: "כיתוב", type: "text" }
      ],
      list: function (d) { return d.items; },
      make: function (v, up, old) {
        var o = old || { id: today() + "-" + Math.random().toString(36).slice(2, 7), date: today() };
        o.type = v.type; o.caption = v.caption || undefined;
        delete o.text; delete o.youtube;
        if (v.type === "text") { o.text = v.text; o.bg = o.bg || "red"; delete o.src; }
        else if (v.type === "youtube") { o.youtube = youtubeId(v.youtube); delete o.src; }
        else if (up.url) o.src = up.url;
        if (/^(image|video|audio)$/.test(o.type) && !o.src) throw { msg: "צריך לבחור קובץ." };
        if (o.type === "image" && !o.fit) o.fit = "contain";
        return o;
      },
      label: function (e) { var t = { image: "תמונה", video: "וידיאו", audio: "הקלטה", text: "טקסט", youtube: "יוטיוב", link: "קישור" }[e.type] || e.type; return [e.caption || e.text || t, t + (e.date ? " · " + e.date : "")]; }
    },
    { id: "texts", name: "טקסטים וקישורים", icon: I.text, special: "texts" }
  ];
  var byId = {}; AREAS.forEach(function (a) { byId[a.id] = a; });

  // ---------- מסכים ----------
  function show(name) {
    ["login", "home", "area"].forEach(function (s) { $(s).hidden = s !== name; });
    $("logout").hidden = name === "login"; $("back").hidden = name !== "area";
    if (name !== "area") $("title").textContent = name === "login" ? "ניהול" : "ניהול האתר";
    window.scrollTo(0, 0);
  }
  function route() {
    if (!S.token) return logout();
    var id = decodeURIComponent(location.hash.slice(1));
    if (byId[id]) return openArea(byId[id]);
    show("home");
  }
  window.addEventListener("hashchange", function () { if (S.busy) return; route(); });
  $("back").addEventListener("click", function () { if (S.busy) return toast("רגע, הקובץ עדיין עולה…"); history.length > 1 && location.hash ? history.back() : (location.hash = ""); });

  function tiles() {
    var t = $("tiles"); t.textContent = "";
    AREAS.forEach(function (a) {
      var b = el("button", "tile"); b.type = "button";
      b.appendChild(icon(a.icon)); b.appendChild(el("b", null, a.name));
      var n = a.special === "genres" ? S.data.content.genres.length + " רשימות" : a.special === "texts" ? "כותרות ורשתות" : a.list(S.data[a.doc]).length + " פריטים";
      b.appendChild(el("small", null, n));
      b.addEventListener("click", function () { location.hash = a.id; });
      t.appendChild(b);
    });
  }

  function openArea(a) {
    show("area"); $("title").textContent = a.name;
    var box = $("area"); box.textContent = "";
    if (a.special === "texts") return textsScreen(box);
    if (a.special === "genres") return genresScreen(box);
    listScreen(box, a, function () { return a.list(S.data[a.doc]); }, function (copy) { return a.list(copy); });
  }

  // רשימה + הוספה + עריכה/סדר/מחיקה, לכל אזור רגיל
  function listScreen(box, a, getList, listIn, setIn) {
    var head = el("div", "area-head");
    if (a.note) head.appendChild(el("p", "muted", a.note));
    var add = el("button", "btn primary big"); add.type = "button"; add.appendChild(icon(I.plus)); add.appendChild(el("span", null, a.addTitle));
    head.appendChild(add); box.appendChild(head);
    var formSlot = el("div"); box.appendChild(formSlot);
    var ul = el("ul", "list"); box.appendChild(ul);

    // מוצא את הפריט בעותק לפי מקומו (או לפי id) ומחזיר את המערך שלו
    function arrOf(copy) { return a.doc === "episodes" ? copy.items : listIn(copy); }
    function idxIn(copy, it) {
      var arr = arrOf(copy);
      if (it.id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === it.id) return i; }
      return getList().indexOf(it) >= 0 && a.doc !== "episodes" ? getList().indexOf(it) : -1;
    }
    add.addEventListener("click", function () {
      add.hidden = true; formSlot.textContent = "";
      formSlot.appendChild(buildForm(a, null, function (v, up) {
        return commit(a.doc, "הוספה ל" + a.name + ": " + (v.title || v.caption || v.type || ""), function (copy) { arrOf(copy).push(a.make(v, up)); });
      }, function () { formSlot.textContent = ""; add.hidden = false; draw(); }));
      var first = formSlot.querySelector("input:not([type=file]), select, textarea, .pick input"); if (first) first.focus();
    });

    function draw() {
      ul.textContent = "";
      var items = getList().slice();
      if (a.sorted) items.sort(function (x, y) { return x.date < y.date ? 1 : -1; });
      if (!items.length) { ul.appendChild(el("li", "card empty", "עוד אין כאן פריטים.")); if (a.afterDraw) a.afterDraw(); return; }
      items.forEach(function (it, i) {
        var li = el("li", "card row"), m = el("div", "row-main"), L = a.label(it);
        m.appendChild(el("b", null, L[0] || "ללא שם")); if (L[1]) m.appendChild(el("span", null, L[1]));
        var tools = el("div", "row-tools");
        function tb(ic, label, fn, cls, dis) { var b = el("button", "icon-btn " + (cls || "")); b.type = "button"; b.setAttribute("aria-label", label); b.appendChild(icon(ic)); b.disabled = !!dis; b.addEventListener("click", fn); tools.appendChild(b); }
        if (!a.sorted) {
          tb(I.up, "הזזה למעלה", function () { move(it, -1); }, "", i === 0);
          tb(I.down, "הזזה למטה", function () { move(it, 1); }, "", i === items.length - 1);
        }
        tb(I.edit, "עריכה", function () {
          var open = li.querySelector(".edit"); if (open) { open.remove(); return; }
          var w = el("div", "edit");
          w.appendChild(buildForm(a, it, function (v, up) {
            return commit(a.doc, "עדכון ב" + a.name + ": " + (v.title || v.caption || ""), function (copy) { var k = idxIn(copy, it); if (k < 0) throw { msg: "הפריט לא נמצא – רענני את הדף." }; arrOf(copy)[k] = a.make(v, up, clone(arrOf(copy)[k])); });
          }, function () { draw(); }));
          li.appendChild(w);
        });
        tb(I.trash, "מחיקה", function () {
          if (!confirm("למחוק את \"" + (L[0] || "הפריט") + "\" מהאתר?")) return;
          commit(a.doc, "מחיקה מ" + a.name + ": " + (L[0] || ""), function (copy) { var k = idxIn(copy, it); if (k >= 0) arrOf(copy).splice(k, 1); }).then(draw, draw);
        }, "danger");
        li.appendChild(m); li.appendChild(tools); ul.appendChild(li);
      });
      if (a.afterDraw) a.afterDraw();
    }
    function move(it, d) {
      commit(a.doc, "שינוי סדר ב" + a.name, function (copy) {
        var arr = arrOf(copy), k = idxIn(copy, it), j = k + d;
        if (k < 0 || j < 0 || j >= arr.length) return;
        var t = arr[k]; arr[k] = arr[j]; arr[j] = t;
      }).then(draw, draw);
    }
    draw();
  }

  // הפלייליסטים: בוחרים סגנון, ואז מוסיפים לו שירים
  function genresScreen(box) {
    var G = S.data.content.genres;
    box.appendChild(el("p", "muted", "בוחרים פלייליסט, ומוסיפים לו שירים מהטלפון."));
    var chips = el("div", "chips"); box.appendChild(chips);
    var slot = el("div"); box.appendChild(slot);
    function pick(id) {
      S.genre = id;
      Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute("aria-pressed", c._id === id ? "true" : "false"); });
      slot.textContent = "";
      var gi = function (c) { for (var i = 0; i < c.genres.length; i++) if (c.genres[i].id === id) return c.genres[i]; return null; };
      var g = gi(S.data.content); if (!g) return;
      var h = el("h2", "sec-title"); slot.appendChild(h);
      var spec = {
        name: g.name, doc: "content", area: "genres", addTitle: "שיר חדש ל" + g.name,
        fields: [fFile(AUDIO, "בחירת קובץ שמע"), { k: "title", label: "שם השיר", type: "text", req: true }],
        make: function (v, up, old) { var o = old && typeof old === "object" ? old : {}; o.title = v.title; if (up.url) { o.url = up.url; o.duration = up.duration || 0; } return o; },
        label: function (e) { return typeof e === "string" ? ["פרק מהארכיון", e] : [e.title, mmss(e.duration)]; },
        afterDraw: function () { var x = gi(S.data.content); if (x) h.textContent = x.name + " · " + x.items.length + " שירים"; }
      };
      var inner = el("div"); slot.appendChild(inner);
      listScreen(inner, spec, function () { var x = gi(S.data.content); return x ? x.items : []; }, function (copy) { return gi(copy).items; });
      // שם ותיאור הפלייליסט
      var meta = el("details", "card"); meta.style.marginTop = "18px";
      var sm = el("summary", null, "שם ותיאור של הפלייליסט"); sm.style.cssText = "min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700"; meta.appendChild(sm);
      meta.appendChild(buildForm({ fields: [{ k: "name", label: "שם", type: "text", req: true }, { k: "note", label: "תיאור קצר", type: "text" }] }, { name: g.name, note: g.note }, function (v) {
        return commit("content", "עדכון פלייליסט " + v.name, function (copy) { var x = gi(copy); x.name = v.name; x.note = v.note; });
      }, function () { genresScreen.redo(); }));
      slot.appendChild(meta);
    }
    genresScreen.redo = function () { box.textContent = ""; genresScreen(box); };
    G.forEach(function (g) {
      var c = el("button", "chip", g.name); c.type = "button"; c._id = g.id;
      c.addEventListener("click", function () { pick(g.id); });
      chips.appendChild(c);
    });
    pick(S.genre && G.some(function (g) { return g.id === S.genre; }) ? S.genre : G[0] && G[0].id);
  }

  // טקסטים וקישורים
  function textsScreen(box) {
    var c = S.data.content;
    var fields = [
      { k: "tagline", label: "שורת הפתיחה בעמוד הראשי (אחרי \"24\")", type: "text", req: true },
      { k: "videoLead", label: "תיאור דף הוידיאו", type: "textarea" },
      { k: "arrangementsLead", label: "תיאור דף העיבודים", type: "textarea" },
      { k: "originalLead", label: "תיאור דף יואלי מקורי", type: "textarea" },
      { k: "instagram", label: "אינסטגרם", type: "url" },
      { k: "tiktok", label: "טיקטוק", type: "url" },
      { k: "facebook", label: "פייסבוק", type: "url" },
      { k: "youtube", label: "ערוץ היוטיוב", type: "url", hint: "יופיע באתר כשנוסיף לחצן יוטיוב לתחתית" }
    ];
    var cur = Object.assign({}, c.texts, c.social);
    box.appendChild(buildForm({ fields: fields }, cur, function (v) {
      return commit("content", "עדכון טקסטים וקישורים", function (copy) {
        ["tagline", "videoLead", "arrangementsLead", "originalLead"].forEach(function (k) { copy.texts[k] = v[k]; });
        ["instagram", "tiktok", "facebook", "youtube"].forEach(function (k) { copy.social[k] = v[k]; });
      });
    }, function (saved) { if (!saved) location.hash = ""; else { box.textContent = ""; textsScreen(box); } }));
  }

  // ---------- התחלה ----------
  loadSession();
  if (!S.token) { logout(); }
  else {
    show("home"); $("tiles").textContent = "טוען…";
    loadAll().then(function () { tiles(); route(); }).catch(function (e) { if (!(e && e.handled)) { netErr(e); $("tiles").textContent = "לא הצלחתי לטעון. רענני את הדף."; } });
  }
  var _show = show;
  show = function (n) { _show(n); if (n === "home" && S.data.content) tiles(); };
})();
