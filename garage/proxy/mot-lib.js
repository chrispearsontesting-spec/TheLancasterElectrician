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
