/* כתובת שרת הניהול (Cloudflare Worker). אין כאן שום סוד: הסיסמה נבדקת רק בשרת. */
window.DKM_ADMIN_API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "http://localhost:8787"
  : "https://dikmanfm-admin.dikmanfm.workers.dev";
