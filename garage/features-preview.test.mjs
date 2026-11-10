// Playwright preview of cheapest fuel nearby and free full export at 390x844.
// Run: node --experimental-import-meta-resolve features-preview.test.mjs
// Playwright is loaded from /tmp/pw-install if it is not in this folder.
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const garage = path.dirname(fileURLToPath(import.meta.url));
const shots = "/workspace/driv3/research/features-2026-11-10";
fs.mkdirSync(shots, { recursive: true });

async function loadPlaywright() {
  try { return await import("playwright"); } catch {}
  return await import(pathToFileURL("/tmp/pw-install/node_modules/playwright/index.mjs").href);
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".ico")) return "image/x-icon";
  if (file.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      let rel = decodeURIComponent(u.pathname);
      if (rel === "/") rel = "/home.html";
      const file = path.normalize(path.join(garage, rel.replace(/^\/+/, "")));
      if (!file.startsWith(garage)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": contentType(file) });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

const demoGarage = {
  i: 0,
  cars: [{ plate: "SB61LGZ", name: "Volvo XC60", nick: "Volvo", fuel: "diesel", mot: "2027-03-12", tax: "2027-01-31" }]
};
const demoLog = [{
  id: "j1",
  when: Date.parse("2026-11-01T10:00:00Z"),
  end: Date.parse("2026-11-01T11:00:00Z"),
  miles: 18.4,
  cost: 6.25,
  plate: "SB61LGZ",
  from: "Lancaster",
  to: "Morecambe",
  fuel: "diesel"
}];
const demoDiy = [{ id: "d1", plate: "SB61LGZ", date: "2026-10-15", title: "Oil change", kind: "service", desc: "", files: [] }];
const demoHist = [{ ts: Date.parse("2026-10-15"), plate: "SB61LGZ", note: "Oil change", type: "text" }];

const mockFuel = {
  updated: "2026-11-10T08:00:00.000Z",
  fuel: "diesel",
  miles: 5,
  lat: 54.047,
  lng: -2.801,
  count: 4,
  stations: [
    { id: "1", brand: "Asda", address: "Ovangle Road, Lancaster", postcode: "LA1 5JR", lat: 54.043, lng: -2.829, distance: 1.2, price: 195.7, unit: "p/L", grade: "B7", updated: "09/11/2026 08:51:24", stale: false },
    { id: "2", brand: "Esso", address: "Morecambe Road, Lancaster", postcode: "LA1 5JB", lat: 54.055, lng: -2.818, distance: 1.5, price: 195.9, unit: "p/L", grade: "B7", updated: "09/11/2026 01:02:04", stale: false },
    { id: "3", brand: "SGN", address: "Owen Road, Lancaster", postcode: "LA1 2AW", lat: 54.058, lng: -2.802, distance: 0.8, price: 199.9, unit: "p/L", grade: "B7", updated: "07/11/2026 10:06:02", stale: false },
    { id: "4", brand: "Tesco", address: "Caton Road, Lancaster", postcode: "LA1 3PE", lat: 54.056, lng: -2.785, distance: 1.1, price: 182.9, unit: "p/L", grade: "B7", updated: "29/04/2026 11:18:22", stale: true }
  ],
  sources: [{ brand: "Asda", ok: true, n: 790 }]
};

function seed(page) {
  return page.addInitScript(({ garage, log, diy, hist }) => {
    localStorage.setItem("gt.garage", JSON.stringify(garage));
    localStorage.setItem("gt.driveLog", JSON.stringify(log));
    localStorage.setItem("gt.diy", JSON.stringify(diy));
    localStorage.setItem("dipstick-history", JSON.stringify(hist));
    localStorage.setItem("gt.fuelPref", JSON.stringify({ fuel: "diesel", miles: 5 }));
  }, { garage: demoGarage, log: demoLog, diy: demoDiy, hist: demoHist });
}

async function mockApis(page) {
  await page.route("https://api.postcodes.io/postcodes/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: 200, result: { postcode: "LA1 1AA", latitude: 54.047, longitude: -2.801 } })
    });
  });
  await page.route("https://dipstick-mot.chris-pearson-testing.workers.dev/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/fuel")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockFuel) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not mocked" }) });
  });
}

const { chromium } = await loadPlaywright();
const { server, port } = await startServer();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  acceptDownloads: true,
  geolocation: { latitude: 54.047, longitude: -2.801 },
  permissions: ["geolocation"]
});
const page = await context.newPage();
await seed(page);
await mockApis(page);
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log("ok -", name);
  } catch (e) {
    failed++;
    console.error("FAIL -", name, e);
    throw e;
  }
}

await step("Record journey shows a cheapest-fuel strip for the car's diesel", async () => {
  await page.goto(base + "/drive.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#cheapFuel .cf-kicker");
  const kicker = await page.textContent("#cheapFuel .cf-kicker");
  assert.match(kicker, /diesel/i);
  const meta = await page.textContent("#cfMeta");
  assert.match(meta, /diesel/i);
  await page.screenshot({ path: path.join(shots, "01-journey-fuel-strip.png"), fullPage: false });
});

await step("postcode search fills the strip, lists other stations, and opens Maps to the cheapest", async () => {
  await page.fill("#cfPc", "LA1 1AA");
  await page.click("#cfPcBtn");
  await page.waitForFunction(() => /195\.7/.test(document.querySelector("#cfPrice")?.textContent || ""));
  const price = await page.textContent("#cfPrice");
  assert.match(price, /195\.7/);
  const meta = await page.textContent("#cfMeta");
  assert.match(meta, /Asda, Ovangle Road \(1\.2 mi\)/);
  const place = await page.getAttribute("#cfMeta a.cf-place", "href");
  assert.match(place, /google\.com\/maps\/search/);
  assert.match(place, /Asda/);
  assert.equal(await page.isDisabled("#cfMapBtn"), false);
  await page.click("#cfMoreSum");
  const brands = await page.$$eval("#cfList .cf-row b", els => els.map(e => e.textContent));
  assert.deepEqual(brands, ["Esso, Morecambe Road (1.5 mi)", "SGN, Owen Road (0.8 mi)", "Tesco, Caton Road (1.1 mi)"]);
  const href = await page.getAttribute("#cfList .cf-dir", "href");
  assert.match(href, /google\.com\/maps\/dir/);
  assert.match(href, /travelmode=driving/);
  await page.screenshot({ path: path.join(shots, "02-journey-fuel-results.png"), fullPage: false });

  const popupPromise = page.waitForEvent("popup");
  await page.click("#cfGo");
  const popup = await popupPromise;
  assert.match(popup.url(), /google\.com\/maps\/dir/);
  assert.match(popup.url(), /54\.043/);
  assert.match(popup.url(), /travelmode=driving/);
  await popup.close();
});

await step("export builds a JSON file, shows the restore check, then restores into a cleared phone", async () => {
  await page.goto(base + "/security.html", { waitUntil: "domcontentloaded" });
  await page.click("#mkEx");
  await page.waitForSelector("#exReady:not(.hide)");
  const sum = await page.textContent("#exSum");
  assert.match(sum, /Export ready/);
  assert.match(sum, /1 car/);
  assert.match(sum, /This file can be restored/);
  await page.locator("#exCard").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "03-export-ready.png"), fullPage: false });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#dlEx")
  ]);
  assert.match(download.suggestedFilename(), /^driv3-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const tmp = path.join(shots, download.suggestedFilename());
  await download.saveAs(tmp);
  const exported = JSON.parse(fs.readFileSync(tmp, "utf8"));
  assert.equal(exported.format, "driv3-json");
  assert.equal(exported.summary.cars, 1);
  assert.ok(exported.ls["gt.garage"].includes("SB61LGZ"));
  assert.ok(exported.ls["gt.driveLog"].includes("Morecambe"));

  await page.evaluate(() => { localStorage.clear(); });
  const afterClear = await page.evaluate(() => localStorage.getItem("gt.garage"));
  assert.equal(afterClear, null);

  await page.setInputFiles("#rsFile", tmp);
  await page.click("#openBk");
  await page.waitForSelector("#rsReady:not(.hide)");
  const rs = await page.textContent("#rsSum");
  assert.match(rs, /1 car/);
  assert.match(rs, /can be restored/i);
  await page.locator("#rsCard").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "04-export-restore-check.png"), fullPage: false });

  await page.click("#doRs");
  await page.waitForFunction(() => /Restored/.test(document.getElementById("rsStatus")?.textContent || ""));
  const restored = await page.evaluate(() => ({
    garage: JSON.parse(localStorage.getItem("gt.garage") || "null"),
    log: JSON.parse(localStorage.getItem("gt.driveLog") || "[]"),
    diy: JSON.parse(localStorage.getItem("gt.diy") || "[]"),
    hist: JSON.parse(localStorage.getItem("dipstick-history") || "[]")
  }));
  assert.equal(restored.garage.cars[0].plate, "SB61LGZ");
  assert.equal(restored.garage.cars[0].fuel, "diesel");
  assert.equal(restored.log[0].cost, 6.25);
  assert.equal(restored.log[0].miles, 18.4);
  assert.equal(restored.diy[0].title, "Oil change");
  assert.equal(restored.hist[0].note, "Oil change");
  await page.screenshot({ path: path.join(shots, "05-export-restored.png"), fullPage: false });
});

await step("CSV download includes the demo journey", async () => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#mkCsv")
  ]);
  assert.match(download.suggestedFilename(), /^driv3-costs-\d{4}-\d{2}-\d{2}\.csv$/);
  const tmp = path.join(shots, download.suggestedFilename());
  await download.saveAs(tmp);
  const csv = fs.readFileSync(tmp, "utf8");
  assert.match(csv, /SB61LGZ,Volvo XC60 Volvo/);
  assert.match(csv, /Lancaster → Morecambe,18.4,6.25/);
});


await step("every Record journey action still works after the tidy", async () => {
  await page.goto(base + "/drive.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#jBtn");
  await page.waitForSelector("#cheapFuel .cf-kicker");
  const tops = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    };
    return {
      journey: pick("#jBtn"),
      fuel: pick("#cheapFuel"),
      auto: pick("#autoOn"),
      dash: pick("#dashBtn"),
      back: pick("a.backBtn")
    };
  });
  assert.ok(tops.journey < tops.fuel, "Start journey should be above fuel");
  assert.ok(tops.fuel < tops.auto, "fuel should be above auto journeys");
  assert.ok(tops.auto < tops.dash, "auto journeys should be above dashcam");
  assert.ok(tops.dash < tops.back, "dashcam should be above Back");
  assert.equal(await page.getAttribute("#costFold", "open"), null);
  assert.equal(await page.getAttribute("#autoSetup", "open"), null);
  assert.equal(await page.isVisible("#mpg"), false);
  assert.equal(await page.isVisible("#dev"), false);

  await page.click("#costFold > summary");
  assert.equal(await page.isVisible("#mpg"), true);
  assert.equal(await page.isVisible("#fuelLine"), true);
  assert.equal(await page.isVisible("#useOwn"), true);
  await page.fill("#mpg", "42");
  await page.check("#useOwn");
  assert.equal(await page.isVisible("#ppl"), true);
  await page.fill("#ppl", "185.9");

  await page.click("#jBtn");
  await page.waitForFunction(() => document.getElementById("jBtn")?.textContent === "Stop journey");
  assert.equal(await page.isVisible("#live"), true);
  await page.click("#jBtn");
  await page.waitForFunction(() => document.getElementById("jBtn")?.textContent === "Start journey");

  await page.locator("#autoCard .tg").click();
  await page.waitForSelector("#webNote:not(.hide)");
  assert.match(await page.textContent("#webNote"), /Available on your phone/);
  assert.equal(await page.isChecked("#autoOn"), false);

  await page.click("#autoSetup > summary");
  assert.equal(await page.isVisible("#dev"), true);
  assert.equal(await page.locator("#perms").count(), 1);

  assert.match(await page.getAttribute("#dashBtn", "href"), /dashcam\.html/);
  assert.match(await page.getAttribute("a.backBtn", "href"), /home\.html#drive/);
  assert.equal(await page.locator("#cfGo").count(), 1);
  assert.equal(await page.locator("#cfMapBtn").count(), 1);
  assert.equal(await page.locator("#cfLoc").count(), 1);
  assert.equal(await page.locator("#cfPcBtn").count(), 1);

  await page.fill("#cfPc", "LA1 1AA");
  await page.click("#cfPcBtn");
  await page.waitForFunction(() => /195\.7/.test(document.querySelector("#cfPrice")?.textContent || ""));
  await page.click("#cfMapBtn");
  await page.waitForSelector("#cfSheet:not([hidden])");
  await page.waitForFunction(() => document.querySelector("#cfSheet")?.dataset.ready === "1", { timeout: 45000 });
  assert.ok(Number(await page.getAttribute("#cfSheet", "data-pins")) >= 1);
  await page.click("#cfSheetClose");
  await page.locator("#cfSheet").waitFor({ state: "hidden" });
});

await step("no console errors on the Record journey page", async () => {
  const noise = (s) => /favicon|ERR_BLOCKED_BY_CLIENT|net::ERR_ABORTED/i.test(s);
  assert.deepEqual(pageErrors.filter((s) => !noise(s)), []);
  assert.deepEqual(consoleErrors.filter((s) => !noise(s)), []);
});

await browser.close();
server.close();
if (failed) process.exit(1);
console.log("\npreview tests passed; screenshots in " + shots);
