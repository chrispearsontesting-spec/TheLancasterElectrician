// Unit tests for phase 2 QR controls: retire (New link), pause, 4-digit job code + lockout. Run: node controls.test.mjs
import assert from "node:assert/strict";
import worker from "./uploads-worker.js";
import { _resetForTests, sha256hex, CODE } from "./uploads-lib.js";
class MockR2 {
  constructor() { this.m = new Map(); this.failPutAfter = Infinity; this.puts = 0; }
  async put(k, v, o = {}) {
    if (++this.puts > this.failPutAfter) throw new Error("boom");
    const buf = typeof v === "string" ? new TextEncoder().encode(v) : new Uint8Array(v);
    this.m.set(k, { buf, httpMetadata: o.httpMetadata || {} });
  }
  async get(k) {
    const r = this.m.get(k); if (!r) return null;
    return { httpMetadata: r.httpMetadata, body: new Blob([r.buf]).stream(), text: async () => new TextDecoder().decode(r.buf) };
  }
  async list({ prefix = "", cursor } = {}) {
    const keys = [...this.m.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? parseInt(cursor, 10) : 0, page = keys.slice(start, start + 3);
    const truncated = start + 3 < keys.length;
    return { objects: page.map(key => ({ key })), truncated, cursor: truncated ? String(start + 3) : undefined };
  }
  async delete(k) { for (const x of [].concat(k)) this.m.delete(x); }
}
const SITE = "https://thelancasterelectrician.com", W = "https://w.dev";
const UID = "AbCdEfGhIjKlMnOpQrStUv", KEY = "OwnerKeyOwnerKeyOwnerKeyOwnerKeyOwnerKey123";
const UID2 = "ZyXwVuTsRqPoNmLkJiHgFe", KEY2 = "NewKeyNewKeyNewKeyNewKeyNewKeyNewKeyNewKey1";
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const webm = () => { const a = new Uint8Array(400); a.set([0x1a, 0x45, 0xdf, 0xa3]); return a; };
let env, ip = 1;
const fresh = () => { _resetForTests(); env = { UPLOADS: new MockR2(), AI: { run: async () => ({ text: "front pads done" }) } }; };
const call = (method, path, { origin = SITE, body, headers = {}, ipAddr } = {}) =>
  worker.fetch(new Request(W + path, { method, body, headers: { ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ipAddr || ("10.2.0." + (ip++ % 250)), ...headers } }), env);
const register = (uid = UID, key = KEY) => sha256hex(key).then(h => call("POST", "/register", { body: JSON.stringify({ uploadId: uid, ownerKeyHash: h }), headers: { "Content-Type": "application/json" } }));
const upload = (code, uid = UID) => { const fd = new FormData(); fd.append("file", new Blob([jpg()]), "a.jpg"); fd.append("note", "x"); return call("POST", "/upload/" + uid, { body: fd, headers: code != null ? { "X-Job-Code": code } : {} }); };
const tx = (code) => call("POST", "/transcribe/" + UID, { body: webm(), headers: { "Content-Type": "audio/webm", ...(code != null ? { "X-Job-Code": code } : {}) } });
const settings = (body, key = KEY, uid = UID) => call("POST", "/settings/" + uid, { body: JSON.stringify(body), headers: { "X-Owner-Key": key, "Content-Type": "application/json" } });
const checkCode = (code, ipAddr) => call("POST", "/code/" + UID, { body: JSON.stringify({ code }), headers: { "Content-Type": "application/json" }, ipAddr });
const info = () => call("GET", "/info/" + UID).then(r => r.json());
const reg = async (uid = UID) => JSON.parse(await (await env.UPLOADS.get("reg/" + uid + ".json")).text());
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log("ok -", name); };

await t("no code, not paused: everything works exactly as before", async () => {
  fresh(); await register();
  const i = await info(); assert.equal(i.paused, false); assert.equal(i.needCode, false);
  assert.equal((await upload()).status, 201);
  assert.equal((await tx()).status, 200);
  assert.equal((await checkCode("")).status, 200);
});
await t("settings need the owner key; bad input 400", async () => {
  fresh(); await register();
  assert.equal((await settings({ paused: true }, "x".repeat(43))).status, 401);
  assert.equal((await settings({ paused: "yes" })).status, 400);
  assert.equal((await settings({ code: "12a4" })).status, 400);
  assert.equal((await settings({ code: "12345" })).status, 400);
});
await t("pause: info says paused, upload + transcribe refused 423 with friendly text; resume restores", async () => {
  fresh(); await register();
  const r = await settings({ paused: true }); assert.equal(r.status, 200); assert.equal((await r.json()).paused, true);
  assert.equal((await info()).paused, true);
  const u = await upload(); assert.equal(u.status, 423); assert.match((await u.json()).error, /paused uploads/);
  assert.equal((await tx()).status, 423);
  assert.equal((await reg()).h, await sha256hex(KEY), "owner hash kept");
  await settings({ paused: false });
  assert.equal((await upload()).status, 201);
});
await t("register refresh keeps paused + code", async () => {
  fresh(); await register(); await settings({ paused: true, code: "4821" });
  const r = await register(); const j = await r.json();
  assert.equal(j.paused, true); assert.equal(j.hasCode, true);
  assert.equal((await reg()).paused, true);
});
await t("code: only a hash salted with the upload ID is stored", async () => {
  fresh(); await register(); await settings({ code: "4821" });
  const g = await reg();
  assert.equal(g.ch, await sha256hex(UID + ":4821"));
  assert.ok(!JSON.stringify(g).includes("4821"));
  assert.equal((await info()).needCode, true);
});
await t("code: check endpoint, upload and transcribe need the right code", async () => {
  fresh(); await register(); await settings({ code: "4821" });
  assert.equal((await checkCode("4821")).status, 200);
  const w = await checkCode("1111"); assert.equal(w.status, 403); assert.equal((await w.json()).triesLeft, 4);
  const nc = await upload(); assert.equal(nc.status, 403); assert.equal((await nc.json()).state, "code");
  assert.equal((await upload("4821")).status, 201);
  assert.equal((await tx()).status, 403);
  assert.equal((await tx("4821")).status, 200);
});
await t("code: 5 wrong tries lock the ID for 15 min (even the right code, any IP); owner change clears lock", async () => {
  fresh(); await register(); await settings({ code: "4821" });
  for (let i = 0; i < 4; i++) assert.equal((await checkCode("000" + i, "1.1.1." + i)).status, 403);
  const l = await checkCode("0009", "1.1.1.9"); assert.equal(l.status, 429); const j = await l.json();
  assert.equal(j.state, "locked"); assert.match(j.error, /locked for 15 minutes/);
  assert.equal((await checkCode("4821", "2.2.2.2")).status, 429);
  assert.equal((await upload("4821")).status, 429);
  assert.equal((await tx("4821")).status, 429);
  assert.equal((await info()).locked, true);
  const lk = JSON.parse(await (await env.UPLOADS.get("lock/" + UID + ".json")).text());
  assert.ok(lk.until - Date.now() > CODE.lockMs - 5000);
  // lock expires
  lk.until = Date.now() - 1; await env.UPLOADS.put("lock/" + UID + ".json", JSON.stringify(lk));
  assert.equal((await checkCode("4821")).status, 200);
  assert.equal(env.UPLOADS.m.has("lock/" + UID + ".json"), false, "right code clears counter");
  // owner resets
  for (let i = 0; i < 5; i++) await checkCode("1234");
  assert.equal((await checkCode("4821")).status, 429);
  await settings({ code: "7777" });
  assert.equal((await checkCode("7777")).status, 200);
});
await t("code: right code resets the wrong-try counter", async () => {
  fresh(); await register(); await settings({ code: "4821" });
  for (let i = 0; i < 4; i++) await checkCode("1111");
  assert.equal((await checkCode("4821")).status, 200);
  const r = await checkCode("1111"); assert.equal((await r.json()).triesLeft, 4);
});
await t("code: clearing it removes the check", async () => {
  fresh(); await register(); await settings({ code: "4821" });
  await settings({ code: "" });
  assert.equal((await reg()).ch, undefined);
  assert.equal((await upload()).status, 201);
});
await t("retire (New link): old ID refused at once, owner can still collect + delete pending jobs, cannot re-register", async () => {
  fresh(); await register(); await settings({ code: "4821" });
  assert.equal((await upload("4821")).status, 201);
  assert.equal((await call("POST", "/retire/" + UID, { headers: { "X-Owner-Key": "y".repeat(43) } })).status, 401);
  const r = await call("POST", "/retire/" + UID, { headers: { "X-Owner-Key": KEY } });
  assert.equal(r.status, 200); assert.equal((await r.json()).pending, 1);
  const g = await reg(); assert.equal(g.retired, true); assert.equal(g.ch, undefined);
  const i = await call("GET", "/info/" + UID); assert.equal(i.status, 410); assert.match((await i.json()).error, /replaced/);
  assert.equal((await upload("4821")).status, 410);
  assert.equal((await tx("4821")).status, 410);
  assert.equal((await checkCode("4821")).status, 410);
  assert.equal((await settings({ paused: true })).status, 410);
  assert.equal((await register()).status, 410);
  const list = await (await call("GET", "/list/" + UID, { headers: { "X-Owner-Key": KEY } })).json();
  assert.equal(list.jobs.length, 1);
  assert.equal((await call("DELETE", "/job/" + UID + "/" + list.jobs[0].id, { headers: { "X-Owner-Key": KEY } })).status, 200);
  // new ID works independently
  await register(UID2, KEY2);
  assert.equal((await upload(null, UID2)).status, 201);
});
await t("CORS preflight allows X-Job-Code", async () => {
  fresh();
  assert.match((await call("OPTIONS", "/upload/" + UID)).headers.get("Access-Control-Allow-Headers"), /X-Job-Code/);
});
console.log(`\n${pass} controls tests passed`);
