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
      const browser = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Accept": "text/html" };
      const page = await fetch("https://vehicleenquiry.service.gov.uk/", { headers: browser });
      const html = await page.text();
      const token = (html.match(/name="authenticity_token" value="([^"]+)"/) || [])[1] || "";
      const cookie = page.headers.get("set-cookie") || "";
      const post = await fetch("https://vehicleenquiry.service.gov.uk/?locale=en", {
        method: "POST",
        headers: { ...browser, "content-type": "application/x-www-form-urlencoded", cookie },
        body: new URLSearchParams({ utf8: "✓", authenticity_token: token, "wizard_vehicle_enquiry_capture_vrn[vrn]": clean }),
        redirect: "manual"
      });
      const confirmHtml = await post.text();
      const token2 = (confirmHtml.match(/name="authenticity_token" value="([^"]+)"/) || [])[1] || token;
      const cookie2 = post.headers.get("set-cookie") || cookie;
      const done = await fetch("https://vehicleenquiry.service.gov.uk/ConfirmVehicle?locale=en", {
        method: "POST",
        headers: { ...browser, "content-type": "application/x-www-form-urlencoded", cookie: cookie2 },
        body: new URLSearchParams({ utf8: "✓", authenticity_token: token2, "wizard_vehicle_enquiry_capture_confirm_vehicle[confirmed]": "Yes" })
      });
      const result = await done.text();
      const text = result.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const tax = /SORN/i.test(text) ? "SORN" : (/Untaxed/i.test(text) ? "Untaxed" : (/Taxed/i.test(text) ? "Taxed" : "Unknown"));
      const mot = (text.match(/MOT\s*(Expires|Expired)[:\s]*([0-9]{1,2} [A-Za-z]+ [0-9]{4})/i) || [])[0] || (/No MOT/i.test(text) ? "No MOT" : "");
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
