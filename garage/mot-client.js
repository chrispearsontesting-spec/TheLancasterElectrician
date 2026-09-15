window.loadMotHistory = function (plate) {
  var box = document.getElementById("motBox");
  if (!box) return;
  var raw = String(plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  var proxy = window.MOT_PROXY || "";
  if (!proxy) {
    box.innerHTML = "<p class='muted'>MOT proxy not pointed yet. Official history link still works below.</p>";
    return;
  }
  if (!raw) {
    box.innerHTML = "<p class='muted'>Enter a plate to load MOT history.</p>";
    return;
  }
  box.innerHTML = "<p class='muted'>Loading official MOT history…</p>";
  fetch(proxy.replace(/\/$/, "") + "/?plate=" + encodeURIComponent(raw))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        box.innerHTML = "<p class='muted'>MOT lookup failed. Use the official link below.</p>";
        return;
      }
      var d = res.j || {};
      var tests = d.motTests || d.MotTests || [];
      var name = [d.make, d.model].filter(Boolean).join(" ");
      var html = "";
      if (name) html += "<p><b>" + name + "</b></p>";
      if (!tests.length) {
        html += "<p class='muted'>No tests returned.</p>";
        box.innerHTML = html;
        return;
      }
      html += tests.slice(0, 8).map(function (t) {
        var result = t.testResult || t.testresult || "";
        var date = (t.completedDate || t.completeddate || "").slice(0, 10);
        var miles = t.odometerValue || t.odometerReading || "";
        var unit = t.odometerUnit || "mi";
        var adv = (t.defects || t.rfrAndComments || []).slice(0, 6).map(function (x) {
          return "<li>" + (x.text || x.comment || x.dangerous || JSON.stringify(x)) + "</li>";
        }).join("");
        return "<div class='fault'><button type='button' class='faultBtn'>" + date + " · " + result + (miles ? (" · " + miles + " " + unit) : "") + "</button><div class='more'>" + (adv ? ("<ul>" + adv + "</ul>") : "<p>No advisories listed.</p>") + "</div></div>";
      }).join("");
      box.innerHTML = html;
    })
    .catch(function () {
      box.innerHTML = "<p class='muted'>Could not reach the MOT proxy.</p>";
    });
};
