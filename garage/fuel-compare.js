/* Fuel-type cost comparison for Route costs, and the fill-up log.
   Storage (new keys only): gt.compareTypes.v1 (your edits), gt.fuelLog.v1 (fill-ups).
   Real-world factors: x0.94 WLTP, x0.82 NEDC — CarAdCheck Real MPG, CC BY 4.0 (caradvertcheck.co.uk/real-mpg).
   Official figures: VCA car fuel data (mpg-uk.js) or CO2 from the V5C/DVLA, via mpg-lookup.js.
   Charging: off-peak 9.9p (Intelligent Octopus Go, Nov 2026), standard = Ofgem cap, public rapid 82p (Zapmap, Oct 2026). */
(function (root) {
  "use strict";
  var GAL = 4.54609;
  var DEF = { petrol: 38, diesel: 43, hybrid: 46, ev: 3.4, phevRange: 30, phevMpg: 38, phevMpk: 3.0,
    charge: "offpeak", homePct: 80, offpeak: 9.9, publicRate: 82, chargeAtDest: false };
  var KEY = "gt.compareTypes.v1", LOG = "gt.fuelLog.v1";
  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function rd(k, d) { var s = ls(); if (!s) return d; try { var v = JSON.parse(s.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function wr(k, v) { var s = ls(); if (s) s.setItem(k, JSON.stringify(v)); }
  function settings() { var s = rd(KEY, {}), o = {}, k; for (k in DEF) o[k] = (s && s[k] != null && s[k] !== "") ? s[k] : DEF[k]; return o; }
  function save(patch) { var s = rd(KEY, {}) || {}, k; for (k in patch) s[k] = patch[k]; wr(KEY, s); return settings(); }
  function fuelCost(miles, mpg, ppl) { return miles / Math.max(+mpg || 1, 1) * GAL * ((+ppl || 0) / 100); }
  function evCost(miles, mpk, pkwh) { return miles / Math.max(+mpk || 0.4, 0.4) * ((+pkwh || 0) / 100); }
  function homeRate(s, P) { return s.charge === "standard" ? (+P.electric || 26.32) : (+s.offpeak || 9.9); }
  function evRate(s, P) {
    if (s.charge === "public") return +s.publicRate || 82;
    var pct = Math.max(0, Math.min(100, +s.homePct)) / 100;
    return homeRate(s, P) * pct + (+s.publicRate || 82) * (1 - pct);
  }
  // PHEV per journey: electric miles first (real range), the rest on petrol at the charge-sustaining mpg.
  function phevSplit(miles, s, isReturn) {
    var range = Math.max(0, +s.phevRange || 0) * (s.chargeAtDest && isReturn ? 2 : 1);
    var e = Math.min(miles, range);
    return { eMiles: e, pMiles: Math.max(0, miles - e) };
  }
  // ---- Fill-up log ----
  function fillups() { var l = rd(LOG, []); return Array.isArray(l) ? l : []; }
  function addFillup(f) {
    var l = fillups();
    var row = { id: f.id || ("f" + Date.now()), date: f.date || new Date().toISOString().slice(0, 10),
      litres: +f.litres || null, ppl: +f.ppl || null, total: +f.total || null, odo: +f.odo || null, miles: +f.miles || null,
      plate: f.plate || "", source: f.source || "manual" };
    if (!row.ppl && row.total && row.litres) row.ppl = Math.round(row.total / row.litres * 1000) / 10;
    if (!row.total && row.ppl && row.litres) row.total = Math.round(row.ppl * row.litres) / 100;
    l.unshift(row); wr(LOG, l.slice(0, 300)); return row;
  }
  // Learned mpg: brim-to-brim. Litres added after the first odometer reading, over the miles driven.
  function learnedMpg(list, plate) {
    var l = (list || []).filter(function (f) { return f && f.litres > 0 && (!plate || !f.plate || f.plate === plate); });
    var withOdo = l.filter(function (f) { return f.odo > 0; }).sort(function (a, b) { return a.odo - b.odo; });
    var miles = 0, litres = 0, n = 0;
    if (withOdo.length >= 2) {
      miles = withOdo[withOdo.length - 1].odo - withOdo[0].odo;
      for (var i = 1; i < withOdo.length; i++) litres += withOdo[i].litres;
      n = withOdo.length;
    }
    l.forEach(function (f) { if (!(f.odo > 0) && f.miles > 0) { miles += f.miles; litres += f.litres; n++; } });
    if (!(miles > 20) || !(litres > 1)) return null;
    var mpg = miles / (litres / GAL);
    if (mpg < 8 || mpg > 120) return null;
    return { mpg: Math.round(mpg * 10) / 10, n: n, miles: miles };
  }
  // ---- My car's economy: learned > official x real-world > your typed figure ----
  function myCar(car, list) {
    car = car || {};
    var learned = learnedMpg(list, car.plate);
    if (learned) return { mpg: learned.mpg, label: "Based on " + learned.n + " fill-ups", how: "learned" };
    var L = root.MpgLookup;
    if (L && (car.make || car.name)) {
      var r = L.lookUp({ make: car.make || "", model: car.model || "", name: car.name || [car.make, car.model].join(" "), fuel: car.fuel,
        year: +car.year || null, engine: +car.engine || null, firstUsedDate: car.firstUsedDate || car.regDate || null, co2: +car.co2 || null });
      if (r && r.costMpg && !r.phev) return { mpg: r.costMpg, label: "Estimate · official " + r.official + " " + r.unit + " (" + r.scheme + "), adjusted", how: "official", official: r.official, scheme: r.scheme, unit: r.unit };
    }
    if (L && +car.co2 > 0) {
      var sch = (+car.year || 0) >= 2019 ? "WLTP" : "NEDC";
      var o = L.officialFromCo2(+car.co2, car.fuel, sch);
      if (o) { var rw = L.realWorldMpg(o.official, o.scheme); return { mpg: rw, label: "Estimate · from CO2 " + car.co2 + " g/km, adjusted", how: "co2" }; }
    }
    if (+car.mpg) return { mpg: +car.mpg, label: "Your figure", how: "typed" };
    return null;
  }
  function kindOf(fuel) {
    var f = String(fuel || "").toLowerCase();
    if (/plug|phev/.test(f)) return "phev";
    if (/electric/.test(f) && !/hybrid/.test(f)) return "electric";
    if (/hybrid/.test(f)) return "hybrid";
    if (/diesel/.test(f)) return "diesel";
    return "petrol";
  }
  // Rows for a journey. miles = total miles for the trip shown (one way or return).
  function rows(miles, P, s, car, list, isReturn) {
    P = P || {}; s = s || settings();
    var petrol = +P.petrol || 167, diesel = +P.diesel || 195.4, rate = evRate(s, P);
    var sp = phevSplit(miles, s, isReturn);
    var out = [
      { id: "petrol", name: "Petrol", sub: s.petrol + " mpg", cost: fuelCost(miles, s.petrol, petrol) },
      { id: "diesel", name: "Diesel", sub: s.diesel + " mpg", cost: fuelCost(miles, s.diesel, diesel) },
      { id: "hybrid", name: "Hybrid", sub: s.hybrid + " mpg", cost: fuelCost(miles, s.hybrid, petrol) },
      { id: "phev", name: "Plug-in hybrid", sub: Math.round(sp.eMiles) + " mi electric + " + (Math.round(sp.pMiles * 10) / 10) + " mi petrol",
        cost: evCost(sp.eMiles, s.phevMpk, rate) + fuelCost(sp.pMiles, s.phevMpg, petrol) },
      { id: "ev", name: "Electric", sub: s.ev + " mi/kWh · " + chargeLabel(s), cost: evCost(miles, s.ev, rate) }
    ];
    var me = myCar(car, list), k = kindOf(car && car.fuel);
    if (me) {
      var c = k === "electric" ? evCost(miles, me.mpg, rate) : fuelCost(miles, me.mpg, k === "diesel" ? diesel : petrol);
      out.push({ id: "mine", name: "My car", sub: me.label, cost: c, mine: true });
    }
    var min = Math.min.apply(null, out.map(function (r) { return r.cost; }));
    out.forEach(function (r) { r.cheapest = Math.abs(r.cost - min) < 0.005; });
    return out;
  }
  function chargeLabel(s) {
    if (s.charge === "public") return "public rapid";
    var h = s.charge === "standard" ? "home standard" : "home off-peak";
    return +s.homePct >= 100 ? h : (h + " " + Math.round(+s.homePct) + "%");
  }
  root.FuelCompare = { DEF: DEF, KEY: KEY, LOG: LOG, settings: settings, save: save, rows: rows, evRate: evRate, phevSplit: phevSplit,
    fillups: fillups, addFillup: addFillup, learnedMpg: learnedMpg, myCar: myCar, fuelCost: fuelCost, evCost: evCost, chargeLabel: chargeLabel, kindOf: kindOf };
})(typeof window !== "undefined" ? window : globalThis);
