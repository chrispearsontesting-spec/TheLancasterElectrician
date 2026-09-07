self.addEventListener("install", function(e){
  e.waitUntil(caches.open("dipstick-v1").then(function(c){
    return c.addAll(["./home.html","./index.html","./service.html","./manifest.json","./icon.svg"]);
  }));
  self.skipWaiting();
});
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(e){
  e.respondWith(fetch(e.request).catch(function(){ return caches.match(e.request); }));
});
