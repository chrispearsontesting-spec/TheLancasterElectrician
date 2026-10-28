// Driv3 "Show mode" car showcases (Cloudflare Worker logic, part of dipstick-uploads).
// Storage in the same R2 bucket (UPLOADS), separate random showId (never the upload ID):
//   show/{sid}/meta.json  -> {h: sha256(showKey), created, t, published, files: {name: bytes}}
//   show/{sid}/card.json  -> sanitised public card (written on Publish)
//   show/{sid}/f/{name}   -> photos (p*.jpg|png|webp, sniffed, <=1.5 MB each, 15 MB total) and clips (c*.mp4|webm, 20 MB total)
// Unpublish deletes everything under show/{sid}/. No lifecycle rule: a published showcase stays until unpublished.
// Writes need X-Show-Key and the app's origin. GETs are public by link (unguessable 128-bit id), noindex.
import { originAllowed, memLimit, sha256hex } from "./uploads-lib.js";

export const SHOW = {
  maxPhotoBytes: 1.5 * 1024 * 1024, maxPhotoTotal: 15 * 1024 * 1024, maxPhotosStored: 24,
  maxClipBytes: 20 * 1024 * 1024, maxClipTotal: 20 * 1024 * 1024, maxClips: 2,
  maxCardBytes: 64 * 1024, maxGallery: 12, maxVideos: 12, maxSocials: 12, maxMods: 40
};
export const SHOW_ID_RE = /^[A-Za-z0-9_-]{22}$/;
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const FILE_RE = /^(p[a-z0-9]{12}\.(jpg|png|webp)|c[a-z0-9]{12}\.(mp4|webm))$/;
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };

function rnd(n, alpha) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => alpha[b % alpha.length]).join(""); }
export function b64url(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  let s = ""; for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

// ---------- sanitising / parsing (also unit-tested) ----------
export function cleanLine(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f\u2028\u2029<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}
export function cleanText(v, max) { // keeps line breaks, max 2 in a row
  return String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029<>]/g, " ")
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max).trim();
}
function num(v, min, max, dp) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/,/g, "")); if (!isFinite(n) || n < min || n > max) return null;
  const f = Math.pow(10, dp || 0); return Math.round(n * f) / f;
}
function url(u) { try { const x = new URL(String(u || "").trim()); return x; } catch (e) { return null; } }
export function youtubeId(u) {
  const s = String(u || "").trim(); if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const x = url(s); if (!x || x.protocol !== "https:" && x.protocol !== "http:") return null;
  const host = x.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id = null;
  if (host === "youtu.be") id = x.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (x.pathname === "/watch") id = x.searchParams.get("v");
    else { const m = x.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/); if (m) id = m[2]; }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export function playlist(u) {
  const x = url(u); if (!x || x.protocol !== "https:") return null;
  const host = x.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "open.spotify.com") {
    const m = x.pathname.replace(/^\/intl-[a-z]{2}(-[a-z]{2})?\//i, "/").match(/^\/(embed\/)?(playlist|album)\/([A-Za-z0-9]{22})$/);
    return m ? { kind: "spotify", type: m[2], id: m[3] } : null;
  }
  if (host === "music.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
    const id = x.searchParams.get("list");
    return id && /^[A-Za-z0-9_-]{10,64}$/.test(id) ? { kind: "ytmusic", id } : null;
  }
  return null;
}

  // Instagram / Facebook post links -> embed descriptor (nothing hosted by us; strict host + path allowlist).
export function social(u) {
    let x=url(u); if(!x||x.protocol!=="https:"||x.username||x.password||String(u).length>500) return null;
    let host=x.hostname.toLowerCase(), path=x.pathname.replace(/\/+$/,"");
    if(host==="instagram.com"||host==="www.instagram.com"){
      let m=path.match(/^(?:\/[A-Za-z0-9._]{1,30})?\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})$/);
      return m?{kind:"ig",type:m[1]==="reels"?"reel":m[1],code:m[2]}:null;
    }
    if(host==="fb.watch"){ return /^\/[A-Za-z0-9_-]{4,40}$/.test(path)?{kind:"fb",type:"video",href:"https://fb.watch"+path+"/"}:null; }
    if(/^(www\.|m\.|web\.)?facebook\.com$/.test(host)){
      if(!/^\/[A-Za-z0-9._\/-]{1,200}$/.test(path)||/^\/(plugins|dialog|login|sharer|l\.php)/.test(path)) return null;
      let keep=["story_fbid","id","v","fbid"], q=[];
      keep.forEach(function(k){ let v=x.searchParams.get(k); if(v&&/^[A-Za-z0-9._-]{1,40}$/.test(v)) q.push(k+"="+v); });
      if(/^\/(permalink|photo|story)\.php$/.test(path)&&!q.length) return null;
      if(path==="/watch"&&!x.searchParams.get("v")) return null;
      let video=/\/(videos|reel|watch)(\/|$)/.test(path+"/");
      return {kind:"fb",type:video?"video":"post",href:"https://www.facebook.com"+path+(q.length?"?"+q.join("&"):"")};
    }
    return null;
  }

export function httpsImage(u) {
  const x = url(u); if (!x || x.protocol !== "https:" || x.username || x.password || String(u).length > 500) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x.hostname)) return null;
  return x.toString();
}
export function instaHandle(v) {
  let s = String(v || "").trim();
  const x = url(s); if (x && /(^|\.)instagram\.com$/i.test(x.hostname)) s = x.pathname.split("/")[1] || "";
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
}
// Build the public card from what the owner sent. Only whitelisted fields survive; files must exist in this showcase.
export function sanitizeCard(c, files) {
  c = c && typeof c === "object" ? c : {};
  const has = n => typeof n === "string" && FILE_RE.test(n) && Object.prototype.hasOwnProperty.call(files || {}, n);
  const b = c.basics || {}, s = c.stats || {}, best = s.best || {};
  const out = {
    v: 1,
    title: cleanLine(c.title, 40),
    basics: { make: cleanLine(b.make, 30), model: cleanLine(b.model, 40), variant: cleanLine(b.variant, 40), year: num(b.year, 1885, 2100), colour: cleanLine(b.colour, 30) },
    stats: { bhp: num(s.bhp, 1, 3000), torque: num(s.torque, 1, 3000), zero60: num(s.zero60, 1, 60, 2), top: num(s.top, 1, 400), weight: num(s.weight, 100, 10000),
      best: { time: cleanLine(best.time, 20), label: cleanLine(best.label, 40), venue: cleanLine(best.venue, 60) } },
    mods: [], story: cleanText(c.story, 3000), gallery: [], hero: 0, videos: [], socials: [], playlist: null, instagram: instaHandle(c.instagram), clips: []
  };
  const plate = String(b.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (plate && !b.hidePlate) out.basics.plate = plate;
  for (const m of (Array.isArray(c.mods) ? c.mods : []).slice(0, SHOW.maxMods)) {
    const name = cleanLine(m && m.name, 60); if (name) out.mods.push({ name, notes: cleanLine(m.notes, 200) });
  }
  for (const g of (Array.isArray(c.gallery) ? c.gallery : [])) {
    if (out.gallery.length >= SHOW.maxGallery) break;
    const cap = cleanLine(g && g.cap, 80);
    if (g && has(g.n) && g.n[0] === "p") out.gallery.push({ n: g.n, cap });
    else if (g && g.url) { const u = httpsImage(g.url); if (u) out.gallery.push({ url: u, cap }); }
  }
  const hero = parseInt(c.hero, 10); out.hero = hero >= 0 && hero < out.gallery.length ? hero : 0;
  for (const v of (Array.isArray(c.videos) ? c.videos : [])) {
    const id = youtubeId(v && typeof v === "object" ? v.id || v.url : v);
    if (id && !out.videos.some(x => x.id === id)) out.videos.push({ id, title: cleanLine(v && typeof v === "object" ? v.title : "", 80) });
    if (out.videos.length >= SHOW.maxVideos) break;
  }
  for (const v of (Array.isArray(c.socials) ? c.socials : [])) {
    const s = social(v && typeof v === "object" ? v.url : v);
    if (!s) continue;
    const key = JSON.stringify(s);
    if (!out.socials.some(x => JSON.stringify({ ...x, title: undefined }) === key)) out.socials.push({ ...s, title: cleanLine(v && typeof v === "object" ? v.title : "", 80) });
    if (out.socials.length >= SHOW.maxSocials) break;
  }
  out.playlist = playlist(c.playlist);
  for (const k of (Array.isArray(c.clips) ? c.clips : []).slice(0, SHOW.maxClips)) if (k && has(k.n) && k.n[0] === "c") out.clips.push({ n: k.n, cap: cleanLine(k.cap, 80) });
  return out;
}
export function sniffShow(u8) {
  const s = (i, str) => [...str].every((c, k) => u8[i + k] === c.charCodeAt(0));
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "jpg";
  if (u8.length >= 8 && u8[0] === 0x89 && s(1, "PNG")) return "png";
  if (u8.length >= 12 && s(0, "RIFF") && s(8, "WEBP")) return "webp";
  if (u8.length >= 12 && s(4, "ftyp") && !["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "avif"].some(x => s(8, x))) return "mp4";
  if (u8.length >= 4 && u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return "webm";
  return null;
}

// ---------- HTTP ----------
function hdrs(origin, env) {
  const h = { "Vary": "Origin", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  if (originAllowed(origin, env)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, X-Show-Key";
    h["Access-Control-Max-Age"] = "600";
  } else { h["Access-Control-Allow-Origin"] = "*"; h["Access-Control-Allow-Methods"] = "GET"; }
  return h;
}
function json(obj, status, h, cache) {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, "Content-Type": "application/json", "Cache-Control": cache || "no-store" } });
}
async function limited(req, env, kind) {
  const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
  // "file" uploads (up to ~14 per publish) share the 120/min READ limiter under their own key; other writes use the 10/min one.
  const b = kind === "write" ? env.UPLOAD_LIMITER : env.READ_LIMITER, cap = kind === "write" ? 10 : 120;
  if (b && typeof b.limit === "function") { try { const { success } = await b.limit({ key: "show-" + kind + ":" + ip }); return !success; } catch (e) { /* fall back */ } }
  return !memLimit("show-" + kind + ":" + ip, cap);
}
export async function getShowMeta(env, sid) {
  if (!SHOW_ID_RE.test(String(sid))) return null;
  const o = await env.UPLOADS.get("show/" + sid + "/meta.json"); if (!o) return null;
  try { return JSON.parse(await o.text()); } catch (e) { return null; }
}
export async function showKeyOk(env, sid, key) {
  if (!KEY_RE.test(String(key || ""))) return null;
  const m = await getShowMeta(env, sid);
  return m && sameHex(await sha256hex(key), m.h) ? m : null;
}
const putMeta = (env, sid, m) => env.UPLOADS.put("show/" + sid + "/meta.json", JSON.stringify(m), { httpMetadata: { contentType: "application/json" } });
async function wipe(env, sid) {
  const keys = []; let cursor;
  do { const p = await env.UPLOADS.list({ prefix: "show/" + sid + "/", cursor }); for (const o of p.objects) keys.push(o.key); cursor = p.truncated ? p.cursor : undefined; } while (cursor);
  for (let i = 0; i < keys.length; i += 900) await env.UPLOADS.delete(keys.slice(i, i + 900));
  return keys.length;
}
const used = (m, pre) => Object.entries(m.files || {}).filter(([n]) => n[0] === pre).reduce((a, [, b]) => a + b, 0);
export const UNPUBLISHED = "This showcase isn't published right now. Ask the owner to switch it back on.";

export async function handleShow(req, env, parts, now = Date.now()) {
  const origin = req.headers.get("Origin") || "";
  const h = hdrs(origin, env), app = originAllowed(origin, env);
  if (req.method === "OPTIONS") return new Response(null, { status: app ? 204 : 403, headers: h });
  if (!env.UPLOADS) return json({ error: "Storage not configured" }, 500, h);
  const sid = parts[1] || "";
  try {
    if (req.method === "GET") {
      if (await limited(req, env, "read")) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });
      if (!SHOW_ID_RE.test(sid)) return json({ error: UNPUBLISHED, state: "missing" }, 404, h);
      if (parts.length === 2) {
        const o = await env.UPLOADS.get("show/" + sid + "/card.json");
        if (!o) return json({ error: UNPUBLISHED, state: "unpublished" }, 404, h, "public, max-age=30");
        return new Response(o.body, { status: 200, headers: { ...h, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
      }
      if (parts.length === 4 && parts[2] === "f" && FILE_RE.test(parts[3])) {
        const name = parts[3], ext = name.split(".").pop();
        if (!(await env.UPLOADS.get("show/" + sid + "/card.json"))) return json({ error: UNPUBLISHED, state: "unpublished" }, 404, h);
        const rm = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get("Range") || "");
        const o = await env.UPLOADS.get("show/" + sid + "/f/" + name, rm ? { range: { offset: +rm[1], ...(rm[2] ? { length: +rm[2] - +rm[1] + 1 } : {}) } } : undefined);
        if (!o) return json({ error: "Not found" }, 404, h);
        const fh = { ...h, "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes", "Content-Disposition": "inline" };
        if (rm && o.range && typeof o.size === "number") {
          const start = o.range.offset || 0, len = o.range.length != null ? o.range.length : o.size - start;
          return new Response(o.body, { status: 206, headers: { ...fh, "Content-Range": `bytes ${start}-${start + len - 1}/${o.size}`, "Content-Length": String(len) } });
        }
        return new Response(o.body, { status: 200, headers: fh });
      }
      return json({ error: "Not found" }, 404, h);
    }
    if (!app) return json({ error: "Origin not allowed" }, 403, h);
    const isFile = req.method === "POST" && parts.length === 3 && (parts[2] === "photo" || parts[2] === "clip");
    if (await limited(req, env, isFile ? "file" : "write")) return json({ error: "Too many requests, try again in a minute" }, 429, { ...h, "Retry-After": "60" });

    // Create an empty showcase: returns its id and secret key (only the hash is kept).
    if (req.method === "POST" && parts.length === 1) {
      const id = b64url(16), key = b64url(32);
      await putMeta(env, id, { h: await sha256hex(key), created: now, t: now, published: false, files: {} });
      return json({ ok: true, showId: id, showKey: key }, 201, h);
    }
    if (!SHOW_ID_RE.test(sid)) return json({ error: "Not found" }, 404, h);
    const meta = await showKeyOk(env, sid, req.headers.get("X-Show-Key"));
    if (!meta) return json({ error: "Not allowed" }, 401, h);

    if (isFile) {
      const clip = parts[2] === "clip", cap = clip ? SHOW.maxClipBytes : SHOW.maxPhotoBytes;
      const len = parseInt(req.headers.get("Content-Length") || "0", 10);
      if (len > cap) return json({ error: clip ? "That clip is over 20 MB. Upload it to YouTube and paste the link instead." : "Photo too big (1.5 MB max)" }, 413, h);
      const u8 = new Uint8Array(await req.arrayBuffer());
      if (!u8.length) return json({ error: "Empty file" }, 400, h);
      if (u8.length > cap) return json({ error: clip ? "That clip is over 20 MB. Upload it to YouTube and paste the link instead." : "Photo too big (1.5 MB max)" }, 413, h);
      const ext = sniffShow(u8);
      if (!ext || clip !== (ext === "mp4" || ext === "webm")) return json({ error: clip ? "Clips must be MP4 or WebM video" : "Photos must be JPEG, PNG or WebP" }, 415, h);
      const kind = clip ? "c" : "p", count = Object.keys(meta.files || {}).filter(n => n[0] === kind).length;
      if (clip ? count >= SHOW.maxClips : count >= SHOW.maxPhotosStored) return json({ error: clip ? "2 clips max. Remove one first." : "Too many photos. Remove some first." }, 409, h);
      if (used(meta, kind) + u8.length > (clip ? SHOW.maxClipTotal : SHOW.maxPhotoTotal)) return json({ error: clip ? "Clip space is full (20 MB). Use a YouTube link instead." : "Photo space is full (15 MB). Remove some photos first." }, 413, h);
      const name = kind + rnd(12, "abcdefghijklmnopqrstuvwxyz0123456789") + "." + ext;
      await env.UPLOADS.put("show/" + sid + "/f/" + name, u8, { httpMetadata: { contentType: TYPES[ext] } });
      meta.files = { ...(meta.files || {}), [name]: u8.length }; meta.t = now; await putMeta(env, sid, meta);
      return json({ ok: true, name, size: u8.length, photoBytes: used(meta, "p"), clipBytes: used(meta, "c") }, 201, h);
    }
    if (req.method === "DELETE" && parts.length === 4 && parts[2] === "f" && FILE_RE.test(parts[3])) {
      await env.UPLOADS.delete("show/" + sid + "/f/" + parts[3]);
      if (meta.files) delete meta.files[parts[3]]; meta.t = now; await putMeta(env, sid, meta);
      return json({ ok: true }, 200, h);
    }
    // Publish / update: sanitise, drop files the card no longer uses, write card.json.
    if (req.method === "PUT" && parts.length === 2) {
      const raw = await req.text();
      if (raw.length > SHOW.maxCardBytes) return json({ error: "Showcase text is too long" }, 413, h);
      let body; try { body = JSON.parse(raw); } catch (e) { return json({ error: "Bad JSON" }, 400, h); }
      const card = sanitizeCard(body, meta.files || {});
      card.updated = now;
      const keep = new Set([...card.gallery.filter(g => g.n).map(g => g.n), ...card.clips.map(c => c.n)]);
      const drop = Object.keys(meta.files || {}).filter(n => !keep.has(n));
      if (drop.length) await env.UPLOADS.delete(drop.map(n => "show/" + sid + "/f/" + n));
      drop.forEach(n => delete meta.files[n]);
      await env.UPLOADS.put("show/" + sid + "/card.json", JSON.stringify(card), { httpMetadata: { contentType: "application/json" } });
      meta.published = true; meta.t = now; await putMeta(env, sid, meta);
      return json({ ok: true, card, removed: drop.length, photoBytes: used(meta, "p"), clipBytes: used(meta, "c") }, 200, h);
    }
    // Unpublish: delete everything for this showcase.
    if (req.method === "DELETE" && parts.length === 2) {
      return json({ ok: true, deleted: await wipe(env, sid) }, 200, h);
    }
    return json({ error: "Not found" }, 404, h);
  } catch (e) {
    return json({ error: "Server error" }, 500, h);
  }
}
