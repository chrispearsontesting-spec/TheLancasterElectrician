// Driv3 "Share for sale" reports (Cloudflare Worker logic, part of dipstick-uploads).
// Storage in the same R2 bucket (UPLOADS):
//   share/{id}/fN.ext     -> photos / PDFs chosen by the owner (sniffed by bytes, like mechanic uploads)
//   share/{id}/meta.json  -> {h: sha256(revokeKey), created, expires, report, files:[{n,type,size,ext}]}, written LAST
//   After revoke: everything deleted except a tiny tombstone meta {revoked:true, created, expires} so buyers see "revoked".
// Lifecycle rule on the bucket deletes share/ objects after 30 days; expiry is also checked here.
// POST/DELETE only from the app's origins. GET is public by link (unguessable 128-bit id).
import { originAllowed, memLimit, sha256hex, sniff, cleanTitle } from "./uploads-lib.js";

export const SHARE = { maxFiles: 40, maxBytes: 25 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024, maxReportBytes: 256 * 1024, ttlMs: 30 * 86400000 };
const SID_RE = /^[A-Za-z0-9_-]{22}$/;
const RKEY_RE = /^[A-Za-z0-9_-]{43}$/;

function b64url(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  let s = ""; for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function hdrs(origin, env) {
  const h = { "Vary": "Origin", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
  if (originAllowed(origin, env)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, X-Revoke-Key";
    h["Access-Control-Max-Age"] = "600";
  } else {
    h["Access-Control-Allow-Origin"] = "*"; // public read by link
    h["Access-Control-Allow-Methods"] = "GET";
  }
  return h;
}
function json(obj, status, h) {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
async function limited(req, env, kind) {
  const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
  const b = kind === "write" ? env.UPLOAD_LIMITER : env.READ_LIMITER;
  if (b && typeof b.limit === "function") {
    try { const { success } = await b.limit({ key: "share-" + kind + ":" + ip }); return !success; } catch (e) { /* fall back */ }
  }
  return !memLimit("share-" + kind + ":" + ip, kind === "write" ? 10 : 120);
}
async function getMeta(env, id) {
  const o = await env.UPLOADS.get("share/" + id + "/meta.json");
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch (e) { return null; }
}
async function listKeys(env, prefix) {
  const keys = []; let cursor;
  do {
    const page = await env.UPLOADS.list({ prefix, cursor });
    for (const o of page.objects) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}
async function wipe(env, id, keepMeta) {
  const keys = (await listKeys(env, "share/" + id + "/")).filter(k => !(keepMeta && k.endsWith("/meta.json")));
  for (let i = 0; i < keys.length; i += 900) await env.UPLOADS.delete(keys.slice(i, i + 900));
  return keys.length;
}
function gone(meta, now) {
  if (!meta) return { status: 404, body: { error: "This report link doesn't exist or has been removed.", state: "missing" } };
  if (meta.revoked) return { status: 410, body: { error: "The seller has withdrawn this report.", state: "revoked", expires: meta.expires } };
  if (!(meta.expires > now)) return { status: 410, body: { error: "This report has expired.", state: "expired", expires: meta.expires } };
  return null;
}

export async function handleShare(req, env, parts, now = Date.now()) {
  const origin = req.headers.get("Origin") || "";
  const h = hdrs(origin, env);
  const appOrigin = originAllowed(origin, env);
  if (req.method === "OPTIONS") return new Response(null, { status: appOrigin ? 204 : 403, headers: h });
  if (!env.UPLOADS) return json({ error: "Storage not configured" }, 500, h);
  const id = parts[1] || "";
  try {
    // ---- Create ----
    if (req.method === "POST" && parts.length === 1) {
      if (!appOrigin) return json({ error: "Origin not allowed" }, 403, h);
      if (await limited(req, env, "write")) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });
      const len = parseInt(req.headers.get("Content-Length") || "0", 10);
      if (len > SHARE.maxBytes + SHARE.maxReportBytes + 512 * 1024) return json({ error: "Too big: 25 MB per report max. Untick some files." }, 413, h);
      if (!/^multipart\/form-data/i.test(req.headers.get("Content-Type") || "")) return json({ error: "Expected multipart/form-data" }, 400, h);
      let fd; try { fd = await req.formData(); } catch (e) { return json({ error: "Could not read report" }, 400, h); }
      const rawReport = fd.get("report");
      if (typeof rawReport !== "string" || !rawReport.length) return json({ error: "Missing report" }, 400, h);
      if (new TextEncoder().encode(rawReport).length > SHARE.maxReportBytes) return json({ error: "Report text too big" }, 413, h);
      let report; try { report = JSON.parse(rawReport); } catch (e) { return json({ error: "Bad report JSON" }, 400, h); }
      if (!report || typeof report !== "object" || Array.isArray(report)) return json({ error: "Bad report JSON" }, 400, h);
      const files = fd.getAll("file").filter(f => f && typeof f === "object" && typeof f.arrayBuffer === "function");
      if (files.length > SHARE.maxFiles) return json({ error: "Max " + SHARE.maxFiles + " files per report" }, 400, h);
      const titles = fd.getAll("title");
      let total = 0; const ready = [];
      for (const [i, f] of files.entries()) {
        if (f.size > SHARE.maxFileBytes) return json({ error: "A file is over 10 MB" }, 413, h);
        total += f.size;
        if (total > SHARE.maxBytes) return json({ error: "Too big: 25 MB per report max. Untick some files." }, 413, h);
        const buf = new Uint8Array(await f.arrayBuffer());
        if (!buf.byteLength) return json({ error: "File " + (i + 1) + " is empty" }, 400, h);
        const kind = sniff(buf, f.name);
        if (!kind) return json({ error: "File " + (i + 1) + " is not a photo or PDF" }, 415, h);
        ready.push({ buf, kind, title: cleanTitle(typeof titles[i] === "string" ? titles[i] : "") });
      }
      const sid = b64url(16), revokeKey = b64url(32);
      const base = "share/" + sid + "/";
      const meta = { h: await sha256hex(revokeKey), created: now, expires: now + SHARE.ttlMs, report, files: [] };
      const written = [];
      try {
        for (let i = 0; i < ready.length; i++) {
          const r = ready[i], key = base + "f" + i + "." + r.kind.ext;
          await env.UPLOADS.put(key, r.buf, { httpMetadata: { contentType: r.kind.type } });
          written.push(key);
          meta.files.push({ n: i, type: r.kind.type, ext: r.kind.ext, size: r.buf.byteLength, title: r.title });
        }
        await env.UPLOADS.put(base + "meta.json", JSON.stringify(meta), { httpMetadata: { contentType: "application/json" } });
      } catch (e) {
        if (written.length) await env.UPLOADS.delete(written).catch(() => {});
        throw e;
      }
      return json({ ok: true, id: sid, revokeKey, created: meta.created, expires: meta.expires, files: meta.files.length, bytes: total }, 201, h);
    }

    if (!SID_RE.test(id)) return json({ error: "This report link doesn't exist or has been removed.", state: "missing" }, 404, h);

    // ---- Revoke ----
    if (req.method === "DELETE" && parts.length === 2) {
      if (!appOrigin) return json({ error: "Origin not allowed" }, 403, h);
      if (await limited(req, env, "write")) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });
      const key = req.headers.get("X-Revoke-Key") || "";
      const meta = await getMeta(env, id);
      if (!meta) return json({ error: "Already gone", state: "missing" }, 404, h);
      if (!RKEY_RE.test(key) || !meta.h || !sameHex(await sha256hex(key), meta.h)) return json({ error: "Not allowed" }, 401, h);
      const n = await wipe(env, id, true);
      await env.UPLOADS.put("share/" + id + "/meta.json", JSON.stringify({ revoked: true, created: meta.created, expires: meta.expires, revokedAt: now }), { httpMetadata: { contentType: "application/json" } });
      return json({ ok: true, deleted: n }, 200, h);
    }

    if (req.method !== "GET") return json({ error: "Not found" }, 404, h);
    if (await limited(req, env, "read")) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });
    const meta = await getMeta(env, id);
    const g = gone(meta, now);
    if (g) {
      if (meta && !meta.revoked && g.body.state === "expired") await wipe(env, id, true).catch(() => {}); // backstop before lifecycle runs
      return json(g.body, g.status, h);
    }
    // ---- Read report ----
    if (parts.length === 2) {
      return json({ ok: true, id, created: meta.created, expires: meta.expires, report: meta.report, files: meta.files.map(f => ({ n: f.n, type: f.type, size: f.size, title: f.title || "" })) }, 200, h);
    }
    // ---- Read one file ----
    if (parts.length === 4 && parts[2] === "file" && /^\d{1,2}$/.test(parts[3])) {
      const f = meta.files.find(x => x.n === parseInt(parts[3], 10));
      if (!f) return json({ error: "Not found" }, 404, h);
      const o = await env.UPLOADS.get("share/" + id + "/f" + f.n + "." + f.ext);
      if (!o) return json({ error: "Not found" }, 404, h);
      return new Response(o.body, { status: 200, headers: { ...h, "Content-Type": f.type, "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline; filename=\"driv3-" + f.n + "." + f.ext + "\"", "Cache-Control": "private, max-age=600" } });
    }
    return json({ error: "Not found" }, 404, h);
  } catch (e) {
    return json({ error: "Server error" }, 500, h);
  }
}
