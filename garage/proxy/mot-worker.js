const ALLOW = [
  "https://thelancasterelectrician.com",
  "https://www.thelancasterelectrician.com",
  "http://localhost",
  "http://127.0.0.1"
];

let cached = { token: "", exp: 0 };

function cors(origin) {
  const ok = ALLOW.some((a) => (origin || "").indexOf(a) === 0);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOW[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) }
  });
}

async function token(env) {
  const now = Date.now();
  if (cached.token && cached.exp > now + 60000) return cached.token;
  const url = env.DVSA_TOKEN_URL;
  if (!url) throw new Error("Missing DVSA_TOKEN_URL");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.DVSA_CLIENT_ID,
    client_secret: env.DVSA_CLIENT_SECRET,
    scope: env.DVSA_SCOPE || "https://tapi.dvsa.gov.uk/.default"
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("Token failed: " + (data.error || res.status));
  }
  cached = {
    token: data.access_token,
    exp: now + Math.max(60, (data.expires_in || 1200) - 60) * 1000
  };
  return cached.token;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    if (req.method === "OPTIONS") return new Response("", { headers: cors(origin) });
    const url = new URL(req.url);
    const plate = String(url.searchParams.get("plate") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!plate) return json({ error: "Add ?plate=AB12CDE" }, 400, origin);
    try {
      const bearer = await token(env);
      const mot = await fetch(
        "https://history.mot.api.gov.uk/v1/trade/vehicles/registration/" + plate,
        {
          headers: {
            Authorization: "Bearer " + bearer,
            "X-API-Key": env.DVSA_API_KEY
          }
        }
      );
      const text = await mot.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
      if (!mot.ok) return json({ error: "DVSA " + mot.status, detail: data }, mot.status, origin);
      return json(data, 200, origin);
    } catch (err) {
      return json({ error: String(err.message || err) }, 500, origin);
    }
  }
};
