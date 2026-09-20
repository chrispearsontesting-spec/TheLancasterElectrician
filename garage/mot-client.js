window.loadMotHistory = function (plate) {
  var box = document.getElementById("motBox");
  var majorsBox = document.getElementById("motMajors");
  var majorCount = document.getElementById("motMajorCount");
  var histCount = document.getElementById("motHistCount");
  if (!box) return;
  var raw = String(plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  var proxy = window.MOT_PROXY || "";
  function setMajors(html, n) {
    if (majorsBox) majorsBox.innerHTML = html || "<p class='muted'>No major or dangerous failures on record.</p>";
    if (majorCount) majorCount.textContent = n ? String(n) : "0";
  }
  if (!proxy) {
    box.innerHTML = "<p class='muted'>MOT proxy not pointed yet. Official history link still works below.</p>";
    setMajors("", 0);
    return;
  }
  if (!raw) {
    box.innerHTML = "<p class='muted'>Enter a plate to load MOT history.</p>";
    setMajors("", 0);
    return;
  }
  box.innerHTML = "<p class='muted'>Loading official MOT history…</p>";
  setMajors("<p class='muted'>Loading…</p>", 0);
  fetch(proxy.replace(/\/$/, "") + "/?plate=" + encodeURIComponent(raw))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        box.innerHTML = "<p class='muted'>MOT lookup failed. Use the official link below.</p>";
        setMajors("", 0);
        return;
      }
      var d = res.j || {};
      var tests = d.motTests || d.MotTests || [];
      var name = [d.make, d.model].filter(Boolean).join(" ");
      if (histCount) histCount.textContent = String(tests.length || 0);
      if (!tests.length) {
        box.innerHTML = (name ? "<p><b>" + name + "</b></p>" : "") + "<p class='muted'>No tests returned.</p>";
        setMajors("", 0);
        return;
      }
      function defectsOf(t) {
        return t.defects || t.rfrAndComments || t.rfrAndComment || [];
      }
      function textOf(x) {
        return x.text || x.comment || x.dangerous || x.failureText || "";
      }
      function typeOf(x) {
        return String(x.type || x.dangerous || x.prstype || "").toUpperCase();
      }
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
        if (/FAIL/i.test(result) && !defectsOf(t).length) {
          majors.push({ date: date, result: result, text: "Test recorded as a fail.", type: "FAIL" });
        }
      });
      if (majors.length) {
        setMajors(
          "<p class='muted'>These were recorded as fail / major / dangerous items. Later tests usually show they were put right.</p>" +
          majors.map(function (m) {
            return "<div class='fault'><button type='button' class='faultBtn'><span class='tag high'>" + (m.type || "FAIL") + "</span>" + m.date + "</button><div class='more'><p>" + m.text + "</p><p class='muted'>Result that day: " + m.result + "</p></div></div>";
          }).join(""),
          majors.length
        );
      } else {
        setMajors("<p class='muted'>No major or dangerous failures listed on the tests we received.</p>", 0);
      }
      var html = name ? "<p><b>" + name + "</b></p>" : "";
      html += tests.slice(0, 12).map(function (t) {
        var result = t.testResult || t.testresult || "";
        var date = (t.completedDate || t.completeddate || "").slice(0, 10);
        var miles = t.odometerValue || t.odometerReading || "";
        var unit = t.odometerUnit || "mi";
        var list = defectsOf(t);
        var adv = list.map(function (x) {
          var label = typeOf(x) || "NOTE";
          return "<li><b>" + label + ".</b> " + textOf(x) + "</li>";
        }).join("");
        var cls = /FAIL/i.test(result) ? "high" : "low";
        return "<div class='fault'><button type='button' class='faultBtn'><span class='tag " + cls + "'>" + result + "</span>" + date + (miles ? (" \u00b7 " + miles + " " + unit) : "") + "</button><div class='more'>" + (adv ? ("<ul>" + adv + "</ul>") : "<p>No defects listed for this test.</p>") + "</div></div>";
      }).join("");
      box.innerHTML = html;
    })
    .catch(function () {
      box.innerHTML = "<p class='muted'>Could not reach the MOT proxy.</p>";
      setMajors("", 0);
    });
};
