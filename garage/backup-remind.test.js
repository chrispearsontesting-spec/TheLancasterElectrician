const assert = require("assert"); const R = require("./backup-remind.js"); const D = R.DAY, t0 = 1.7e12;
assert.equal(R.due({ hasCar: false, firstUse: t0 }), null);
let d = R.due({ hasCar: true, firstUse: t0 }); assert.equal(d.kind, "first"); assert.equal(d.at, t0 + 7 * D);
assert.equal(R.due({ hasCar: true, firstUse: t0, snooze: t0 + 14 * D }).at, t0 + 14 * D);
assert.equal(R.due({ hasCar: true, firstUse: t0, lastBackup: t0 + D, size: 120000, baseSize: 100000 }), null); // backed up, little change
d = R.due({ hasCar: true, firstUse: t0, lastBackup: t0 + D, size: 200000, baseSize: 100000 }); assert.equal(d.kind, "stale"); assert.equal(d.at, t0 + 61 * D);
assert.equal(R.changedALot(1000 + 49999, 1000), false); assert.equal(R.changedALot(1000 + 50000, 1000), true);
assert.equal(R.sizeOf(k => ({ "gt.garage": "abcd", "gt.lastBackup": "123", "other": "zzz" })[k], ["gt.garage", "gt.lastBackup", "other"]), 4);
console.log("backup-remind tests ok");
