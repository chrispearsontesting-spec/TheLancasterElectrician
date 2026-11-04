/* Driv3 service worker: works offline without pinning phones to old versions.
   - HTML pages: network first (3.5 s timeout), fall back to the saved copy, then offline.html.
   - Same-origin assets (js/css/images/fonts/vendor): stale-while-revalidate, keyed on the full URL incl. ?v=.
   - prices.json / other data JSON: network first, saved copy when offline.
   - Never touched: non-GET, cross-origin (MOT/DVLA proxy, uploads Worker, maps, fuel APIs), /garage/proxy/, /garage/uploads-worker/.
   Bump VERSION on each release that changes this file; old caches are deleted on activate. */
"use strict";
var VERSION = "2026-11-04c";
var CACHE = "driv3-" + VERSION;
var RUNTIME = CACHE;
var SCOPE = new URL("./", self.location).href;
var PAGES = ["home.html","index.html","offline.html","buy.html","calendar.html","dashcam.html","drive.html","insurance.html","jobs.html",
  "mechanic.html","mot.html","performance.html","privacy.html","reminders.html","renew.html","report.html","route.html","security.html",
  "service.html","share.html","show.html","showcase-edit.html","tax.html","upload.html","view.html"];
var EXTRA = ["manifest.json","favicon.ico","icon.svg","icon-192.png","icon-512.png","icon-512-maskable.png","apple-touch-icon.png","carbon.png","audi-silver.svg","prices.json","mpg-meta.json",
  "sticker/sticker.js","sticker/frame-black.png","sticker/frame-white.png","sticker/geist-mono-id.woff",
  "badges/audi-rs3.svg","badges/audi-rs4.svg","badges/audi-rs6.svg","badges/audi-s3.svg","badges/audi-s4.svg","badges/bmw-m2.svg","badges/bmw-m3.svg",
  "badges/bmw-m4.svg","badges/bmw-m5.svg","badges/bmw-m6.svg","badges/ford-rs.svg","badges/ford-st.svg","badges/mercedes-amg.svg","badges/vw-gti.svg","badges/vw-r.svg"];
var NET_TIMEOUT = 3500;

function abs(u){ return new URL(u, SCOPE).href; }
function ours(url){ return url.indexOf(SCOPE) === 0 && !/\/garage\/(proxy|uploads-worker|tools)\//.test(url); }
function isData(url){ var p = new URL(url).pathname; return /\.json$/.test(p) && !/manifest\.json$/.test(p); }

/* Local src/href in a page (scripts, styles, icons, images). Big vendor files are left to cache on first use. */
function refs(html, base){
  var out = [], re = /(?:src|href)\s*=\s*["']([^"'#]+)["']/gi, m;
  while((m = re.exec(html))){
    var u; try{ u = new URL(m[1], base).href; }catch(e){ continue; }
    if(!ours(u) || /\.html(\?|$)/.test(u) || /\/vendor\//.test(u)) continue;
    out.push(u);
  }
  return out;
}

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    var assets = EXTRA.map(abs);
    return Promise.all(PAGES.map(function(p){
      var u = abs(p);
      return fetch(u, {cache:"no-cache"}).then(function(r){
        if(!r.ok) return;
        return r.clone().text().then(function(t){ assets = assets.concat(refs(t, u)); return c.put(u, r); });
      }).catch(function(){});
    })).then(function(){
      var uniq = assets.filter(function(u,i){ return assets.indexOf(u) === i; });
      return Promise.all(uniq.map(function(u){
        return fetch(u, {cache:"no-cache"}).then(function(r){ if(r.ok) return c.put(u, r); }).catch(function(){});
      }));
    });
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return /^driv3-/.test(k) && k !== CACHE && k !== RUNTIME; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function put(req, res){
  if(res && res.ok && res.type === "basic"){ var copy = res.clone(); caches.open(RUNTIME).then(function(c){ c.put(req, copy); }); }
  return res;
}
function fromCache(req, loose){
  return caches.match(req).then(function(r){ return r || (loose ? caches.match(req, {ignoreSearch:true}) : undefined); });
}
function networkFirst(req, isPage){
  return new Promise(function(resolve){
    var done = false;
    function fallback(){
      if(done) return; done = true;
      fromCache(req, true).then(function(r){
        resolve(r || (isPage ? caches.match(abs("offline.html")) : new Response("", {status:504, statusText:"Offline"})));
      });
    }
    var t = setTimeout(fallback, NET_TIMEOUT);
    fetch(req).then(function(res){
      put(isPage ? new Request(req.url.split("#")[0]) : req, res);
      clearTimeout(t);
      if(done) return; done = true; resolve(res);
    }).catch(function(){ clearTimeout(t); fallback(); });
  });
}
function staleWhileRevalidate(e){
  var req = e.request;
  var net = fetch(req).then(function(res){ return put(req, res); });
  e.waitUntil(net.then(function(){}, function(){}));
  return fromCache(req, false).then(function(hit){
    return hit || net.catch(function(){ return fromCache(req, true).then(function(r){ return r || new Response("", {status:504, statusText:"Offline"}); }); });
  });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET" || !ours(req.url) || req.headers.has("range")) return;
  if(req.mode === "navigate" || /\.html(\?|$)/.test(new URL(req.url).pathname + "?")){ e.respondWith(networkFirst(req, req.mode === "navigate")); return; }
  if(isData(req.url)){ e.respondWith(networkFirst(req, false)); return; }
  e.respondWith(staleWhileRevalidate(e));
});
