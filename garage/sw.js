self.addEventListener("install", function(e){
  e.waitUntil(caches.open("dipstick-v4").then(function(c){
    return c.addAll(["./home.html","./index.html","./service.html","./manifest.json","./icon.svg","./ncap.js","./ncap-url.js","./home-ratings.js"]);
  }));
  self.skipWaiting();
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!=="dipstick-v4"}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch", function(e){
  if(/prices\.json/.test(e.request.url)){
    e.respondWith(fetch(e.request,{cache:"no-store"}));
    return;
  }
  e.respondWith(fetch(e.request).catch(function(){ return caches.match(e.request); }));
});
