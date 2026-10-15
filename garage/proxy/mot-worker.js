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
      return new Response(JSON.stringify({ plate: clean, tax, mot, raw: text.slice(0, 400) }), { headers });
    }
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
