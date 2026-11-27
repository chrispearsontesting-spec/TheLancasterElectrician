const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
  const sandbox = { window: null, globalThis: null, console: console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const dir = __dirname;
  vm.runInContext(fs.readFileSync(path.join(dir, "mpg-uk.js"), "utf8"), sandbox, { filename: "mpg-uk.js" });
  vm.runInContext(fs.readFileSync(path.join(dir, "mpg-lookup.js"), "utf8"), sandbox, { filename: "mpg-lookup.js" });
  return sandbox;
}

function withinPct(got, expected, pct) {
  assert.ok(got != null, "expected an official figure, got " + got + " (target " + expected + ")");
  const err = Math.abs(got - expected) / expected;
  assert.ok(err <= pct / 100, "official " + got + " is " + (err * 100).toFixed(2) + "% from published " + expected + " (limit " + pct + "%)");
}

const env = load();
const L = env.MpgLookup;
const table = env.MPG_UK || env.window.MPG_UK;

// Sourced official combined figures (UK). VCA = Vehicle Certification Agency
// car fuel data already shipped in mpg-uk.js. Manufacturer figures cited where used.
const CARS = [
  {
    id: "YT19CLF Honda CR-V 1.5 petrol 2019",
    info: { make: "HONDA", model: "CR-V", name: "HONDA CR-V", fuel: "Petrol", year: 2019, engine: 1498, firstUsedDate: "2019-03-18" },
    // Auto Trader / VCA CR-V 2019 1.5 VTEC Turbo EX 5 door WLTP combined 34.9.
    // Honda UK 19YM EX AWD manual is 35.3. Median of VCA 2019 1.5 rows is 35.3.
    official: 34.9, unit: "mpg", scheme: "WLTP", source: "Honda UK / VCA / Auto Trader WLTP combined (EX 34.9; SE/SR 35.3)",
    not: 38.2,
    before: 38.2
  },
  {
    id: "WN69MBX Mitsubishi Outlander Design CVT 2.0 petrol 2019",
    info: { make: "MITSUBISHI", model: "OUTLANDER DESIGN CVT", name: "MITSUBISHI OUTLANDER DESIGN CVT", fuel: "Petrol", year: 2019, engine: 1998, firstUsedDate: "2019-09-30" },
    official: 32.5, unit: "mpg", scheme: "WLTP", source: "Mitsubishi UK WLTP combined 32.5 (Design 2.0 CVT)",
    before: 32.5
  },
  {
    id: "Mitsubishi Outlander PHEV 2019",
    info: { make: "MITSUBISHI", model: "OUTLANDER PHEV", name: "MITSUBISHI OUTLANDER PHEV", fuel: "Hybrid Electric", year: 2019, engine: 1998, firstUsedDate: "2019-03-01" },
    official: 38.6, unit: "mpg", scheme: "WLTP", phev: true, source: "VCA OUTLANDER PHEV WLTP combined 38.6 (weighted)",
    not: 148
  },
  {
    id: "Toyota Yaris 1.0 petrol Sep 2018 (WLTP)",
    info: { make: "TOYOTA", model: "YARIS", name: "TOYOTA YARIS", fuel: "Petrol", year: 2018, engine: 998, firstUsedDate: "2018-09-15" },
    official: 45, unit: "mpg", scheme: "WLTP", source: "VCA YARIS MY2018 1.0L Manual WLTP combined 45.0",
    not: 65.7
  },
  {
    id: "Toyota Prius 1.8 hybrid 2016 (NEDC)",
    info: { make: "TOYOTA", model: "PRIUS", name: "TOYOTA PRIUS", fuel: "Hybrid Electric", year: 2016, engine: 1798, firstUsedDate: "2016-04-01" },
    // VCA Prius MY2016 NEDC combined is 85.6 (17") or 94.1 (15"). Median of the official set is 94.1.
    official: 94.1, unit: "mpg", scheme: "NEDC", source: "VCA Prius, MY2016 1.8 NEDC combined 85.6 / 94.1 (wheel size)"
  },
  {
    id: "Hyundai i10 1.0 2024",
    info: { make: "HYUNDAI", model: "I10", name: "HYUNDAI I10", fuel: "Petrol", year: 2024, engine: 998, firstUsedDate: "2024-03-01" },
    official: 53.3, unit: "mpg", scheme: "WLTP", source: "VCA i10 MY24 1.0 WLTP combined median 53.3 (51.4–55.4)"
  },
  {
    id: "Nissan Leaf 40kWh 2018",
    info: { make: "NISSAN", model: "LEAF", name: "NISSAN LEAF", fuel: "Electric", year: 2018, engine: null, firstUsedDate: "2018-09-01" },
    official: 3, unit: "mi/kWh", scheme: "WLTP", source: "VCA Leaf 40KW 2018 WLTP 3.0 mi/kWh"
  },
  {
    id: "Kia Niro 1.6 self-charging hybrid 2020",
    info: { make: "KIA", model: "NIRO 2", name: "KIA NIRO 2", fuel: "Hybrid Electric", year: 2020, engine: 1580, firstUsedDate: "2020-03-01" },
    official: 58.9, unit: "mpg", scheme: "WLTP", source: "VCA Niro 1.6 GDi self-charging WLTP combined (typical 58.9; 53.3–58.9)",
    not: 201.8
  },
  {
    id: "Vauxhall Corsa 1.4 petrol 2016",
    info: { make: "VAUXHALL", model: "CORSA", name: "VAUXHALL CORSA", fuel: "Petrol", year: 2016, engine: 1398, firstUsedDate: "2016-03-01" },
    official: 54.3, unit: "mpg", scheme: "NEDC", source: "VCA Corsa Model Year 2016 1.4i NEDC combined median 54.3"
  },
  {
    id: "Toyota RAV4 2.5 hybrid 2017",
    info: { make: "TOYOTA", model: "RAV4", name: "TOYOTA RAV4", fuel: "Hybrid Electric", year: 2017, engine: 2494, firstUsedDate: "2017-06-01" },
    official: 56.4, unit: "mpg", scheme: "NEDC", source: "VCA RAV4 MY2017 Hybrid 2.5 NEDC combined 55.4 / 56.4 / 57.6"
  },
  {
    id: "Ford Fiesta 1.0 EcoBoost 2019",
    info: { make: "FORD", model: "FIESTA", name: "FORD FIESTA", fuel: "Petrol", year: 2019, engine: 998, firstUsedDate: "2019-03-15" },
    // VCA "All New Fiesta, Model Year Post 2018¾" plus later Post 2019½ 1.0 EcoBoost WLTP.
    official: 46.3, unit: "mpg", scheme: "WLTP", source: "VCA All New Fiesta 1.0 EcoBoost WLTP combined (Post 2018¾ / 2019½, typ. 46.3)",
  },
  {
    id: "Volkswagen Golf 1.5 TSI 2021",
    info: { make: "VOLKSWAGEN", model: "GOLF MATCH", name: "VOLKSWAGEN GOLF MATCH", fuel: "Petrol", year: 2021, engine: 1498, firstUsedDate: "2021-03-01" },
    official: 48.7, unit: "mpg", scheme: "WLTP", source: "VCA Golf 1.5 TSI petrol (not eTSI) WLTP combined 47.9–49.6, median 48.7"
  }
];

test("VCA table loaded", () => {
  assert.ok(table && table.length > 1000, "mpg-uk.js should expose MPG_UK");
});

CARS.forEach((car) => {
  test(car.id, () => {
    const got = L.lookUp(car.info, table);
    assert.equal(got.unit, car.unit);
    if (car.scheme) assert.equal(got.scheme, car.scheme);
    if (car.phev) assert.equal(got.phev, true);
    if (car.not != null) assert.notEqual(got.official, car.not);
    if (car.loose) {
      // Fiesta 1.0 WLTP official figures vary a little by year cut; stay within 6% if the cluster is wider.
      withinPct(got.official, car.official, 6);
    } else if (car.id.indexOf("Prius") >= 0) {
      // Official NEDC is 85.6 or 94.1 by wheel size. Accept either (or the median).
      const ok = [85.6, 94.1].some((n) => Math.abs(got.official - n) / n <= 0.03);
      assert.ok(ok, "Prius official " + got.official + " should be within 3% of 85.6 or 94.1");
    } else {
      withinPct(got.official, car.official, 3);
    }
    if (!car.phev && car.unit === "mpg") {
      assert.ok(got.realWorld > 0, "real-world estimate should be set");
      assert.notEqual(got.realWorld, got.official, "real-world should be labelled separately from official");
    }
    if (car.phev) {
      assert.ok(got.officialLabel && /weighted/i.test(got.officialLabel), "PHEV official should be labelled weighted");
      assert.notEqual(got.costMpg, got.official, "PHEV running cost must not use official combined");
    }
  });
});

test("old sureMpg CR-V path is the bug: year-qualified WLTP rows were skipped", () => {
  const hay = "honda cr-v";
  const want = "petrol";
  const hits = [];
  for (let i = 0; i < table.length; i++) {
    const row = table[i], make = String(row[0] || "").toLowerCase(), model = String(row[1] || "").toLowerCase();
    if (model.length < 3 || hay.indexOf(model) < 0) continue;
    if (make && hay.indexOf(make) < 0) continue;
    const rf = String(row[3] || "").toLowerCase();
    if (want && rf.indexOf(want.slice(0, 4)) < 0) continue;
    if (row[6]) hits.push(+row[6]);
  }
  hits.sort((a, b) => a - b);
  const mid = hits[Math.floor(hits.length / 2)];
  assert.equal(Math.round(mid * 10) / 10, 38.2);
});

test("CO2 fallback: WLTP petrol 196 g/km is about 32.8 mpg (Outlander)", () => {
  const got = L.officialFromCo2(196, "petrol", "WLTP");
  withinPct(got.official, 32.5, 3);
  assert.equal(got.scheme, "WLTP");
});

test("CO2 fallback: WLTP petrol 181 g/km is about 35.3–35.6 mpg (CR-V EX)", () => {
  const got = L.officialFromCo2(181, "petrol", "WLTP");
  withinPct(got.official, 35.3, 3);
});

test("real-world factors: WLTP 34.9 → ~33, NEDC 54.3 → ~45", () => {
  assert.equal(L.realWorldMpg(34.9, "WLTP"), 33);
  assert.equal(L.realWorldMpg(32.5, "WLTP"), 31);
  assert.equal(L.realWorldMpg(54.3, "NEDC"), 45);
});

test("PHEV is not confused with petrol Outlander", () => {
  const petrol = L.lookUp({ make: "MITSUBISHI", model: "OUTLANDER DESIGN CVT", name: "MITSUBISHI OUTLANDER DESIGN CVT", fuel: "Petrol", year: 2019, engine: 1998, firstUsedDate: "2019-09-30" }, table);
  const phev = L.lookUp({ make: "MITSUBISHI", model: "OUTLANDER PHEV", name: "MITSUBISHI OUTLANDER PHEV", fuel: "Hybrid Electric", year: 2019, engine: 1998, firstUsedDate: "2019-03-01" }, table);
  assert.equal(petrol.phev, false);
  assert.equal(petrol.official, 32.5);
  assert.equal(phev.phev, true);
  withinPct(phev.official, 38.6, 3);
});
