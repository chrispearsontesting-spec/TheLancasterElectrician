/* Snapshot garage data into the Android widget plugin, and honour open= deep links.
   No-ops in the browser when Driv3Widget is missing. */
(function(){
  "use strict";
  var ACCENT = {blue:"#7dd3fc",green:"#86efac",red:"#fca5a5",orange:"#fdba74",white:"#f1f5f9"};
  var going = false, timer = null;

  function plugin(){
    try {
      var C = window.Capacitor;
      if (!C || !C.Plugins || !C.Plugins.Driv3Widget) return null;
      return C.Plugins.Driv3Widget;
    } catch (e) { return null; }
  }

  function safePage(p){
    return p && /^[a-z0-9.-]+\.html$/i.test(p) ? p : null;
  }

  function consumeOpen(){
    var W = plugin();
    if (!W || !W.getPendingOpen || going) return;
    W.getPendingOpen().then(function(r){
      var dest = r && safePage(r.page);
      if (!dest) return;
      var here = (location.pathname || "").split("/").pop() || "";
      if (here === dest) return;
      going = true;
      location.replace(dest);
    }).catch(function(){});
  }

  function carOf(s){
    if (!s || !s.cars || !s.cars.length) return {};
    var i = typeof s.i === "number" && s.i >= 0 && s.i < s.cars.length ? s.i : 0;
    return s.cars[i] || {};
  }

  function shrinkPhoto(dataUrl, done){
    if (!dataUrl || dataUrl.indexOf("data:") !== 0) { done(null); return; }
    try {
      var img = new Image();
      img.onload = function(){
        try {
          var w = img.width, h = img.height, max = 480;
          if (w > max) { h = Math.max(1, Math.round(h * max / w)); w = max; }
          var cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          done(cv.toDataURL("image/jpeg", 0.8));
        } catch (e) { done(null); }
      };
      img.onerror = function(){ done(null); };
      img.src = dataUrl;
    } catch (e) { done(null); }
  }

  function payload(photo){
    var s = {};
    try { s = JSON.parse(localStorage.getItem("gt.garage") || "null") || {}; } catch (e) {}
    var c = carOf(s);
    var accentName = "blue";
    try { accentName = localStorage.getItem("gt.accent") || "blue"; } catch (e) {}
    var fuelLast = null;
    try { fuelLast = JSON.parse(localStorage.getItem("gt.fuelLast") || "null"); } catch (e) {}
    var fuelType = "";
    try {
      var pref = localStorage.getItem("gt.fuelPref") || "";
      var f = String(c.fuel || pref || "").toLowerCase();
      if (/diesel/.test(f)) fuelType = "diesel";
      else if (/petrol|unleaded|gasoline/.test(f)) fuelType = "petrol";
      else if (fuelLast && fuelLast.fuel) fuelType = fuelLast.fuel;
    } catch (e) {}
    var o = {
      plate: c.plate || "",
      nick: c.nick || c.name || "",
      accent: ACCENT[accentName] || ACCENT.blue,
      mot: c.mot || "",
      tax: c.tax || "",
      ins: c.ins || c.insurance || "",
      service: c.oil || "",
      fuelType: fuelType || "diesel"
    };
    if (fuelLast && fuelLast.lat != null && fuelLast.lng != null) {
      o.lat = Number(fuelLast.lat);
      o.lng = Number(fuelLast.lng);
      if (fuelLast.label) o.postcode = String(fuelLast.label);
    }
    if (photo) o.photo = photo;
    return o;
  }

  function sync(){
    var W = plugin();
    if (!W || !W.snapshot) return;
    var s = {};
    try { s = JSON.parse(localStorage.getItem("gt.garage") || "null") || {}; } catch (e) {}
    var c = carOf(s);
    shrinkPhoto(c.photo, function(photo){
      W.snapshot(payload(photo)).catch(function(){});
    });
  }

  function queue(){
    clearTimeout(timer);
    timer = setTimeout(sync, 250);
  }

  try {
    var set = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(k, v){
      set(k, v);
      if (k === "gt.garage" || k === "gt.accent" || k === "gt.fuelPref" || k === "gt.fuelLast") queue();
    };
  } catch (e) {}

  document.addEventListener("driv3:unlock", function(){ consumeOpen(); queue(); });
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) { consumeOpen(); queue(); } });
  window.addEventListener("pageshow", function(){ consumeOpen(); queue(); });

  function boot(){
    consumeOpen();
    queue();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(boot, 50); setTimeout(boot, 400); });
  else { setTimeout(boot, 50); setTimeout(boot, 400); }

  window.Driv3WidgetSync = sync;
})();
