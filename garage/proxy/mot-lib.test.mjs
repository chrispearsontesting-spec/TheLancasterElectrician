import assert from "node:assert/strict";
import worker from "./mot-worker.js";
import { _resetForTests, memLimit } from "./mot-lib.js";
const calls = [];
let tokenLife = 3600, motStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls.push(url);
  if (url.startsWith("https://login.example/token")) return new Response(JSON.stringify({ access_token: "tok" + calls.filter(u => u.includes("token")).length, expires_in: tokenLife }));
  if (url.startsWith("https://history.mot.api.gov.uk/")) {
    if (motStatus === 401) { motStatus = 200; return new Response("{}", { status: 401 }); }
    return new Response(JSON.stringify({ make: "VOLVO", model: "XC60", auth: init.headers.Authorization }), { status: 200 });
  }
  throw new Error("unexpected fetch " + url);
};
const env = { DVSA_TOKEN_URL: "https://login.example/token", DVSA_CLIENT_ID: "id", DVSA_CLIENT_SECRET: "s", DVSA_API_KEY: "k" };
const req = (q, origin, ip = "1.1.1.1", method = "GET") => new Request("https://w.dev/" + q, { method, headers: { ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ip } });
const SITE = "https://thelancasterelectrician.com";
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log("ok -", name); };

await t("rejects foreign origin with 403, no upstream call", async () => {
  _resetForTests(); calls.length = 0;
  const r = await worker.fetch(req("?plate=SB61LGZ", "https://evil.example"), env);
  assert.equal(r.status, 403); assert.equal(r.headers.get("Access-Control-Allow-Origin"), null); assert.equal(calls.length, 0);
});
await t("rejects missing Origin (curl / direct) with 403", async () => {
  const r = await worker.fetch(req("?plate=SB61LGZ", ""), env); assert.equal(r.status, 403);
});
await t("allows site origin, echoes it in CORS", async () => {
  _resetForTests(); calls.length = 0;
  const r = await worker.fetch(req("?plate=SB61LGZ", SITE), env);
  assert.equal(r.status, 200); assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.equal((await r.json()).make, "VOLVO");
});
await t("allows localhost dev origin and OPTIONS preflight", async () => {
  const r = await worker.fetch(req("?plate=X", "http://localhost:8765", "2.2.2.2", "OPTIONS"), env);
  assert.equal(r.status, 204); assert.equal(r.headers.get("Access-Control-Allow-Origin"), "http://localhost:8765");
});
await t("localhost can be switched off with ALLOW_LOCALHOST=0", async () => {
  const r = await worker.fetch(req("?plate=X", "http://localhost:8765"), { ...env, ALLOW_LOCALHOST: "0" }); assert.equal(r.status, 403);
});
await t("token cached across requests (1 token fetch for 5 lookups)", async () => {
  _resetForTests(); calls.length = 0;
  for (let i = 0; i < 5; i++) assert.equal((await worker.fetch(req("?plate=AB12CDE", SITE, "3.3.3." + i), env)).status, 200);
  assert.equal(calls.filter(u => u.includes("token")).length, 1);
  assert.equal(calls.filter(u => u.includes("history.mot")).length, 5);
});
await t("concurrent cold requests share one token fetch", async () => {
  _resetForTests(); calls.length = 0;
  await Promise.all([1, 2, 3].map(i => worker.fetch(req("?plate=AB12CDE", SITE, "4.4.4." + i), env)));
  assert.equal(calls.filter(u => u.includes("token")).length, 1);
});
await t("token refreshed when near expiry", async () => {
  _resetForTests(); calls.length = 0; tokenLife = 60; // shorter than 2-minute skew -> always refresh
  await worker.fetch(req("?plate=AB12CDE", SITE, "5.5.5.1"), env);
  await worker.fetch(req("?plate=AB12CDE", SITE, "5.5.5.2"), env);
  assert.equal(calls.filter(u => u.includes("token")).length, 2); tokenLife = 3600;
});
await t("401 from DVSA drops token and retries once", async () => {
  _resetForTests(); calls.length = 0; motStatus = 401;
  const r = await worker.fetch(req("?plate=AB12CDE", SITE, "6.6.6.6"), env);
  assert.equal(r.status, 200); assert.equal(calls.filter(u => u.includes("token")).length, 2);
});
await t("in-memory limiter: 20/min per IP then 429, other IPs unaffected", async () => {
  _resetForTests(); calls.length = 0;
  for (let i = 0; i < 20; i++) assert.equal((await worker.fetch(req("?plate=AB12CDE", SITE, "7.7.7.7"), env)).status, 200);
  const r = await worker.fetch(req("?plate=AB12CDE", SITE, "7.7.7.7"), env);
  assert.equal(r.status, 429); assert.equal(r.headers.get("Retry-After"), "60");
  assert.equal((await worker.fetch(req("?plate=AB12CDE", SITE, "8.8.8.8"), env)).status, 200);
  assert.equal(calls.filter(u => u.includes("history.mot")).length, 21);
});
await t("memory window resets after 60s", async () => {
  _resetForTests(); const t0 = 1e12;
  for (let i = 0; i < 20; i++) memLimit("ip", t0);
  assert.equal(memLimit("ip", t0 + 1000), false); assert.equal(memLimit("ip", t0 + 61000), true);
});
await t("uses MOT_LIMITER binding when present (keyed by IP)", async () => {
  _resetForTests(); const keys = [];
  const limiter = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  const r = await worker.fetch(req("?plate=AB12CDE", SITE, "9.9.9.9"), { ...env, MOT_LIMITER: limiter });
  assert.equal(r.status, 429); assert.deepEqual(keys, ["ip:9.9.9.9"]);
});
await t("bad plate -> 400 without upstream call", async () => {
  _resetForTests(); calls.length = 0;
  const r = await worker.fetch(req("?plate=--", SITE), env); assert.equal(r.status, 400); assert.equal(calls.length, 0);
});
await t("POST rejected 405", async () => {
  const r = await worker.fetch(req("?plate=AB12CDE", SITE, "1.2.3.4", "POST"), env); assert.equal(r.status, 405);
});
console.log(`\n${pass} tests passed; no real network calls (fetch mocked).`);
