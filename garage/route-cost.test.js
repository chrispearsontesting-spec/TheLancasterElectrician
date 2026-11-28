const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
function load(files, store) {
  const st = store || {};
  const sb = { localStorage: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } } };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), sb, { filename: f }));
  return { sb, st };
}
const { sb } = load(["route-cost.js"]);
const RC = sb.RouteCost;
const step = (miles, mph, ref) => ({ distance: miles * 1609.34, duration: miles / mph * 3600, ref });

test("road class from refs", () => {
  assert.equal(RC.roadClass({ ref: "M6" }), "motorway");
  assert.equal(RC.roadClass({ ref: "A6" }), "a");
  assert.equal(RC.roadClass({ ref: "A601(M)" }), "motorway");
  assert.equal(RC.roadClass({ name: "Church Lane" }), "local");
});

test("speed curve: stop-start and 70+ mph cost more than 50 mph", () => {
  assert.ok(RC.speedFactor(15) > RC.speedFactor(50));
  assert.ok(RC.speedFactor(75) > RC.speedFactor(55));
});

test("cheaper route only suggested if it saves 5% or 20p", () => {
  const main = RC.compactSteps({ legs: [{ steps: [step(20, 70, "M6"), step(4, 30, "A6")] }] });
  const close = { steps: RC.compactSteps({ legs: [{ steps: [step(20.2, 70, "M6"), step(4, 30, "A6")] }] }), miles: 24.2, mainMiles: 24 };
  assert.equal(RC.cheaper(main, [close], 12, 4, { f: {} }), null);
  const short = { steps: RC.compactSteps({ legs: [{ steps: [step(15, 50, "B6478")] }] }), miles: 15, mainMiles: 24 };
  const best = RC.cheaper(main, [short], 12, 4, { f: {} });
  assert.ok(best && best.save >= 0.2, "shorter steady road should save");
});

test("rush hour costs more than evening; chosen hour equals the page cost", () => {
  const main = RC.compactSteps({ legs: [{ steps: [step(5, 25, "A6"), step(15, 65, "M6"), step(3, 20, "")] }] });
  const day = RC.dayCosts(main, 5, 8, { f: {} });
  const at8 = day.find(d => d.h === 8), at20 = day.find(d => d.h === 20);
  assert.ok(Math.abs(at8.cost - 5) < 1e-9);
  assert.ok(at8.cost > at20.cost);
  assert.ok(at8.extraMins > at20.extraMins);
});

test("learning from journeys: slow 08:00 trips raise the 08:00 penalty", () => {
  const log = [];
  const base = new Date("2026-11-02T08:00:00").getTime();
  for (let i = 0; i < 8; i++) log.push({ when: base + i * 864e5, end: base + i * 864e5 + 60 * 60000, miles: 20 });          // 20 mph at 08:00
  for (let i = 0; i < 8; i++) log.push({ when: base + i * 864e5 + 6 * 36e5, end: base + i * 864e5 + 6 * 36e5 + 30 * 60000, miles: 20 }); // 40 mph at 14:00
  const L = RC.learnHours(log);
  assert.equal(L.n, 16);
  assert.ok(L.f[8].ratio < 1 && L.f[14].ratio > 1);
  const main = RC.compactSteps({ legs: [{ steps: [step(10, 40, "A6")] }] });
  assert.ok(RC.model(main, 8, L).secs > RC.model(main, 8, { f: {} }).secs);
});

test("alternatives: reject U-turns, big detours and copies", () => {
  const main = { distance: 40000, duration: 2400 };
  assert.equal(RC.usableAlt(main, { distance: 60000, duration: 2500, legs: [] }), false);
  assert.equal(RC.usableAlt(main, { distance: 40100, duration: 2410, legs: [] }), false);
  assert.equal(RC.usableAlt(main, { distance: 36000, duration: 2600, legs: [{ steps: [{ maneuver: { modifier: "uturn" } }] }] }), false);
  assert.equal(RC.usableAlt(main, { distance: 36000, duration: 2600, legs: [{ steps: [{ maneuver: { modifier: "left" } }] }] }), true);
});

test("fuel types: costs, PHEV split, charging mix, cheapest flag", () => {
  const { sb: s2, st } = load(["mpg-uk.js", "mpg-lookup.js", "fuel-compare.js"]);
  const FC = s2.FuelCompare, P = { petrol: 167, diesel: 195.4, electric: 26.32 };
  const set = FC.settings();
  assert.equal(set.petrol, 38); assert.equal(set.charge, "offpeak"); assert.equal(set.homePct, 80);
  // 50 mi petrol at 38 mpg, 167p: 50/38*4.54609*1.67
  const rows = FC.rows(50, P, set, null, [], true);
  assert.ok(Math.abs(rows.find(r => r.id === "petrol").cost - 50 / 38 * 4.54609 * 1.67) < 1e-9);
  // EV rate: 80% x 9.9 + 20% x 82 = 24.32p
  assert.ok(Math.abs(FC.evRate(set, P) - 24.32) < 1e-9);
  assert.equal(rows.find(r => r.cheapest).id, "ev");
  // PHEV: 30 mi battery, 20 mi petrol; charge at destination doubles battery on a return trip
  assert.equal(JSON.stringify(FC.phevSplit(50, set, true)), JSON.stringify({ eMiles: 30, pMiles: 20 }));
  assert.equal(JSON.stringify(FC.phevSplit(50, Object.assign({}, set, { chargeAtDest: true }), true)), JSON.stringify({ eMiles: 50, pMiles: 0 }));
  // Public only
  assert.equal(FC.evRate(Object.assign({}, set, { charge: "public" }), P), 82);
  // Edits persist in gt.compareTypes.v1 only
  FC.save({ petrol: 41 });
  assert.equal(FC.settings().petrol, 41);
  assert.deepEqual(Object.keys(st).sort(), ["gt.compareTypes.v1"]);
});

test("My car: fill-ups beat official; official beats typed; CR-V official is real-world adjusted", () => {
  const { sb: s2 } = load(["mpg-uk.js", "mpg-lookup.js", "fuel-compare.js"]);
  const FC = s2.FuelCompare;
  const crv = { make: "HONDA", model: "CR-V", fuel: "Petrol", year: 2019, engine: 1498, mpg: 39, plate: "YT19CLF" };
  const off = FC.myCar(crv, []);
  assert.equal(off.how, "official"); assert.equal(off.mpg, 33); assert.match(off.label, /official 35\.3 mpg \(WLTP\)/);
  FC.addFillup({ litres: 48, odo: 61500, plate: "YT19CLF" });
  FC.addFillup({ litres: 46, odo: 61840, plate: "YT19CLF" });
  FC.addFillup({ litres: 44.2, odo: 62170, plate: "YT19CLF" });
  const me = FC.myCar(crv, FC.fillups());
  assert.equal(me.how, "learned");
  assert.equal(me.mpg, Math.round(670 / (90.2 / 4.54609) * 10) / 10);
  assert.match(me.label, /Based on 3 fill-ups/);
  // ppl filled from total and litres
  const r = FC.addFillup({ litres: 40, total: 68, plate: "X" });
  assert.equal(r.ppl, 170);
  assert.equal(FC.myCar({ fuel: "Petrol", mpg: 44 }, []).how, "typed");
});
