/* ==========================================================================
   DIKMAN FM · Admin API (Cloudflare Worker)
   השומר שבין עמוד הניהול (dikmanfm.github.io/admin/) לבין R2 ו-GitHub.
   כל הסודות יושבים כאן בלבד, כ-Secrets של Cloudflare – לא בקוד ולא ב-GitHub:
     ADMIN_PASSWORD   הסיסמה לעמוד הניהול
     SESSION_SECRET   מפתח לחתימת אישור הכניסה (מחרוזת אקראית ארוכה)
     GH_TOKEN         טוקן GitHub מוגבל: רק לריפוזיטורי של האתר, רק Contents: Read and write
   ========================================================================== */

const DOCS = {
  content:  { path: "js/content.js",             kind: "js" },
  episodes: { path: "data/manual-episodes.json", kind: "json" },
  stories:  { path: "data/stories.json",         kind: "json" }
};
const JS_HEAD = "/* DIKMAN FM · תוכן שמתעדכן מעמוד הניהול (admin). לא לערוך ידנית: הקובץ נכתב מחדש בכל שמירה. */\nwindow.DKM_CONTENT = ";
const AREAS = ["laila", "master", "arrangements", "original", "video", "genres", "stories"];
const PART = 8 * 1024 * 1024;               // גודל קבוע לכל חלק (R2 דורש חלקים שווים חוץ מהאחרון)
const MAX_FILE = 600 * 1024 * 1024;          // תקרה לקובץ אחד
const SESSION_HOURS = 12;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = okOrigin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    } : { "Vary": "Origin" };
    const out = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });

    // בדיקות מקומיות בלבד: מגיש את הקבצים שהועלו ל-R2 המדומה
    if (env.DEV_LOCAL_DOCS === "1" && req.method === "GET" && new URL(req.url).pathname.startsWith("/_media/")) {
      const o = await env.BUCKET.get(decodeURIComponent(new URL(req.url).pathname.slice(8)));
      return o ? new Response(o.body, { headers: { "Content-Type": o.httpMetadata.contentType || "application/octet-stream" } }) : new Response("", { status: 404 });
    }
    if (req.method === "OPTIONS") return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!okOrigin) return out({ error: "origin" }, 403);

    const url = new URL(req.url), p = url.pathname;
    try {
      if (p === "/api/login" && req.method === "POST") return out(...(await login(req, env)));

      const sess = await verify(req, env);
      if (!sess) return out({ error: "auth" }, 401);

      if (p === "/api/data" && req.method === "GET") {
        const res = {};
        for (const k of Object.keys(DOCS)) res[k] = await readDoc(env, k);
        return out({ ...res, mediaBase: env.MEDIA_BASE_URL, partSize: PART });
      }
      if (p === "/api/save" && req.method === "POST") {
        const b = await req.json();
        if (!DOCS[b.doc] || typeof b.data !== "object" || !b.data) return out({ error: "bad" }, 400);
        if (!validDoc(b.doc, b.data)) return out({ error: "bad-data" }, 400);
        const r = await writeDoc(env, b.doc, b.data, b.sha || null, String(b.message || "עדכון").slice(0, 120));
        return r.conflict ? out({ error: "conflict" }, 409) : out({ sha: r.sha });
      }
      if (p === "/api/upload/start" && req.method === "POST") {
        const b = await req.json();
        const type = String(b.type || "").toLowerCase(), size = +b.size || 0;
        if (!AREAS.includes(b.area)) return out({ error: "area" }, 400);
        if (!/^(audio|image|video)\/[\w.+-]+$/.test(type)) return out({ error: "type" }, 400);
        if (!size || size > MAX_FILE) return out({ error: "size" }, 400);
        const key = "admin/" + b.area + "/" + newName(b.name, type);
        const up = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
        return out({ key, uploadId: up.uploadId, partSize: PART });
      }
      if (p === "/api/upload/part" && req.method === "PUT") {
        const key = url.searchParams.get("key") || "", id = url.searchParams.get("uploadId") || "", n = +url.searchParams.get("n");
        if (!okKey(key) || !id || !(n >= 1 && n <= 10000)) return out({ error: "bad" }, 400);
        const body = await req.arrayBuffer();
        if (!body.byteLength || body.byteLength > PART) return out({ error: "size" }, 400);
        const part = await env.BUCKET.resumeMultipartUpload(key, id).uploadPart(n, body);
        return out({ n: part.partNumber, etag: part.etag });
      }
      if (p === "/api/upload/complete" && req.method === "POST") {
        const b = await req.json();
        if (!okKey(b.key) || !b.uploadId || !Array.isArray(b.parts) || !b.parts.length) return out({ error: "bad" }, 400);
        const parts = b.parts.map(x => ({ partNumber: +x.n, etag: String(x.etag) })).sort((a, c) => a.partNumber - c.partNumber);
        await env.BUCKET.resumeMultipartUpload(b.key, b.uploadId).complete(parts);
        return out({ url: env.MEDIA_BASE_URL.replace(/\/$/, "") + "/" + b.key.split("/").map(encodeURIComponent).join("/") });
      }
      if (p === "/api/upload/abort" && req.method === "POST") {
        const b = await req.json();
        if (okKey(b.key) && b.uploadId) { try { await env.BUCKET.resumeMultipartUpload(b.key, b.uploadId).abort(); } catch (e) {} }
        return out({ ok: true });
      }
      return out({ error: "not-found" }, 404);
    } catch (e) {
      return out({ error: "server", detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
  }
};

// ---------- כניסה ----------
async function login(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  if (env.LOGIN_LIMIT) {
    const { success } = await env.LOGIN_LIMIT.limit({ key: "login:" + ip });
    if (!success) return [{ error: "slow-down" }, 429];
  }
  let b = {}; try { b = await req.json(); } catch (e) {}
  const pass = typeof b.password === "string" ? b.password : "";
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return [{ error: "not-configured" }, 503];
  const [a, c] = await Promise.all([sha(pass), sha(env.ADMIN_PASSWORD)]);
  if (!pass || !crypto.subtle.timingSafeEqual(a, c)) return [{ error: "wrong" }, 401];
  const exp = Date.now() + SESSION_HOURS * 3600e3;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp })));
  return [{ token: payload + "." + await sign(payload, env), exp }, 200];
}
async function verify(req, env) {
  const h = req.headers.get("Authorization") || "";
  const m = /^Bearer ([\w-]+)\.([\w-]+)$/.exec(h);
  if (!m || !env.SESSION_SECRET) return null;
  const good = await sign(m[1], env);
  const x = new TextEncoder().encode(good), y = new TextEncoder().encode(m[2]);
  if (x.length !== y.length || !crypto.subtle.timingSafeEqual(x, y)) return null;
  let data = null; try { data = JSON.parse(new TextDecoder().decode(unb64url(m[1]))); } catch (e) { return null; }
  return data && data.exp > Date.now() ? data : null;
}
async function sign(s, env) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s))));
}
async function sha(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
function b64url(bytes) { let s = ""; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64url(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

// ---------- קבצים ----------
function okKey(k) { return typeof k === "string" && /^admin\/[a-z]+\/[\w.-]+$/.test(k); }
function newName(name, type) {
  const ext = (String(name || "").match(/\.([a-z0-9]{2,5})$/i) || [])[1] || ({ "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov" })[type] || "bin";
  const d = new Date().toISOString().slice(0, 10);
  const rnd = b64url(crypto.getRandomValues(new Uint8Array(6))).toLowerCase().replace(/[^a-z0-9]/g, "x");
  return d + "-" + rnd + "." + ext.toLowerCase();
}

// ---------- מסמכי התוכן (GitHub, או אחסון מקומי בבדיקות) ----------
function validDoc(doc, d) {
  if (JSON.stringify(d).length > 900000) return false;
  if (doc === "episodes" || doc === "stories") return Array.isArray(d.items);
  if (doc === "content") return typeof d.showcase === "object" && Array.isArray(d.genres);
  return false;
}
function serialize(doc, data) {
  const json = JSON.stringify(data, null, 1);
  return DOCS[doc].kind === "js" ? JS_HEAD + json + ";\n" : json + "\n";
}
function parse(doc, text) {
  if (DOCS[doc].kind === "js") {
    const i = text.indexOf("window.DKM_CONTENT = ");
    text = text.slice(i + 21).trim().replace(/;\s*$/, "");
  }
  return JSON.parse(text);
}
async function readDoc(env, doc) {
  if (env.DEV_LOCAL_DOCS === "1") {                       // בדיקות מקומיות בלבד
    const o = await env.BUCKET.get("_dev/" + DOCS[doc].path);
    if (!o) return { data: doc === "content" ? null : { items: [] }, sha: null };
    const t = await o.text(); return { data: parse(doc, t), sha: o.etag };
  }
  const r = await gh(env, "GET", "/contents/" + DOCS[doc].path + "?ref=" + (env.GH_BRANCH || "main"));
  if (r.status === 404) return { data: doc === "content" ? null : { items: [] }, sha: null };
  if (!r.ok) throw new Error("github read " + r.status);
  const j = await r.json();
  return { data: parse(doc, utf8(j.content)), sha: j.sha };
}
async function writeDoc(env, doc, data, sha, message) {
  const text = serialize(doc, data);
  if (env.DEV_LOCAL_DOCS === "1") {
    const cur = await env.BUCKET.head("_dev/" + DOCS[doc].path);
    if ((cur ? cur.etag : null) !== sha) return { conflict: true };
    const o = await env.BUCKET.put("_dev/" + DOCS[doc].path, text); return { sha: o.etag };
  }
  const body = { message: "ניהול: " + message, content: b64utf8(text), branch: env.GH_BRANCH || "main",
    committer: { name: "dikmanfm-admin", email: "admin-bot@users.noreply.github.com" } };
  if (sha) body.sha = sha;
  const r = await gh(env, "PUT", "/contents/" + DOCS[doc].path, body);
  if (r.status === 409 || r.status === 422) return { conflict: true };
  if (!r.ok) throw new Error("github write " + r.status);
  return { sha: (await r.json()).content.sha };
}
function gh(env, method, path, body) {
  return fetch("https://api.github.com/repos/" + env.GH_REPO + path, {
    method,
    headers: { "Authorization": "Bearer " + env.GH_TOKEN, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "dikmanfm-admin" },
    body: body ? JSON.stringify(body) : undefined
  });
}
function utf8(b64) { return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0))); }
function b64utf8(text) {
  const bytes = new TextEncoder().encode(text); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
