/* Route costs extras (2026-11-28): cheaper route, time of day, compare car types, fill-ups.
   Needs route-app.js, route-map.js, compare.js (loaded first), route-cost.js, fuel-compare.js, mpg-lookup.js. */
(function () {
  "use strict";
  var RC = window.RouteCost, FC = window.FuelCompare;
  if (!RC || !FC) return;
  var RP = { main: null, alts: [], hour: null, altOn: false, lastBest: null };
  window.RoutePlus = RP;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function gbp(n) { return "\u00a3" + (+n || 0).toFixed(2); }
  function pence(n) { n = Math.abs(+n || 0); return n < 1 ? Math.round(n * 100) + "p" : gbp(n); }
  function hh(h) { return (h < 10 ? "0" : "") + h + ":00"; }
  function nowHour() { var d = new Date(), h = d.getHours() + (d.getMinutes() >= 30 ? 1 : 0); return Math.max(5, Math.min(22, h)); }
  RP.hour = nowHour();
  function rd(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function myPlate() { var g = typeof garageCar === "function" ? garageCar() : null; return g && (g.plate || g.vrn) ? String(g.plate || g.vrn).toUpperCase().replace(/\s/g, "") : ""; }
  function learned() {
    var p = myPlate();
    var log = rd("gt.driveLog", []).filter(function (t) { return t && (!p || !t.plate || String(t.plate).toUpperCase().replace(/\s/g, "") === p); });
    return RC.learnHours(log);
  }

  // ---- 1. Routes with alternatives (OSRM, free, no key) ----
  window.route = async function (a, b) {
    var url = "https://router.project-osrm.org/route/v1/driving/" + a.lon + "," + a.lat + ";" + b.lon + "," + b.lat + "?overview=full&geometries=geojson&steps=true&alternatives=true";
    var res = await fetch(url);
    if (!res.ok) throw new Error("Route failed");
    var data = await res.json();
    if (data.code !== "Ok" || !data.routes || !data.routes.length) throw new Error("No driving route");
    var r = data.routes[0], merged = [];
    r.legs.forEach(function (leg) { (leg.steps || []).forEach(function (st) { var name = st.ref || st.name; if (!name) return; if (merged.length && merged[merged.length - 1].n === name) merged[merged.length - 1].m += st.distance; else merged.push({ n: name, m: st.distance }); }); });
    var miles = r.distance / 1609.34;
    RP.main = { steps: RC.compactSteps(r), miles: miles, secs: r.duration, geo: r.geometry };
    var altRoutes = data.routes.slice(1).filter(function (x) { return RC.usableAlt(r, x); });
    if (!altRoutes.length) {
      // OSRM often finds no alternative on short trips; try routes via points either side (free, same router).
      var vias = RC.viaPoints(a, b);
      var got = await Promise.all(vias.map(function (v) {
        return fetch("https://router.project-osrm.org/route/v1/driving/" + a.lon + "," + a.lat + ";" + v.lon.toFixed(5) + "," + v.lat.toFixed(5) + ";" + b.lon + "," + b.lat + "?overview=full&geometries=geojson&steps=true")
          .then(function (x) { return x.ok ? x.json() : null; }).then(function (j) { return j && j.code === "Ok" && j.routes && j.routes[0]; }).catch(function () { return null; });
      }));
      got.forEach(function (x) { if (RC.usableAlt(r, x) && !altRoutes.some(function (y) { return Math.abs(y.distance - x.distance) < 300; })) altRoutes.push(x); });
    }
    RP.alts = altRoutes.map(function (x) { return { steps: RC.compactSteps(x), miles: x.distance / 1609.34, mainMiles: miles, secs: x.duration, geo: x.geometry }; });
    RP.altOn = false;
    return { miles: miles, secs: r.duration, roads: merged.filter(function (x) { return x.m >= 1500; }).sort(function (p, q) { return q.m - p.m; }).slice(0, 4).map(function (x) { return x.n + " " + (x.m / 1609.34).toFixed(1) + " mi"; }), geo: r.geometry };
  };

  // Map: show the other route in grey under yours; tap the suggestion to highlight it.
  function paintMapAlt() {
    var m = window.map, best = RP.lastBest;
    if (!m || !m.getStyle) return;
    function go() {
      try {
        if (m.getLayer("rpAlt")) m.removeLayer("rpAlt");
        if (m.getSource("rpAlt")) m.removeSource("rpAlt");
        if (!best) { if (m.getLayer("route")) m.setPaintProperty("route", "line-color", "#1a73e8"); return; }
        m.addSource("rpAlt", { type: "geojson", data: best.alt.geo });
        m.addLayer({ id: "rpAlt", type: "line", source: "rpAlt", layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": RP.altOn ? "#1a73e8" : "#8a8f98", "line-width": RP.altOn ? 6 : 4, "line-opacity": RP.altOn ? 1 : 0.75 } }, m.getLayer("route") && !RP.altOn ? "route" : undefined);
        if (m.getLayer("route")) m.setPaintProperty("route", "line-color", RP.altOn ? "#8a8f98" : "#1a73e8");
      } catch (e) {}
    }
    if (m.isStyleLoaded && m.isStyleLoaded() && m.getSource("route")) go(); else m.once("idle", go);
  }
  if (typeof window.drawRoute === "function") {
    var _draw = window.drawRoute;
    window.drawRoute = function () { _draw.apply(this, arguments); setTimeout(paintMapAlt, 0); };
  }

  // ---- UI shells (added once, under the result card) ----
  function ensureUi() {
    if ($("rpAltBox")) return;
    var res = $("result"); if (!res) return;
    var box = document.createElement("div"); box.id = "rpAltBox"; box.className = "hide";
    var day = document.createElement("div"); day.id = "rpDayBox"; day.className = "hide";
    res.parentNode.insertBefore(day, res.nextSibling);
    res.parentNode.insertBefore(box, res.nextSibling);
    box.addEventListener("click", function (e) { if (!e.target.closest(".rpAlt")) return; RP.altOn = !RP.altOn; paintAll(); paintMapAlt(); });
    day.addEventListener("change", function (e) { if (e.target.id === "rpHour") { RP.hour = +e.target.value; paintAll(); } });
    day.addEventListener("click", function (e) { var c = e.target.closest(".rpCol"); if (c) { RP.hour = +c.getAttribute("data-h"); paintAll(); } });
  }
  function baseOneWay() {
    if (!window.lastTrip || typeof costs !== "function") return null;
    var t = window.lastTrip; return costs(t.oneMiles || t.miles, t.oneSecs || t.secs).ecoGBP;
  }
  function haveSteps() { var t = window.lastTrip; return RP.main && t && Math.abs((t.oneMiles || t.miles) - RP.main.miles) < 0.05; }

  function paintAlt(base) {
    var box = $("rpAltBox"); if (!box) return;
    if (!haveSteps() || !(base > 0)) { box.className = "hide"; RP.lastBest = null; return; }
    var L = learned(), best = RC.cheaper(RP.main.steps, RP.alts, RP.hour, base, L);
    RP.lastBest = best;
    box.className = "";
    if (!best) { box.innerHTML = "<p class='rpOk'>Your route is the cheapest we found for " + hh(RP.hour) + ".</p>"; return; }
    var name = RC.viaName(best.alt.steps, RP.main.steps), dm = best.alt.miles - RP.main.miles, dt = Math.round(best.extraMins);
    var bits = [(Math.abs(dm) < 0.1 ? "Same distance" : (Math.abs(dm).toFixed(1) + " mi " + (dm > 0 ? "longer" : "shorter"))),
      (dt === 0 ? "same time" : (Math.abs(dt) + " min " + (dt > 0 ? "slower" : "quicker"))), pence(best.save) + " cheaper. Estimate."];
    box.innerHTML = "<button type='button' class='rpAlt" + (RP.altOn ? " on" : "") + "'><span class='ar'>\u2191</span><span class='tx'><b>" + esc(name) + "</b><span>" + esc(bits.join(" \u00b7 ")) + (RP.altOn ? " Shown on the map." : " Tap to see it on the map.") + "</span></span><span class='sv'>\u2212" + pence(best.save) + "</span></button>";
  }
  function paintDay(base) {
    var box = $("rpDayBox"); if (!box) return;
    if (!haveSteps() || !(base > 0)) { box.className = "hide"; return; }
    var L = learned(), list = RC.dayCosts(RP.main.steps, base, RP.hour, L);
    var max = Math.max.apply(null, list.map(function (x) { return x.cost; })), min = Math.min.apply(null, list.map(function (x) { return x.cost; }));
    var lo = min * 0.9, best = list.filter(function (x) { return x.cost === min; })[0];
    var at = list.reduce(function (p, x) { return Math.abs(x.h - RP.hour) < Math.abs(p.h - RP.hour) ? x : p; }, list[0]);
    var opts = ""; for (var h = 5; h <= 22; h++) opts += "<option value='" + h + "'" + (h === RP.hour ? " selected" : "") + ">Leaving " + hh(h) + "</option>";
    var bars = list.map(function (x) {
      var pct = 18 + 82 * (x.cost - lo) / Math.max(max - lo, 0.01);
      var cls = "rpCol" + (x === best ? " best" : "") + (x === at ? " at" : "");
      return "<button type='button' class='" + cls + "' data-h='" + x.h + "'><em>" + gbp(x.cost) + "</em><i style='height:" + pct.toFixed(0) + "%'></i><u>" + hh(x.h) + "</u><s>+" + Math.round(x.extraMins) + "m</s></button>";
    }).join("");
    var nowCost = base, save = nowCost - best.cost;
    var note = save >= 0.05 ? ("Cheapest to go at " + hh(best.h) + ", about " + pence(save) + " less than " + hh(RP.hour) + ".") : ("Leaving at " + hh(RP.hour) + " is about as cheap as it gets.");
    note += " Estimate from typical weekday traffic on these roads" + (L.n >= 4 ? (", tuned with your " + L.n + " journeys.") : ".");
    box.className = "";
    box.innerHTML = "<div class='rpBar'><span class='rpChip'>Leaving " + hh(RP.hour) + "<i></i><select id='rpHour' aria-label='Leaving time'>" + opts + "</select></span><span class='rpTag'>Estimate</span></div>" +
      "<div class='rpDay'><div class='hd'><b>Cost across the day</b><span>One way \u00b7 6am\u20138pm</span></div><div class='rpBars'>" + bars + "</div></div><p class='rpNote'>" + esc(note) + "</p>";
  }

  // ---- 3. Compare car types (replaces the old list inside the same card) ----
  var openSheet = null;
  function car() { return typeof garageCar === "function" ? (garageCar() || {}) : {}; }
  function paintTypes() {
    var cardEl = $("compareCard"), el = $("compareBody"); if (!cardEl || !el) return;
    var t = window.lastTrip; if (!t) return;
    var ret = typeof tripMult === "function" ? tripMult() === 2 : true;
    var miles = (t.oneMiles || t.miles || 0) * (ret ? 2 : 1);
    var s = FC.settings(), P = window.PRICE || {}, g = car();
    var list = FC.rows(miles, P, s, g, FC.fillups(), ret);
    cardEl.classList.add("rpTypes");
    var title = cardEl.querySelector("b"); if (title && !title.closest(".rpRow")) title.style.display = "none";
    var rate = FC.evRate(s, P);
    var html = "<div class='hd'><b>Compare car types</b><span>" + (ret ? "Return trip" : "One way") + " \u00b7 " + miles.toFixed(1) + " mi</span></div>";
    html += list.map(function (r) {
      return "<div class='rpRow" + (r.cheapest ? " best" : "") + "'><div class='nm'><b>" + esc(r.name) + (r.cheapest ? " <span class='rpPill'>CHEAPEST</span>" : "") + "</b><span>" + esc(r.sub) + "</span></div><div class='gbp'>" + gbp(r.cost) + "</div><button type='button' class='ed' data-ed='" + r.id + "' aria-label='Edit " + esc(r.name) + "'>\u270e</button></div>";
    }).join("");
    var fills = FC.fillups().filter(function (f) { var p = myPlate(); return !p || !f.plate || f.plate === p; }).length;
    html += "<details class='rpHow' id='rpHow'" + (RP.howOpen ? " open" : "") + "><summary>How we worked this out</summary>" +
      "<p><b>Charging</b> (electric and plug-in hybrid)</p><div class='rpSeg' id='rpCharge'>" +
      [["offpeak", "Off-peak", (+s.offpeak).toFixed(1) + "p"], ["standard", "Standard", (+P.electric || 26.32).toFixed(1) + "p"], ["public", "Public", (+s.publicRate).toFixed(0) + "p"]].map(function (c) {
        return "<button type='button' data-ch='" + c[0] + "' class='" + (s.charge === c[0] ? "on" : "") + "'>" + c[1] + "<em>" + c[2] + "/kWh</em></button>"; }).join("") + "</div>" +
      (s.charge === "public" ? "" : "<label for='rpHome'>Charged at home: <b id='rpHomeV'>" + Math.round(s.homePct) + "%</b></label><input type='range' id='rpHome' min='0' max='100' step='5' value='" + Math.round(s.homePct) + "'/><div class='rpSlide'><span>All public</span><span>All home</span></div>") +
      "<p>Electric works out at " + rate.toFixed(1) + "p per kWh. Plug-in hybrid uses its battery first (" + s.phevRange + " mi real range, charged before you set off), then petrol.</p>" +
      "<p>Petrol " + (+P.petrol || 0).toFixed(1) + "p, diesel " + (+P.diesel || 0).toFixed(1) + "p (UK average" + (P.date ? ", " + esc(P.date) : "") + "). Off-peak is a typical EV tariff; public is the UK rapid average (Zapmap).</p>" +
      "<p>Starting figures are official economy adjusted to real driving: \u00d70.94 for WLTP figures, \u00d70.82 for older NEDC figures (<a href='https://caradvertcheck.co.uk/real-mpg' target='_blank' rel='noopener'>CarAdCheck Real MPG</a>, CC BY 4.0). Official figures from the VCA. My car uses your fill-ups once you have two with the mileage.</p>" +
      "<p>Fill-ups saved: <b>" + fills + "</b></p><button type='button' class='rpSmall' data-ed='mine'>Add a fill-up</button></details>";
    el.innerHTML = html;
  }
  function closeSheet() { if (openSheet) { openSheet.remove(); openSheet = null; } }
  function sheet(title, sub, fields, onSave) {
    closeSheet();
    var bg = document.createElement("div"); bg.className = "rpSheetBg";
    bg.innerHTML = "<div class='rpSheet' role='dialog' aria-label='" + esc(title) + "'><h3>" + esc(title) + "</h3><p class='muted'>" + esc(sub) + "</p>" +
      fields.map(function (f) { return f.two ? "<div class='two'>" + f.two.map(field).join("") + "</div>" : field(f); }).join("") +
      "<div class='acts'><button type='button' data-x='1'>Cancel</button><button type='button' class='pri' data-s='1'>Save</button></div></div>";
    function field(f) { return "<div><label for='" + f.id + "'>" + esc(f.label) + "</label><input id='" + f.id + "' type='number' inputmode='decimal' step='any' value='" + (f.value == null ? "" : f.value) + "' placeholder='" + esc(f.ph || "") + "'/></div>"; }
    bg.addEventListener("click", function (e) {
      if (e.target === bg || e.target.closest("[data-x]")) closeSheet();
      else if (e.target.closest("[data-s]")) { if (onSave(function (id) { var i = bg.querySelector("#" + id); return i ? i.value : ""; }) !== false) { closeSheet(); paintAll(); } }
    });
    document.body.appendChild(bg); openSheet = bg;
  }
  function edit(id) {
    var s = FC.settings();
    var num = function (v, lo, hi) { v = parseFloat(v); return isFinite(v) && v >= lo && v <= hi ? Math.round(v * 10) / 10 : null; };
    if (id === "petrol" || id === "diesel" || id === "hybrid") {
      var nm = { petrol: "Petrol", diesel: "Diesel", hybrid: "Hybrid" }[id];
      sheet(nm + " economy", "Miles per gallon you'd expect in real driving.", [{ id: "rpE1", label: "mpg", value: s[id] }], function (v) {
        var x = num(v("rpE1"), 10, 120); if (x == null) return false; var p = {}; p[id] = x; FC.save(p); });
    } else if (id === "ev") {
      sheet("Electric economy", "Miles per kWh in real driving. Winter is lower.", [{ id: "rpE1", label: "mi/kWh", value: s.ev }], function (v) {
        var x = num(v("rpE1"), 1, 8); if (x == null) return false; FC.save({ ev: x }); });
    } else if (id === "phev") {
      sheet("Plug-in hybrid", "Battery first, then petrol. Use the range you really get.", [
        { two: [{ id: "rpP1", label: "Electric range (mi)", value: s.phevRange }, { id: "rpP2", label: "mi/kWh on battery", value: s.phevMpk }] },
        { id: "rpP3", label: "mpg once the battery is flat", value: s.phevMpg }], function (v) {
        var a = num(v("rpP1"), 0, 150), b = num(v("rpP2"), 1, 6), c = num(v("rpP3"), 10, 90); if (a == null || b == null || c == null) return false;
        FC.save({ phevRange: a, phevMpk: b, phevMpg: c }); });
    } else if (id === "mine") {
      var g = car(), today = new Date().toISOString().slice(0, 10);
      sheet("Add a fill-up", "Fill to the top each time. Two fill-ups with the mileage give your real mpg.", [
        { two: [{ id: "rpF1", label: "Litres", ph: "e.g. 45.2" }, { id: "rpF2", label: "Total \u00a3", ph: "e.g. 78.40" }] },
        { id: "rpF3", label: "Mileage on the dash", ph: "e.g. 62310" }], function (v) {
        var L = num(v("rpF1"), 1, 200), T = num(v("rpF2"), 1, 500), O = parseFloat(v("rpF3"));
        if (L == null) return false;
        FC.addFillup({ litres: L, total: T, odo: isFinite(O) && O > 0 ? Math.round(O) : null, plate: myPlate(), date: today, source: "manual" }); });
    }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("#compareCard [data-ed]"); if (b) { edit(b.getAttribute("data-ed")); return; }
    var c = e.target.closest("#rpCharge [data-ch]"); if (c) { FC.save({ charge: c.getAttribute("data-ch") }); RP.howOpen = true; paintAll(); }
  });
  document.addEventListener("toggle", function (e) { if (e.target && e.target.id === "rpHow") RP.howOpen = e.target.open; }, true);
  document.addEventListener("input", function (e) {
    if (e.target.id === "rpHome") { var v = +e.target.value; if ($("rpHomeV")) $("rpHomeV").textContent = v + "%"; FC.save({ homePct: v }); clearTimeout(RP.t); RP.t = setTimeout(function () { RP.howOpen = true; paintAll(); }, 250); }
  });

  function paintAll() {
    ensureUi();
    var base = baseOneWay();
    paintAlt(base); paintDay(base); paintTypes();
    var meta = $("rMeta"); if (meta) { var mt = meta.textContent.replace(/ \u00b7 leaving \d\d:00$/, ""); meta.textContent = haveSteps() ? mt + " \u00b7 leaving " + hh(RP.hour) : mt; }
  }
  window.paintCompare = function () { paintTypes(); };
  if (typeof window.paintResult === "function") {
    var _pr = window.paintResult;
    window.paintResult = function () { _pr.apply(this, arguments); paintAll(); };
  }
  ensureUi();
  if (window.lastTrip) paintAll();
})();
