export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json"
    };
    if (req.method === "OPTIONS") return new Response("", { headers });
    const plate = new URL(req.url).searchParams.get("plate") || "";
    const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return new Response(JSON.stringify({ error: "Add ?plate=AB12CDE" }), { status: 400, headers });
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
      const mot = await fetch("https://history.mot.api.gov.uk/v1/trade/vehicles/registration/" + clean, {
        headers: { Authorization: "Bearer " + tok.access_token, "X-API-Key": env.DVSA_API_KEY }
      });
      const data = await mot.text();
      return new Response(data, { status: mot.status, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers });
    }
  }
};
