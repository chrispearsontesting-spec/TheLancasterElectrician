// Tests for /fuel on the MOT worker: parse, filter, cache. Run: node fuel-lib.test.mjs
import assert from "node:assert/strict";
import worker from "./mot-worker.js";
import { _resetForTests, asPence, milesBetween, parseFuelFeed, pickPrice, filterFuelStations } from "./mot-lib.js";

const SITE = "https://thelancasterelectrician.com";
const env = { DVSA_TOKEN_URL: "https://login.example/token", DVSA_CLIENT_ID: "id", DVSA_CLIENT_SECRET: "s", DVSA_API_KEY: "k" };
const req = (q, origin = SITE, ip = "1.1.1.1") => new Request("https://w.dev/" + q, { method: "GET", headers: { Origin: origin, "CF-Connecting-IP": ip } });

let pass = 0;
const t = async (n, f) => { await f(); pass++; console.log("ok -", n); };

await t("asPence accepts pence and converts pounds", () => {
  assert.equal(asPence(195.7), 195.7);
  assert.equal(asPence(1.959), 195.9);
  assert.equal(asPence(0), null);
  assert.equal(asPence(999), null);
  assert.equal(asPence("166.9"), 166.9);
});

await t("milesBetween Lancaster to a nearby Asda is under 3 miles", () => {
  const d = milesBetween(54.047, -2.801, 54.043, -2.829);
  assert.ok(d > 0.8 && d < 2.5, d);
});

await t("parseFuelFeed and pickPrice read the CMA schema", () => {
  const parsed = parseFuelFeed({
    last_updated: "09/11/2026 08:51:24",
    stations: [{
      site_id: "a1", brand: "Asda", address: "Ovangle Road", postcode: "LA1 5JR",
      location: { latitude: "54.043", longitude: "-2.829" },
      prices: { E10: 166.9, B7: 195.7 }
    }]
  }, "Asda");
  assert.equal(parsed.stations.length, 1);
  assert.equal(parsed.stations[0].lat, 54.043);
  assert.deepEqual(pickPrice(parsed.stations[0].prices, "diesel"), { price: 195.7, grade: "B7" });
  assert.deepEqual(pickPrice(parsed.stations[0].prices, "petrol"), { price: 166.9, grade: "E10" });
});

await t("filterFuelStations drops far stations, sorts stale last then by price", () => {
  const stations = [
    { id: "a", brand: "Asda", address: "Lancaster", postcode: "LA1 5JR", lat: 54.043, lng: -2.829, prices: { B7: 195.7 }, updated: "09/11/2026 08:51:24" },
    { id: "m", brand: "Asda", address: "Manchester", postcode: "M1 1AA", lat: 53.48, lng: -2.24, prices: { B7: 190.0 }, updated: "09/11/2026 08:51:24" },
    { id: "t", brand: "Tesco", address: "Lancaster", postcode: "LA1 3PE", lat: 54.056, lng: -2.785, prices: { B7: 182.9 }, updated: "29/04/2026 11:18:22" },
    { id: "e", brand: "Esso", address: "Lancaster", postcode: "LA1 5JB", lat: 54.055, lng: -2.818, prices: { B7: 195.9 }, updated: "09/11/2026 01:02:04" }
  ];
  const now = Date.parse("2026-11-10T12:00:00Z");
  const out = filterFuelStations(stations, { lat: 54.047, lng: -2.801, miles: 5, fuel: "diesel", now });
  assert.deepEqual(out.map(s => s.brand), ["Asda", "Esso", "Tesco"]);
  assert.equal(out[2].stale, true);
  assert.equal(out[0].stale, false);
  assert.ok(out[0].distance < 5);
});

const sample = (brand, extra = {}) => new Response(JSON.stringify({
  last_updated: extra.updated || "09/11/2026 08:51:24",
  stations: extra.stations || []
}));

function mockFeeds() {
  let n = 0;
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    url = String(url); n++;
    if (url.includes("asda")) return sample("Asda", { stations: [
      { site_id: "a1", brand: "Asda", address: "Ovangle Road, Lancaster", postcode: "LA1 5JR", location: { latitude: 54.043, longitude: -2.829 }, prices: { E10: 166.9, B7: 195.7 } },
      { site_id: "a2", brand: "Asda", address: "Manchester", postcode: "M1 1AA", location: { latitude: 53.48, longitude: -2.24 }, prices: { B7: 190.0 } }
    ] });
    if (url.includes("esso")) return sample("Esso", { stations: [
      { site_id: "e1", brand: "Esso", address: "Morecambe Road, Lancaster", postcode: "LA1 5JB", location: { latitude: 54.055, longitude: -2.818 }, prices: { B7: 195.9, E10: 167.9 } }
    ] });
    if (url.includes("tesco")) return sample("Tesco", { updated: "29/04/2026 11:18:22", stations: [
      { site_id: "t1", brand: "Tesco", address: "Caton Road, Lancaster", postcode: "LA1 3PE", location: { latitude: 54.056, longitude: -2.785 }, prices: { B7: 182.9, E10: 151.9 } }
    ] });
    if (/fuel_prices|fuel\.json|latestdata|SGN_daily|moto-way|applegreen|krl|sainsburys|morrisons|motorfuel|bp\.com/.test(url)) {
      return sample("other");
    }
    throw new Error("unexpected fetch " + url);
  };
  return { count: () => n, restore: () => { globalThis.fetch = orig; } };
}

await t("GET /fuel rejects foreign origin and missing coords", async () => {
  _resetForTests();
  const mock = mockFeeds();
  try {
    const bad = await worker.fetch(req("fuel?lat=54&lng=-2", "https://evil.example"), env);
    assert.equal(bad.status, 403);
    const miss = await worker.fetch(req("fuel?miles=5&fuel=diesel", SITE), env);
    assert.equal(miss.status, 400);
    assert.match((await miss.json()).error, /lat/);
    assert.equal(mock.count(), 0);
  } finally { mock.restore(); }
});

await t("GET /fuel merges feeds, filters Lancaster diesel and does not call DVSA", async () => {
  _resetForTests();
  const mock = mockFeeds();
  try {
    const r = await worker.fetch(req("fuel?lat=54.047&lng=-2.801&miles=5&fuel=diesel", SITE), env);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
    const j = await r.json();
    assert.equal(j.count, 3);
    assert.deepEqual(j.stations.map(s => s.brand), ["Asda", "Esso", "Tesco"]);
    assert.equal(j.stations[0].price, 195.7);
    assert.equal(j.stations[2].stale, true);
    assert.ok(j.sources.some(s => s.brand === "Asda" && s.ok && s.n === 2));
    assert.ok(!String(mock.count() && "").includes("history.mot"));
  } finally { mock.restore(); }
});

await t("GET /fuel uses the in-memory cache on a second request", async () => {
  _resetForTests();
  const mock = mockFeeds();
  try {
    const r1 = await worker.fetch(req("fuel?lat=54.047&lng=-2.801&miles=5&fuel=diesel", SITE), env);
    assert.equal(r1.status, 200);
    const first = mock.count();
    assert.ok(first >= 12, first);
    const r2 = await worker.fetch(req("fuel?lat=54.047&lng=-2.801&miles=5&fuel=petrol", SITE, "2.2.2.2"), env);
    assert.equal(r2.status, 200);
    assert.equal(mock.count(), first);
    const j = await r2.json();
    assert.equal(j.fuel, "petrol");
    assert.equal(j.stations[0].grade, "E10");
  } finally { mock.restore(); }
});

await t("unknown path still requires a plate, so /fuel is the only new route", async () => {
  _resetForTests();
  const mock = mockFeeds();
  try {
    const r = await worker.fetch(req("?lat=54.047&lng=-2.801&miles=5&fuel=diesel", SITE), env);
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /plate/);
  } finally { mock.restore(); }
});

console.log(`\n${pass} fuel tests passed`);
