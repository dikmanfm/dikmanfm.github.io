/* ==========================================================================
   חישוב שקיעה ומצב שבת/חג – לפי אזור (ישראל / ניו יורק)
   • כל אזור מחושב לפי אזור הזמן שלו (Asia/Jerusalem, America/New_York) והשקיעה במקומו,
     בלי קשר לשעון של המכשיר. שבת בישראל חוסמת רק גולשים מישראל, ולהפך.
   • אזור הגולש מזוהה לפי אזור הזמן של הדפדפן (בלי לבקש הרשאת מיקום).
   • כשלאזור יש טבלת זמנים (times, למשל מלוח 2net) – הטבלה קובעת בדיוק, כולל חגים.
   • מחוץ לתקופת הטבלה: אלגוריתם "משוואת הזריחה" (NOAA המקוצר) – דיוק של כדקה.

   מצב בדיקה (בכתובת):
     ?shabbat=1            מסך השבת מוצג עכשיו, עם זמני השבת הקרובה של האזור
     ?region=ny | il       כפיית אזור הגולש
     ?sim=2026-11-27T15:50 שעון מדומה (שעון האזור), הזמן ממשיך לרוץ ממנו – לבדיקת מעבר אמיתי
     #shabbat-preview      תאימות לאחור, כמו ?shabbat=1
   ========================================================================== */
(function () {
  "use strict";
  var RAD = Math.PI / 180, DAY = 864e5;

  // ---------- שקיעה לתאריך לוח (y, m, d) במקום נתון – מחזיר רגע מוחלט ----------
  function sunsetYMD(y, m, d, lat, lng) {
    var J = Date.UTC(y, m - 1, d) / DAY + 2440587.5;
    var n = Math.ceil(J - 2451545 + 0.0008);
    var Js = n - lng / 360;
    var M = (357.5291 + 0.98560028 * Js) % 360;
    var C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
    var L = (M + C + 180 + 102.9372) % 360;
    var Jt = 2451545 + Js + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
    var sd = Math.sin(L * RAD) * Math.sin(23.4397 * RAD);
    var cd = Math.cos(Math.asin(sd));
    var cw = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sd) / (Math.cos(lat * RAD) * cd);
    var w = Math.acos(cw) / RAD;
    return new Date((Jt + w / 360 - 2440587.5) * DAY);
  }
  // תאימות: sunset(date, lat, lng) לפי תאריך המכשיר
  function sunset(date, lat, lng) { return sunsetYMD(date.getFullYear(), date.getMonth() + 1, date.getDate(), lat, lng); }

  // ---------- תאריך ושעה באזור זמן ----------
  var WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var fmtCache = {};
  function parts(date, tz) {
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23"
    }));
    var o = {};
    f.formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, dow: WD[o.weekday], h: +o.hour % 24, min: +o.minute };
  }
  function shift(p, n) { var t = new Date(Date.UTC(p.y, p.m - 1, p.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(date, tz) { var p = parts(date, tz); return pad(p.h) + ":" + pad(p.min); }
  // הפרש אזור הזמן ברגע נתון (במילישניות) – להמרת "שעון קיר" באזור לרגע מוחלט
  function tzOffset(date, tz) {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
      .formatToParts(date).reduce(function (o, x) { o[x.type] = +x.value || x.value; return o; }, {});
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
  }
  function wallToInstant(s, tz) {   // "2026-11-27T15:50" בשעון האזור
    var m = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d))?)?$/.exec(s);
    if (!m) { var t = Date.parse(s); return isNaN(t) ? null : t; }
    var guess = Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0));
    return guess - tzOffset(new Date(guess), tz);
  }

  // ---------- אזורים ----------
  var DEFAULT_REGIONS = {
    il: { name: "ישראל", tz: "Asia/Jerusalem", lat: 31.778, lng: 35.235, candleMinutes: 40, havdalaMinutes: 40, match: ["Asia/Jerusalem", "Asia/Tel_Aviv", "Israel"] },
    ny: { name: "ניו יורק", tz: "America/New_York", lat: 40.7128, lng: -74.006, candleMinutes: 18, havdalaMinutes: 50, match: ["America/", "US/", "Canada/"] }
  };
  function regions(cfg) {
    if (cfg && cfg.regions) return cfg.regions;
    // הגדרה ישנה (lat/lng יחידים) – נחשבת כישראל
    var il = {}; for (var k in DEFAULT_REGIONS.il) il[k] = DEFAULT_REGIONS.il[k];
    if (cfg && cfg.lat != null) { il.lat = cfg.lat; il.lng = cfg.lng; il.candleMinutes = cfg.candleMinutes; il.havdalaMinutes = cfg.havdalaMinutes; }
    return { il: il, ny: DEFAULT_REGIONS.ny };
  }

  var Q = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();

  function detectRegion(cfg) {
    var R = regions(cfg), force = Q.get("region");
    if (force && R[force]) return force;
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    for (var k in R) {
      var mt = R[k].match || [];
      for (var i = 0; i < mt.length; i++) if (tz === mt[i] || (mt[i].slice(-1) === "/" && tz.indexOf(mt[i]) === 0)) return k;
    }
    // ברירת מחדל בטוחה: אזור הבית של התחנה (גם כשאזור הזמן לא ידוע)
    return (cfg && cfg.fallbackRegion && R[cfg.fallbackRegion]) ? cfg.fallbackRegion : Object.keys(R)[0];
  }

  // ---------- שעון (אמיתי, או מדומה במצב בדיקה) ----------
  var simOffset = 0;
  function now() { return new Date(Date.now() + simOffset); }

  // שבת אחת: כניסה/יציאה סביב יום שישי של האזור
  function shabbatAround(fri, r) {
    var c = r.candleMinutes * 6e4, h = r.havdalaMinutes * 6e4, sat = shift(fri, 1);
    return {
      since: new Date(sunsetYMD(fri.y, fri.m, fri.d, r.lat, r.lng).getTime() - c),
      until: new Date(sunsetYMD(sat.y, sat.m, sat.d, r.lat, r.lng).getTime() + h)
    };
  }

  // ---------- טבלת זמנים קבועה (למשל מלוח 2net) ----------
  // r.times = [["YYYY-MM-DD HH:MM" כניסה, "YYYY-MM-DD HH:MM" יציאה, "shabbat"|"holiday", שם], ...] בשעון האזור.
  // בתוך התקופה שהטבלה מכסה – רק הטבלה קובעת (בדיוק לפי הלוח). מחוץ לה – החישוב לפי השקיעה.
  function table(r) {
    if (!r.times || !r.times.length) return null;
    if (r._tbl) return r._tbl;
    var list = [];
    for (var i = 0; i < r.times.length; i++) {
      var t = r.times[i], a = wallToInstant(String(t[0]).replace(" ", "T"), r.tz), b = wallToInstant(String(t[1]).replace(" ", "T"), r.tz);
      if (a != null && b != null && b > a) list.push({ since: new Date(a), until: new Date(b), kind: t[2] === "holiday" ? "holiday" : "shabbat", name: t[3] || "" });
    }
    list.sort(function (x, y) { return x.since - y.since; });
    // הטבלה "מכסה" משבוע לפני הכניסה הראשונה ועד היציאה האחרונה
    r._tbl = list.length ? { list: list, from: list[0].since.getTime() - 7 * DAY, to: list[list.length - 1].until.getTime() } : null;
    return r._tbl;
  }
  function inTable(at, r) {
    var T = table(r), t = at.getTime();
    if (!T || t < T.from || t >= T.to) return undefined;     // מחוץ לטבלה: לחשב
    for (var i = 0; i < T.list.length; i++) { var w = T.list[i]; if (t >= w.since && t < w.until) return w; }
    return null;                                              // בתוך התקופה, לא בשבת/חג
  }

  // מחזיר null אם מותר לשדר, או {kind, since, until, region, regionName, tz}
  function closedState(at, cfg, key) {
    if (!cfg || !cfg.enabled) return null;
    var R = regions(cfg); key = key && R[key] ? key : detectRegion(cfg);
    var r = R[key], p = parts(at, r.tz), base = { region: key, regionName: r.name, tz: r.tz };
    var out = function (o) { for (var k in base) o[k] = base[k]; return o; };

    var tw = inTable(at, r);
    if (tw !== undefined) return tw ? out({ kind: tw.kind, name: tw.name, since: tw.since, until: tw.until }) : null;

    if (p.dow === 5 || p.dow === 6) {
      var w = shabbatAround(shift(p, p.dow === 6 ? -1 : 0), r);
      if (at >= w.since && at < w.until) return out({ kind: "shabbat", since: w.since, until: w.until });
    }
    var list = r.holidays || cfg.holidays || [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i].start.split("-"), b = list[i].end.split("-");
      var s = sunsetYMD(+a[0], +a[1], +a[2], r.lat, r.lng).getTime() - r.candleMinutes * 6e4;
      var e = sunsetYMD(+b[0], +b[1], +b[2], r.lat, r.lng).getTime() + r.havdalaMinutes * 6e4;
      if (at >= s && at < e) return out({ kind: "holiday", name: list[i].name, since: new Date(s), until: new Date(e) });
    }
    return null;
  }

  // השבת הנוכחית או הקרובה של אזור (לתצוגה מקדימה ולמידע)
  function nextShabbat(at, cfg, key) {
    var R = regions(cfg), r = R[key] || R[detectRegion(cfg)], p = parts(at, r.tz);
    var T = table(r);
    if (T && at.getTime() >= T.from && at.getTime() < T.to) {
      for (var i = 0; i < T.list.length; i++) if (T.list[i].until > at) return { since: T.list[i].since, until: T.list[i].until, kind: T.list[i].kind, name: T.list[i].name };
    }
    var w = shabbatAround(shift(p, p.dow === 6 ? -1 : (5 - p.dow + 7) % 7), r);
    if (at >= w.until) w = shabbatAround(shift(p, (5 - p.dow + 7) % 7 || 7), r);
    return w;
  }

  // ---------- מצב בדיקה ----------
  var previewOn = Q.get("shabbat") === "1" || Q.get("shabbat") === "preview";
  function preview() { return previewOn || location.hash === "#shabbat-preview"; }
  var previewState = null;

  // מה שהאפליקציה שואלת: האם חסום עכשיו לגולש הזה
  function current(cfg) {
    var key = detectRegion(cfg), R = regions(cfg), r = R[key], at = now();
    if (preview()) {
      if (!previewState || previewState.region !== key) {
        var real = nextShabbat(at, cfg, key), dur = real.until - real.since;
        // הספירה לאחור "אמיתית" (כאילו השבת נכנסה לפני שעתיים), השעות המוצגות – של השבת הקרובה
        previewState = { kind: "shabbat", preview: true, since: new Date(at - 2 * 36e5), until: new Date(at - 2 * 36e5 + dur),
          realSince: real.since, realUntil: real.until, region: key, regionName: r.name, tz: r.tz };
      }
      return previewState;
    }
    previewState = null;
    return closedState(at, cfg, key);
  }

  // סרגל קטן שמראה שמצב בדיקה פעיל, עם יציאה
  function testBadge(cfg) {
    var sim = Q.get("sim"), force = Q.get("region");
    if (!preview() && !sim && !force) return;
    var key = detectRegion(cfg), r = regions(cfg)[key];
    var b = document.createElement("div");
    b.className = "zm-test"; b.setAttribute("dir", "rtl");
    b.style.cssText = "position:fixed;z-index:9999;top:calc(8px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:6px 10px;font:600 12px/1.3 Heebo,system-ui,sans-serif;color:#000;background:#ffd27a;box-shadow:0 6px 20px rgba(0,0,0,.5);white-space:nowrap;max-width:calc(100vw - 16px);overflow:hidden";
    var clean = location.pathname + (location.hash === "#shabbat-preview" ? "" : location.hash);
    b.innerHTML = "<span>מצב בדיקה · " + r.name + (sim ? ' · <span id="zmSim" dir="ltr"></span>' : "") + "</span>" +
      '<a href="' + clean + '" style="color:#000;text-decoration:underline">יציאה</a>';
    document.body.appendChild(b);
    if (sim) {
      var el = document.getElementById("zmSim");
      var tick = function () { var p = parts(now(), r.tz); el.textContent = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][p.dow] + " " + pad(p.h) + ":" + pad(p.min); };
      tick(); setInterval(tick, 1000);
    }
  }

  function init(cfg) {
    var sim = Q.get("sim");
    if (sim) {
      var key = detectRegion(cfg), t = wallToInstant(sim, regions(cfg)[key].tz);
      if (t != null) simOffset = t - Date.now();
    }
    var go = function () { testBadge(cfg); };
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  }
  init(window.RADIO_CONFIG && window.RADIO_CONFIG.shabbat);

  window.Zmanim = {
    sunset: sunset, sunsetYMD: sunsetYMD, closedState: closedState, nextShabbat: nextShabbat,
    regions: regions, detectRegion: detectRegion, current: current, now: now, hm: hm, parts: parts,
    isTest: function () { return preview() || !!Q.get("sim") || !!Q.get("region"); }
  };
})();
