/* Official UK mpg lookup from the VCA tables in mpg-uk.js, with a CO2 fallback.
   Combined mpg is the type-approval figure (NEDC or WLTP). Real-world estimates use
   CarAdCheck (CC BY 4.0) factors: WLTP 94%, NEDC 82%. Official PHEV combined is a
   weighted lab figure, not a running-cost figure.
   CO2→L/100km: NEDC petrol 23.2 / diesel 26.5 (Dir. 80/1268/EEC as 93/116/EC);
   WLTP E10 22.78 / B7 26.31 (Reg. 2017/1151). UK mpg = 282.480936 / (L/100km).
   2017–2020 V5C CO2 is often NEDC-correlated: convert to a WLTP-equivalent official
   mpg with a 0.86 factor when the VES figure is treated as NEDC-corr. */
(function (root) {
  "use strict";
  var UK_MPG = 282.480936;
  var CO2_NEDC = { petrol: 23.2, diesel: 26.5 };
  var CO2_WLTP = { petrol: 22.78, diesel: 26.31 };
  var RW = { WLTP: 0.94, NEDC: 0.82 };
  var NEDC_CORR_TO_WLTP = 0.86;
  var WLTP_FROM = "2018-09-01";
  var MONTHS = "january february march april may june july august september october november december";
  var FILLER = /^(model|year|my|ym|from|post|pre|new|all|the|and|door|doors|hatchback|hatch|estate|saloon|touring|convertible|cabriolet|coupe|sportback|plus|limited|edition)$/i;
  var MAKES = {
    vw: "volkswagen", volkswagen: "volkswagen",
    mercedes: "mercedes-benz", "mercedes benz": "mercedes-benz", "mercedes-benz": "mercedes-benz", merc: "mercedes-benz",
    "land rover": "land rover", landrover: "land rover",
    citroen: "citroen", "citroën": "citroen",
    "mini": "mini", bmw: "bmw", audi: "audi", ford: "ford", honda: "honda",
    toyota: "toyota", nissan: "nissan", hyundai: "hyundai", kia: "kia",
    vauxhall: "vauxhall", mitsubishi: "mitsubishi", skoda: "skoda",
    peugeot: "peugeot", renault: "renault", mazda: "mazda", seat: "seat",
    volvo: "volvo", jaguar: "jaguar", suzuki: "suzuki", subaru: "subaru",
    lexus: "lexus", mg: "mg", "ds": "ds", fiat: "fiat", alfa: "alfa romeo",
    "alfa romeo": "alfa romeo", jeep: "jeep", porsche: "porsche", tesla: "tesla"
  };

  function clean(s) { return String(s || "").toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim(); }
  function normMake(s) {
    var t = clean(s).replace(/[^a-z0-9]+/g, " ").trim();
    return MAKES[t] || t;
  }
  function makesMatch(a, b) {
    a = normMake(a); b = normMake(b);
    if (!a || !b) return !a && !b;
    if (a === b) return true;
    if (a.indexOf(b) === 0 || b.indexOf(a) === 0) return true;
    return a.slice(0, 4) === b.slice(0, 4) && a.slice(0, 4).length >= 4;
  }
  function fuelFamily(fuel, name) {
    var s = clean(fuel) + " " + clean(name);
    if (/phev|plug-?in/.test(s) || /electricity\s*\/\s*(petrol|diesel)/.test(s)) return "phev";
    if (/electric/.test(s) && !/hybrid|petrol|diesel/.test(s)) return "electric";
    if (/hybrid|petrol electric|diesel electric|petrol hybrid|diesel hybrid/.test(s)) return "hybrid";
    if (/diesel/.test(s)) return "diesel";
    if (/petrol|gasoline/.test(s)) return "petrol";
    return clean(fuel) || "petrol";
  }
  function rowFamily(row) {
    var f = clean(row[3]), m = clean(row[1]) + " " + clean(row[2]);
    if (/phev|plug-?in/.test(m) || /electricity\s*\/\s*(petrol|diesel)/.test(f)) return "phev";
    if (/^electricity$|^electric$/.test(f) || (f.indexOf("electric") >= 0 && f.indexOf("petrol") < 0 && f.indexOf("diesel") < 0 && f.indexOf("hybrid") < 0)) return "electric";
    if (/hybrid|petrol electric|diesel electric/.test(f)) return "hybrid";
    if (/diesel/.test(f)) return "diesel";
    return "petrol";
  }
  function litresFromCc(cc) {
    var n = +cc;
    if (!n || n < 100) return null;
    return Math.round(n / 100) / 10;
  }
  function enginesIn(text) {
    var out = [], seen = {};
    function add(n) {
      n = +n;
      if (!(n >= 0.6 && n <= 8.5)) return;
      var k = n.toFixed(1);
      if (!seen[k]) { seen[k] = 1; out.push(n); }
    }
    String(text || "").replace(/\b(\d{3,4})\s*cc\b/gi, function (_, n) { add(Math.round(+n / 100) / 10); });
    String(text || "").replace(/\b(\d(?:\.\d)?)\s*(?:l\b|litre|liter)/gi, function (_, n) { add(n); });
    String(text || "").replace(/\b(\d(?:\.\d)?)\s*(?:vtec|i-mmd|i-dtec|i-vtec|i-ctdi|ecoboost|tdi|tsi|tfsi|etsi|hdi|dci|crdi|mivec|skyactiv|cdti|dtec|gdi|vvt|tdci|multijet|t-gdi|bluehdi)/gi, function (_, n) { add(n); });
    String(text || "").replace(/\b(\d\.\d)\b/g, function (_, n) { add(n); });
    return out;
  }
  function fracYear(raw) {
    var s = String(raw || "").replace(/\s+/g, "");
    var m = s.match(/(19|20)\d{2}/);
    if (!m) return null;
    var y = +m[0];
    if (/¾/.test(s) || /3\/4/.test(s)) return y + 0.75;
    if (/½/.test(s) || /1\/2/.test(s)) return y + 0.5;
    if (/¼/.test(s) || /1\/4/.test(s)) return y + 0.25;
    return y;
  }
  function twoDigitYear(yy) {
    yy = +yy;
    return yy >= 80 ? 1900 + yy : 2000 + yy;
  }
  function parseYearInfo(model) {
    var text = String(model || "");
    var exact = [];
    var ranges = [];
    var used = [];
    function mark(from, to) { used.push([from, to]); }

    text.replace(/\b(post|pre)\s*((?:19|20)\d{2}(?:\s*[½¼¾]|\.00|\s*1\/[24])?)/gi, function (m, which, yraw, idx) {
      var y = fracYear(yraw);
      if (y == null) return m;
      if (which.toLowerCase() === "post") ranges.push({ min: y, max: Infinity });
      else ranges.push({ min: -Infinity, max: y });
      mark(idx, idx + m.length);
      return m;
    });
    text.replace(/\bfrom\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+((?:19|20)\d{2})\b/gi, function (m, mon, y, idx) {
      var mi = MONTHS.split(" ").indexOf(mon.toLowerCase());
      ranges.push({ min: +y + (mi < 0 ? 0 : mi / 12), max: Infinity });
      mark(idx, idx + m.length);
      return m;
    });
    text.replace(/\b(?:model\s+year|my|ym)\s*-?\s*((?:19|20)?\d{2})a?\b/gi, function (m, yraw, idx) {
      var y = yraw.length === 2 ? twoDigitYear(yraw) : +yraw;
      exact.push(y);
      mark(idx, idx + m.length);
      return m;
    });
    text.replace(/\(\s*((?:19|20)\d{2})\s*YM\s*\)/gi, function (m, y, idx) {
      exact.push(+y);
      mark(idx, idx + m.length);
      return m;
    });
    text.replace(/\bMY\s*((?:19|20)?\d{2})\b/gi, function (m, yraw, idx) {
      var y = yraw.length === 2 ? twoDigitYear(yraw) : +yraw;
      exact.push(y);
      mark(idx, idx + m.length);
      return m;
    });
    function taken(i) {
      for (var k = 0; k < used.length; k++) if (i >= used[k][0] && i < used[k][1]) return true;
      return false;
    }
    text.replace(/\b((?:19|20)\d{2})\b/g, function (m, y, idx) {
      if (taken(idx)) return m;
      exact.push(+y);
      return m;
    });
    var uniq = [];
    exact.forEach(function (y) { if (uniq.indexOf(y) < 0) uniq.push(y); });
    return { exact: uniq, ranges: ranges, hasYear: uniq.length > 0 || ranges.length > 0 };
  }
  function carFrac(info) {
    var d = info && (info.firstUsedDate || info.registrationDate);
    if (d && /^\d{4}-\d{2}/.test(d)) {
      var p = String(d).slice(0, 10).split("-");
      return +p[0] + ((+p[1] || 1) - 1) / 12 + ((+p[2] || 1) - 1) / 365;
    }
    if (info && info.year) return { lo: +info.year, hi: +info.year + 0.999 };
    return null;
  }
  function inRange(frac, lo, hi, range) {
    var min = range.min, max = range.max;
    if (typeof frac === "number") return frac + 1e-6 >= min && frac - 1e-6 <= max;
    return hi + 1e-6 >= min && lo - 1e-6 <= max;
  }
  function yearFit(yearInfo, info) {
    if (!yearInfo.hasYear) return "yearless";
    var year = info && info.year ? +info.year : null;
    var when = carFrac(info);
    var frac = typeof when === "number" ? when : null;
    var lo = frac != null ? frac : (when && when.lo);
    var hi = frac != null ? frac : (when && when.hi);
    var i;
    if (yearInfo.exact.length) {
      if (year && yearInfo.exact.indexOf(year) >= 0) return "exact";
      if (frac != null && yearInfo.exact.indexOf(Math.floor(frac)) >= 0) return "exact";
      if (frac != null && (frac % 1) >= 8 / 12 && yearInfo.exact.indexOf(Math.floor(frac) + 1) >= 0) return "adjacent";
      if (year && yearInfo.exact.indexOf(year + 1) >= 0 && frac == null) return "adjacent";
      if (!yearInfo.ranges.length) return "no";
    }
    if (yearInfo.ranges.length && lo != null) {
      for (i = 0; i < yearInfo.ranges.length; i++) {
        if (inRange(frac, lo, hi, yearInfo.ranges[i])) return "range";
      }
      for (i = 0; i < yearInfo.ranges.length; i++) {
        var r = yearInfo.ranges[i], mid = frac != null ? frac : (lo + hi) / 2;
        if (isFinite(r.min) && r.min - mid >= 0 && r.min - mid <= 1) return "near";
        if (isFinite(r.max) && mid - r.max >= 0 && mid - r.max <= 1) return "near";
      }
      return "no";
    }
    return "no";
  }
  function coreTokens(model) {
    var s = String(model || "")
      .replace(/[(),]/g, " ")
      .replace(/\b(model\s+year|my|ym)\s*-?\s*((?:19|20)?\d{2})a?\b/gi, " ")
      .replace(/\b(post|pre|from)\b/gi, " ")
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, " ")
      .replace(/\b((?:19|20)\d{2})a?\b/g, " ")
      .replace(/[½¼¾]/g, " ")
      .replace(/\\u00[bB][dDeE]/g, " ")
      .replace(/[^a-z0-9+.\-]+/gi, " ")
      .toLowerCase();
    return s.split(/\s+/).filter(function (w) { return w && w.length >= 1 && !FILLER.test(w) && !/^\d+$/.test(w) && !/^my\d+$/i.test(w); });
  }
  function hayOf(info) {
    return clean([info.make, info.model, info.name].filter(Boolean).join(" "));
  }
  function modelMatches(row, info) {
    var hay = hayOf(info);
    var tokens = coreTokens(row[1]);
    if (!tokens.length) return false;
    var i, ok = true;
    for (i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var re = new RegExp("(^|[^a-z0-9])" + tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)", "i");
      if (!re.test(hay)) { ok = false; break; }
    }
    if (ok) return true;
    var desc = clean(row[2]);
    var motModel = clean(info.model || info.name || "");
    var code = motModel.match(/\b(\d{3}[dieh]|[a-z]\s?\d{3}|leaf|gti|gtd|rs|st)\b/i);
    if (code && (desc.indexOf(clean(code[1])) >= 0 || clean(row[1]).indexOf(clean(code[1])) >= 0)) return true;
    return false;
  }
  function engineOk(row, litres) {
    if (!litres) return true;
    var found = enginesIn(String(row[1] || "") + " " + String(row[2] || ""));
    if (!found.length) return true;
    for (var i = 0; i < found.length; i++) if (Math.abs(found[i] - litres) <= 0.07) return true;
    return false;
  }
  function preferredScheme(info) {
    var d = info && (info.firstUsedDate || info.registrationDate);
    if (d && /^\d{4}-\d{2}/.test(d)) return String(d).slice(0, 10) >= WLTP_FROM ? "WLTP" : "NEDC";
    if (info && info.year >= 2019) return "WLTP";
    if (info && info.year && info.year <= 2017) return "NEDC";
    return "NEDC";
  }
  function median(nums) {
    if (!nums.length) return null;
    var a = nums.slice().sort(function (x, y) { return x - y; });
    // Pick a real official figure (lower middle), never an interpolated value.
    return a[Math.floor((a.length - 1) / 2)];
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function officialFromCo2(co2, fuel, scheme) {
    co2 = +co2;
    if (!co2 || co2 < 20 || co2 > 600) return null;
    var fam = fuelFamily(fuel);
    var kind = fam === "diesel" ? "diesel" : "petrol";
    var sch = scheme === "WLTP" ? "WLTP" : "NEDC";
    var factor = (sch === "WLTP" ? CO2_WLTP : CO2_NEDC)[kind];
    var litres = co2 / factor;
    if (litres <= 0) return null;
    return { official: round1(UK_MPG / litres), scheme: sch, source: "co2" };
  }
  function realWorldMpg(official, scheme) {
    official = +official;
    if (!official) return null;
    var f = RW[scheme] || RW.WLTP;
    return Math.round(official * f);
  }
  function pickBestYear(cands, info) {
    var ranks = { exact: 5, adjacent: 4, range: 3, near: 2, yearless: 1, no: 0 };
    var best = 0, i, f;
    for (i = 0; i < cands.length; i++) {
      f = ranks[cands[i].fit] || 0;
      if (f > best) best = f;
    }
    if (!best) return [];
    var kept = cands.filter(function (c) { return (ranks[c.fit] || 0) === best; });
    if (best === 2) {
      var when = carFrac(info);
      var frac = typeof when === "number" ? when : (when && (when.lo + when.hi) / 2);
      var bestMin = -Infinity;
      kept.forEach(function (c) {
        (c.yearInfo.ranges || []).forEach(function (r) {
          if (frac == null || inRange(frac, frac, frac, r)) {
            if (isFinite(r.min) && r.min > bestMin) bestMin = r.min;
          }
        });
      });
      if (isFinite(bestMin) && bestMin > -Infinity) {
        var tight = kept.filter(function (c) {
          return (c.yearInfo.ranges || []).some(function (r) {
            return Math.abs((r.min || -Infinity) - bestMin) < 0.02;
          });
        });
        if (tight.length) kept = tight;
      }
    }
    return kept;
  }
  function lookUp(info, list) {
    info = info || {};
    list = list || (root.MPG_UK) || [];
    var family = fuelFamily(info.fuel, [info.model, info.name].join(" "));
    var litres = litresFromCc(info.engine);
    var wantScheme = preferredScheme(info);
    var cands = [], i, row, fit, yi;
    for (i = 0; i < list.length; i++) {
      row = list[i];
      if (!makesMatch(row[0], info.make) && !(info.name && clean(info.name).indexOf(normMake(row[0])) >= 0) && !(info.name && clean(info.name).indexOf(clean(row[0])) >= 0)) continue;
      if (rowFamily(row) !== family) continue;
      if (!modelMatches(row, info)) continue;
      yi = parseYearInfo(row[1]);
      fit = yearFit(yi, info);
      if (fit === "no") continue;
      if (!engineOk(row, litres)) continue;
      cands.push({ row: row, fit: fit, yearInfo: yi });
    }
    var allCands = cands;
    cands = pickBestYear(cands, info);
    if (cands.length) {
      var schemeHits = cands.filter(function (c) { return String(c.row[8] || "") === wantScheme; });
      if (schemeHits.length) cands = schemeHits;
      else if (wantScheme === "WLTP") {
        var nearWltp = allCands.filter(function (c) {
          return String(c.row[8] || "") === "WLTP" && (c.fit === "exact" || c.fit === "adjacent" || c.fit === "range" || c.fit === "near");
        });
        if (nearWltp.length) cands = pickBestYear(nearWltp, info);
      }
    }
    var unit = family === "electric" ? "mi/kWh" : "mpg";
    var figs = [];
    var evFigs = [];
    var extras = [];
    cands.forEach(function (c) {
      var comb = c.row[6], ev = c.row[7], extra = c.row[5];
      if (family === "electric") { if (ev) evFigs.push(+ev); }
      else if (comb) figs.push(+comb);
      if (extra) extras.push(+extra);
    });
    var use = family === "electric" ? evFigs : figs;
    var official = use.length ? round1(median(use)) : null;
    var scheme = wantScheme;
    if (cands.length) scheme = String(cands[0].row[8] || wantScheme);
    var source = official ? "vca" : null;
    var phev = family === "phev";
    var rw = null;
    if (official && !phev) rw = realWorldMpg(official, scheme);
    if (phev) {
      var cs = extras.filter(function (n) { return n >= 20 && n <= 70; });
      if (cs.length) rw = realWorldMpg(median(cs), scheme === "NEDC" ? "NEDC" : "WLTP");
    }
    if (!official && info.co2) {
      var co2Scheme = wantScheme;
      var co2 = officialFromCo2(info.co2, family === "diesel" ? "diesel" : "petrol", (info.year >= 2017 && info.year <= 2020 && wantScheme === "WLTP") ? "NEDC" : co2Scheme);
      if (co2) {
        official = co2.official;
        scheme = co2.scheme;
        source = "co2";
        if (info.year >= 2017 && info.year <= 2020 && wantScheme === "WLTP") {
          official = round1(official * NEDC_CORR_TO_WLTP);
          scheme = "WLTP";
          source = "co2-nedc-corr";
        }
        if (!phev) rw = realWorldMpg(official, scheme);
      }
    }
    var u = unit;
    var officialLabel = official ? ("Official " + official + " " + u + (phev ? " (weighted)" : "")) : null;
    var realWorldLabel = null;
    if (phev && rw) realWorldLabel = "Real-world est. ~" + rw + " " + u + " off-charge";
    else if (phev) realWorldLabel = "Real-world est. depends on charging";
    else if (rw) realWorldLabel = "Real-world est. ~" + rw + " " + u;
    var costMpg = phev ? (rw || null) : (rw || official);
    return {
      official: official,
      realWorld: rw,
      scheme: official ? scheme : null,
      unit: u,
      phev: phev,
      source: source,
      officialLabel: officialLabel,
      realWorldLabel: realWorldLabel,
      costMpg: costMpg,
      hits: cands.length,
      family: family
    };
  }

  root.MpgLookup = {
    lookUp: lookUp,
    officialFromCo2: officialFromCo2,
    realWorldMpg: realWorldMpg,
    fuelFamily: fuelFamily,
    litresFromCc: litresFromCc,
    preferredScheme: preferredScheme,
    UK_MPG: UK_MPG,
    RW: RW
  };
})(typeof window !== "undefined" ? window : globalThis);
