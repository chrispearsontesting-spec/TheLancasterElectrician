// Unit tests for export.js JSON round-trip and CSV. Run: node export.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("./backup.js");
globalThis.Driv3Backup = { core, summarize: core.summarize };
const X = require("./export.js");

let pass = 0;
const t = async (n, f) => { await f(); pass++; console.log("ok -", n); };

const snap = () => ({
  ls: {
    "gt.garage": JSON.stringify({ i: 0, cars: [{ plate: "SB61LGZ", name: "Volvo XC60", nick: "Volvo", fuel: "diesel" }, { plate: "AB12CDE", fuel: "petrol" }] }),
    "gt.driveLog": JSON.stringify([{ id: "j1", when: Date.parse("2026-11-01T10:00:00Z"), end: Date.parse("2026-11-01T11:00:00Z"), miles: 18.4, cost: 6.25, plate: "SB61LGZ", from: "Lancaster", to: "Morecambe", fuel: "diesel" }]),
    "gt.diy": JSON.stringify([{ id: "d1", plate: "SB61LGZ", date: "2026-10-15", title: "Oil change", kind: "service" }]),
    "dipstick-history": JSON.stringify([{ ts: Date.parse("2026-10-15"), plate: "SB61LGZ", note: "Oil change", type: "text" }])
  },
  dbs: [{ name: "dipstick-uploads", version: 1, stores: [
    { name: "files", keyPath: null, autoIncrement: false, indexes: [], records: [
      { k: "j1/f0.jpg", v: { blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" }), name: "a.jpg" } }
    ] }
  ] }]
});

const bytesOf = async b => [...new Uint8Array(await b.arrayBuffer())];

await t("JSON export filename uses today's date and driv3-json format", async () => {
  const out = await X.makeJson(snap());
  assert.match(out.name, /^driv3-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const obj = JSON.parse(out.text);
  assert.equal(obj.format, "driv3-json");
  assert.equal(obj.v, 1);
  assert.equal(obj.app, "Driv3");
  assert.equal(obj.summary.cars, 2);
  assert.equal(out.check.ok, true);
  assert.equal(out.check.cars, 2);
});

await t("JSON export round-trips localStorage, blobs and summary", async () => {
  const s = snap();
  const out = await X.makeJson(s);
  const opened = X.openJson(out.text);
  assert.equal(opened.check.ok, true);
  assert.deepEqual(opened.snap.ls, s.ls);
  const blob = opened.snap.dbs[0].stores[0].records[0].v.blob;
  assert.equal(blob.type, "image/jpeg");
  assert.deepEqual(await bytesOf(blob), [0xff, 0xd8, 0xff, 1, 2, 3]);
  assert.equal(opened.summary.cars, 2);
});

await t("reject files that are not Driv3 JSON exports", () => {
  assert.equal(X.looksLikeExport('{"hello":1}'), false);
  assert.throws(() => X.openJson('{"hello":1}'), /isn't a Driv3 export/);
  assert.throws(() => X.jsonToSnap({ format: "driv3-json", v: 2, ls: {}, dbs: [] }), /newer Driv3/);
});

await t("CSV lists cars, journeys, work and history", () => {
  const csv = X.makeCsv(snap().ls);
  assert.match(csv.name, /^driv3-costs-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(csv.text, /^type,date,plate,title,miles,cost_gbp,notes\n/);
  assert.match(csv.text, /car,.*SB61LGZ,Volvo XC60 Volvo/);
  assert.match(csv.text, /journey,.*SB61LGZ,Lancaster → Morecambe,18.4,6.25/);
  assert.match(csv.text, /work,2026-10-15,SB61LGZ,Oil change/);
  assert.match(csv.text, /history,.*SB61LGZ,Oil change/);
});

await t("restore check fails if a car key is dropped", async () => {
  const out = await X.makeJson(snap());
  const obj = JSON.parse(out.text);
  const back = X.jsonToSnap(obj);
  delete back.ls["gt.driveLog"];
  assert.equal(X.checkRestore(obj, back).ok, false);
});

console.log(`\n${pass} export tests passed`);
