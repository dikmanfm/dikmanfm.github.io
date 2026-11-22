/* ==========================================================================
   הגדרות התחנה – זה הקובץ היחיד שצריך לערוך כדי להתאים את האפליקציה
   ========================================================================== */
window.RADIO_CONFIG = {
  stationName: "DIKMAN FM",

  // מצב הדגמה: כל עוד אין כתובת שידור אמיתית, מתנגן צליל הדגמה שנוצר בדפדפן.
  // אחרי שמכניסים את live.url – להעביר ל-false.
  demo: false,

  // ---------- השידור החי ----------
  live: {
    program: "יואלי דיקמן – בשידור חי",
    stationLabel: "קול פליי 107.6FM",
    // ↓↓↓ כאן מדביקים את הכתובת הישירה של השידור (מסתיימת ב-mp3 / aac / m3u8 וכו')
    url: "https://cdn.cybercdn.live/Kol_Barama/Music/icecast.audio",
    nowPlaying: ""          // אופציונלי: status-json.xsl של Icecast
  },

  // ---------- לוח השידורים החיים (שעון ישראל) ----------
  // days: 0=ראשון 1=שני 2=שלישי 3=רביעי 4=חמישי 5=שישי 6=שבת
  // שעת סיום קטנה משעת ההתחלה = עובר חצות.
  schedule: [
    { days: [0, 1, 2, 3, 4], from: "14:00", to: "16:00", label: "צהריים" },
    // ליל חמישי – "לילה מנצח": מחצות (כלומר שישי 00:00) ועד 04:00 לפנות בוקר
    { days: [5], from: "00:00", to: "04:00", label: "ליל חמישי" }
  ],
  // כמה דקות להמשיך בשידור החי אחרי שעת הסיום (אם התוכנית נמשכת מעט)
  liveExtraMinutes: 0,

  // ---------- שידורים חוזרים (כל השעות שאין שידור חי) ----------
  rotation: {
    shuffle: true,          // סדר אקראי, בלי חזרה עד שכל ההקלטות התנגנו
    category: ""            // ריק = כל הארכיון. אפשר להגביל, למשל "תוכניות"
  },

  // קובץ הארכיון שנבנה מערוץ הטלגרם (server/telegram-sync.mjs)
  episodesUrl: "data/episodes.json",

  // מחוגי VU לפי השמע האמיתי – רק אם שרת השידור מאפשר CORS
  realMeters: false,

  // מצב שבת: חוסם השמעה מכניסת שבת עד צאת השבת, לפי שקיעה מחושבת – בנפרד לכל אזור.
  // הגולש מקבל את האזור שלו לפי אזור הזמן של הדפדפן (match). שבת בישראל לא חוסמת את ניו יורק, ולהפך.
  // הפלייליסט שלך · לפי סגנון. בכל סגנון items: מזהה פרק מהארכיון ("masster_play-46")
  // או שיר בודד { title: "שם", url: "https://…mp3", duration: 240 }. הקבצים חייבים להיות ב-https.
  genres: [
    { id: "hasidi",  name: "חסידי",            en: "HASIDIC",     note: "ניגונים, שמחה וקלאסיקות חסידיות", items: [] },
    { id: "mizrahi", name: "מזרחי",            en: "MIZRAHI",     note: "פיוטים, ים תיכוני ושירי נשמה",   items: [] },
    { id: "alt-il",  name: "אלטרנטיבי ישראלי", en: "ALT · IL",    note: "יהודי עכשווי, גיטרות ואינדי",    items: [] },
    { id: "us-jew",  name: "אמריקאי יהודי",    en: "JEWISH · US", note: "פופ יהודי מניו יורק ומעבר לים",  items: [] }
  ],

  // הדפים "עוד מיואלי" (הלחצנים העגולים ב-Orbit). כל הקישורים חייבים להיות ב-https.
  //   video:        { youtube: "מזהה הסרטון", title: "שם השיר", sub: "שורת משנה" } (אפשר גם date, place)
  //                 או { title, url: "https://…mp4" }
  //   arrangements: { title: "שם השיר", artist: "מבצע", role: "עיבוד" / "לחן" / "עיבוד ולחן", url: "https://…mp3", duration: 240 }
  //   original:     { title: "שם השיר", note: "שורה קצרה", url: "https://…mp3" או "concepts/orbit/audio/קובץ.mp3", duration: 240 }
  showcase: {
    video: [
      { youtube: "j1JJRKhyjxg", title: "אוברטורת פתיחה · Ruslan & Ludmila", sub: "יואלי דיקמן · מופע השקת האלבום \"תדבר איתו\" של שמוליק סוכות" },
      { youtube: "KSmkAuIX_6o", title: "תדבר איתו", sub: "בניני האומה LIVE · שמוליק סוכות & יואלי דיקמן" },
      { youtube: "0eaKyLjWstc", title: "שרים MBD", sub: "LIVE · קובי ברומר, יואלי דיקמן ומקהלת נשמה" },
      { youtube: "C-Hrpg-AOJc", title: "הילד הזה", sub: "בניני האומה LIVE · שמוליק סוכות & יואלי דיקמן" },
      { youtube: "dsE4eGVL-r4", title: "גיבור עולם", sub: "בניני האומה LIVE · שמוליק סוכות & יואלי דיקמן" },
      { youtube: "Zy2fWaUDvY8", title: "רואה אותי", sub: "בניני האומה LIVE · שמוליק סוכות & יואלי דיקמן" },
      { youtube: "MQPPWvylKsg", title: "תסתכל לשמים", sub: "בניני האומה LIVE · שמוליק סוכות & יואלי דיקמן" },
      { youtube: "PdGBxsJUSPE", title: "עברתי בחושך", sub: "קולולחן Live · שמוליק סוכות, בנצי שטיין ויואלי דיקמן" }
    ],
    arrangements: [],
    original: [
      { title: "פתחי לי",          url: "concepts/orbit/audio/pitchi-li.mp3",                duration: 297 },
      { title: "ואפיל תחינתי",     note: "גרסה ווקאלית", url: "concepts/orbit/audio/vayapil-techinati-vocal.mp3", duration: 341 },
      { title: "למצוא חן",         url: "concepts/orbit/audio/limtzo-chen.mp3",              duration: 329 },
      { title: "ואפיל תחינתי",     url: "concepts/orbit/audio/vayapil-techinati.mp3",        duration: 341 },
      { title: "ישתבח שמך",        note: "גרסה ווקאלית", url: "concepts/orbit/audio/yishtabach-shimcha-vocal.mp3", duration: 259 },
      { title: "נושם שלמות",       url: "concepts/orbit/audio/noshem-shlemut.mp3",           duration: 303 },
      { title: "טאטע למה",         note: "אהרלה סאמעט ויואלי גרינפלד", url: "concepts/orbit/audio/tate-lama.mp3", duration: 260 },
      { title: "תפילה לחופה",      url: "concepts/orbit/audio/tefila-lachupa.mp3",           duration: 319 }
    ]

  },

  shabbat: {
    enabled: true,
    fallbackRegion: "il",          // אזור זמן לא מוכר (אירופה וכו') → לפי ישראל
    regions: {
      il: {
        name: "ישראל", tz: "Asia/Jerusalem",
        lat: 31.778, lng: 35.235,  // ירושלים. לבני ברק: 32.084, 34.834
        candleMinutes: 40, havdalaMinutes: 40,
        match: ["Asia/Jerusalem", "Asia/Tel_Aviv", "Israel"]
      },
      ny: {
        name: "ניו יורק", tz: "America/New_York",
        lat: 40.7128, lng: -74.006,
        candleMinutes: 18, havdalaMinutes: 50,
        match: ["America/", "US/", "Canada/"]   // כל יבשת אמריקה מקבלת את זמני ניו יורק
      }
    },
    // חגים: תאריכי לוח של האזור. אפשר גם רשימה נפרדת בתוך אזור (holidays) – למשל יום טוב שני בחו"ל
    holidays: [
      // { name: "פסח", start: "2027-04-21", end: "2027-04-22" }
    ]
  }
};
