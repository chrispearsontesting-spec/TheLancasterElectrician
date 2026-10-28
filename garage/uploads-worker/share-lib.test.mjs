// Unit tests for "Share for sale" reports (mock R2). Run: node share-lib.test.mjs
import assert from "node:assert/strict";
import worker from "./uploads-worker.js";
import { _resetForTests, sha256hex } from "./uploads-lib.js";
import { handleShare, SHARE } from "./share-lib.js";

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
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const pdf = () => new TextEncoder().encode("%PDF-1.4\n%fake\n");
const html = () => new TextEncoder().encode("<html><script>alert(1)</script>");
let env, ip = 1;
const fresh = () => { _resetForTests(); env = { UPLOADS: new MockR2() }; };
const call = (method, path, { origin = SITE, body, headers = {}, ipAddr } = {}) =>
  worker.fetch(new Request(W + path, { method, body, headers: { ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ipAddr || ("10.1.0." + (ip++ % 250)), ...headers } }), env);
const REPORT = { v: 1, car: { make: "Volvo", model: "XC60 D5", plate: "SB61LGZ" }, note: "Lovely car" };
const form = (files = [], report = REPORT) => { const fd = new FormData(); fd.append("report", typeof report === "string" ? report : JSON.stringify(report)); files.forEach(([b, n, t]) => { fd.append("file", new Blob([b]), n); fd.append("title", t || ""); }); return fd; };
const create = async (files, opts = {}) => call("POST", "/share", { body: form(files, opts.report), ...opts });
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log("ok -", name); };

await t("create: 201, 128-bit id, 256-bit revoke key, only hash stored, files sniffed", async () => {
  fresh();
  const r = await create([[jpg(), "a.jpg", "Brake discs"], [pdf(), "inv.pdf", "Invoice"]]);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.match(j.id, /^[A-Za-z0-9_-]{22}$/); assert.match(j.revokeKey, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(j.files, 2); assert.ok(j.expires - j.created === SHARE.ttlMs);
  const meta = JSON.parse(await (await env.UPLOADS.get("share/" + j.id + "/meta.json")).text());
  assert.equal(meta.h, await sha256hex(j.revokeKey));
  assert.ok(!JSON.stringify(meta).includes(j.revokeKey));
  assert.ok(env.UPLOADS.m.has("share/" + j.id + "/f0.jpg") && env.UPLOADS.m.has("share/" + j.id + "/f1.pdf"));
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
});
await t("create: only from app origins (foreign / missing origin 403), localhost ok", async () => {
  fresh();
  assert.equal((await create([], { origin: "https://evil.example" })).status, 403);
  assert.equal((await create([], { origin: "" })).status, 403);
  assert.equal((await create([], { origin: "http://localhost:5500" })).status, 201);
  assert.equal((await call("OPTIONS", "/share", { origin: "https://evil.example" })).status, 403);
  const pre = await call("OPTIONS", "/share");
  assert.equal(pre.status, 204); assert.match(pre.headers.get("Access-Control-Allow-Headers"), /X-Revoke-Key/);
});
await t("create: rejects markup, bad JSON, missing report, too many files, too big", async () => {
  fresh();
  assert.equal((await create([[html(), "x.pdf"]])).status, 415);
  assert.equal((await create([], { report: "{nope" })).status, 400);
  assert.equal((await create([], { report: "[1,2]" })).status, 400);
  const fd = new FormData(); fd.append("file", new Blob([jpg()]), "a.jpg");
  assert.equal((await call("POST", "/share", { body: fd })).status, 400);
  assert.equal((await create(Array.from({ length: SHARE.maxFiles + 1 }, () => [jpg(), "a.jpg"]))).status, 400);
  const big = new Uint8Array(9 * 1024 * 1024); big.set(jpg());
  assert.equal((await create([[big, "1.jpg"], [big, "2.jpg"], [big, "3.jpg"]])).status, 413);
  const huge = new Uint8Array(11 * 1024 * 1024); huge.set(jpg());
  assert.equal((await create([[huge, "h.jpg"]])).status, 413);
  assert.equal([...env.UPLOADS.m.keys()].length, 0, "nothing stored on failures");
});
await t("create: R2 failure cleans up half-written files", async () => {
  fresh(); env.UPLOADS.failPutAfter = 1;
  assert.equal((await create([[jpg(), "a.jpg"], [jpg(), "b.jpg"]])).status, 500);
  assert.equal(env.UPLOADS.m.size, 0);
});
await t("read: public by link from any origin or none, noindex, no hash leaked", async () => {
  fresh();
  const j = await (await create([[jpg(), "a.jpg", "Front pads"]])).json();
  for (const origin of ["", "https://evil.example", SITE]) {
    const r = await call("GET", "/share/" + j.id, { origin });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.report.car.plate, "SB61LGZ"); assert.equal(b.files[0].title, "Front pads");
    assert.equal(b.h, undefined); assert.ok(!JSON.stringify(b).includes(j.revokeKey));
    assert.match(r.headers.get("X-Robots-Tag"), /noindex/);
  }
  assert.equal((await call("GET", "/share/" + j.id, { origin: "" })).headers.get("Access-Control-Allow-Origin"), "*");
});
await t("file: correct type, nosniff, inline; unknown n 404; bad ids 404", async () => {
  fresh();
  const j = await (await create([[jpg(), "a.jpg"], [pdf(), "b.pdf"]])).json();
  const f0 = await call("GET", "/share/" + j.id + "/file/0", { origin: "" });
  assert.equal(f0.status, 200); assert.equal(f0.headers.get("Content-Type"), "image/jpeg"); assert.equal(f0.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(new Uint8Array(await f0.arrayBuffer()), jpg());
  const f1 = await call("GET", "/share/" + j.id + "/file/1", { origin: "" });
  assert.equal(f1.headers.get("Content-Type"), "application/pdf");
  assert.equal((await call("GET", "/share/" + j.id + "/file/2")).status, 404);
  assert.equal((await call("GET", "/share/" + j.id + "/file/../meta.json")).status, 404);
  assert.equal((await call("GET", "/share/short")).status, 404);
  assert.equal((await call("GET", "/share/AAAAAAAAAAAAAAAAAAAAAA")).status, 404);
});
await t("revoke: needs right key + app origin; leaves tombstone; files gone; state revoked", async () => {
  fresh();
  const j = await (await create([[jpg(), "a.jpg"], [pdf(), "b.pdf"]])).json();
  assert.equal((await call("DELETE", "/share/" + j.id, { headers: { "X-Revoke-Key": "x".repeat(43) } })).status, 401);
  assert.equal((await call("DELETE", "/share/" + j.id, { headers: { "X-Revoke-Key": j.revokeKey }, origin: "https://evil.example" })).status, 403);
  const r = await call("DELETE", "/share/" + j.id, { headers: { "X-Revoke-Key": j.revokeKey } });
  assert.equal(r.status, 200); assert.equal((await r.json()).deleted, 2);
  assert.deepEqual([...env.UPLOADS.m.keys()], ["share/" + j.id + "/meta.json"]);
  const g = await call("GET", "/share/" + j.id, { origin: "" });
  assert.equal(g.status, 410); assert.equal((await g.json()).state, "revoked");
  assert.equal((await call("GET", "/share/" + j.id + "/file/0", { origin: "" })).status, 410);
  assert.equal((await call("DELETE", "/share/" + j.id, { headers: { "X-Revoke-Key": j.revokeKey } })).status, 401, "tombstone has no hash");
});
await t("expiry checked in code: 410 expired and files wiped", async () => {
  fresh();
  const j = await (await create([[jpg(), "a.jpg"]])).json();
  const later = Date.now() + SHARE.ttlMs + 1000;
  const req = new Request(W + "/share/" + j.id, { headers: { "CF-Connecting-IP": "9.9.9.9" } });
  const r = await handleShare(req, env, ["share", j.id], later);
  assert.equal(r.status, 410); assert.equal((await r.json()).state, "expired");
  assert.ok(!env.UPLOADS.m.has("share/" + j.id + "/f0.jpg"));
});
await t("rate limits: writes 10/min, reads 120/min per IP", async () => {
  fresh();
  let last;
  for (let i = 0; i < 11; i++) last = await create([], { ipAddr: "7.7.7.7" });
  assert.equal(last.status, 429);
  const j = await (await create([])).json();
  for (let i = 0; i < 121; i++) last = await call("GET", "/share/" + j.id, { ipAddr: "8.8.8.8", origin: "" });
  assert.equal(last.status, 429);
});
await t("existing routes still origin-locked", async () => {
  fresh();
  assert.equal((await call("GET", "/info/AbCdEfGhIjKlMnOpQrStUv", { origin: "" })).status, 403);
});
console.log(`\n${pass} share tests passed`);
