/* Driv3 buyer-facing report (report.html?r=<id>). Read-only. MOT is fetched live from the DVSA via the dipstick-mot proxy;
   the owner's snapshot is only a fallback. Everything user-supplied is escaped. */
(function(){
  var API = window.UPLOADS_API, app = document.getElementById("app");
  var id = new URLSearchParams(location.search).get("r") || "";
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function d(ms){ return new Date(ms).toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"}); }
  function iso(s){ var t = Date.parse(String(s || "").slice(0,10) + "T12:00:00"); return isNaN(t) ? esc(s) : d(t); }
  function miles(n){ var x = String(n == null ? "" : n).replace(/\D/g, ""); return x ? Number(x).toLocaleString("en-GB") : ""; }
  function cap(s){ s = String(s || ""); return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""; }
  function fileUrl(n){ return API + "/share/" + encodeURIComponent(id) + "/file/" + n; }
  function state(ico, title, msg){
    document.title = title + " · Driv3";
    app.innerHTML = '<div class="state"><div class="ico">' + ico + '</div><h1>' + esc(title) + '</h1><p class="sub">' + esc(msg) + '</p>' +
      '<p class="sub">Ask the seller for a new link if you still need the car\'s history.</p><p class="sub" style="margin-top:20px">You can still check the official MOT history at <a style="color:#3dd68c" href="https://www.gov.uk/check-mot-history" rel="noopener">gov.uk/check-mot-history</a>.</p></div>';
  }
  if (!/^[A-Za-z0-9_-]{22}$/.test(id)){ state("🔗", "Link not recognised", "This report link looks incomplete. Check you copied the whole link."); return; }

  function plateHtml(p){ return p ? '<span class="plate"><span class="uk">UK</span><span class="reg">' + esc(p) + '</span></span>' : ""; }
  function defectType(x){ var t = String(x.type || "").toUpperCase(); if (x.dangerous || /DANGEROUS/.test(t)) return ["maj","Dangerous"]; if (/MAJOR|FAIL/.test(t)) return ["maj","Major"]; if (/PRS/.test(t)) return ["min","Fixed at test"]; if (/MINOR/.test(t)) return ["min","Minor"]; if (/ADVISORY/.test(t)) return ["adv","Advisory"]; return ["adv", cap(t) || "Note"]; }
  function motRows(tests){
    if (!tests.length) return '<p class="muted">No MOT tests on record (the car may be under 3 years old).</p>';
    return tests.map(function(t){
      var fail = /FAIL/i.test(t.testResult || ""), defs = t.defects || t.rfrAndComments || [];
      return '<div class="row"><div><b>' + iso(t.completedDate || t.testDate) + '</b>' + (t.odometerValue ? '<p class="muted">' + miles(t.odometerValue) + " " + esc(t.odometerUnit === "km" ? "km" : "miles") + '</p>' : "") +
        defs.map(function(x){ var ty = defectType(x); return '<p class="def"><i class="' + ty[0] + '">' + esc(ty[1]) + '</i>' + esc(x.text || x.comment || "") + '</p>'; }).join("") +
        (defs.length ? "" : '<p class="muted">No advisories or defects.</p>') +
        '</div><span class="tag ' + (fail ? "fail" : "pass") + '">' + (fail ? "Fail" : "Pass") + '</span></div>';
    }).join("");
  }
  var photos = [];
  function filesHtml(list, files){
    var imgs = "", docs = "";
    (list || []).forEach(function(n){
      var f = files[n]; if (!f) return;
      if (/^image\//.test(f.type)){ var pi = photos.push({n: n, title: f.title}) - 1;
        imgs += '<figure><button type="button" data-p="' + pi + '" aria-label="Enlarge photo"><img loading="lazy" alt="' + esc(f.title || "Work photo") + '" src="' + esc(fileUrl(n)) + '"/></button>' + (f.title ? '<figcaption>' + esc(f.title) + '</figcaption>' : "") + '</figure>'; }
      else docs += '<a class="doc" href="' + esc(fileUrl(n)) + '" target="_blank" rel="noopener"><span class="pdf">PDF</span><span>' + esc(f.title || "Document") + '</span></a>';
    });
    return (imgs ? '<div class="thumbs">' + imgs + '</div>' : "") + docs;
  }

  function render(data){
    var r = data.report || {}, car = r.car || {}, files = {};
    (data.files || []).forEach(function(f){ files[f.n] = f; });
    var title = [car.year, car.make, car.model].filter(Boolean).join(" ") || car.name || "Vehicle history";
    document.title = title + " · Driv3 report";
    var h = '<h1>' + esc(title) + '</h1><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + plateHtml(car.plate) +
      (car.name && car.name !== title ? '<span class="sub">' + esc(car.name) + '</span>' : "") + '</div>' +
      '<p class="sub" id="sharedLine">Shared via Driv3 on ' + d(data.created) + ' · link expires ' + d(data.expires) + '</p>';
    var facts = [["Make", car.make], ["Model", car.model], ["Year", car.year], ["Fuel", cap(car.fuel)], ["Engine", car.engine ? miles(car.engine) + " cc" : ""], ["Colour", cap(car.colour)]].filter(function(x){ return x[1]; });
    if (facts.length) h += '<div class="facts">' + facts.map(function(x){ return '<div class="fact"><div class="k">' + x[0] + '</div><div class="v">' + esc(x[1]) + '</div></div>'; }).join("") + '</div>';
    if (r.mot) h += '<div class="card" id="motCard"><h2>MOT history <span class="badge copy" id="motBadge">Checking DVSA…</span></h2><p class="muted" id="motSrc"></p><div id="motRows">' + motRows(r.mot.tests || []) + '</div></div>';
    if (r.service && (r.service.reminders.length || r.service.history.length)){
      h += '<div class="card" id="serviceCard"><h2>Service &amp; maintenance</h2>' +
        r.service.reminders.map(function(x){ return '<div class="row"><div><b>' + esc(x.label) + '</b><p class="muted">' + esc(x.detail || "") + '</p></div><span class="tag due">' + iso(x.date) + '</span></div>'; }).join("") +
        r.service.history.map(function(x){ return '<div class="job"><b>' + esc(x.date) + '</b><p class="txt">' + esc(x.note) + '</p>' + (x.file != null ? filesHtml([x.file], files) : "") + '</div>'; }).join("") + '</div>';
    }
    if (r.jobs && r.jobs.length){
      h += '<div class="card" id="workCard"><h2>Mechanic work</h2><p class="muted">Photos and notes sent by the garage to the owner\'s Driv3 app.</p>' +
        r.jobs.map(function(j){ return '<div class="job"><b>' + d(j.date) + '</b>' + ((j.garage || j.mileage) ? '<p class="muted">' + esc([j.garage, j.mileage ? miles(j.mileage) + " miles" : ""].filter(Boolean).join(" · ")) + '</p>' : "") +
          (j.note ? '<p class="txt">' + esc(j.note) + '</p>' : "") + filesHtml(j.files, files) + '</div>'; }).join("") + '</div>';
    }
    if (r.mileage && r.mileage.length){
      h += '<div class="card" id="milesCard"><h2>Mileage log</h2>' + r.mileage.map(function(m){ return '<div class="row"><div><b>' + miles(m.miles) + ' miles</b><p class="muted">' + esc(m.src || "") + '</p></div><span class="tag due">' + iso(m.date) + '</span></div>'; }).join("") + '</div>';
    }
    if (r.note) h += '<div class="card" id="noteCard"><h2>From the seller</h2><p class="note">' + esc(r.note) + '</p></div>';
    h += '<button class="btn noprint" type="button" id="print">Save as PDF / print</button>' +
      '<p class="foot">This report was put together by the seller in the Driv3 app. Service records, photos and notes are supplied by the seller; MOT history marked "Live from DVSA" comes straight from the government\'s MOT service. Always check the car and its paperwork in person.</p>';
    app.innerHTML = h;
    document.getElementById("print").onclick = function(){ window.print(); };
    app.addEventListener("click", function(e){
      var b = e.target.closest && e.target.closest("[data-p]"); if (!b) return;
      var p = photos[+b.getAttribute("data-p")];
      document.getElementById("lbImg").src = fileUrl(p.n); document.getElementById("lbCap").textContent = p.title || "";
      document.getElementById("lb").classList.add("open");
    });
    if (r.mot) liveMot(car.plate, r.mot);
  }
  function closeLb(){ document.getElementById("lb").classList.remove("open"); }
  document.getElementById("lbX").onclick = closeLb;
  document.getElementById("lb").onclick = function(e){ if (e.target === this) closeLb(); };
  document.addEventListener("keydown", function(e){ if (e.key === "Escape") closeLb(); });

  function liveMot(plate, snap){
    var badge = document.getElementById("motBadge"), src = document.getElementById("motSrc");
    function fallback(){
      badge.className = "badge copy"; badge.textContent = "Owner's copy";
      src.textContent = "Couldn't reach the DVSA just now, so this is the seller's saved copy from " + d(snap.fetched || Date.now()) + ". Check it free at gov.uk/check-mot-history.";
    }
    if (!plate || !window.fetchMotVehicle){ fallback(); return; }
    window.fetchMotVehicle(plate).then(function(v){
      if (!v || !v.ok){ fallback(); return; }
      badge.className = "badge live"; badge.textContent = "Live from DVSA";
      src.textContent = "Fetched just now from the DVSA MOT history service for " + plate + ".";
      document.getElementById("motRows").innerHTML = motRows(v.tests || []);
    }).catch(fallback);
  }

  fetch(API + "/share/" + encodeURIComponent(id)).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ return {status: r.status, j: j}; });
  }).then(function(x){
    if (x.status === 200 && x.j.report) return render(x.j);
    var s = x.j && x.j.state;
    if (s === "revoked") state("🔒", "This report has been withdrawn", "The seller has turned this link off, so its photos and records are no longer available.");
    else if (s === "expired") state("⏳", "This report has expired", "Driv3 report links last 30 days" + (x.j.expires ? " and this one ended on " + d(x.j.expires) : "") + ".");
    else if (x.status === 429) state("⌛", "Busy right now", "Too many requests. Please try again in a minute.");
    else state("🔗", "Report not found", "This link doesn't exist or has been removed.");
  }).catch(function(){ state("📶", "Couldn't load the report", "Check your connection and try again."); });
})();
