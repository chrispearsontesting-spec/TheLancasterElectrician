const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(){
  const store = {};
  const el = { style: {} };
  const sandbox = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null),
      setItem: (k,v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    window: null
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"cam-flip.js"),"utf8"), sandbox);
  return { store, el, F: sandbox.D3CamFlip };
}

test("defaults: dashcam environment 180, performance 0", () => {
  const { F } = load();
  assert.equal(F.get("dashcam","environment"), 180);
  assert.equal(F.get("performance","environment"), 0);
  assert.equal(F.get("dashcam","user"), 0);
});

test("boot applies default before anything is stored", () => {
  const { F, el, store } = load();
  F.boot("dashcam","environment", el);
  assert.equal(el.style.transform, "rotate(180deg)");
  assert.equal(store["gt.camFlip"], undefined);
});

test("toggle saves and applies, then boot restores", () => {
  const { F, el, store } = load();
  F.boot("dashcam","environment", el);
  assert.equal(F.toggle("dashcam","environment", el), 0);
  assert.equal(el.style.transform, "rotate(0deg)");
  const saved = JSON.parse(store["gt.camFlip"]);
  assert.equal(saved.dashcam.environment, 0);
  const el2 = { style: {} };
  F.boot("dashcam","environment", el2);
  assert.equal(el2.style.transform, "rotate(0deg)");
});

test("modes and facings are stored separately", () => {
  const { F, el } = load();
  F.toggle("dashcam","environment", el);
  F.toggle("performance","environment", el);
  assert.equal(F.get("dashcam","environment"), 0);
  assert.equal(F.get("performance","environment"), 180);
  assert.equal(F.get("dashcam","user"), 0);
});

test("corrupt storage falls back to the default", () => {
  const { F, el, store } = load();
  store["gt.camFlip"] = "nope";
  assert.equal(F.boot("dashcam","environment", el), 180);
  store["gt.camFlip"] = JSON.stringify({dashcam:{environment:90}});
  assert.equal(F.get("dashcam","environment"), 180);
});

test("does not write other keys", () => {
  const { F, el, store } = load();
  store["gt.driveLog"] = "keep-me";
  F.toggle("performance","environment", el);
  assert.equal(store["gt.driveLog"], "keep-me");
  assert.deepEqual(Object.keys(store).sort(), ["gt.camFlip","gt.driveLog"]);
});
