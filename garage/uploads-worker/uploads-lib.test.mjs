// Local unit tests with an in-memory mock of the R2 bucket. Run: node uploads-lib.test.mjs
import assert from "node:assert/strict";
import worker from "./uploads-worker.js";
import { _resetForTests, sha256hex, sniff, LIMITS } from "./uploads-lib.js";

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
    const start = cursor ? parseInt(cursor, 10) : 0, page = keys.slice(start, start + 3); // small pages to exercise paging
    const truncated = start + 3 < keys.length;
    return { objects: page.map(key => ({ key })), truncated, cursor: truncated ? String(start + 3) : undefined };
  }
  async delete(k) { for (const x of [].concat(k)) this.m.delete(x); }
}
const SITE = "https://thelancasterelectrician.com";
const W = "https://w.dev";
const UID = "AbCdEfGhIjKlMnOpQrStUv"; // 22 chars = 128 bits
const KEY = "OwnerKeyOwnerKeyOwnerKeyOwnerKeyOwnerKey123";
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const pdf = () => new TextEncoder().encode("%PDF-1.4\n%fake\n");
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
let env, ip = 1;
const fresh = () => { _resetForTests(); env = { UPLOADS: new MockR2() }; };
const call = (method, path, { origin = SITE, body, headers = {}, ipAddr } = {}) =>
  worker.fetch(new Request(W + path, { method, body, headers: { ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ipAddr || ("10.0.0." + (ip++ % 250)), ...headers } }), env);
const register = (uid = UID, key = KEY) => sha256hex(key).then(h => call("POST", "/register", { body: JSON.stringify({ uploadId: uid, ownerKeyHash: h }), headers: { "Content-Type": "application/json" } }));
const form = (files, fields = {}) => { const fd = new FormData(); files.forEach(([b, n, t]) => fd.append("file", new Blob([b], { type: t || "" }), n)); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return fd; };
const upload = (fd, uid = UID) => call("POST", "/upload/" + uid, { body: fd });
const owner = (method, path, key = KEY) => call(method, path, { headers: { "X-Owner-Key": key } });
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log("ok -", name); };

await t("foreign origin and missing origin -> 403", async () => {
  fresh();
  assert.equal((await call("GET", "/info/" + UID, { origin: "https://evil.example" })).status, 403);
  assert.equal((await call("GET", "/info/" + UID, { origin: "" })).status, 403);
});
await t("localhost allowed, can be disabled", async () => {
  fresh();
  assert.equal((await call("OPTIONS", "/upload/" + UID, { origin: "http://localhost:8080" })).status, 204);
  env.ALLOW_LOCALHOST = "0";
  assert.equal((await call("OPTIONS", "/upload/" + UID, { origin: "http://localhost:8080" })).status, 403);
});
await t("preflight lists X-Owner-Key and echoes origin", async () => {
  fresh();
  const r = await call("OPTIONS", "/list/" + UID);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.match(r.headers.get("Access-Control-Allow-Headers"), /X-Owner-Key/);
});
await t("register: stores only the hash, idempotent, 409 on different hash, bad input 400", async () => {
  fresh();
  assert.equal((await register()).status, 201);
  const stored = await (await env.UPLOADS.get("reg/" + UID + ".json")).text();
  assert.ok(stored.includes(await sha256hex(KEY)) && !stored.includes(KEY));
  assert.equal((await register()).status, 200);
  assert.equal((await register(UID, "SomeoneElseSomeoneElseSomeoneElse1234567890")).status, 409);
  assert.equal((await call("POST", "/register", { body: JSON.stringify({ uploadId: "short", ownerKeyHash: "x" }) })).status, 400);
  assert.equal((await call("POST", "/register", { body: "not json" })).status, 400);
});
await t("info: 404 until registered, then ok", async () => {
  fresh();
  assert.equal((await call("GET", "/info/" + UID)).status, 404);
  await register();
  assert.equal((await call("GET", "/info/" + UID)).status, 200);
});
await t("upload to unregistered ID -> 404", async () => {
  fresh();
  assert.equal((await upload(form([[jpg(), "a.jpg"]]))).status, 404);
});
await t("upload 2 photos + PDF + note, owner lists, downloads, deletes", async () => {
  fresh(); await register();
  const r = await upload(form([[jpg(), "front.jpg", "image/jpeg"], [png(), "dash.png"], [pdf(), "Invoice 123.pdf"]], { note: "New front pads and discs", garage: "Smith Motors", mechanic: "Dave", mileage: "84,210" }));
  assert.equal(r.status, 201);
  const { jobId } = await r.json();
  const l = await owner("GET", "/list/" + UID); assert.equal(l.status, 200);
  const { jobs } = await l.json();
  assert.equal(jobs.length, 1);
  const j = jobs[0];
  assert.equal(j.id, jobId); assert.equal(j.note, "New front pads and discs"); assert.equal(j.garage, "Smith Motors"); assert.equal(j.mileage, 84210);
  assert.deepEqual(j.files.map(f => f.type), ["image/jpeg", "image/png", "application/pdf"]);
  const f = await owner("GET", "/file/" + UID + "/" + jobId + "/" + j.files[2].key);
  assert.equal(f.status, 200); assert.equal(f.headers.get("Content-Type"), "application/pdf");
  assert.equal(new TextDecoder().decode(await f.arrayBuffer()), "%PDF-1.4\n%fake\n");
  const d = await owner("DELETE", "/job/" + UID + "/" + jobId); assert.equal(d.status, 200);
  assert.equal((await d.json()).deleted, 4);
  assert.equal([...env.UPLOADS.m.keys()].filter(k => k.startsWith("job/")).length, 0);
  assert.equal((await (await owner("GET", "/list/" + UID)).json()).jobs.length, 0);
});
await t("owner routes need the right key", async () => {
  fresh(); await register();
  assert.equal((await call("GET", "/list/" + UID)).status, 401);
  assert.equal((await owner("GET", "/list/" + UID, "WrongKeyWrongKeyWrongKeyWrongKeyWrongKey123")).status, 401);
  const { jobId } = await (await upload(form([[jpg(), "a.jpg"]]))).json();
  assert.equal((await owner("DELETE", "/job/" + UID + "/" + jobId, "WrongKeyWrongKeyWrongKeyWrongKeyWrongKey123")).status, 401);
  assert.equal((await owner("GET", "/file/" + UID + "/" + jobId + "/f0.jpg", "WrongKeyWrongKeyWrongKeyWrongKeyWrongKey123")).status, 401);
  assert.equal([...env.UPLOADS.m.keys()].filter(k => k.startsWith("job/")).length, 2);
});
await t("path traversal / odd file names rejected", async () => {
  fresh(); await register();
  const { jobId } = await (await upload(form([[jpg(), "a.jpg"]]))).json();
  assert.equal((await owner("GET", "/file/" + UID + "/" + jobId + "/meta.json")).status, 404);
  assert.equal((await owner("GET", "/file/" + UID + "/" + jobId + "/..%2Freg")).status, 404);
  assert.equal((await owner("GET", "/file/" + UID + "/../" + jobId + "/f0.jpg")).status, 404);
});
await t("rejects non-image/PDF content even if named .jpg", async () => {
  fresh(); await register();
  const r = await upload(form([[new TextEncoder().encode("<html>evil</html>"), "x.jpg", "image/jpeg"]]));
  assert.equal(r.status, 415);
  assert.equal([...env.UPLOADS.m.keys()].filter(k => k.startsWith("job/")).length, 0);
});
await t("rejects >10 files, >10MB file, >50MB job, empty job", async () => {
  fresh(); await register();
  assert.equal((await upload(form(Array.from({ length: 11 }, (_, i) => [jpg(), i + ".jpg"])))).status, 400);
  const big = new Uint8Array(LIMITS.maxFileBytes + 1); big.set([0xff, 0xd8, 0xff]);
  assert.equal((await upload(form([[big, "big.jpg"]]))).status, 413);
  const nine = new Uint8Array(9 * 1024 * 1024); nine.set([0xff, 0xd8, 0xff]);
  assert.equal((await upload(form(Array.from({ length: 6 }, (_, i) => [nine, i + ".jpg"])))).status, 413);
  assert.equal((await upload(form([], {}))).status, 400);
  assert.equal([...env.UPLOADS.m.keys()].filter(k => k.startsWith("job/")).length, 0);
});
await t("Content-Length over 51MB rejected before parsing", async () => {
  fresh(); await register();
  const r = await worker.fetch(new Request(W + "/upload/" + UID, { method: "POST", body: "x", headers: { Origin: SITE, "Content-Type": "multipart/form-data; boundary=x", "Content-Length": String(60 * 1024 * 1024) } }), env);
  assert.equal(r.status, 413);
});
await t("note-only job allowed; text is trimmed and capped", async () => {
  fresh(); await register();
  assert.equal((await upload(form([], { note: "  " + "a".repeat(5000) + "  ", mileage: "lots" }))).status, 201);
  const { jobs } = await (await owner("GET", "/list/" + UID)).json();
  assert.equal(jobs[0].note.length, LIMITS.maxNote); assert.equal(jobs[0].mileage, null); assert.equal(jobs[0].files.length, 0);
});
await t("failed R2 write cleans up partial files, nothing listed", async () => {
  fresh(); await register();
  env.UPLOADS.failPutAfter = env.UPLOADS.puts + 2;
  const r = await upload(form([[jpg(), "a.jpg"], [jpg(), "b.jpg"], [pdf(), "c.pdf"]]));
  assert.equal(r.status, 500);
  assert.equal([...env.UPLOADS.m.keys()].filter(k => k.startsWith("job/")).length, 0);
});
await t("pending jobs capped at 20 (list paging works)", async () => {
  fresh(); await register();
  for (let i = 0; i < LIMITS.maxPendingJobs; i++) assert.equal((await upload(form([], { note: "n" + i }))).status, 201);
  assert.equal((await upload(form([], { note: "one more" }))).status, 429);
  assert.equal((await (await owner("GET", "/list/" + UID)).json()).jobs.length, 20);
});
await t("per-IP rate limit (fallback): 11th write in a minute -> 429", async () => {
  fresh(); await register();
  let last;
  for (let i = 0; i < 11; i++) last = await call("POST", "/upload/" + UID, { body: form([], { note: "x" }), ipAddr: "9.9.9.9" });
  assert.equal(last.status, 429);
});
await t("uses rate-limit binding when present", async () => {
  fresh(); const seen = [];
  env.UPLOAD_LIMITER = { limit: async ({ key }) => { seen.push(key); return { success: false }; } };
  assert.equal((await call("POST", "/upload/" + UID, { body: form([], { note: "x" }), ipAddr: "8.8.8.8" })).status, 429);
  assert.deepEqual(seen, ["write:8.8.8.8"]);
});
await t("sniff recognises jpeg/png/webp/heic/pdf only", async () => {
  const b = s => new TextEncoder().encode(s);
  assert.equal(sniff(jpg()).ext, "jpg"); assert.equal(sniff(png()).ext, "png"); assert.equal(sniff(pdf()).ext, "pdf");
  assert.equal(sniff(b("RIFF\0\0\0\0WEBPVP8 ")).ext, "webp"); assert.equal(sniff(b("\0\0\0\x18ftypheic")).ext, "heic");
  assert.equal(sniff(b("GIF89a")), null); assert.equal(sniff(b("PK\x03\x04")), null);
});
console.log(`\n${pass} passed`);
