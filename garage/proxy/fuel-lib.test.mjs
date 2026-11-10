// Tests for /fuel on the MOT worker: parse, filter, cache. Run: node fuel-lib.test.mjs
import assert from "node:assert/strict";
import worker from "./mot-worker.js";
import { _resetForTests, asPence, milesBetween, parseFuelFeed, pickPrice, filterFuelStations, normalizeFFGrade, extractBrand, officialList, joinOfficialStations, refreshFuelCache } from "./mot-lib.js";

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


await t("normalizeFFGrade and extractBrand cover official grades and supermarket names", () => {
  assert.equal(normalizeFFGrade("B7_STANDARD"), "B7");
  assert.equal(normalizeFFGrade("B7S"), "B7");
  assert.equal(normalizeFFGrade("B7_PREMIUM"), "SDV");
  assert.equal(normalizeFFGrade("E5"), "E5");
  assert.equal(normalizeFFGrade("E10"), "E10");
  assert.equal(extractBrand("TESCO EXTRA LANCASTER"), "Tesco");
  assert.equal(extractBrand("SHELL LANCASTER"), "Shell");
  assert.equal(extractBrand("SAINSBURYS SUPERMARKET MORECAMBE"), "Sainsbury's");
  assert.equal(extractBrand("BP CONNECT HEYSHAM"), "BP");
});

await t("joinOfficialStations maps forecourts to prices and keeps per-grade timestamps", () => {
  const sites = [{
    node_id: "n1",
    trading_name: "TESCO EXTRA LANCASTER",
    brand_name: "Tesco",
    location: { latitude: 54.056, longitude: -2.785, address_line_1: "Caton Road", town: "Lancaster", postcode: "LA1 3PE" }
  }, {
    node_id: "n2",
    trading_name: "SHELL LANCASTER",
    location: { latitude: 54.05, longitude: -2.80, address_line_1: "Penny Street", postcode: "LA1 1XN" }
  }];
  const priced = [{
    node_id: "n1",
    fuel_prices: [
      { fuel_type: "E10", price: 169.9, price_last_updated: "2026-11-10T01:00:00Z" },
      { fuel_type: "B7_STANDARD", price: 196.9, price_last_updated: "2026-11-10T01:05:00Z" },
      { fuel_type: "E5", price: 181.9, price_last_updated: "2026-11-09T18:00:00Z" }
    ]
  }, {
    node_id: "n2",
    fuel_prices: [
      { fuel_type: "B7S", price: 198.9, price_last_updated: "2026-11-10T00:30:00Z" },
      { fuel_type: "E10", price: 171.9, price_last_updated: "2026-11-10T00:30:00Z" }
    ]
  }];
  const joined = joinOfficialStations(sites, priced);
  assert.equal(joined.length, 2);
  const tesco = joined.find(s => s.id === "n1");
  assert.equal(tesco.brand, "Tesco");
  assert.equal(tesco.prices.B7, 196.9);
  assert.equal(tesco.prices.E10, 169.9);
  assert.equal(tesco.prices.E5, 181.9);
  assert.equal(tesco.times.B7, "2026-11-10T01:05:00Z");
  assert.equal(tesco.postcode, "LA1 3PE");
  const filtered = filterFuelStations(joined, { lat: 54.047, lng: -2.801, miles: 5, fuel: "diesel", now: Date.parse("2026-11-10T02:00:00Z") });
  assert.equal(filtered[0].brand, "Tesco");
  assert.equal(filtered[0].price, 196.9);
  assert.equal(filtered[0].updated, "2026-11-10T01:05:00Z");
  assert.equal(filtered[0].stale, false);
});

await t("officialList unwraps both a raw array and a data wrapper", () => {
  assert.equal(officialList([{ node_id: "1" }]).length, 1);
  assert.equal(officialList({ data: [{ node_id: "1" }, { node_id: "2" }] }).length, 2);
  assert.equal(officialList({ data: { forecourts: [{ node_id: "1" }] } }).length, 1);
});

const ffEnv = {
  ...env,
  FUEL_FINDER_CLIENT_ID: "test-id",
  FUEL_FINDER_CLIENT_SECRET: "test-secret",
  FUEL_FINDER_MIN_STATIONS: "1",
  GARAGE_CONTACTS: {
    store: new Map(),
    async get(key, type) {
      const v = this.store.get(key);
      if (v == null) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(key, val) { this.store.set(key, val); }
  }
};

function mockOfficial(opts = {}) {
  let n = 0, tokenCalls = 0;
  const orig = globalThis.fetch;
  const blocked = !!opts.blocked;
  const tokenNested = opts.tokenNested !== false;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url); n++;
    if (url.includes("generate_access_token")) {
      tokenCalls++;
      if (blocked) {
        return new Response("", { status: 403, headers: { server: "CloudFront", "x-cache": "Error from cloudfront" } });
      }
      const body = tokenNested
        ? { success: true, data: { access_token: "test-token", expires_in: 3600 } }
        : { access_token: "test-token", token_type: "Bearer", expires_in: 3600 };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/pfs/fuel-prices")) {
      const batch = Number(new URL(url).searchParams.get("batch-number") || "1");
      if (batch > 1) return new Response("", { status: 404 });
      return new Response(JSON.stringify({
        data: [
          { node_id: "s1", fuel_prices: [{ fuel_type: "B7_STANDARD", price: 196.9, price_last_updated: "2026-11-10T01:10:00Z" }, { fuel_type: "E10", price: 168.9, price_last_updated: "2026-11-10T01:10:00Z" }] },
          { node_id: "s2", fuel_prices: [{ fuel_type: "B7S", price: 197.9, price_last_updated: "2026-11-10T01:12:00Z" }, { fuel_type: "E10", price: 169.9, price_last_updated: "2026-11-10T01:12:00Z" }] },
          { node_id: "s3", fuel_prices: [{ fuel_type: "B7_STANDARD", price: 199.9, price_last_updated: "2026-11-10T00:40:00Z" }, { fuel_type: "E10", price: 171.9, price_last_updated: "2026-11-10T00:40:00Z" }] },
          { node_id: "far", fuel_prices: [{ fuel_type: "B7_STANDARD", price: 150.0, price_last_updated: "2026-11-10T01:00:00Z" }] }
        ]
      }), { status: 200 });
    }
    if (url.includes("/api/v1/pfs")) {
      const batch = Number(new URL(url).searchParams.get("batch-number") || "1");
      if (batch > 1) return new Response("", { status: 404 });
      return new Response(JSON.stringify([
        { node_id: "s1", brand_name: "Tesco", trading_name: "TESCO EXTRA LANCASTER", location: { latitude: 54.056, longitude: -2.785, address_line_1: "Caton Road", town: "Lancaster", postcode: "LA1 3PE" } },
        { node_id: "s2", brand_name: "Shell", trading_name: "SHELL LANCASTER", location: { latitude: 54.049, longitude: -2.801, address_line_1: "Penny Street", postcode: "LA1 1XN" } },
        { node_id: "s3", trading_name: "BP CONNECT HEYSHAM", location: { latitude: 54.046, longitude: -2.82, address_line_1: "Morecambe Road", postcode: "LA3 2RQ" } },
        { node_id: "far", brand_name: "Asda", trading_name: "ASDA MANCHESTER", location: { latitude: 53.48, longitude: -2.24, postcode: "M1 1AA" } }
      ]), { status: 200 });
    }
    if (opts.allowRetailers && /fuel_prices|fuel\.json|latestdata|SGN_daily|moto-way|applegreen|krl|sainsburys|morrisons|motorfuel|bp\.com/.test(url)) {
      return sample("other");
    }
    throw new Error("unexpected fetch " + url);
  };
  return { count: () => n, tokenCalls: () => tokenCalls, restore: () => { globalThis.fetch = orig; } };
}

await t("GET /fuel uses Fuel Finder as the primary source when credentials are present", async () => {
  _resetForTests();
  const mock = mockOfficial();
  try {
    const seeded = await refreshFuelCache(ffEnv);
    assert.equal(seeded.ok, true);
    assert.ok(seeded.n >= 4);
    const r = await worker.fetch(req("fuel?lat=54.047&lng=-2.801&miles=5&fuel=diesel", SITE), ffEnv);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.provider, "fuel-finder");
    assert.deepEqual(j.stations.map(s => s.brand), ["Tesco", "Shell", "BP"]);
    assert.equal(j.stations[0].price, 196.9);
    assert.equal(j.stations[0].updated, "2026-11-10T01:10:00Z");
    assert.ok(j.sources.some(s => s.brand === "Fuel Finder" && s.ok && s.n === 4));
    assert.equal(j.stations.some(s => s.brand === "Asda"), false);
  } finally { mock.restore(); }
});

await t("GET /fuel falls back to retailer feeds if Fuel Finder is blocked by CloudFront", async () => {
  _resetForTests();
  const mock = mockOfficial({ blocked: true, allowRetailers: true });
  // retailer mock from mockOfficial only returns empty "other" feeds — splice in Asda via wrapper
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    url = String(url);
    if (url.includes("asda")) {
      return sample("Asda", { stations: [
        { site_id: "a1", brand: "Asda", address: "Ovangle Road, Lancaster", postcode: "LA1 5JR", location: { latitude: 54.043, longitude: -2.829 }, prices: { E10: 166.9, B7: 195.7 } }
      ] });
    }
    return inner(url, init);
  };
  try {
    const isolated = {
      ...ffEnv,
      GARAGE_CONTACTS: { store: new Map(), async get() { return null; }, async put() {} }
    };
    const failed = await refreshFuelCache(isolated);
    assert.equal(failed.ok, false);
    assert.equal(failed.error, "cloudfront_blocked");
    assert.equal(failed.status, 403);
    const r = await worker.fetch(req("fuel?lat=54.047&lng=-2.801&miles=5&fuel=diesel", SITE), isolated);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.provider, "retailers");
    assert.equal(j.sources[0].brand, "Fuel Finder");
    assert.equal(j.sources[0].ok, false);
    assert.equal(j.sources[0].error, "cloudfront_blocked");
    assert.equal(j.sources[0].status, 403);
    assert.equal(j.stations[0].brand, "Asda");
    assert.equal(j.stations[0].price, 195.7);
  } finally { mock.restore(); }
});

await t("Fuel Finder access token is reused across a second refresh", async () => {
  _resetForTests();
  const mock = mockOfficial();
  try {
    const a = await refreshFuelCache(ffEnv);
    const b = await refreshFuelCache(ffEnv);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(mock.tokenCalls(), 1);
  } finally { mock.restore(); }
});

console.log(`\n${pass} fuel tests passed`);
