window.motLabel = function (raw) {
  var t = String(raw || "").toUpperCase();
  if (/DANGEROUS/.test(t) || t === "TRUE") return "Dangerous";
  if (/MAJOR/.test(t)) return "Major fail";
  if (/ADVISORY/.test(t)) return "Advisory";
  if (/MINOR/.test(t)) return "Minor";
  if (/PRS/.test(t)) return "Fixed on the day";
  if (/FAIL/.test(t)) return "Fail";
  if (/PASS/.test(t)) return "Pass";
  return raw || "Note";
};
window.fetchMotVehicle = function (plate) {
  var raw = String(plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  var proxy = window.MOT_PROXY || "";
  var empty = { ok: false, plate: raw, make: "", model: "", name: "", fuel: "", year: null, engine: null, tests: [] };
  if (!proxy || !raw) return Promise.resolve(empty);
  return fetch(proxy.replace(/\/$/, "") + "/?plate=" + encodeURIComponent(raw))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) return empty;
      var d = res.j || {};
      var tests = d.motTests || d.MotTests || [];
      var make = d.make || d.Make || "";
      var model = d.model || d.Model || "";
      var fuel = d.fuelType || d.FuelType || "";
      var engine = d.engineSize || d.EngineSize || d.engineCapacity || null;
      var year = d.yearOfManufacture || d.firstUsedDate || null;
      if (year && String(year).length >= 4) year = parseInt(String(year).slice(0, 4), 10);
      else year = null;
      return {
        ok: true,
        plate: raw,
        make: make,
        model: model,
        name: [make, model].filter(Boolean).join(" "),
        fuel: fuel,
        year: year,
        engine: engine ? parseInt(engine, 10) : null,
        tests: tests,
        raw: d
      };
    })
    .catch(function () { return empty; });
};
window.loadMotHistory = function (plate) {
  var box = document.getElementById("motBox");
  var majorsBox = document.getElementById("motMajors");
  var majorCount = document.getElementById("motMajorCount");
  var histCount = document.getElementById("motHistCount");
  if (!box) return Promise.resolve(null);
  var raw = String(plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function jobs(tests){ if(window.paintMotJobs) window.paintMotJobs(tests||[]); }
  function setMajors(html, n) {
    if (majorsBox) majorsBox.innerHTML = html || "<p class='muted'>No major or dangerous failures on record.</p>";
    if (majorCount) majorCount.textContent = n ? String(n) : "0";
  }
  if (!window.MOT_PROXY) {
    box.innerHTML = "<p class='muted'>MOT proxy not pointed yet. Official history link still works below.</p>";
    setMajors("", 0); jobs([]);
    return Promise.resolve(null);
  }
  if (!raw) {
    box.innerHTML = "<p class='muted'>Enter a plate to load MOT history.</p>";
    setMajors("", 0); jobs([]);
    return Promise.resolve(null);
  }
  box.innerHTML = "<p class='muted'>Loading official MOT history\u2026</p>";
  setMajors("<p class='muted'>Loading\u2026</p>", 0);
  return window.fetchMotVehicle(raw).then(function (info) {
    if (!info || !info.ok) {
      box.innerHTML = "<p class='muted'>MOT lookup failed. Use the official link below.</p>";
      setMajors("", 0); jobs([]);
      return info;
    }
    var tests = info.tests || [];
    var name = info.name || "";
    if (histCount) histCount.textContent = String(tests.length || 0);
    jobs(tests);
    if (!tests.length) {
      box.innerHTML = (name ? "<p><b>" + name + "</b></p>" : "") + "<p class='muted'>No tests returned.</p>";
      setMajors("", 0);
      return info;
    }
    function defectsOf(t) { return t.defects || t.rfrAndComments || t.rfrAndComment || []; }
    function textOf(x) { return x.text || x.comment || x.dangerous || x.failureText || ""; }
    function typeOf(x) { return String(x.type || x.dangerous || x.prstype || "").toUpperCase(); }
    function isMajor(x) {
      var t = typeOf(x);
      var s = textOf(x).toLowerCase();
      if (/DANGEROUS|MAJOR|FAIL|FAILURE/.test(t)) return true;
      if (x.dangerous === true || x.dangerous === "true") return true;
      if (/\bdangerous\b|\bmajor\b/.test(s) && /ADVISORY|MINOR/.test(t) === false) return t.indexOf("ADVISORY") < 0;
      return t === "FAIL" || t === "PRS";
    }
    var majors = [];
    tests.forEach(function (t) {
      var date = (t.completedDate || t.completeddate || "").slice(0, 10);
      var result = t.testResult || t.testresult || "";
      defectsOf(t).forEach(function (x) {
        if (!isMajor(x)) return;
        majors.push({ date: date, result: result, text: textOf(x), type: typeOf(x) || "FAIL" });
      });
      if (/FAIL/i.test(result) && !defectsOf(t).length) majors.push({ date: date, result: result, text: "Test recorded as a fail.", type: "FAIL" });
    });
    if (majors.length) {
      setMajors("<p class='muted'>These were fail, major or dangerous items. A later pass usually means they were put right.</p>" + majors.map(function (m) {
        return "<div class='fault'><button type='button' class='faultBtn'><span class='tag high'>" + window.motLabel(m.type) + "</span>" + m.date + "</button><div class='more'><p>" + m.text + "</p><p class='muted'>Result that day: " + window.motLabel(m.result) + "</p></div></div>";
      }).join(""), majors.length);
    } else setMajors("<p class='muted'>No major or dangerous failures listed.</p>", 0);
    var html = name ? "<p><b>" + name + "</b></p>" : "";
    html += tests.slice(0, 12).map(function (t) {
      var result = t.testResult || t.testresult || "";
      var date = (t.completedDate || t.completeddate || "").slice(0, 10);
      var miles = t.odometerValue || t.odometerReading || "";
      var unit = t.odometerUnit || "mi";
      var list = defectsOf(t);
      var adv = list.map(function (x) { return "<li><b>" + window.motLabel(typeOf(x)) + ".</b> " + textOf(x) + "</li>"; }).join("");
      var cls = /FAIL/i.test(result) ? "high" : "low";
      return "<div class='fault'><button type='button' class='faultBtn'><span class='tag " + cls + "'>" + window.motLabel(result) + "</span>" + date + (miles ? (" \u00b7 " + miles + " " + unit) : "") + "</button><div class='more'>" + (adv ? ("<ul>" + adv + "</ul>") : "<p>No defects listed for this test.</p>") + "</div></div>";
    }).join("");
    box.innerHTML = html;
    return info;
  });
};
