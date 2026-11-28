import test from "node:test";
import assert from "node:assert/strict";
import { originAllowed } from "./mot-lib.js";

test("Trac3 live and Pages previews are allowed", () => {
  for (const o of ["https://thelancasterelectrician.com", "https://trac3.co.uk", "https://www.trac3.co.uk",
    "https://trac3.pages.dev", "https://preview-chris-pass-2026-11-1.trac3.pages.dev", "https://cbaf5ec1.trac3.pages.dev"]) {
    assert.equal(originAllowed(o, {}), true, o);
  }
});

test("look-alike origins are refused", () => {
  for (const o of ["https://eviltrac3.pages.dev", "https://trac3.pages.dev.evil.com", "http://trac3.pages.dev",
    "https://a.b.trac3.pages.dev", "https://other.pages.dev", "", "null"]) {
    assert.equal(originAllowed(o, {}), false, o);
  }
});
