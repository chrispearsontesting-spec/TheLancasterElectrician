// Dipstick mechanic uploads (Cloudflare Worker logic). Imported by uploads-worker.js and the local tests.
// Storage: R2 bucket bound as UPLOADS.
//   reg/{uploadId}.json             -> {h: sha256(ownerKey) hex, t: registered/refreshed ms}
//   job/{uploadId}/{jobId}/fN.ext    -> uploaded files
//   job/{uploadId}/{jobId}/meta.json -> job details, written LAST so half-finished uploads are never listed
// Lifecycle on the bucket deletes job/ objects after 14 days (backstop; the owner's app deletes on download).
// Owner endpoints need header X-Owner-Key; only its SHA-256 is ever stored.

const ALLOWED_ORIGINS = ["https://thelancasterelectrician.com", "https://www.thelancasterelectrician.com"];
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
export const LIMITS = { maxFiles: 10, maxFileBytes: 10 * 1024 * 1024, maxJobBytes: 50 * 1024 * 1024, maxPendingJobs: 20, maxNote: 4000, maxShort: 100, maxTitle: 80 };
const ID_RE = /^[A-Za-z0-9_-]{22,43}$/;     // 128-256 bit base64url
const HASH_RE = /^[a-f0-9]{64}$/;
const JOB_RE = /^[a-z0-9]{8,12}-[a-f0-9]{8}$/;
const FILE_RE = /^f\d{1,2}\.(jpg|png|webp|heic|pdf)$/;
const MEM_WINDOW_MS = 60000;
const memHits = new Map();

export function originAllowed(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (DEV_ORIGIN.test(origin) && (env && env.ALLOW_LOCALHOST) !== "0") return true;
  const extra = String((env && env.EXTRA_ORIGINS) || "").split(",").map(s => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

export function memLimit(key, limit, now = Date.now()) {
  const rec = memHits.get(key);
  if (!rec || now - rec.start >= MEM_WINDOW_MS) {
    memHits.set(key, { start: now, n: 1 });
    if (memHits.size > 5000) { for (const [k, v] of memHits) { if (now - v.start >= MEM_WINDOW_MS) memHits.delete(k); } }
    return true;
  }
  rec.n++;
  return rec.n <= limit;
}

async function allow(req, env, kind) {
  const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
  const binding = kind === "write" ? env.UPLOAD_LIMITER : env.READ_LIMITER;
  if (binding && typeof binding.limit === "function") {
    try { const { success } = await binding.limit({ key: kind + ":" + ip }); return success; } catch (e) { /* fall back */ }
  }
  return memLimit(kind + ":" + ip, kind === "write" ? 10 : 120);
}

export function _resetForTests() { memHits.clear(); }

export async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

// Identify file type from its first bytes, never from the name or the browser's claim.
function findAscii(u8, str, from, to) {
  const end = Math.min(u8.length, to) - str.length;
  const c0 = str.charCodeAt(0);
  outer: for (let i = Math.max(0, from); i <= end; i++) {
    if (u8[i] !== c0) continue;
    for (let k = 1; k < str.length; k++) if (u8[i + k] !== str.charCodeAt(k)) continue outer;
    return i;
  }
  return -1;
}
// HTML / SVG / XML / script at the start (after optional BOM/whitespace) is never accepted.
function looksLikeMarkup(u8) {
  let i = 0;
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) i = 3;
  while (i < u8.length && (u8[i] === 0x20 || u8[i] === 0x09 || u8[i] === 0x0a || u8[i] === 0x0d)) i++;
  if (u8[i] === 0x3c) return true; // '<'
  const head = new TextDecoder("latin1").decode(u8.subarray(i, i + 1024)).toLowerCase();
  return /<\s*(script|html|!doctype|svg|iframe|body|head|\?xml)/.test(head) || /^(#!|function\b|var\b|let\b|const\b|import\b)/.test(head);
}
export function hexHead(u8, n = 8) { return [...u8.subarray(0, n)].map(b => b.toString(16).padStart(2, "0")).join(" "); }

export function sniff(u8, name) {
  const s = (i, str) => [...str].every((c, k) => u8[i + k] === c.charCodeAt(0));
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (u8.length >= 8 && u8[0] === 0x89 && s(1, "PNG")) return { ext: "png", type: "image/png" };
  if (u8.length >= 12 && s(0, "RIFF") && s(8, "WEBP")) return { ext: "webp", type: "image/webp" };
  if (u8.length >= 12 && s(4, "ftyp") && ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].some(b => s(8, b))) return { ext: "heic", type: "image/heic" };
  if (u8.length >= 5 && s(0, "%PDF-")) return { ext: "pdf", type: "application/pdf" };
  // Some PDFs (scanner apps, email exports, linearised/encrypted files) have junk before the header.
  // Accept "%PDF-" anywhere in the first 64 KB, but never if the file looks like HTML or script.
  if (looksLikeMarkup(u8)) return null;
  const PDF = { ext: "pdf", type: "application/pdf" };
  if (findAscii(u8, "%PDF-", 0, 64 * 1024) >= 0) return PDF;
  // Named .pdf: accept "%PDF" (no dash) in the first 64 KB, or a "%%EOF" trailer in the last 2 KB.
  if (/\.pdf$/i.test(String(name || "")) && (findAscii(u8, "%PDF", 0, 64 * 1024) >= 0 || findAscii(u8, "%%EOF", Math.max(0, u8.length - 2048), u8.length) >= 0)) return PDF;
  return null;
}

function cleanText(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}
function cleanName(v) {
  return cleanText(v, 80).replace(/[\\/:*?"<>|]/g, "_") || "file";
}
// Per-file title typed by the mechanic: one line, no control chars, max 80 chars.
export function cleanTitle(v) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, LIMITS.maxTitle).trim();
}
function newJobId(now) {
  const r = new Uint8Array(4); crypto.getRandomValues(r);
  return now.toString(36) + "-" + [...r].map(b => b.toString(16).padStart(2, "0")).join("");
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Owner-Key",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}
function json(obj, status, h) {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function getReg(env, id) {
  const o = await env.UPLOADS.get("reg/" + id + ".json");
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch (e) { return null; }
}
async function ownerOk(req, env, id) {
  const key = req.headers.get("X-Owner-Key") || "";
  if (!ID_RE.test(key)) return false;
  const reg = await getReg(env, id);
  if (!reg) return false;
  return sameHex(await sha256hex(key), reg.h);
}
async function listJobMetas(env, id) {
  const metas = [];
  let cursor;
  do {
    const page = await env.UPLOADS.list({ prefix: "job/" + id + "/", cursor });
    for (const o of page.objects) if (o.key.endsWith("/meta.json")) metas.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return metas;
}

export async function handle(req, env) {
  const origin = req.headers.get("Origin") || "";
  if (!originAllowed(origin, env)) return json({ error: "Origin not allowed" }, 403, {});
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (!env.UPLOADS) return json({ error: "Storage not configured" }, 500, h);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const route = parts[0] || "";
  const id = parts[1] || "";
  const write = (req.method === "POST");
  if (!(await allow(req, env, write ? "write" : "read"))) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });

  try {
    // Owner registers (or refreshes) the hash of its secret key for an upload ID.
    if (route === "register" && req.method === "POST" && parts.length === 1) {
      let body; try { body = await req.json(); } catch (e) { return json({ error: "Bad JSON" }, 400, h); }
      const uid = String(body && body.uploadId || ""), hash = String(body && body.ownerKeyHash || "").toLowerCase();
      if (!ID_RE.test(uid) || !HASH_RE.test(hash)) return json({ error: "Bad uploadId or ownerKeyHash" }, 400, h);
      const reg = await getReg(env, uid);
      if (reg && !sameHex(reg.h, hash)) return json({ error: "Upload ID already registered" }, 409, h);
      await env.UPLOADS.put("reg/" + uid + ".json", JSON.stringify({ h: hash, t: Date.now(), c: reg ? reg.c : Date.now() }), { httpMetadata: { contentType: "application/json" } });
      return json({ ok: true, created: !reg }, reg ? 200 : 201, h);
    }

    if (!ID_RE.test(id)) return json({ error: "Not found" }, 404, h);

    // Mechanic page: is this link live?
    if (route === "info" && req.method === "GET" && parts.length === 2) {
      const reg = await getReg(env, id);
      if (!reg) return json({ error: "This upload link is not active yet. Ask the owner to open Mechanic uploads in Driv3." }, 404, h);
      return json({ ok: true, limits: LIMITS }, 200, h);
    }

    // Mechanic uploads one job (multipart).
    if (route === "upload" && req.method === "POST" && parts.length === 2) {
      const reg = await getReg(env, id);
      if (!reg) return json({ error: "This upload link is not active. Ask the owner for a new link." }, 404, h);
      const len = parseInt(req.headers.get("Content-Length") || "0", 10);
      if (len > LIMITS.maxJobBytes + 1024 * 1024) return json({ error: "Too big: 50 MB per upload max" }, 413, h);
      if (!/^multipart\/form-data/i.test(req.headers.get("Content-Type") || "")) return json({ error: "Expected multipart/form-data" }, 400, h);
      const pending = await listJobMetas(env, id);
      if (pending.length >= LIMITS.maxPendingJobs) return json({ error: "The owner has too many uploads waiting. Ask them to open Driv3 first." }, 429, h);
      let fd; try { fd = await req.formData(); } catch (e) { return json({ error: "Could not read upload" }, 400, h); }
      const files = fd.getAll("file").filter(f => f && typeof f === "object" && typeof f.arrayBuffer === "function");
      const note = cleanText(fd.get("note"), LIMITS.maxNote);
      if (!files.length && !note) return json({ error: "Add a photo, PDF or note" }, 400, h);
      if (files.length > LIMITS.maxFiles) return json({ error: "Max " + LIMITS.maxFiles + " files per upload" }, 400, h);
      const titles = fd.getAll("title"); // optional, same order as files
      let total = 0;
      const ready = [];
      for (const [fi, f] of files.entries()) {
        if (f.size > LIMITS.maxFileBytes) return json({ error: cleanName(f.name) + " is over 10 MB" }, 413, h);
        total += f.size;
        if (total > LIMITS.maxJobBytes) return json({ error: "Too big: 50 MB per upload max" }, 413, h);
        const buf = new Uint8Array(await f.arrayBuffer());
        if (buf.byteLength === 0) return json({ error: cleanName(f.name) + " is empty. If it's in Google Drive, download it to the phone first", debug: { size: 0, head: "" } }, 400, h);
        const kind = sniff(buf, f.name);
        if (!kind) return json({ error: cleanName(f.name) + " is not a photo or PDF", debug: { size: buf.byteLength, head: hexHead(buf) } }, 415, h);
        ready.push({ buf, kind, name: cleanName(f.name), title: cleanTitle(typeof titles[fi] === "string" ? titles[fi] : "") });
      }
      const mileageRaw = cleanText(fd.get("mileage"), 12).replace(/[,\s]/g, "");
      const mileage = /^\d{1,7}$/.test(mileageRaw) ? parseInt(mileageRaw, 10) : null;
      const now = Date.now();
      const jobId = newJobId(now);
      const base = "job/" + id + "/" + jobId + "/";
      const meta = {
        id: jobId, created: now, note,
        garage: cleanText(fd.get("garage"), LIMITS.maxShort),
        mechanic: cleanText(fd.get("mechanic"), LIMITS.maxShort),
        mileage, files: []
      };
      const written = [];
      try {
        for (let i = 0; i < ready.length; i++) {
          const r = ready[i];
          const key = "f" + i + "." + r.kind.ext;
          await env.UPLOADS.put(base + key, r.buf, { httpMetadata: { contentType: r.kind.type }, customMetadata: r.title ? { title: encodeURIComponent(r.title) } : undefined });
          written.push(base + key);
          const fm = { key, name: r.name, type: r.kind.type, size: r.buf.byteLength };
          if (r.title) fm.title = r.title;
          meta.files.push(fm);
        }
        await env.UPLOADS.put(base + "meta.json", JSON.stringify(meta), { httpMetadata: { contentType: "application/json" } });
      } catch (e) {
        if (written.length) await env.UPLOADS.delete(written).catch(() => {});
        throw e;
      }
      return json({ ok: true, jobId, files: meta.files.length }, 201, h);
    }

    // Owner-only routes from here.
    if (!["list", "file", "job"].includes(route)) return json({ error: "Not found" }, 404, h);
    if (!(await ownerOk(req, env, id))) return json({ error: "Not allowed" }, 401, h);

    if (route === "list" && req.method === "GET" && parts.length === 2) {
      const keys = await listJobMetas(env, id);
      const jobs = [];
      for (const k of keys) {
        const o = await env.UPLOADS.get(k);
        if (o) { try { jobs.push(JSON.parse(await o.text())); } catch (e) { /* skip */ } }
      }
      jobs.sort((a, b) => a.created - b.created);
      return json({ jobs }, 200, h);
    }
    if (route === "file" && req.method === "GET" && parts.length === 4 && JOB_RE.test(parts[2]) && FILE_RE.test(parts[3])) {
      const o = await env.UPLOADS.get("job/" + id + "/" + parts[2] + "/" + parts[3]);
      if (!o) return json({ error: "Not found" }, 404, h);
      return new Response(o.body, { status: 200, headers: { ...h, "Content-Type": (o.httpMetadata && o.httpMetadata.contentType) || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    if (route === "job" && req.method === "DELETE" && parts.length === 3 && JOB_RE.test(parts[2])) {
      const prefix = "job/" + id + "/" + parts[2] + "/";
      const keys = [];
      let cursor;
      do {
        const page = await env.UPLOADS.list({ prefix, cursor });
        for (const o of page.objects) keys.push(o.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      if (keys.length) await env.UPLOADS.delete(keys);
      return json({ ok: true, deleted: keys.length }, 200, h);
    }
    return json({ error: "Not found" }, 404, h);
  } catch (e) {
    return json({ error: "Server error" }, 500, h);
  }
}
