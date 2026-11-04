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
const C_MAX = 500000;

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

const JUNK_MAIL = /(example\.(com|org)|sentry|wixpress|domain\.com|email\.com|yourdomain|yoursite|@\d*x\.|\.(png|jpe?g|gif|svg|webp|css|js)$)/i;
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
