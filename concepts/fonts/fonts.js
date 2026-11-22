/* ==========================================================================
   DIKMAN FM · פונטים לבדיקה ללוגו
   רשימה אחת שמשמשת גם את דף ההשוואה וגם את המתג בקונספט Orbit.
   הקבצים מקומיים (concepts/fonts/files) – בלי CDN, עובד גם מאחורי סינון.
   ========================================================================== */
(function () {
  "use strict";
  var F = [
    { id: "heebo",        name: "Heebo Black",   file: null,                  src: "הנוכחי",    lic: "OFL",            note: "הפונט שבאתר היום", track: "-.045em", weight: 900 },
    { id: "xirod",        name: "Xirod",         file: "xirod.otf",           src: "dafont",    lic: "חינם",           note: "רחב וכבד מאוד" },
    { id: "nasalization", name: "Nasalization",  file: "nasalization.otf",    src: "1001fonts", lic: "חינם (Typodermic)", note: "מעוגל, חללית" },
    { id: "induction",    name: "Induction",     file: "induction.otf",       src: "1001fonts", lic: "CC0",            note: "רחב במיוחד, קווים חדים" },
    { id: "orbitron",     name: "Orbitron Black",file: "orbitron-black.otf",  src: "1001fonts", lic: "OFL",            note: "הקלאסי של הסייבר" },
    { id: "audiowide",    name: "Audiowide",     file: "audiowide.ttf",       src: "1001fonts", lic: "OFL",            note: "רדיו פוגש טכנו" },
    { id: "neuropol",     name: "Neuropol",      file: "neuropol.otf",        src: "dafont",    lic: "חינם (Typodermic)", note: "טכנולוגי ונקי" },
    { id: "quantum",      name: "Quantum",       file: "quantum.ttf",         src: "1001fonts", lic: "חינם",           note: "כבד עם חיתוכים" },
    { id: "zero-velocity",name: "Zero Velocity", file: "zero-velocity.ttf",   src: "1001fonts", lic: "חינם",           note: "נטוי, קו כרום כפול" },
    { id: "underwhelmed", name: "Underwhelmed",  file: "underwhelmed.ttf",    src: "1001fonts", lic: "חינם",           note: "שמן ומרובע" },
    { id: "dream-mma",    name: "Dream MMA",     file: "dream-mma.ttf",       src: "dafont",    lic: "חינם",           note: "נטוי ואגרסיבי" },
    { id: "bigmacca",     name: "Bigmacca",      file: "bigmacca.ttf",        src: "dafont",    lic: "CC BY-SA · קרדיט", note: "כבד, סטנסיל" },
    { id: "robotech-gp",  name: "Robotech GP",   file: "robotech-gp.ttf",     src: "dafont",    lic: "CC BY-SA · קרדיט", note: "טכנו כבד" },
    { id: "moonhouse",    name: "Moonhouse",     file: "moonhouse.ttf",       src: "dafont",    lic: "חינם",           note: "עגול ועתידני" },
    { id: "future-earth", name: "Future Earth",  file: "future-earth.ttf",    src: "dafont",    lic: "CC BY-ND",       note: "רחב וחזק" }
  ];
  F.forEach(function (f, i) { f.n = i; f.family = f.file ? "DKM " + f.name : "Heebo"; });

  // @font-face נוצר כאן, יחסית ל-<base> של הדף (שורש הפרויקט)
  var css = F.filter(function (f) { return f.file; }).map(function (f) {
    return '@font-face{font-family:"' + f.family + '";src:url("concepts/fonts/files/' + f.file + '");font-display:swap}';
  }).join("");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  window.DKMFonts = {
    list: F,
    get: function (id) { return F.filter(function (f) { return f.id === id; })[0] || F[0]; },
    // מחיל פונט על הלוגו דרך משתני CSS
    apply: function (el, id) {
      var f = this.get(id);
      el.style.setProperty("--logo-font", '"' + f.family + '", "Heebo", sans-serif');
      el.style.setProperty("--logo-weight", f.weight || 400);
      el.style.setProperty("--logo-track", f.track || "0em");
      el.setAttribute("data-font", f.id);
      return f;
    }
  };
})();
