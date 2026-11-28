/* Route costs: cheaper route + time of day (free version).
   - Routes: OSRM public router with alternatives=true (no key). Each step's speed and road class
     (motorway / A road / local) feeds a speed-based fuel model.
   - Suggest another route only if it saves at least 5% or 20p one way.
   - Time of day: typical weekday speed bands by road class (DfT road congestion statistics, CGN tables,
     shape only), a stop-start penalty for slow traffic, and learning from your own journeys (gt.driveLog).
   Costs are shown relative to the trip cost the page already shows, so numbers stay consistent. */
(function (root) {
  "use strict";
  var MILE = 1609.34;
  // Share of free-flow speed by hour (weekday). Index 0..23. Shapes follow DfT CGN typical weekday speeds:
  // local A roads dip hardest at 08:00 and 17:00; strategic roads dip less.
  var BANDS = {
    local:    [1,1,1,1,1,.97,.92,.80,.72,.80,.85,.84,.83,.83,.82,.78,.73,.70,.80,.88,.93,.96,.98,1],
    a:        [1,1,1,1,1,.98,.94,.84,.78,.85,.89,.88,.87,.87,.86,.82,.78,.76,.85,.91,.95,.97,.99,1],
    motorway: [1,1,1,1,1,.99,.96,.88,.85,.92,.96,.96,.95,.95,.94,.90,.86,.85,.92,.97,.99,1,1,1]
  };
  function roadClass(step) {
    var ref = String((step && (step.ref || step.name)) || "").toUpperCase();
    if (/(^|[ ;])M\d/.test(ref) || /\(M\)/.test(ref)) return "motorway";
    if (/(^|[ ;])A\d/.test(ref)) return "a";
    return "local";
  }
  // Fuel use relative to the combined figure, by speed (mph). 1 = combined mpg.
  // Low speeds and stop-start cost more; 45-60 mph is best; above 65 mph drag rises.
  function speedFactor(mph) {
    mph = +mph || 0;
    if (mph <= 0) return 1;
    if (mph < 10) return 1.75;
    if (mph < 20) return 1.45;
    if (mph < 30) return 1.18;
    if (mph < 40) return 1.0;
    if (mph < 50) return 0.9;
    if (mph <= 60) return 0.88;
    if (mph <= 66) return 0.95;
    if (mph <= 72) return 1.05;
    return 1.15;
  }
  function compactSteps(osrmRoute) {
    var out = [];
    ((osrmRoute && osrmRoute.legs) || []).forEach(function (leg) {
      (leg.steps || []).forEach(function (st) {
        if (!(st.distance > 0)) return;
        out.push({ d: st.distance, s: Math.max(st.duration, 1), c: roadClass(st), n: st.ref || st.name || "" });
      });
    });
    return out;
  }
  // Learned hour factors from journeys: hourly average speed vs your overall average.
  function learnHours(log) {
    var byH = {}, all = [], i;
    (Array.isArray(log) ? log : []).forEach(function (t) {
      if (!t || t.type === "run") return;
      var miles = +t.miles || 0, ms = (+t.end || 0) - (+t.when || 0);
      if (miles < 2 || ms < 3 * 60000 || ms > 5 * 3600000) return;
      var mph = miles / (ms / 3600000);
      if (mph < 3 || mph > 90) return;
      var h = new Date(+t.when).getHours();
      (byH[h] = byH[h] || []).push(mph); all.push(mph);
    });
    if (all.length < 4) return { n: all.length, f: {} };
    var avg = all.reduce(function (a, b) { return a + b; }, 0) / all.length, f = {};
    for (i = 0; i < 24; i++) {
      if (!byH[i]) continue;
      var a = byH[i].reduce(function (x, y) { return x + y; }, 0) / byH[i].length;
      var w = byH[i].length / (byH[i].length + 4); // blend: more trips at that hour, more trust
      f[i] = { ratio: a / avg, w: w, n: byH[i].length };
    }
    return { n: all.length, f: f };
  }
  function hourShare(cls, h, learned) {
    var base = (BANDS[cls] || BANDS.local)[((h % 24) + 24) % 24];
    var L = learned && learned.f && learned.f[h];
    if (!L) return base;
    // Your own pattern vs the typical band shape, scaled to the typical daytime average.
    var mean = 0.86, mine = Math.max(0.5, Math.min(1.1, mean * L.ratio));
    return base * (1 - L.w) + mine * L.w;
  }
  // Model one route at an hour: free-flow speed from OSRM, congested by band; fuel factor from speed.
  // Returns { secs, fuel } where fuel is in "combined-miles" units (miles × speed factor).
  function model(steps, h, learned) {
    var secs = 0, fuel = 0;
    (steps || []).forEach(function (st) {
      var free = (st.d / MILE) / (st.s / 3600);
      var share = h == null ? 1 : hourShare(st.c, h, learned);
      var mph = free * share;
      var t = st.s / share;
      var miles = st.d / MILE;
      // Stop-start penalty: lost speed below free flow costs extra on top of the speed curve.
      var stop = 1 + Math.max(0, 1 - share) * 0.35;
      secs += t; fuel += miles * speedFactor(mph) * stop;
    });
    return { secs: secs, fuel: fuel };
  }
  // Pick a cheaper alternative. base = the page's one-way cost for the main route.
  function cheaper(mainSteps, alts, h, base, learned) {
    var m = model(mainSteps, h, learned);
    var best = null;
    (alts || []).forEach(function (a) {
      var am = model(a.steps, h, learned);
      var cost = base * (am.fuel / Math.max(m.fuel, 1e-6));
      var save = base - cost;
      if (save >= 0.20 || save / Math.max(base, 0.01) >= 0.05) {
        if (!best || save > best.save) best = { alt: a, cost: cost, save: save, extraMiles: a.miles - (a.mainMiles || 0), extraMins: (am.secs - m.secs) / 60 };
      }
    });
    return best;
  }
  function viaName(steps, mainSteps) {
    var mainNames = {}; (mainSteps || []).forEach(function (s) { if (s.n) mainNames[s.n] = (mainNames[s.n] || 0) + s.d; });
    var tally = {}; (steps || []).forEach(function (s) { if (s.n && /^[AMB]\d/.test(s.n)) tally[s.n] = (tally[s.n] || 0) + s.d; });
    Object.keys(tally).forEach(function (k) { tally[k] -= (mainNames[k] || 0); if (tally[k] < 1600) delete tally[k]; });
    var best = "", d = 0; Object.keys(tally).forEach(function (k) { if (tally[k] > d) { d = tally[k]; best = k; } });
    if (!best) (steps || []).forEach(function (s) { if (s.n && !mainNames[s.n] && s.d > d) { d = s.d; best = s.n; } });
    return best ? "Via " + best.split(";")[0] : "Other route";
  }
  // Cost across the day, scaled so the chosen hour equals the page's one-way cost.
  function dayCosts(steps, base, atHour, learned, hours) {
    hours = hours || [6, 8, 10, 12, 14, 16, 18, 20];
    var ref = model(steps, atHour, learned), free = model(steps, 3, learned);
    return hours.map(function (h) {
      var m = model(steps, h, learned);
      return { h: h, cost: base * (m.fuel / Math.max(ref.fuel, 1e-6)), extraMins: Math.max(0, (m.secs - free.secs) / 60) };
    });
  }
  // Free fallback when OSRM finds no alternative: route via points either side of the midpoint.
  function viaPoints(a, b) {
    var mx = (a.lon + b.lon) / 2, my = (a.lat + b.lat) / 2, k = Math.cos(my * Math.PI / 180);
    var dx = (b.lon - a.lon) * k, dy = b.lat - a.lat;
    return [0.06, -0.06, 0.15, -0.15].map(function (f) { return { lon: mx + (-dy * f) / k, lat: my + dx * f }; });
  }
  // Keep only sensible alternatives: not much longer or slower, no U-turns, not a copy of the main route.
  function usableAlt(main, r) {
    if (!r || !main) return false;
    if (r.distance > main.distance * 1.3 || r.duration > main.duration * 1.4) return false;
    if (Math.abs(r.distance - main.distance) < main.distance * 0.02 && Math.abs(r.duration - main.duration) < 60) return false;
    var u = false;
    (r.legs || []).forEach(function (l) { (l.steps || []).forEach(function (st) { if (st.maneuver && st.maneuver.modifier === "uturn") u = true; }); });
    return !u;
  }
  root.RouteCost = { roadClass: roadClass, speedFactor: speedFactor, compactSteps: compactSteps, learnHours: learnHours,
    model: model, cheaper: cheaper, viaPoints: viaPoints, usableAlt: usableAlt, viaName: viaName, dayCosts: dayCosts, BANDS: BANDS };
})(typeof window !== "undefined" ? window : globalThis);
