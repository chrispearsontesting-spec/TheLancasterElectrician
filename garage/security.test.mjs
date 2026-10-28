// Unit tests for app-lock.js (PIN hash + backoff) and backup.js (pack/serialize/encrypt round trip). Run: node security.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("./app-lock.js"), B = require("./backup.js");
let pass = 0; const t = async (n, f) => { await f(); pass++; console.log("ok -", n); };

await t("PIN record stores salted PBKDF2 hash only, >=150k iterations", async () => {
  const r = await L.makeRecord("482913");
  assert.ok(r.iter >= 150000); assert.equal(r.len, 6);
  assert.ok(!JSON.stringify(r).includes("482913"));
  const r2 = await L.makeRecord("482913"); assert.notEqual(r.salt, r2.salt); assert.notEqual(r.hash, r2.hash);
  assert.equal(await L.check(r, "482913"), true);
  assert.equal(await L.check(r, "482914"), false);
  assert.equal(await L.check(r, "48291"), false);
});
await t("PIN must be 4-6 digits", async () => {
  for (const bad of ["123", "1234567", "12a4", ""]) await assert.rejects(L.makeRecord(bad));
  assert.equal((await L.makeRecord("1234", 1000)).len, 4);
});
await t("backoff: 5 wrong = 30s, then 60s, 120s; right PIN resets", () => {
  let s = null, now = 1e12;
  for (let i = 0; i < 4; i++) { s = L.nextTries(s, false, now); assert.equal(s.until, 0); }
  s = L.nextTries(s, false, now); assert.equal(s.until - now, 30000); assert.equal(s.n, 0);
  for (let i = 0; i < 5; i++) s = L.nextTries(s, false, now); assert.equal(s.until - now, 60000);
  for (let i = 0; i < 5; i++) s = L.nextTries(s, false, now); assert.equal(s.until - now, 120000);
  assert.deepEqual(L.nextTries(s, true, now), { n: 0, until: 0, rounds: 0 });
});
const snap = () => ({
  ls: { "gt.garage": JSON.stringify({ i: 0, cars: [{ plate: "SB61LGZ", upId: "A".repeat(22), upKey: "K".repeat(43) }, { plate: "AB12CDE" }] }), "dipstick-history": "[]", "gt.shares": "[]" },
  dbs: [{ name: "dipstick-uploads", version: 1, stores: [
    { name: "jobs", keyPath: "id", autoIncrement: false, indexes: [{ name: "up", keyPath: "up", unique: false, multiEntry: false }], records: [{ k: "j1", v: { id: "j1", up: "A".repeat(22), note: "pads", when: new Date(5), weird: { $blob: "not a ref" } } }] },
    { name: "files", keyPath: null, autoIncrement: false, indexes: [], records: [
      { k: "j1/f0.jpg", v: { blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" }), name: "a.jpg" } },
      { k: "j1/f1.pdf", v: { blob: new File([new Uint8Array(70000).fill(7)], "inv.pdf", { type: "application/pdf", lastModified: 42 }) } }] }] },
    { name: "dipstick", version: 2, stores: [{ name: "clips", keyPath: null, autoIncrement: false, indexes: [], records: [{ k: 1, v: new Uint8Array([9, 8, 7]).buffer }, { k: 2, v: new Uint16Array([1, 65535]) }] }] }]
});
const bytesOf = async b => [...new Uint8Array(await b.arrayBuffer())];
await t("serialize/deserialize keeps blobs, files, buffers, dates and odd keys identical", async () => {
  const s = snap(), back = B.deserialize(await B.serialize(s));
  assert.deepEqual(back.ls, s.ls);
  const j = back.dbs[0].stores[0].records[0].v;
  assert.equal(j.when.getTime(), 5); assert.deepEqual(j.weird, { $blob: "not a ref" });
  const f = back.dbs[0].stores[1].records;
  assert.equal(f[0].v.blob.type, "image/jpeg"); assert.deepEqual(await bytesOf(f[0].v.blob), [0xff, 0xd8, 0xff, 1, 2, 3]);
  assert.equal(f[1].v.blob.name, "inv.pdf"); assert.equal(f[1].v.blob.size, 70000); assert.equal(f[1].v.blob.lastModified, 42);
  const c = back.dbs[1].stores[0].records;
  assert.deepEqual([...new Uint8Array(c[0].v)], [9, 8, 7]); assert.ok(c[1].v instanceof Uint16Array); assert.deepEqual([...c[1].v], [1, 65535]);
  assert.deepEqual(back.dbs[0].stores[0].indexes, s.dbs[0].stores[0].indexes);
});
await t("encrypt -> decrypt round trip; header has salt/iv/iter>=250k; no plaintext leaks", async () => {
  const plain = await B.serialize(snap());
  const file = await B.encrypt(plain, "correct horse battery staple");
  const h = B.readHeader(file).h;
  assert.ok(h.iter >= 250000); assert.equal(h.cipher, "AES-256-GCM"); assert.equal(atob(h.salt).length, 16); assert.equal(atob(h.iv).length, 12);
  assert.ok(!Buffer.from(file).toString("latin1").includes("SB61LGZ"));
  const out = await B.decrypt(file, "correct horse battery staple");
  assert.deepEqual([...out.plain], [...plain]);
  const f2 = await B.encrypt(plain, "correct horse battery staple"); assert.notDeepEqual([...f2.subarray(12, 200)], [...file.subarray(12, 200)]);
});
await t("wrong passphrase, tampered file and non-backup fail cleanly", async () => {
  const file = await B.encrypt(await B.serialize(snap()), "right pass phrase", { iter: 250000 });
  await assert.rejects(B.decrypt(file, "wrong pass phrase"), e => e.code === "badpass" && /Wrong passphrase/.test(e.message));
  const bad = file.slice(); bad[bad.length - 5] ^= 1; await assert.rejects(B.decrypt(bad, "right pass phrase"), e => e.code === "badpass");
  const hdr = file.slice(); hdr[40] ^= 1; await assert.rejects(B.decrypt(hdr, "right pass phrase"));
  await assert.rejects(B.decrypt(new TextEncoder().encode("hello world, not a backup"), "x"), /isn't a Driv3 backup/);
});
await t("summary counts cars and files", async () => {
  const s = B.summarize(snap()); assert.equal(s.cars, 2); assert.equal(s.files, 4);
});
await t("passphrase strength hint", () => {
  assert.equal(B.strength("abc").score, 0); assert.equal(B.strength("Volvo2024!x").score, 2);
  assert.equal(B.strength("purple tractor seven lemons").score, 3);
});
console.log(`\n${pass} security tests passed`);
