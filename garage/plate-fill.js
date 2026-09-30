window.fillFromPlate = function (plate, done) {
  var raw = String(plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw || !window.fetchMotVehicle) {
    if (done) done(null);
    return;
  }
  window.fetchMotVehicle(raw).then(function (info) {
    if (!info || !info.ok || !info.name) {
      if (done) done(null);
      return;
    }
    var exp = "";
    var tests = info.tests || [];
    var i, t, e;
    for (i = 0; i < tests.length; i++) {
      t = tests[i];
      e = t.expiryDate || t.motTestExpiryDate || t.expirydate;
      if (e) {
        exp = String(e).slice(0, 10);
        break;
      }
    }
    var fuel = String(info.fuel || "").toLowerCase();
    if (/diesel/.test(fuel)) fuel = "diesel";
    else if (/electric|electricity|bev/.test(fuel)) fuel = "electric";
    else if (/hybrid|phev/.test(fuel)) fuel = "hybrid";
    else if (/petrol|gasoline/.test(fuel)) fuel = "petrol";
    else fuel = "";
    if (done) done({ name: info.name, fuel: fuel, year: info.year, mot: exp, plate: raw });
  });
};
window.applyPlateFields = function (info, ids) {
  if (!info) return;
  ids = ids || {};
  var nameEl = ids.name && document.getElementById(ids.name);
  var fuelEl = ids.fuel && document.getElementById(ids.fuel);
  var motEl = ids.mot && document.getElementById(ids.mot);
  var statusEl = ids.status && document.getElementById(ids.status);
  if (nameEl && info.name) nameEl.value = info.name;
  if (fuelEl && info.fuel) {
    var opt = fuelEl.querySelector('option[value="' + info.fuel + '"]');
    if (opt) fuelEl.value = info.fuel;
  }
  if (motEl && info.mot && !motEl.value) motEl.value = info.mot;
  if (statusEl) statusEl.textContent = info.name;
};
window.bindPlateField = function (ids) {
  var el = document.getElementById(ids.plate);
  if (!el) return;
  var t;
  function run() {
    window.fillFromPlate(el.value, function (info) {
      window.applyPlateFields(info, ids);
    });
  }
  el.addEventListener("blur", run);
  el.addEventListener("change", run);
  el.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });
  el.addEventListener("input", function () {
    clearTimeout(t);
    t = setTimeout(run, 600);
  });
};
