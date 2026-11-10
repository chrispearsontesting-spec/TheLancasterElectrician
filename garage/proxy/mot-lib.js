// Dipstick MOT proxy logic. Imported by mot-worker.js (the Worker entry) and by the local tests.
// - Only answers the Dipstick site (and localhost for dev); other origins get 403.
// - Per-IP rate limit: uses the MOT_LIMITER rate-limit binding when deployed (see wrangler.toml),
//   falls back to a best-effort in-memory counter (per Worker isolate, resets when it recycles).
// - Caches the DVSA OAuth token in memory until shortly before it expires.

const ALLOWED_ORIGINS = ["https://thelancasterelectrician.com", "https://www.thelancasterelectrician.com"];
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MEM_LIMIT = 20;          // requests per IP per window (fallback limiter)
const MEM_WINDOW_MS = 60000;
const TOKEN_SKEW_MS = 120000;  // refresh token 2 minutes before expiry

let tokenCache = { value: "", exp: 0, pending: null };
const memHits = new Map();

export function originAllowed(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (DEV_ORIGIN.test(origin) && (env && env.ALLOW_LOCALHOST) !== "0") return true;
  const extra = String((env && env.EXTRA_ORIGINS) || "").split(",").map(s => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

export function memLimit(key, now = Date.now()) {
  const rec = memHits.get(key);
  if (!rec || now - rec.start >= MEM_WINDOW_MS) {
    memHits.set(key, { start: now, n: 1 });
    if (memHits.size > 5000) { for (const [k, v] of memHits) { if (now - v.start >= MEM_WINDOW_MS) memHits.delete(k); } }
    return true;
  }
  rec.n++;
  return rec.n <= MEM_LIMIT;
}

async function allowRequest(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown";
  if (env && env.MOT_LIMITER && typeof env.MOT_LIMITER.limit === "function") {
    try {
      const { success } = await env.MOT_LIMITER.limit({ key: "ip:" + ip });
      return success;
    } catch (e) { /* fall through to memory limiter */ }
  }
  return memLimit(ip);
}

export async function getToken(env, now = Date.now()) {
  if (tokenCache.value && now < tokenCache.exp - TOKEN_SKEW_MS) return tokenCache.value;
  if (tokenCache.pending) return tokenCache.pending;
  tokenCache.pending = (async () => {
    try {
      const tokenRes = await fetch(env.DVSA_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: env.DVSA_CLIENT_ID,
          client_secret: env.DVSA_CLIENT_SECRET,
          scope: env.DVSA_SCOPE || "https://tapi.dvsa.gov.uk/.default"
        })
      });
      const tok = await tokenRes.json();
      if (!tok.access_token) throw new Error("Token failed");
      const life = (parseInt(tok.expires_in, 10) || 3600) * 1000;
      tokenCache.value = tok.access_token;
      tokenCache.exp = Date.now() + life;
      return tokenCache.value;
    } finally {
      tokenCache.pending = null;
    }
  })();
  return tokenCache.pending;
}

export function _resetForTests() {
  tokenCache = { value: "", exp: 0, pending: null };
  memHits.clear();
  fuelCache = { at: 0, payload: null, pending: null };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers });
}

// GOV.UK vehicle enquiry (Nov 2026 flow): GET / -> POST /vehicle-enquiry/save (vrn) -> 302 ConfirmVehicle
// -> POST /vehicle-enquiry/save (confirmed=Yes) -> 302 VehicleFound. Needs a real cookie jar
// (session + TS* cookies) and the CSRF token from the vrn form, not the cookie-banner form.
const VES_BASE = "https://vehicleenquiry.service.gov.uk";
const VES_UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html" };

function formToken(html) {
  const m = html.match(/<form[^>]*action="\/vehicle-enquiry\/save[^"]*"[^>]*>([\s\S]*?)<\/form>/);
  const src = m ? m[1] : html;
  return (src.match(/name="authenticity_token" value="([^"]+)"/) || [])[1] || "";
}

async function vesFetch(jar, url, opts = {}) {
  for (let i = 0; i < 5; i++) {
    const cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
    const res = await fetch(url, { ...opts, headers: { ...VES_UA, ...(opts.headers || {}), cookie }, redirect: "manual" });
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
    for (const c of list) { const kv = c.split(";")[0]; const eq = kv.indexOf("="); if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1)); }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, url).toString(); opts = {}; continue; }
    return res.text();
  }
  return "";
}

export async function govukTaxText(clean) {
  const jar = new Map();
  const form = { "content-type": "application/x-www-form-urlencoded", Origin: VES_BASE, Referer: VES_BASE + "/" };
  const p1 = await vesFetch(jar, VES_BASE + "/?locale=en");
  const p2 = await vesFetch(jar, VES_BASE + "/vehicle-enquiry/save?locale=en", { method: "POST", headers: form,
    body: new URLSearchParams({ authenticity_token: formToken(p1), "wizard_vehicle_enquiry_capture_vrn[vrn]": clean }).toString() });
  let result = p2;
  if (/confirm_vehicle/.test(p2)) {
    result = await vesFetch(jar, VES_BASE + "/vehicle-enquiry/save?locale=en", { method: "POST", headers: form,
      body: new URLSearchParams({ authenticity_token: formToken(p2), "wizard_vehicle_enquiry_capture_confirm_vehicle[confirmed]": "Yes" }).toString() });
  }
  const text = result.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const at = text.indexOf("Tax and MOT status results", text.indexOf("Tax and MOT status results") + 1);
  return at > 0 ? text.slice(at) : text;
}

// ---- Garage website contact finder (?contact=<url>) ----
// Reads at most 2 pages (home + one same-host contact page), 5 s each, ~500 KB each, <=3 redirects.
const C_UA = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36", "Accept": "text/html,application/xhtml+xml" };
const C_MAX = 800000;

export function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || h === "localhost" || /\.(localhost|local|internal|lan|home|arpa)$/.test(h)) return null;
  if (/^[\d.]+$/.test(h)) {
    const p = h.split(".").map(Number);
    if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255))) return null;
    if (p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) ||
        (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127)) return null;
  }
  if (h.includes(":")) return null; // no IPv6 literals
  return u;
}

async function readCapped(res) {
  if (!res.body) return "";
  const reader = res.body.getReader(); const dec = new TextDecoder(); let out = "", n = 0;
  while (n < C_MAX) { const { done, value } = await reader.read(); if (done) break; n += value.length; out += dec.decode(value, { stream: true }); }
  try { reader.cancel(); } catch (e) {}
  return out;
}

async function pageFetch(url) {
  let u = safeUrl(url); if (!u) return null;
  for (let i = 0; i <= 3; i++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
    try {
      const res = await fetch(u.toString(), { headers: C_UA, redirect: "manual", signal: ctl.signal });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) { u = safeUrl(new URL(loc, u).toString()); if (!u) return null; continue; }
      if (!res.ok || !/html|text/i.test(res.headers.get("content-type") || "text/html")) return null;
      return { url: u, html: await readCapped(res) };
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  return null;
}

const JUNK_MAIL = /(example\.(com|org)|sentry|wixpress|@domain\.com|@email\.com|yourdomain|yoursite|@\d*x\.|\.(png|jpe?g|gif|svg|webp|css|js)$)/i;
function goodMail(m) { m = String(m || "").trim().toLowerCase(); return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(m) && !JUNK_MAIL.test(m) ? m : ""; }
export function normPhone(p) {
  let d = String(p || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = "0" + d.slice(3).replace(/^0/, ""); else if (d.startsWith("0044")) d = "0" + d.slice(4);
  d = d.replace(/\+/g, "");
  return /^0(1\d{8,9}|[237]\d{9}|80[08]\d{6,7})$/.test(d) ? d : "";
}
function prettyPhone(d) {
  if (/^0(7\d{3})(\d{6})$/.test(d)) return d.replace(/^(07\d{3})(\d{6})$/, "$1 $2");
  if (/^02/.test(d)) return d.replace(/^(02\d)(\d{4})(\d{4})$/, "$1 $2 $3");
  if (/^0(1\d1|11\d)/.test(d)) return d.replace(/^(0\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
  if (d.length === 10) return d.replace(/^(0\d{4})(\d{5})$/, "$1 $2");
  return d.replace(/^(0\d{4})(\d{6})$/, "$1 $2");
}
function decode(s) { return s.replace(/&#64;|&#x40;/gi, "@").replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ").replace(/%20/g, " "); }
function pick(arr) {
  const c = new Map(); arr.forEach((v, i) => { if (!v) return; const r = c.get(v) || { n: 0, i }; r.n++; c.set(v, r); });
  let best = "", bn = 0, bi = 1e9; for (const [v, r] of c) if (r.n > bn || (r.n === bn && r.i < bi)) { best = v; bn = r.n; bi = r.i; }
  return best;
}

export function extractContact(html) {
  html = decode(String(html || ""));
  const phones = [], mails = [], lPh = [], lMail = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of m[1].matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) lPh.push(normPhone(t[1]));
    for (const t of m[1].matchAll(/"email"\s*:\s*"(?:mailto:)?([^"]+)"/gi)) lMail.push(goodMail(t[1]));
  }
  for (const m of html.matchAll(/href=["']\s*mailto:([^"'?]+)/gi)) mails.push(goodMail(decodeURIComponent(m[1])));
  for (const m of html.matchAll(/href=["']\s*tel:([^"']+)/gi)) phones.push(normPhone(decodeURIComponent(m[1])));
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const tPh = [], tMail = [];
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) tMail.push(goodMail(m[0]));
  for (const m of text.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/g)) tPh.push(normPhone(m[0]));
  const phone = pick(phones) || pick(lPh) || pick(tPh);
  const email = pick(mails) || pick(lMail) || pick(tMail);
  return { phone: phone ? prettyPhone(phone) : "", email };
}

function contactLink(html, base) {
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/contact/i.test(m[1] + " " + m[2].replace(/<[^>]+>/g, ""))) continue;
    try { const u = new URL(m[1], base); if (u.hostname === base.hostname && /^https?:$/.test(u.protocol)) return u.toString(); } catch (e) {}
  }
  return "";
}

export async function findContact(raw) {
  const out = { phone: "", email: "", source: "" };
  const first = await pageFetch(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
  if (!first) return out;
  let r = extractContact(first.html);
  out.phone = r.phone; out.email = r.email; if (r.phone || r.email) out.source = first.url.toString();
  if (!out.phone || !out.email) {
    const link = contactLink(first.html, first.url);
    if (link && link !== first.url.toString()) {
      const second = await pageFetch(link);
      if (second) {
        r = extractContact(second.html);
        if (!out.phone && r.phone) { out.phone = r.phone; out.source = out.source || second.url.toString(); }
        if (!out.email && r.email) { out.email = r.email; out.source = out.source || second.url.toString(); }
      }
    }
  }
  return out;
}


// ---- Remembered garage contacts (KV GARAGE_CONTACTS) + domain guessing (?garage= / ?savecontact=1 / ?findcontact=) ----
// Only a garage's business email/website is stored, keyed by normalised garage name + postcode. Nothing about the user.
const TLDS = new Set("uk com net org biz info co io me eu ie scot wales cymru london online site shop store website services garage cars car auto autos tech email business works page".split(" "));
export function realMail(m) {
  m = String(m || "").trim().toLowerCase().replace(/^mailto:/, "");
  if (m.length < 6 || m.length > 100) return "";
  const r = m.match(/^([a-z0-9._%+-]{1,64})@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24}))$/);
  if (!r || !TLDS.has(r[3]) || /\.\./.test(m) || JUNK_MAIL.test(m)) return "";
  return m;
}
export function realSite(w) {
  w = String(w || "").trim(); if (!w || w.length > 200) return "";
  const u = safeUrl(/^https?:\/\//i.test(w) ? w : "https://" + w);
  if (!u) return "";
  const tld = u.hostname.split(".").pop().toLowerCase();
  return TLDS.has(tld) ? u.origin + (u.pathname === "/" ? "/" : u.pathname) : "";
}
function gNorm(s) { return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
export function garageKey(name, postcode) {
  const n = gNorm(name).slice(0, 80), pc = String(postcode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (n.length < 2 || !/^[A-Z]{1,2}\d[A-Z\d]?(\d[A-Z]{2})?$/.test(pc)) return "";
  return n + "|" + pc;
}
const saveHits = new Map();
function saveAllowed(ip, now = Date.now()) { // max 10 saves per IP per hour (per isolate)
  const r = saveHits.get(ip);
  if (!r || now - r.start > 3600000) { saveHits.set(ip, { start: now, n: 1 }); if (saveHits.size > 5000) saveHits.clear(); return true; }
  return ++r.n <= 10;
}
async function kvGet(env, k) { if (!env || !env.GARAGE_CONTACTS) return null; try { return await env.GARAGE_CONTACTS.get(k, "json"); } catch (e) { return null; } }
async function kvPut(env, k, v, ttl) { if (!env || !env.GARAGE_CONTACTS) return false; try { await env.GARAGE_CONTACTS.put(k, JSON.stringify(v), ttl ? { expirationTtl: ttl } : undefined); return true; } catch (e) { return false; } }

function cfDecode(hex) { try { const k = parseInt(hex.slice(0, 2), 16); let o = ""; for (let i = 2; i < hex.length; i += 2) o += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return o; } catch (e) { return ""; } }
export function pageEmails(html) {
  html = String(html || "");
  const out = [];
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) out.push(cfDecode(m[1]));
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) out.push(cfDecode(m[1]));
  const d = decode(html);
  for (const m of d.matchAll(/href=["']\s*mailto:([^"'?]+)/gi)) { try { out.push(decodeURIComponent(m[1])); } catch (e) {} }
  for (const m of d.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) for (const t of m[1].matchAll(/"email"\s*:\s*"(?:mailto:)?([^"]+)"/gi)) out.push(t[1]);
  const text = d.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/\s*[\[\(\{]\s*at\s*[\]\)\}]\s*/gi, "@").replace(/\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*/gi, ".");
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi)) out.push(m[0]);
  return out.map(realMail).filter(Boolean);
}
function bestEmail(list, host) {
  const base = String(host || "").toLowerCase().replace(/^www\./, "");
  const own = list.filter(e => e.split("@")[1] === base || e.split("@")[1].endsWith("." + base));
  return pick(own.length ? own : list);
}
export function guessDomains(name) {
  const w = gNorm(name).replace(/\b(ltd|limited|plc|llp|t a|ta|the|and|co|uk|mot|mots|centre|center|station)\b/g, " ").split(" ").filter(Boolean);
  if (!w.length) return [];
  const all = w.join(""), core = w.filter(x => !/^(garage|garages|motors|motor|services|service|auto|autos|tyres|tyre)$/.test(x)).join("");
  const c = [all];
  if (core && core !== all) c.push(core);
  if (core && !/garage/.test(all)) c.push(core + "garage");
  if (core && !/motors/.test(all)) c.push(core + "motors");
  const seen = new Set(), out = [];
  for (const x of c) if (x.length >= 4 && x.length <= 40) for (const t of ["co.uk", "com"]) { const d = x + "." + t; if (!seen.has(d)) { seen.add(d); out.push(d); } }
  return out.slice(0, 6);
}
function siteMatches(html, phone, postcode) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^44/, "0").slice(-10);
  const pc = String(postcode || "").toLowerCase().replace(/\s/g, "");
  const text = String(html).replace(/<[^>]+>/g, " ");
  if (digits.length >= 9 && text.replace(/\D/g, "").includes(digits)) return true;
  return pc.length >= 5 && String(html).toLowerCase().replace(/\s|&nbsp;/g, "").includes(pc);
}
async function emailFromSite(first) {
  let list = pageEmails(first.html), source = list.length ? first.url.toString() : "";
  if (!list.length) {
    const tries = [contactLink(first.html, first.url), new URL("/contact", first.url).toString(), new URL("/contact-us", first.url).toString()].filter((v, i, a) => v && a.indexOf(v) === i && v !== first.url.toString());
    for (const t of tries.slice(0, 2)) { const p = await pageFetch(t); if (p) { list = pageEmails(p.html); if (list.length) { source = p.url.toString(); break; } } }
  }
  return { email: bestEmail(list, first.url.hostname), source };
}
export async function findByGuess(name, postcode, phone) {
  const doms = guessDomains(name);
  const pages = await Promise.all(doms.map(d => pageFetch("https://www." + d + "/").then(p => p || pageFetch("https://" + d + "/")).catch(() => null)));
  for (const p of pages) {
    if (!p || !siteMatches(p.html, phone, postcode)) continue;
    const r = await emailFromSite(p);
    return { email: r.email, website: p.url.origin + "/", source: r.source || p.url.toString() };
  }
  return { email: "", website: "", source: "" };
}


// ---- Cheapest fuel nearby (/fuel) ------------------------------------------
// No-key retailer JSON feeds (former CMA open-data scheme). Many retailers
// still publish these files. The official Fuel Finder API needs a GOV.UK One
// Login and OAuth client secret, which we do not register for or store.
// The merged national list is cached in memory for 45 minutes.

export const FUEL_FEEDS = [
  { brand: "Asda", url: "https://storelocator.asda.com/fuel_prices_data.json" },
  { brand: "BP", url: "https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json" },
  { brand: "Esso", url: "https://fuelprices.esso.co.uk/latestdata.json" },
  { brand: "Tesco", url: "https://www.tesco.com/fuel_prices/fuel_prices_data.json" },
  { brand: "Morrisons", url: "https://www.morrisons.com/fuel-prices/fuel.json" },
  { brand: "Sainsbury's", url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json" },
  { brand: "MFG", url: "https://fuel.motorfuelgroup.com/fuel_prices_data.json" },
  { brand: "SGN", url: "https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json" },
  { brand: "JET", url: "https://jetlocal.co.uk/fuel_prices_data.json" },
  { brand: "Moto", url: "https://moto-way.com/fuel-price/fuel_prices.json" },
  { brand: "Rontec", url: "https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json" },
  { brand: "Applegreen", url: "https://applegreenstores.com/fuel-prices/data.json" }
];

const FUEL_CACHE_MS = 45 * 60 * 1000;
const FUEL_FETCH_MS = 12000;
let fuelCache = { at: 0, payload: null, pending: null };

export function asPence(v) {
  let n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 10) n = n * 100;
  if (n < 80 || n > 400) return null;
  return Math.round(n * 10) / 10;
}

export function parseUpdated(s) {
  const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

export function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.7613;
  const toR = (d) => d * Math.PI / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

const GRADE = {
  petrol: ["E10", "e10"],
  e10: ["E10", "e10"],
  diesel: ["B7", "b7"],
  b7: ["B7", "b7"],
  e5: ["E5", "e5"],
  premium: ["E5", "e5"],
  sdv: ["SDV", "sdv"]
};

export function pickPrice(prices, fuel) {
  if (!prices || typeof prices !== "object") return null;
  const keys = GRADE[String(fuel || "petrol").toLowerCase()] || GRADE.petrol;
  for (const k of keys) {
    if (prices[k] == null) continue;
    const p = asPence(prices[k]);
    if (p != null) return { price: p, grade: String(k).toUpperCase() };
  }
  return null;
}

export function parseFuelFeed(json, feedBrand) {
  if (!json || typeof json !== "object") return { updated: "", stations: [] };
  const raw = json.stations || json.Stations || (Array.isArray(json) ? json : []);
  const updated = json.last_updated || json.lastUpdated || "";
  const stations = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const loc = s.location || s.Location || {};
    const lat = Number(loc.latitude ?? loc.lat);
    const lng = Number(loc.longitude ?? loc.lng ?? loc.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    stations.push({
      id: String(s.site_id || s.siteId || s.id || (feedBrand + ":" + lat + "," + lng)),
      brand: String(s.brand || feedBrand || "").trim() || feedBrand,
      address: String(s.address || s.Address || "").trim(),
      postcode: String(s.postcode || s.Postcode || "").trim(),
      lat, lng,
      prices: s.prices || s.Prices || {},
      updated: s.last_updated || updated
    });
  }
  return { updated, stations };
}

export function filterFuelStations(stations, opts) {
  const lat = Number(opts.lat), lng = Number(opts.lng);
  const miles = Math.min(30, Math.max(1, Number(opts.miles) || 5));
  const fuel = String(opts.fuel || "petrol").toLowerCase();
  const staleAfter = opts.staleAfterMs != null ? opts.staleAfterMs : 7 * 86400000;
  const now = opts.now || Date.now();
  const out = [];
  for (const s of stations || []) {
    const picked = pickPrice(s.prices, fuel);
    if (!picked) continue;
    const distance = milesBetween(lat, lng, s.lat, s.lng);
    if (distance > miles) continue;
    const when = parseUpdated(s.updated);
    out.push({
      id: s.id,
      brand: s.brand,
      address: s.address,
      postcode: s.postcode,
      lat: s.lat,
      lng: s.lng,
      distance: Math.round(distance * 10) / 10,
      price: picked.price,
      unit: "p/L",
      grade: picked.grade,
      updated: s.updated || "",
      stale: !!(when && (now - when.getTime() > staleAfter))
    });
  }
  out.sort((a, b) => Number(a.stale) - Number(b.stale) || a.price - b.price || a.distance - b.distance);
  return out.slice(0, 25);
}

async function fetchOneFeed(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FUEL_FETCH_MS);
  try {
    const r = await fetch(feed.url, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; Driv3/1.0; +https://thelancasterelectrician.com/garage/) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      },
      signal: ctrl.signal
    });
    if (!r.ok) return { brand: feed.brand, ok: false, n: 0, status: r.status, stations: [] };
    const json = await r.json();
    const parsed = parseFuelFeed(json, feed.brand);
    return { brand: feed.brand, ok: true, n: parsed.stations.length, updated: parsed.updated, stations: parsed.stations };
  } catch (e) {
    return { brand: feed.brand, ok: false, n: 0, error: String((e && e.message) || e), stations: [] };
  } finally {
    clearTimeout(t);
  }
}

export async function mergeFuelFeeds() {
  const results = await Promise.all(FUEL_FEEDS.map(fetchOneFeed));
  const stations = [];
  const sources = [];
  for (const r of results) {
    sources.push({ brand: r.brand, ok: r.ok, n: r.n });
    if (r.stations && r.stations.length) stations.push(...r.stations);
  }
  return { updated: new Date().toISOString(), sources, stations };
}

async function cachedFuelMerge() {
  const now = Date.now();
  if (fuelCache.payload && now - fuelCache.at < FUEL_CACHE_MS) return fuelCache.payload;
  if (fuelCache.pending) return fuelCache.pending;
  fuelCache.pending = (async () => {
    try {
      const payload = await mergeFuelFeeds();
      fuelCache.payload = payload;
      fuelCache.at = Date.now();
      return payload;
    } finally {
      fuelCache.pending = null;
    }
  })();
  return fuelCache.pending;
}

async function fuelHandle(sp, headers) {
  const latRaw = sp.get("lat"), lngRaw = sp.get("lng");
  const lat = Number(latRaw), lng = Number(lngRaw);
  if (latRaw == null || lngRaw == null || latRaw === "" || lngRaw === "" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "Add ?lat=&lng=" }, 400, headers);
  }
  const miles = Math.min(30, Math.max(1, Number(sp.get("miles")) || 5));
  const fuel = String(sp.get("fuel") || "petrol").toLowerCase();
  const merged = await cachedFuelMerge();
  const stations = filterFuelStations(merged.stations, { lat, lng, miles, fuel });
  const hdrs = { ...headers, "Cache-Control": "public, max-age=60, s-maxage=1800" };
  return json({
    updated: merged.updated,
    fuel,
    miles,
    lat,
    lng,
    count: stations.length,
    stations,
    sources: merged.sources
  }, 200, hdrs);
}

export async function handle(req, env) {
  {
    const origin = req.headers.get("Origin") || "";
    const ok = originAllowed(origin, env);
    const headers = { "Content-Type": "application/json", "Vary": "Origin" };
    if (ok) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    }
    if (!ok) return json({ error: "Origin not allowed" }, 403, headers);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "GET") return json({ error: "GET only" }, 405, headers);
    if (!(await allowRequest(req, env))) {
      headers["Retry-After"] = "60";
      return json({ error: "Too many lookups. Try again in a minute." }, 429, headers);
    }

    {
      const u = new URL(req.url);
      const path = u.pathname.replace(/\/+$/, "") || "/";
      if (path === "/fuel") {
        return fuelHandle(u.searchParams, headers);
      }
    }

    const sp = new URL(req.url).searchParams;
    if (sp.has("garage") || sp.has("findcontact") || sp.get("savecontact") === "1") {
      const name = sp.get("garage") || sp.get("findcontact") || sp.get("name") || "";
      const key = garageKey(name, sp.get("postcode"));
      if (!key) return json({ error: "Need garage name and postcode" }, 400, headers);
      if (sp.get("savecontact") === "1") {
        const ip = req.headers.get("CF-Connecting-IP") || "unknown";
        if (!saveAllowed(ip)) return json({ error: "Too many saves" }, 429, headers);
        const email = sp.get("email") ? realMail(sp.get("email")) : "", website = sp.get("website") ? realSite(sp.get("website")) : "";
        if ((sp.get("email") && !email) || (sp.get("website") && !website) || (!email && !website)) return json({ error: "Bad email or website" }, 400, headers);
        const old = (await kvGet(env, "u:" + key)) || {};
        const rec = { email: email || old.email || "", website: website || old.website || "", source: "user", updated: new Date().toISOString().slice(0, 10) };
        if (rec.email === old.email && rec.website === old.website) return json({ saved: false, unchanged: true }, 200, headers);
        return json({ saved: await kvPut(env, "u:" + key, rec) }, 200, headers);
      }
      const user = await kvGet(env, "u:" + key);
      if (sp.has("garage")) return json(user && user.email ? user : {}, 200, headers);
      if (user && user.email) return json(user, 200, headers);
      const cached = await kvGet(env, "f:" + key);
      if (cached) return json(cached, 200, headers);
      let r = { email: "", website: "", source: "" };
      try { r = await findByGuess(name, sp.get("postcode"), sp.get("phone")); } catch (e) {}
      const rec = { email: r.email, website: r.website, source: r.email ? "auto" : "none", updated: new Date().toISOString().slice(0, 10) };
      await kvPut(env, "f:" + key, rec, r.email ? 180 * 86400 : 30 * 86400);
      return json(rec, 200, headers);
    }
    const contactUrl = new URL(req.url).searchParams.get("contact");
    if (contactUrl !== null) {
      if (!safeUrl(/^https?:\/\//i.test(contactUrl) ? contactUrl : "https://" + contactUrl)) return json({ error: "Bad url" }, 400, headers);
      try { return json(await findContact(contactUrl), 200, headers); } catch (e) { return json({ phone: "", email: "", source: "" }, 200, headers); }
    }
    const plate = new URL(req.url).searchParams.get("plate") || "";
    const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!clean) return json({ error: "Add ?plate=AB12CDE" }, 400, headers);
    if (new URL(req.url).searchParams.get("tax") === "1") {
      const text = await govukTaxText(clean);
      const st = (text.match(/Vehicle [A-Z0-9]+ (is Taxed|is Untaxed|has a valid SORN|has an expired SORN|is not taxed)/i) || [])[1] || "";
      const tax = /SORN/i.test(st) ? "SORN" : (/Untaxed|not taxed/i.test(st) ? "Untaxed" : (/Taxed/i.test(st) ? "Taxed" : "Unknown"));
      const motM = text.match(/MOT certificate (Expires|Expired)[:\s]*([0-9]{1,2} [A-Za-z]+ [0-9]{4})/i) || text.match(/MOT (Expires|Expired)[:\s]*([0-9]{1,2} [A-Za-z]+ [0-9]{4})/i);
      const mot = motM ? motM[1] + ": " + motM[2] : (/No MOT|does not have an MOT|no details held/i.test(text) ? "No MOT" : "");
      return json({ plate: clean, tax, mot, raw: text.slice(0, 400) }, 200, headers);
    }
    try {
      let access = await getToken(env);
      let mot = await fetch("https://history.mot.api.gov.uk/v1/trade/vehicles/registration/" + clean, {
        headers: { Authorization: "Bearer " + access, "X-API-Key": env.DVSA_API_KEY }
      });
      if (mot.status === 401) {
        // Token revoked early: drop it and retry once with a fresh one.
        tokenCache.value = ""; tokenCache.exp = 0;
        access = await getToken(env);
        mot = await fetch("https://history.mot.api.gov.uk/v1/trade/vehicles/registration/" + clean, {
          headers: { Authorization: "Bearer " + access, "X-API-Key": env.DVSA_API_KEY }
        });
      }
      const data = await mot.text();
      return new Response(data, { status: mot.status, headers });
    } catch (err) {
      return json({ error: String(err.message || err) }, 500, headers);
    }
  }
}
