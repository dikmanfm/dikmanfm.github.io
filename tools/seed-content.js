// יוצר את js/content.js מהערכים שיש היום ב-config.js וב-index.html (פעם אחת, להתחלה)
global.window = {}; global.location = { search: "", hash: "" }; global.document = {};
require("../js/config.js");
const fs = require("fs"), C = window.RADIO_CONFIG;
const html = fs.readFileSync("index.html", "utf8");
const link = re => (html.match(re) || [])[1] || "";
const content = {
  updated: new Date().toISOString(),
  texts: {
    tagline: "שעות של מוזיקה יהודית ללא הפסקה",
    videoLead: "", arrangementsLead: "", originalLead: ""
  },
  social: {
    instagram: link(/class="soc" href="([^"]+)"[^>]*data-label="אינסטגרם"/),
    tiktok: link(/class="soc" href="([^"]+)"[^>]*data-label="טיקטוק"/),
    facebook: link(/class="soc" href="([^"]+)"[^>]*data-label="פייסבוק"/),
    youtube: ""
  },
  showcase: { video: C.showcase.video, arrangements: C.showcase.arrangements, original: C.showcase.original },
  genres: C.genres
};
for (const [k, p] of [["videoLead", "video"], ["arrangementsLead", "arrangements"], ["originalLead", "original"]]) {
  const h = fs.readFileSync("concepts/orbit/" + p + "/index.html", "utf8");
  content.texts[k] = (h.match(/<p class="lead">([^<]*)<\/p>/) || [])[1] || "";
}
fs.writeFileSync("js/content.js", "/* DIKMAN FM · תוכן שמתעדכן מעמוד הניהול (admin). לא לערוך ידנית: הקובץ נכתב מחדש בכל שמירה. */\nwindow.DKM_CONTENT = " + JSON.stringify(content, null, 1) + ";\n");
console.log("ok", Object.keys(content.social).map(k => k + "=" + content.social[k]).join(" "), content.texts);
