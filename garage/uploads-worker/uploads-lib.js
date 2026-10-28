// Dipstick mechanic uploads (Cloudflare Worker logic). Imported by uploads-worker.js and the local tests.
// Storage: R2 bucket bound as UPLOADS.
//   reg/{uploadId}.json             -> {h: sha256(ownerKey) hex, t: registered/refreshed ms}
//   job/{uploadId}/{jobId}/fN.ext    -> uploaded files
//   job/{uploadId}/{jobId}/meta.json -> job details, written LAST so half-finished uploads are never listed
// Lifecycle on the bucket deletes job/ objects after 14 days (backstop; the owner's app deletes on download).
// Owner endpoints need header X-Owner-Key; only its SHA-256 is ever stored.
//   reg/{uploadId}.json also holds owner controls: paused (bool), ch (sha256(uploadId+":"+code) of an optional 4-digit job code),
//     retired (old ID after "New link": uploads refused, owner key still works to collect/delete old jobs)
//   lock/{uploadId}.json            -> wrong job-code counter {n, first, until}; 5 wrong in a row locks the ID for 15 minutes
//   share/{id}/...                   -> "Share for sale" reports, see share-lib.js (30-day lifecycle)

import { handleShare } from "./share-lib.js";

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

// ---- Voice notes: POST /transcribe/{uploadId}, raw audio body (webm/opus, ogg, mp4/m4a, wav). ----
export const AUDIO = { maxBytes: 2 * 1024 * 1024, maxSeconds: 60 };
export const WHISPER_MODELS = ["@cf/openai/whisper-large-v3-turbo", "@cf/openai/whisper"];
export function sniffAudio(u8) {
  const s = (i, str) => [...str].every((c, k) => u8[i + k] === c.charCodeAt(0));
  if (u8.length >= 4 && u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return "audio/webm";
  if (u8.length >= 4 && s(0, "OggS")) return "audio/ogg";
  if (u8.length >= 12 && s(4, "ftyp")) return "audio/mp4";
  if (u8.length >= 12 && s(0, "RIFF") && s(8, "WAVE")) return "audio/wav";
  if (u8.length >= 3 && (s(0, "ID3") || (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0))) return "audio/mpeg";
  return null;
}
export function b64(u8) {
  let out = "";
  for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(out);
}
export function cleanTranscript(t) {
  return String(t == null ? "" : t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, LIMITS.maxNote);
}
async function allowTranscribe(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
  const b = env.TRANSCRIBE_LIMITER || env.UPLOAD_LIMITER;
  if (b && typeof b.limit === "function") {
    try { const { success } = await b.limit({ key: "tx:" + ip }); return success; } catch (e) { /* fall back */ }
  }
  return memLimit("tx:" + ip, 10);
}
export const CODE = { maxTries: 5, lockMs: 15 * 60000 };
const CODE_RE = /^\d{4}$/;
export function codeHash(id, code) { return sha256hex(id + ":" + code); }
const RETIRED_MSG = "This QR code has been replaced by the owner. Ask them for the new one.";
const PAUSED_MSG = "The owner has paused uploads for this car. Ask them to turn uploads back on.";
async function getLock(env, id) {
  const o = await env.UPLOADS.get("lock/" + id + ".json");
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch (e) { return null; }
}
// Gate for mechanic-side writes (upload, transcribe, code check). Returns a Response to send, or null if allowed.
async function gate(env, h, id, reg, code, now = Date.now()) {
  if (!reg) return json({ error: "This upload link is not active. Ask the owner for a new link." }, 404, h);
  if (reg.retired) return json({ error: RETIRED_MSG, state: "retired" }, 410, h);
  if (reg.paused) return json({ error: PAUSED_MSG, state: "paused" }, 423, h);
  if (!reg.ch) return null;
  const lock = await getLock(env, id);
  if (lock && lock.until > now) {
    const mins = Math.max(1, Math.ceil((lock.until - now) / 60000));
    return json({ error: "Too many wrong codes. This link is locked for " + mins + " minute" + (mins > 1 ? "s" : "") + ". Check the code with the owner.", state: "locked", retryAfter: mins * 60 }, 429, { ...h, "Retry-After": String(mins * 60) });
  }
  code = String(code || "").trim();
  if (CODE_RE.test(code) && sameHex(await codeHash(id, code), reg.ch)) {
    if (lock) await env.UPLOADS.delete("lock/" + id + ".json");
    return null;
  }
  if (!code) return json({ error: "Enter the 4-digit job code from the owner.", state: "code" }, 403, h);
  const restart = !lock || lock.until || now - (lock.first || 0) > CODE.lockMs; // first miss, after a lock ended, or old misses
  const n = restart ? 1 : (lock.n || 0) + 1;
  const rec = { n, first: n === 1 ? now : lock.first, until: 0 };
  if (n >= CODE.maxTries) { rec.n = 0; rec.until = now + CODE.lockMs; }
  await env.UPLOADS.put("lock/" + id + ".json", JSON.stringify(rec), { httpMetadata: { contentType: "application/json" } });
  if (rec.until) return json({ error: "Too many wrong codes. This link is locked for 15 minutes. Check the code with the owner.", state: "locked", retryAfter: 900 }, 429, { ...h, "Retry-After": "900" });
  const left = CODE.maxTries - n;
  return json({ error: "That code isn't right. " + left + " tr" + (left > 1 ? "ies" : "y") + " left.", state: "code", triesLeft: left }, 403, h);
}

async function transcribe(req, env, h, id) {
  if (!(await allowTranscribe(req, env))) return json({ error: "Too many voice notes, try again in a minute" }, 429, { ...h, "Retry-After": "60" });
  if (!ID_RE.test(id)) return json({ error: "Not found" }, 404, h);
  if (!env.AI || typeof env.AI.run !== "function") return json({ error: "Voice notes are not available" }, 503, h);
  const g = await gate(env, h, id, await getReg(env, id), req.headers.get("X-Job-Code"));
  if (g) return g;
  const len = parseInt(req.headers.get("Content-Length") || "0", 10);
  if (len > AUDIO.maxBytes) return json({ error: "Voice note too long (60 seconds max)" }, 413, h);
  const u8 = new Uint8Array(await req.arrayBuffer());
  if (u8.length > AUDIO.maxBytes) return json({ error: "Voice note too long (60 seconds max)" }, 413, h);
  if (u8.length < 200) return json({ error: "Nothing recorded" }, 400, h);
  if (!sniffAudio(u8)) return json({ error: "Unsupported audio format" }, 415, h);
  const audio = b64(u8);
  let lastErr;
  for (const model of WHISPER_MODELS) {
    try {
      const input = model.includes("turbo") ? { audio, language: "en", task: "transcribe", vad_filter: true, initial_prompt: "UK garage job notes: tyres, MOT, brake pads, discs, mm." } : { audio: [...u8] };
      const out = await env.AI.run(model, input);
      return json({ text: cleanTranscript(out && out.text) }, 200, h);
    } catch (e) { lastErr = e; }
  }
  console.log("transcribe failed", String(lastErr && lastErr.message || lastErr));
  return json({ error: "Couldn't transcribe that, try again" }, 502, h);
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
    "Access-Control-Allow-Headers": "Content-Type, X-Owner-Key, X-Job-Code",
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
  const sp = new URL(req.url).pathname.split("/").filter(Boolean);
  if (sp[0] === "share") return handleShare(req, env, sp);
  const origin = req.headers.get("Origin") || "";
  if (!originAllowed(origin, env)) return json({ error: "Origin not allowed" }, 403, {});
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (!env.UPLOADS) return json({ error: "Storage not configured" }, 500, h);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const route = parts[0] || "";
  const id = parts[1] || "";
  if (route === "transcribe" && req.method === "POST" && parts.length === 2) {
    try { return await transcribe(req, env, h, id); } catch (e) { return json({ error: "Server error" }, 500, h); }
  }
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
      if (reg && reg.retired) return json({ error: "This upload ID was replaced", state: "retired" }, 410, h);
      await env.UPLOADS.put("reg/" + uid + ".json", JSON.stringify({ ...(reg || {}), h: hash, t: Date.now(), c: reg ? reg.c : Date.now() }), { httpMetadata: { contentType: "application/json" } });
      return json({ ok: true, created: !reg, paused: !!(reg && reg.paused), hasCode: !!(reg && reg.ch) }, reg ? 200 : 201, h);
    }

    if (!ID_RE.test(id)) return json({ error: "Not found" }, 404, h);

    // Mechanic page: is this link live?
    if (route === "info" && req.method === "GET" && parts.length === 2) {
      const reg = await getReg(env, id);
      if (!reg) return json({ error: "This upload link is not active yet. Ask the owner to open Mechanic uploads in Driv3." }, 404, h);
      if (reg.retired) return json({ error: RETIRED_MSG, state: "retired" }, 410, h);
      const lock = reg.ch ? await getLock(env, id) : null;
      return json({ ok: true, limits: LIMITS, paused: !!reg.paused, needCode: !!reg.ch, locked: !!(lock && lock.until > Date.now()) }, 200, h);
    }

    // Mechanic page: check the job code before filling the form in (counts towards the 5-try lock).
    if (route === "code" && req.method === "POST" && parts.length === 2) {
      let body = {}; try { body = await req.json(); } catch (e) { /* empty */ }
      const reg = await getReg(env, id);
      if (reg && !reg.retired && !reg.paused && !reg.ch) return json({ ok: true, needCode: false }, 200, h);
      const g = await gate(env, h, id, reg, body && body.code);
      return g || json({ ok: true }, 200, h);
    }

    // Mechanic uploads one job (multipart).
    if (route === "upload" && req.method === "POST" && parts.length === 2) {
      const reg = await getReg(env, id);
      if (!reg) return json({ error: "This upload link is not active. Ask the owner for a new link." }, 404, h);
      const len = parseInt(req.headers.get("Content-Length") || "0", 10);
      const g0 = await gate(env, h, id, reg, req.headers.get("X-Job-Code")); // retired / paused / job code
      if (g0) return g0;
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
    if (!["list", "file", "job", "settings", "retire"].includes(route)) return json({ error: "Not found" }, 404, h);
    if (!(await ownerOk(req, env, id))) return json({ error: "Not allowed" }, 401, h);

    // Owner controls: pause/resume, set/clear the job code. Body {paused?: bool, code?: "1234" | ""}.
    if (route === "settings" && req.method === "POST" && parts.length === 2) {
      let body; try { body = await req.json(); } catch (e) { return json({ error: "Bad JSON" }, 400, h); }
      const reg = await getReg(env, id);
      if (reg.retired) return json({ error: "This upload ID was replaced", state: "retired" }, 410, h);
      if (body && "paused" in body) { if (typeof body.paused !== "boolean") return json({ error: "paused must be true or false" }, 400, h); reg.paused = body.paused; }
      if (body && "code" in body) {
        const code = String(body.code == null ? "" : body.code);
        if (code === "") delete reg.ch;
        else if (CODE_RE.test(code)) reg.ch = await codeHash(id, code);
        else return json({ error: "The code must be 4 digits" }, 400, h);
        await env.UPLOADS.delete("lock/" + id + ".json");
      }
      if (!reg.paused) delete reg.paused;
      reg.t = Date.now();
      await env.UPLOADS.put("reg/" + id + ".json", JSON.stringify(reg), { httpMetadata: { contentType: "application/json" } });
      return json({ ok: true, paused: !!reg.paused, hasCode: !!reg.ch }, 200, h);
    }
    // Owner retires this ID after making a new link: mechanics are refused straight away,
    // the owner key keeps working for list/file/job so nothing still waiting is lost.
    if (route === "retire" && req.method === "POST" && parts.length === 2) {
      const reg = await getReg(env, id);
      const pending = (await listJobMetas(env, id)).length;
      await env.UPLOADS.put("reg/" + id + ".json", JSON.stringify({ h: reg.h, c: reg.c, t: Date.now(), retired: true }), { httpMetadata: { contentType: "application/json" } });
      await env.UPLOADS.delete("lock/" + id + ".json");
      return json({ ok: true, retired: true, pending }, 200, h);
    }
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
