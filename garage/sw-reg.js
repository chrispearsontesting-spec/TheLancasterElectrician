/* Driv3: register the offline service worker (scope /garage/) and show a small banner when there is no signal. */
(function(){
  "use strict";
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")){
    navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"}).then(function(r){
      document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="visible") r.update().catch(function(){}); });
    }).catch(function(){});
  }
  var bar=null;
  function show(){
    if(navigator.onLine){ if(bar) bar.style.display="none"; return; }
    if(!bar){ bar=document.createElement("div"); bar.setAttribute("role","status");
      bar.style.cssText="position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;background:#1a1c20;color:#f2f2f2;border:1px solid #2c2f35;border-radius:999px;padding:8px 14px;font:600 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:92vw;text-align:center;pointer-events:none";
      bar.textContent="Offline: live MOT and fuel prices unavailable"; (document.body||document.documentElement).appendChild(bar); }
    bar.style.display="";
  }
  addEventListener("online",show); addEventListener("offline",show);
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",show); else show();
})();
