/* Driv3 "Share for sale" builder + owner link management (share.html).
   Builds a JSON snapshot from on-phone data, uploads it with the chosen files to the dipstick-uploads Worker (POST /share),
   and keeps {id, revoke key, expiry} in localStorage "gt.shares" so links can be copied, shared or revoked later.
   Never includes: insurance, owner name/address, garage contact details, calendar, journeys, dashcam. */
(function(){
  var API = window.UPLOADS_API, U = window.DipUploads;
  var LS_KEY = "gt.shares", MAX_FILES = 40, MAX_BYTES = 25 * 1024 * 1024;
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function plateOf(c){ return String(c && c.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function ukDate(ms){ return new Date(ms).toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"}); }
  function isoUk(s){ var p = String(s || "").slice(0,10).split("-"); return p.length < 3 ? String(s||"") : p[2] + "/" + p[1] + "/" + p[0]; }
  function mb(n){ return (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + " MB"; }
  function plateHtml(p){ return p ? '<span class="plate"><span class="uk">UK</span><span class="reg">' + esc(p) + '</span></span>' : ""; }

  // ---- Share links stored on this phone ----
  function loadShares(){ try { var a = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch(e){ return []; } }
  function saveShares(a){ localStorage.setItem(LS_KEY, JSON.stringify(a)); }
  function reportUrl(id){ var u = new URL("report.html", location.href); u.search = ""; u.hash = ""; u.searchParams.set("r", id); return u.toString(); }
  function waUrl(s){ return "https://wa.me/?text=" + encodeURIComponent((s.car ? s.car + " " : "") + "history report (Driv3): " + reportUrl(s.id)); }
  async function copy(t, btn){
    try { await navigator.clipboard.writeText(t); } catch(e){ var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    if (btn){ var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function(){ btn.textContent = o; }, 1400); }
  }
  function renderLinks(){
    var now = Date.now(), list = loadShares().filter(function(s){ return s.expires > now; });
    saveShares(list); // forget expired ones
    var box = $("links");
    if (!list.length){ box.innerHTML = '<p class="note">No active links yet.</p>'; return; }
    box.innerHTML = "";
    list.sort(function(a,b){ return b.created - a.created; }).forEach(function(s){
      var d = document.createElement("div"); d.className = "shareItem"; d.setAttribute("data-id", s.id);
      d.innerHTML = '<div class="carRow">' + plateHtml(s.plate) + '<b>' + esc(s.car || "Car") + '</b></div>' +
        '<div class="meta">Made ' + esc(ukDate(s.created)) + ' · expires ' + esc(ukDate(s.expires)) + (s.files ? ' · ' + s.files + ' file' + (s.files > 1 ? "s" : "") : "") + '</div>' +
        '<div class="row3"><button class="btn" type="button" data-a="copy">Copy</button><a class="btn" data-a="wa" target="_blank" rel="noopener">WhatsApp</a><button class="btn danger" type="button" data-a="revoke">Revoke</button></div>';
      d.querySelector('[data-a=wa]').href = waUrl(s);
      d.querySelector('[data-a=copy]').onclick = function(){ copy(reportUrl(s.id), this); };
      d.querySelector('[data-a=revoke]').onclick = function(){ revoke(s, this); };
      box.appendChild(d);
    });
  }
  async function revoke(s, btn){
    if (!confirm("Revoke this link? Anyone who has it will see \"withdrawn\" and the photos and files are deleted now. This can't be undone.")) return;
    btn.disabled = true; btn.textContent = "Revoking…";
    try {
      var r = await fetch(API + "/share/" + encodeURIComponent(s.id), {method:"DELETE", headers:{"X-Revoke-Key": s.key}});
      if (!r.ok && r.status !== 404 && r.status !== 410){ var m = ""; try { m = (await r.json()).error; } catch(e){} throw new Error(m || ("HTTP " + r.status)); }
      saveShares(loadShares().filter(function(x){ return x.id !== s.id; }));
      renderLinks();
    } catch(e){ btn.disabled = false; btn.textContent = "Revoke"; alert("Couldn't revoke: " + e.message); }
  }
  window.Driv3Shares = {load: loadShares, reportUrl: reportUrl};

  // ---- Builder ----
  var garage = U && U.garage(), car = garage && garage.cars[garage.i];
  var history = []; try { history = JSON.parse(localStorage.getItem("dipstick-history") || "[]") || []; } catch(e){}
  var jobs = [], mot = null;
  function carName(){ return (car && (car.nick || car.name)) || "Car"; }
  function header(){
    if (!car){ $("carRow").innerHTML = '<b>No car yet.</b> <span class="note">Add one on the home screen first.</span>'; $("builder").classList.add("hide"); return; }
    $("carRow").innerHTML = plateHtml(plateOf(car)) + "<b>" + esc(carName()) + "</b>";
  }
  function reminders(){
    var out = [];
    if (!car) return out;
    if (car.oil) out.push({label:"Full service", date:car.oil, detail:"Next due"});
    if (car.beltDate){ var d = new Date(car.beltDate + "T12:00:00"); d.setFullYear(d.getFullYear() + (+(car.beltYears || 5)));
      out.push({label:"Timing belt", date:d.toISOString().slice(0,10), detail:"Fitted " + isoUk(car.beltDate) + ", change every " + (car.beltYears || 5) + " years" + (car.beltMiles ? " or " + Number(car.beltMiles).toLocaleString("en-GB") + " miles" : "")}); }
    if (car.tyreDate) out.push({label:"Tyres", date:car.tyreDate, detail:"Fitted"});
    if (car.mot) out.push({label:"MOT", date:car.mot, detail:"Expires"});
    return out;
  }
  function isImg(t){ return /^image\//.test(t || ""); }
  function fileRowHtml(id, checked, thumb, type, title, warn){
    return '<label class="tick"><input type="checkbox" data-f="' + esc(id) + '"' + (checked ? " checked" : "") + '/><div class="fileRow">' +
      (isImg(type) && thumb ? '<img alt="" src="' + esc(thumb) + '"/>' : '<span class="pdf">PDF</span>') +
      '<div><div class="t" style="font-size:14px">' + esc(title) + '</div>' + (warn ? '<div class="warn">May show your name and address</div>' : '') + '</div></div></label>';
  }
  var thumbs = []; // object URLs
  function blobUrl(b){ var u = URL.createObjectURL(b); thumbs.push(u); return u; }
  function renderHistoryFiles(){
    var html = "";
    history.forEach(function(it, i){
      if (!it || !it.data) return;
      var pdf = !isImg(it.type);
      html += fileRowHtml("h" + i, !pdf, it.data, it.type, (it.date ? it.date + " · " : "") + (it.note || "Work"), pdf);
    });
    $("histFiles").innerHTML = html;
  }
  async function renderJobs(){
    var box = $("jobs");
    if (!U || !car || !car.upId){ $("jobsCard").classList.add("hide"); return; }
    try { jobs = await U.jobsFor(car.upId); } catch(e){ jobs = []; }
    if (!jobs.length){ $("jobsCard").classList.add("hide"); return; }
    box.innerHTML = "";
    for (var j = 0; j < jobs.length; j++){
      var job = jobs[j], wrap = document.createElement("div");
      var head = ukDate(job.created) + (job.garage ? " · " + job.garage : "") + (job.mileage ? " · " + Number(job.mileage).toLocaleString("en-GB") + " mi" : "");
      var h = '<label class="tick"><input type="checkbox" data-job="' + j + '" checked/><div><div class="t">' + esc(head) + '</div><div class="d">' + esc(job.note ? job.note.slice(0,140) + (job.note.length > 140 ? "…" : "") : "Work note") + '</div></div></label><div class="sub">';
      for (var k = 0; k < (job.files || []).length; k++){
        var f = job.files[k], thumb = "";
        if (isImg(f.type)){ try { var rec = await U.getFile(job.id, f.key); if (rec && rec.blob) thumb = blobUrl(rec.blob); } catch(e){} }
        h += fileRowHtml("j" + j + ":" + k, isImg(f.type), thumb, f.type, U.fileTitle(f), !isImg(f.type));
      }
      wrap.innerHTML = h + "</div>";
      box.appendChild(wrap);
    }
  }
  function ticked(id){ var el = document.querySelector('[data-f="' + id + '"]'); return !!(el && el.checked); }
  function on(id){ return $(id).checked; }

  function dataUrlToBlob(u){
    var m = /^data:([^;,]*)(;base64)?,(.*)$/.exec(u || ""); if (!m) return null;
    var raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return new Blob([a], {type: m[1] || "application/octet-stream"});
  }
  // Photos: re-compress to max 1600px JPEG (drops EXIF incl. GPS). PDFs as-is.
  async function prepImage(blob){
    try {
      var bmp = await createImageBitmap(blob);
      var s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      var out = await new Promise(function(res){ cv.toBlob(res, "image/jpeg", 0.82); });
      if (out && out.size) return out;
    } catch(e){}
    return blob; // e.g. HEIC the browser can't decode: send unchanged
  }

  // Collect the selection (without file bytes) for preview, and with bytes for upload.
  function selection(){
    var sel = {files: [], jobs: [], history: []};
    if (on("incService")) history.forEach(function(it, i){
      if (!it) return;
      var withFile = it.data && ticked("h" + i);
      sel.history.push({i: i, file: withFile});
      if (withFile) sel.files.push({src: "h", i: i, type: it.type, title: it.note || "Work"});
    });
    jobs.forEach(function(job, j){
      var noteOn = !!(document.querySelector('[data-job="' + j + '"]') || {}).checked;
      var fs = (job.files || []).map(function(f, k){ return ticked("j" + j + ":" + k) ? k : -1; }).filter(function(k){ return k >= 0; });
      if (!noteOn && !fs.length) return;
      sel.jobs.push({j: j, note: noteOn, files: fs});
      fs.forEach(function(k){ var f = job.files[k]; sel.files.push({src: "j", j: j, k: k, type: f.type, title: U.cleanTitle(f.title)}); }); // untitled: no caption (file names can be personal)
    });
    return sel;
  }
  function mileage(){
    var out = [];
    if (mot && mot.tests) mot.tests.forEach(function(t){ var m = parseInt(String(t.odometerValue || "").replace(/\D/g, ""), 10); if (m && (t.odometerUnit || "mi").toLowerCase().indexOf("k") !== 0) out.push({date: String(t.completedDate || "").slice(0,10), miles: m, src: "MOT"}); });
    jobs.forEach(function(job){ if (job.mileage) out.push({date: new Date(job.created).toISOString().slice(0,10), miles: job.mileage, src: job.garage || "Garage visit"}); });
    return out.sort(function(a,b){ return a.date < b.date ? 1 : -1; });
  }
  function trimTests(tests){
    return (tests || []).slice(0, 30).map(function(t){
      var d = t.defects || t.rfrAndComments || [];
      return {completedDate: t.completedDate || t.testDate || "", testResult: t.testResult || "", odometerValue: t.odometerValue || "", odometerUnit: t.odometerUnit || "",
        expiryDate: t.expiryDate || "", defects: d.slice(0, 40).map(function(x){ return {text: x.text || x.comment || "", type: x.type || "", dangerous: !!x.dangerous}; })};
    });
  }
  async function ensureMot(){
    if (mot || !car || !plateOf(car) || !window.fetchMotVehicle) return mot;
    try { var key = "gt.shareMot." + plateOf(car), c = sessionStorage.getItem(key); if (c) return (mot = JSON.parse(c)); } catch(e){}
    var r = await window.fetchMotVehicle(plateOf(car));
    if (r && r.ok){ mot = {make: r.make, model: r.model, fuel: r.fuel, year: r.year, engine: r.engine, colour: (r.raw && (r.raw.primaryColour || r.raw.colour)) || "", firstUsed: (r.raw && (r.raw.firstUsedDate || r.raw.registrationDate)) || "", tests: trimTests(r.tests)};
      try { sessionStorage.setItem("gt.shareMot." + plateOf(car), JSON.stringify(mot)); } catch(e){} }
    return mot;
  }
  function snapshot(sel, fileIndex){
    var rep = {v: 1, app: "Driv3", sharedAt: Date.now()};
    if (on("incCar")) rep.car = {name: carName(), plate: plateOf(car), make: (mot && mot.make) || car.make || "", model: (mot && mot.model) || car.model || "",
      year: (mot && mot.year) || car.year || null, fuel: (mot && mot.fuel) || car.fuel || "", engine: (mot && mot.engine) || car.engine || "", colour: (mot && mot.colour) || "", firstUsed: (mot && mot.firstUsed) || ""};
    else rep.car = {name: "", plate: on("incMot") ? plateOf(car) : ""}; // reg only kept if needed for the live MOT check
    if (on("incMot")) rep.mot = {fetched: Date.now(), tests: (mot && mot.tests) || []};
    if (on("incService")){
      rep.service = {reminders: reminders(), history: sel.history.map(function(h){ var it = history[h.i]; return {date: it.date || "", note: it.note || "Work", file: h.file ? fileIndex["h" + h.i] : null}; })};
    }
    rep.jobs = sel.jobs.map(function(sj){ var job = jobs[sj.j]; return {date: job.created, garage: job.garage || "", mileage: job.mileage || null, note: sj.note ? (job.note || "") : "",
      files: sj.files.map(function(k){ return fileIndex["j" + sj.j + ":" + k]; })}; });
    if (on("incMiles")) rep.mileage = mileage();
    var n = $("sellerNote").value.trim(); if (n) rep.note = n.slice(0, 1500);
    return rep;
  }
  async function preview(){
    $("previewBtn").disabled = true; $("previewBtn").textContent = "Building preview…";
    if (on("incMot") || on("incCar") || on("incMiles")) await ensureMot();
    var sel = selection(), photos = sel.files.filter(function(f){ return isImg(f.type); }).length, pdfs = sel.files.length - photos;
    var rep = snapshot(sel, {}), li = [];
    if (rep.car && rep.car.name) li.push("Car: " + ([rep.car.year, rep.car.make, rep.car.model].filter(Boolean).join(" ") || rep.car.name) + (rep.car.fuel ? " · " + rep.car.fuel : "") + (rep.car.engine ? " · " + rep.car.engine + "cc" : ""));
    if (rep.mot) li.push("MOT history: live from DVSA" + (rep.mot.tests.length ? " (your copy: " + rep.mot.tests.length + " tests)" : ""));
    if (rep.service) li.push("Service: " + rep.service.reminders.length + " reminders, " + rep.service.history.length + " saved work entries");
    if (rep.jobs.length) li.push("Mechanic work: " + rep.jobs.length + " job" + (rep.jobs.length > 1 ? "s" : ""));
    li.push("Files: " + photos + " photo" + (photos === 1 ? "" : "s") + ", " + pdfs + " PDF" + (pdfs === 1 ? "" : "s"));
    if (rep.mileage) li.push("Mileage log: " + rep.mileage.length + " readings");
    if (rep.note) li.push("Seller note: “" + rep.note.slice(0, 80) + (rep.note.length > 80 ? "…" : "") + "”");
    var warn = sel.files.length > MAX_FILES ? '<p class="warn">Too many files (' + sel.files.length + '). Max ' + MAX_FILES + '.</p>' : "";
    $("pv").innerHTML = '<div class="carRow">' + plateHtml(plateOf(car)) + "<b>" + esc(carName()) + '</b></div><ul>' + li.map(function(x){ return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      '<p class="note" style="margin-bottom:0">Not included: your name, address, insurance, calendar, journeys or dashcam. Link expires in 30 days.</p>' + warn;
    $("previewCard").classList.remove("hide"); $("status").textContent = ""; $("status").className = "status";
    $("create").disabled = sel.files.length > MAX_FILES;
    $("previewBtn").disabled = false; $("previewBtn").textContent = "Update preview";
    $("previewCard").scrollIntoView({behavior: "smooth", block: "start"});
  }
  async function create(){
    var st = $("status"), btn = $("create");
    btn.disabled = true; st.className = "status"; st.textContent = "Preparing photos…";
    try {
      await ensureMot();
      var sel = selection(), fd = new FormData(), idx = {}, total = 0;
      for (var i = 0; i < sel.files.length; i++){
        var f = sel.files[i], blob = null;
        if (f.src === "h") blob = dataUrlToBlob(history[f.i].data);
        else { var job = jobs[f.j], rec = await U.getFile(job.id, job.files[f.k].key); blob = rec && rec.blob; }
        if (!blob) continue;
        if (isImg(f.type) || isImg(blob.type)) blob = await prepImage(blob);
        var n = Object.keys(idx).length;
        idx[f.src === "h" ? "h" + f.i : "j" + f.j + ":" + f.k] = n;
        total += blob.size;
        fd.append("file", blob, "f" + n + (/pdf/.test(blob.type || f.type) ? ".pdf" : ".jpg"));
        fd.append("title", f.title || "");
        st.textContent = "Preparing files " + (i + 1) + "/" + sel.files.length + "…";
      }
      if (total > MAX_BYTES) throw new Error("Too big (" + mb(total) + "). Max 25 MB, untick some PDFs or photos.");
      var rep = snapshot(sel, idx);
      fd.append("report", JSON.stringify(rep));
      st.textContent = "Uploading " + mb(total) + "…";
      var r = await fetch(API + "/share", {method: "POST", body: fd});
      var j = {}; try { j = await r.json(); } catch(e){}
      if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
      var s = {id: j.id, key: j.revokeKey, created: j.created, expires: j.expires, plate: plateOf(car), car: carName(), files: j.files};
      var all = loadShares(); all.push(s); saveShares(all);
      st.className = "status good"; st.textContent = "Link created.";
      showDone(s); renderLinks();
    } catch(e){
      st.className = "status bad"; st.textContent = "Couldn't create the link: " + e.message;
    } finally { btn.disabled = false; }
  }
  function showDone(s){
    $("doneCard").classList.remove("hide");
    $("doneTitle").textContent = s.car + " · expires " + ukDate(s.expires);
    $("doneUrl").textContent = reportUrl(s.id);
    $("doneCopy").onclick = function(){ copy(reportUrl(s.id), this); };
    $("doneWa").href = waUrl(s);
    $("doneOpen").href = reportUrl(s.id);
    $("doneCard").scrollIntoView({behavior: "smooth", block: "start"});
  }

  header(); renderLinks();
  if (car){
    var rc = reminders().length, hc = history.length;
    $("serviceDesc").textContent = (rc ? rc + " reminder" + (rc > 1 ? "s" : "") + " (service, timing belt, tyres, MOT)" : "Service and timing belt reminders") + (hc ? " and " + hc + " saved work entr" + (hc > 1 ? "ies" : "y") : "");
    renderHistoryFiles(); renderJobs();
    $("incService").onchange = function(){ $("histFiles").style.display = this.checked ? "" : "none"; };
    $("previewBtn").onclick = preview;
    $("create").onclick = create;
  }
})();
