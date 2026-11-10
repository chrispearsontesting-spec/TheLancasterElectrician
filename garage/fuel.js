/* Cheapest fuel on Record journey. Talks to the garage /fuel proxy; no keys in the app. */
(function () {
  "use strict";
  var root = document.getElementById("cheapFuel");
  if (!root) return;

  var TILE_STYLE = "https://tiles.openfreemap.org/styles/bright";
  var ML_CSS = "./vendor/maplibre/maplibre-gl.css?v=4.7.1";
  var ML_JS = "./vendor/maplibre/maplibre-gl.js?v=4.7.1";
  var MILES_PER_DEG_LAT = 69.0;

  var state = {
    fuel: (function () {
      try { return localStorage.getItem("gt.fuelPref") || ""; } catch (e) { return ""; }
    })(),
    miles: 5
  };
  var last = null;
  var cheapest = null;
  var others = [];
  var map = null;
  var markers = [];
  var popup = null;
  var mapReady = false;

  function $(id) { return root.querySelector("#" + id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function say(msg, kind) {
    var el = $("cfStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cf-status" + (kind ? " " + kind : "");
  }

  function carFuel() {
    if (window.D3Fuel && typeof window.D3Fuel.preferred === "function") {
      var p = window.D3Fuel.preferred();
      if (p === "electric") return "electric";
      if (p === "petrol" || p === "diesel") return p;
    }
    try {
      var raw = localStorage.getItem("gt.garage");
      var list = raw ? JSON.parse(raw) : [];
      var car = list && list[0];
      var f = car && String(car.fuel || "").toLowerCase();
      if (/electric|ev|phev|hybrid/.test(f) && !/diesel|petrol|unleaded/.test(f)) return "electric";
      if (/diesel/.test(f)) return "diesel";
      if (/petrol|unleaded|gasoline/.test(f)) return "petrol";
    } catch (e) {}
    return state.fuel === "petrol" || state.fuel === "diesel" ? state.fuel : "diesel";
  }
  function fuelParam() { var f = carFuel(); return f === "petrol" ? "petrol" : "diesel"; }
  function fuelLabel() { return fuelParam() === "petrol" ? "petrol" : "diesel"; }

  function mapsUrl(s) {
    return "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(s.lat + "," + s.lng) + "&travelmode=driving";
  }
  function placeUrl(s) {
    var text = [s.brand, s.address, s.postcode].filter(Boolean).join(", ");
    var q = text || ((s.lat != null && s.lng != null) ? (s.lat + "," + s.lng) : "");
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }
  function titleish(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (s === s.toUpperCase() && /[A-Z]/.test(s)) {
      return s.toLowerCase().replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); });
    }
    return s;
  }
  function shortAddr(s) {
    var a = String(s.address || "").trim();
    if (a) return titleish(a.split(",")[0].trim());
    return String(s.postcode || "").trim();
  }
  function distLabel(n) {
    var x = Number(n);
    if (!isFinite(x)) return "";
    return x.toFixed(1) + " mi";
  }
  function stationName(s) {
    var who = String(s.brand || "Station").trim() || "Station";
    var where = shortAddr(s);
    var core = where ? who + ", " + where : who;
    var d = distLabel(s.distance);
    return d ? core + " (" + d + ")" : core;
  }
  function fmtPrice(n) {
    var x = Number(n);
    return isFinite(x) ? x.toFixed(1) : "—";
  }
  function fmtWhen(iso, stale) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var now = new Date();
    var same = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var yday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var wasY = d.getFullYear() === yday.getFullYear() && d.getMonth() === yday.getMonth() && d.getDate() === yday.getDate();
    var label = same ? "Updated today" : wasY ? "Updated yesterday" : ("Updated " + d.getDate() + " " +
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]);
    return stale ? label + " · may be out of date" : label;
  }
  function fullAddress(s) {
    return [s.address, s.postcode].filter(Boolean).join(", ");
  }

  function injectStyle() {
    if (document.getElementById("cfStyles")) return;
    var css = document.createElement("style");
    css.id = "cfStyles";
    css.textContent =
      "#cheapFuel{margin:0 0 22px;padding:16px 16px 14px;border:1px solid #2a2a2e;border-radius:18px;background:#141416}" +
      "#cheapFuel .cf-kicker{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8e}" +
      "#cheapFuel .cf-price{margin:0;font-size:32px;font-weight:700;letter-spacing:-.03em;line-height:1.1}" +
      "#cheapFuel .cf-meta{margin:8px 0 0;font-size:14px;color:#c7c7cc;line-height:1.45}" +
      "#cheapFuel .cf-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}" +
      "#cheapFuel .cf-chip{appearance:none;border:1px solid #2a2a2e;background:#1c1c1e;color:#f2f2f2;border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;font-weight:650;cursor:pointer}" +
      "#cheapFuel .cf-chip[aria-pressed='true']{background:#1e3a2f;border-color:#14532d;color:#bbf7d0}" +
      "#cheapFuel .cf-go{display:block;width:100%;margin-top:14px;box-sizing:border-box;border:0;border-radius:16px;padding:14px 16px;font:inherit;font-size:16px;font-weight:700;background:#14532d;color:#fff;text-align:center;text-decoration:none;cursor:pointer}" +
      "#cheapFuel .cf-go[aria-disabled='true'],#cheapFuel .cf-go:disabled{opacity:.45;pointer-events:none}" +
      "#cheapFuel .cf-mapbtn{display:block;width:100%;margin-top:8px;box-sizing:border-box;border:1px solid #2a2a2e;border-radius:16px;padding:13px 16px;font:inherit;font-size:16px;font-weight:650;background:#1c1c1e;color:#f2f2f2;text-align:center;cursor:pointer}" +
      "#cheapFuel .cf-mapbtn:disabled{opacity:.45;cursor:default}" +
      "#cheapFuel .cf-find{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}" +
      "#cheapFuel .cf-find button{appearance:none;border:0;background:none;color:#8ab4ff;font:inherit;font-size:14px;font-weight:650;padding:0;cursor:pointer}" +
      "#cheapFuel .cf-pc{display:flex;gap:8px;margin-top:10px}" +
      "#cheapFuel .cf-pc input{flex:1;min-width:0;border:1px solid #2a2a2e;border-radius:12px;background:#0b0c0e;color:#f2f2f2;padding:10px 12px;font:inherit;font-size:16px}" +
      "#cheapFuel .cf-pc button{appearance:none;border:1px solid #2a2a2e;border-radius:12px;background:#1c1c1e;color:#f2f2f2;padding:10px 14px;font:inherit;font-size:14px;font-weight:650;cursor:pointer}" +
      "#cheapFuel .cf-status{margin:10px 0 0;font-size:13px;color:#8a8a8e;min-height:1.2em}" +
      "#cheapFuel .cf-status.bad{color:#f2b8b5}" +
      "#cheapFuel .cf-more{margin-top:12px;border-top:1px solid #2a2a2e;padding-top:8px}" +
      "#cheapFuel .cf-more summary{cursor:pointer;font-size:14px;font-weight:650;color:#c7c7cc;list-style:none}" +
      "#cheapFuel .cf-more summary::-webkit-details-marker{display:none}" +
      "#cheapFuel .cf-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid #2a2a2e;font-size:14px}" +
      "#cheapFuel .cf-row:first-child{border-top:0}" +
      "#cheapFuel .cf-sub{display:block;color:#8a8a8e;font-size:13px;margin-top:3px;font-weight:400}" +
      "#cheapFuel .cf-dir{color:#8ab4ff;text-decoration:none;font-weight:650;white-space:nowrap;flex-shrink:0;padding-top:2px}" +
      "#cheapFuel .cf-stale{color:#e6c07b}" +
      "#cheapFuel a.cf-place{color:#8ab4ff;text-decoration:none;font-weight:650}" +
      "#cheapFuel a.cf-place:hover{text-decoration:underline}" +
      "#cheapFuel .cf-empty{color:#8a8a8e;font-size:14px;margin:8px 0 0}" +
      "#cfSheet{position:fixed;inset:0;z-index:80;background:#0b0c0e;display:flex;flex-direction:column}" +
      "#cfSheet[hidden]{display:none!important}" +
      "#cfSheet .cf-sheet-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 12px;border-bottom:1px solid #2a2a2e;background:#141416}" +
      "#cfSheet .cf-sheet-bar p{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em}" +
      "#cfSheet .cf-sheet-bar button{appearance:none;border:0;background:none;color:#8ab4ff;font:inherit;font-size:16px;font-weight:650;cursor:pointer;padding:4px 0}" +
      "#cfMap{flex:1;min-height:0;width:100%;background:#0b0c0e}" +
      "#cheapFuel .cf-you{width:16px;height:16px;border-radius:50%;background:#8ab4ff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(138,180,255,.28)}" +
      "#cheapFuel .cf-pin{appearance:none;border:1px solid #3a3a3e;background:#1c1c1e;color:#f2f2f2;border-radius:999px;padding:5px 8px;font:inherit;font-size:11px;font-weight:750;letter-spacing:-.02em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);line-height:1.1}" +
      "#cheapFuel .cf-pin-best{background:#14532d;border-color:#22c55e;color:#fff}" +
      "#cheapFuel .maplibregl-popup{z-index:30}" +"#cheapFuel .maplibregl-marker{z-index:1}" +"#cheapFuel .maplibregl-popup-content{background:#141416;color:#f2f2f2;border:1px solid #2a2a2e;border-radius:14px;padding:12px 14px 12px;box-shadow:0 8px 24px rgba(0,0,0,.45)}" +
      "#cheapFuel .maplibregl-popup-tip{border-top-color:#141416}" +
      "#cheapFuel .maplibregl-popup-close-button{color:#c7c7cc;font-size:18px;padding:0 6px}" +
      "#cheapFuel .cf-pop .cf-place{display:block}" +
      "#cheapFuel .cf-pop .cf-place strong{display:block;font-size:15px;line-height:1.35}" +
      "#cheapFuel .cf-pop-meta{margin:8px 0 0;font-size:13px;color:#c7c7cc}" +
      "#cheapFuel .cf-pop-go{margin-top:10px;padding:11px 14px;font-size:15px}";
    document.head.appendChild(css);
  }

  function setMiles(n) {
    state.miles = n;
    root.querySelectorAll(".cf-chip").forEach(function (b) {
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-miles")) === n));
    });
  }

  function renderIdle() {
    cheapest = null;
    others = [];
    $("cfPrice").textContent = "—";
    $("cfMeta").textContent = "Prices for " + fuelLabel() + " near you.";
    $("cfGo").setAttribute("aria-disabled", "true");
    $("cfGo").removeAttribute("href");
    $("cfMapBtn").disabled = true;
    $("cfMore").hidden = true;
    $("cfList").innerHTML = "";
  }

  function placeLink(s, inner) {
    return "<a class='cf-place' href='" + esc(placeUrl(s)) + "' target='_blank' rel='noopener'>" + inner + "</a>";
  }

  function renderResult() {
    if (!cheapest) {
      $("cfPrice").textContent = "—";
      $("cfMeta").textContent = "No stations with " + fuelLabel() + " within " + state.miles + " miles.";
      $("cfGo").setAttribute("aria-disabled", "true");
      $("cfGo").removeAttribute("href");
      $("cfMapBtn").disabled = true;
      $("cfMore").hidden = true;
      $("cfList").innerHTML = "";
      updateMapIfOpen();
      return;
    }
    $("cfPrice").textContent = fmtPrice(cheapest.price) + "p";
    var when = fmtWhen(cheapest.updated, cheapest.stale);
    $("cfMeta").innerHTML = placeLink(cheapest, esc(stationName(cheapest))) +
      (when ? ("<span class='" + (cheapest.stale ? " cf-stale" : "") + "'> · " + esc(when) + "</span>") : "");
    $("cfGo").href = mapsUrl(cheapest);
    $("cfGo").removeAttribute("aria-disabled");
    $("cfMapBtn").disabled = false;
    if (!others.length) {
      $("cfMore").hidden = true;
      $("cfList").innerHTML = "";
    } else {
      $("cfMore").hidden = false;
      $("cfMoreSum").textContent = "More nearby (" + others.length + ")";
      $("cfList").innerHTML = others.map(function (s) {
        var whenS = fmtWhen(s.updated, s.stale);
        return "<div class='cf-row'><div>" +
          placeLink(s, "<b>" + esc(stationName(s)) + "</b>") + " " + fmtPrice(s.price) + "p" +
          (whenS ? "<span class='cf-sub" + (s.stale ? " cf-stale" : "") + "'>" + esc(whenS) + "</span>" : "") +
          "</div><a class='cf-dir' href='" + esc(mapsUrl(s)) + "' target='_blank' rel='noopener'>Directions</a></div>";
      }).join("");
    }
    updateMapIfOpen();
  }

  function circleGeoJSON(lat, lng, miles) {
    var R = 3958.7613;
    var coords = [];
    var lat1 = lat * Math.PI / 180;
    var lon1 = lng * Math.PI / 180;
    var ang = miles / R;
    for (var i = 0; i <= 64; i++) {
      var brng = (i / 64) * 2 * Math.PI;
      var lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brng));
      var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
      coords.push([lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  }
  function circleBounds(lat, lng, miles) {
    var latD = miles / MILES_PER_DEG_LAT;
    var lngD = miles / (Math.cos(lat * Math.PI / 180) * 69.172);
    return [[lng - lngD, lat - latD], [lng + lngD, lat + latD]];
  }
  function allStations() {
    var list = [];
    if (cheapest) list.push(cheapest);
    return list.concat(others);
  }

  function loadMapLibre() {
    if (window.maplibregl) return Promise.resolve();
    if (loadMapLibre.p) return loadMapLibre.p;
    loadMapLibre.p = new Promise(function (resolve, reject) {
      if (!document.querySelector("link[data-cf-maplibre]")) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = ML_CSS;
        link.setAttribute("data-cf-maplibre", "1");
        document.head.appendChild(link);
      }
      var s = document.createElement("script");
      s.src = ML_JS;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("map")); };
      document.head.appendChild(s);
    });
    return loadMapLibre.p;
  }

  function clearMarkers() {
    if (popup) { try { popup.remove(); } catch (e) {} popup = null; }
    markers.forEach(function (m) { try { m.remove(); } catch (e) {} });
    markers = [];
  }

  function popupHTML(s) {
    var where = fullAddress(s);
    return "<div class='cf-pop'>" +
      placeLink(s, "<strong>" + esc(stationName(s)) + "</strong>" +
        (where ? "<span class='cf-sub'>" + esc(where) + "</span>" : "")) +
      "<p class='cf-pop-meta'>" + fmtPrice(s.price) + "p" +
        (s.updated ? " · " + esc(fmtWhen(s.updated, s.stale)) : "") + "</p>" +
      "<a class='cf-go cf-pop-go' href='" + esc(mapsUrl(s)) + "' target='_blank' rel='noopener'>Directions</a>" +
      "</div>";
  }

  function showPopup(s) {
    if (!map || s.lat == null || s.lng == null) return;
    if (popup) { try { popup.remove(); } catch (e) {} }
    popup = new maplibregl.Popup({ offset: 18, className: "cf-popwrap", maxWidth: "280px", closeButton: true })
      .setLngLat([Number(s.lng), Number(s.lat)])
      .setHTML(popupHTML(s))
      .addTo(map);
  }

  function paintMap() {
    if (!map || !mapReady || !last) return;
    var miles = Number(state.miles) || 5;
    var gj = circleGeoJSON(last.lat, last.lng, miles);
    if (map.getSource("cf-radius")) {
      map.getSource("cf-radius").setData(gj);
    } else {
      map.addSource("cf-radius", { type: "geojson", data: gj });
      map.addLayer({
        id: "cf-radius-fill", type: "fill", source: "cf-radius",
        paint: { "fill-color": "#14532d", "fill-opacity": 0.08 }
      });
      map.addLayer({
        id: "cf-radius-line", type: "line", source: "cf-radius",
        paint: { "line-color": "#22c55e", "line-width": 1.5, "line-opacity": 0.5 }
      });
    }
    map.fitBounds(circleBounds(last.lat, last.lng, miles), { padding: 36, duration: 0, maxZoom: 14 });
    clearMarkers();
    var you = document.createElement("div");
    you.className = "cf-you";
    you.title = last.label || "You";
    markers.push(new maplibregl.Marker({ element: you, anchor: "center" })
      .setLngLat([last.lng, last.lat]).addTo(map));
    allStations().forEach(function (s, i) {
      if (s.lat == null || s.lng == null) return;
      var best = i === 0;
      var el = document.createElement("button");
      el.type = "button";
      el.className = "cf-pin" + (best ? " cf-pin-best" : "");
      el.textContent = fmtPrice(s.price) + "p";
      el.setAttribute("aria-label", stationName(s) + ", " + fmtPrice(s.price) + "p");
      el.style.zIndex = best ? "2" : "1";
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        showPopup(s);
      });
      markers.push(new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([Number(s.lng), Number(s.lat)]).addTo(map));
    });
    var sheet = $("cfSheet");
    if (sheet) {
      sheet.dataset.miles = String(miles);
      sheet.dataset.pins = String(root.querySelectorAll(".cf-pin").length);
      try {
        var b = map.getBounds();
        sheet.dataset.span = String((b.getNorth() - b.getSouth()).toFixed(5));
        sheet.dataset.ready = "1";
      } catch (e) {}
    }
    var title = $("cfSheetTitle");
    if (title) title.textContent = "Within " + miles + " miles";
  }

  function updateMapIfOpen() {
    var sheet = $("cfSheet");
    if (!sheet || sheet.hidden || !map) return;
    var run = function () { map.resize(); paintMap(); };
    if (mapReady) run();
    else map.once("load", run);
  }

  function closeSheet() {
    var sheet = $("cfSheet");
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function showSheet() {
    var sheet = $("cfSheet");
    if (!sheet || !last) return;
    sheet.hidden = false;
    sheet.dataset.ready = "0";
    $("cfSheetTitle").textContent = "Within " + state.miles + " miles";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    loadMapLibre().then(function () {
      return new Promise(function (ok) {
        requestAnimationFrame(function () { requestAnimationFrame(ok); });
      });
    }).then(function () {
      if (!map) {
        map = new maplibregl.Map({
          container: $("cfMap"),
          style: TILE_STYLE,
          center: [last.lng, last.lat],
          zoom: 11,
          attributionControl: true
        });
        root.__cfMap = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", function () {
          mapReady = true;
          paintMap();
        });
      } else {
        map.resize();
        if (mapReady) paintMap();
        else map.once("load", function () { mapReady = true; paintMap(); });
      }
    }).catch(function () {
      say("The map could not load.", "bad");
    });
  }

  function viewMap() {
    function go() {
      if (!last) { say("Allow location or type a postcode first."); return; }
      if (!cheapest && !others.length) {
        say("No stations with " + fuelLabel() + " within " + state.miles + " miles. Try a wider search.");
        return;
      }
      showSheet();
    }
    if (last && (cheapest || others.length)) { go(); return; }
    say("Finding stations…");
    ensurePlace().then(function (p) { return search(p.lat, p.lng, p.label); }).then(go).catch(function (err) {
      if (err && err.code === "no-geo") {
        say("Allow location, or type a postcode.");
        $("cfPc").focus();
        return;
      }
      say((err && err.message) || "Could not find stations.", "bad");
    });
  }

  function endpoint() {
    var base = (window.MOT_PROXY || "").replace(/\/+$/, "");
    return base ? base + "/fuel" : "";
  }

  function search(lat, lng, label) {
    var url = endpoint();
    if (!url) {
      say("Fuel search is not configured.", "bad");
      return Promise.resolve();
    }
    last = { lat: lat, lng: lng, label: label || "" };
    say("Finding " + fuelLabel() + " near " + (label || "you") + "…");
    var q = url + "?lat=" + encodeURIComponent(lat) + "&lng=" + encodeURIComponent(lng) +
      "&miles=" + encodeURIComponent(state.miles) + "&fuel=" + encodeURIComponent(fuelParam());
    return fetch(q).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; }).catch(function () {
        throw new Error("Fuel search failed.");
      });
    }).then(function (res) {
      if (!res.ok) throw new Error((res.j && res.j.error) || "Fuel search failed.");
      var stations = (res.j && res.j.stations) || [];
      cheapest = stations[0] || null;
      others = stations.slice(1);
      renderResult();
      if (cheapest) {
        say((res.j.count || stations.length) + " stations within " + state.miles + " miles" +
          (label ? " of " + label : "") + ".");
      } else {
        say("No stations with " + fuelLabel() + " within " + state.miles + " miles. Try a wider search.");
      }
    }).catch(function (err) {
      cheapest = null;
      others = [];
      renderResult();
      say((err && err.message) || "Fuel search failed.", "bad");
    });
  }

  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject(new Error("Location is not available on this phone.")); return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location" });
      }, function () { reject(new Error("Could not read your location.")); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 });
    });
  }

  function lookupPostcode(raw) {
    var pc = String(raw || "").trim();
    if (!pc) return Promise.reject(new Error("Type a postcode."));
    return fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(pc)).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      var r = res.j && res.j.result;
      if (!res.ok || !r) throw new Error("We could not find that postcode.");
      return { lat: r.latitude, lng: r.longitude, label: r.postcode || pc.toUpperCase() };
    });
  }

  function ensurePlace() {
    if (last) return Promise.resolve(last);
    return locate().catch(function () {
      var err = new Error("location");
      err.code = "no-geo";
      throw err;
    });
  }

  function takeMe(ev) {
    if (!cheapest) {
      if (ev) ev.preventDefault();
      say("Finding the cheapest station…");
      ensurePlace().then(function (p) { return search(p.lat, p.lng, p.label); }).then(function () {
        if (cheapest) window.open(mapsUrl(cheapest), "_blank", "noopener");
      }).catch(function (err) {
        if (err && err.code === "no-geo") {
          say("Allow location, or type a postcode to find cheap fuel nearby.");
          $("cfPc").focus();
          return;
        }
        say((err && err.message) || "Could not find stations.", "bad");
      });
    }
  }

  function onKey(ev) {
    if (ev.key === "Escape") closeSheet();
  }

  function boot() {
    injectStyle();
    var f = carFuel();
    if (f === "electric") {
      root.innerHTML = "<p class='cf-kicker'>Fuel</p><p class='cf-empty'>This car is electric, so there is no pump search here.</p>";
      return;
    }
    root.innerHTML =
      "<p class='cf-kicker'>Cheapest " + fuelLabel() + " nearby</p>" +
      "<p class='cf-price' id='cfPrice'>—</p>" +
      "<p class='cf-meta' id='cfMeta'>Prices for " + fuelLabel() + " near you.</p>" +
      "<div class='cf-chips' role='group' aria-label='Search radius'>" +
        [3, 5, 10, 20].map(function (n) {
          return "<button type='button' class='cf-chip' data-miles='" + n + "' aria-pressed='" + (n === state.miles) + "'>" + n + " miles</button>";
        }).join("") +
      "</div>" +
      "<a class='cf-go' id='cfGo' target='_blank' rel='noopener' aria-disabled='true'>Take me to the cheapest</a>" +
      "<button type='button' class='cf-mapbtn' id='cfMapBtn' disabled>View on map</button>" +
      "<div class='cf-find'><button type='button' id='cfLoc'>Use my location</button></div>" +
      "<div class='cf-pc'><input id='cfPc' type='text' inputmode='text' autocomplete='postal-code' spellcheck='false' placeholder='Or type a postcode' aria-label='Postcode'><button type='button' id='cfPcBtn'>Find</button></div>" +
      "<p class='cf-status' id='cfStatus'></p>" +
      "<details class='cf-more' id='cfMore' hidden><summary id='cfMoreSum'>More nearby</summary><div id='cfList'></div></details>" +
      "<div id='cfSheet' hidden role='dialog' aria-modal='true' aria-labelledby='cfSheetTitle'>" +
        "<div class='cf-sheet-bar'><p id='cfSheetTitle'>Nearby stations</p><button type='button' id='cfSheetClose'>Close</button></div>" +
        "<div id='cfMap' role='application' aria-label='Map of nearby stations'></div>" +
      "</div>";

    root.querySelectorAll(".cf-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = Number(btn.getAttribute("data-miles"));
        setMiles(n);
        if (last) search(last.lat, last.lng, last.label);
      });
    });
    $("cfGo").addEventListener("click", takeMe);
    $("cfMapBtn").addEventListener("click", viewMap);
    $("cfSheetClose").addEventListener("click", closeSheet);
    document.addEventListener("keydown", onKey);
    $("cfLoc").addEventListener("click", function () {
      say("Finding your location…");
      locate().then(function (p) { return search(p.lat, p.lng, p.label); }).catch(function (err) {
        say((err && err.message) || "Could not read your location.", "bad");
      });
    });
    $("cfPcBtn").addEventListener("click", function () {
      lookupPostcode($("cfPc").value).then(function (p) { return search(p.lat, p.lng, p.label); }).catch(function (err) {
        say((err && err.message) || "We could not find that postcode.", "bad");
      });
    });
    $("cfPc").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); $("cfPcBtn").click(); }
    });
  }

  boot();
})();
