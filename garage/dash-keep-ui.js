/* Trac3 Dashcam: the Clips storage sheet (gt.dashKeep via dash-keep.js) and the short hint under Start. */
(function(){
  var K=window.D3DashKeep; if(!K) return;
  var $=function(id){ return document.getElementById(id); }, sheet=$("keepSheet");
  function paintIcons(){ document.querySelectorAll("#keepBtn [data-k],#keepWarn [data-k]").forEach(function(el){ if(!el.firstChild&&window.dipstickIcon) el.innerHTML=window.dipstickIcon(el.getAttribute("data-k"))||""; }); }
  function hint(){ var h=$("dcHint"); if(h&&!document.body.classList.contains("track")) h.textContent="Road camera. "+K.label()+"."; }
  function paint(){ var c=K.get();
    document.querySelectorAll("#keepOpts [data-mode]").forEach(function(b){ b.setAttribute("aria-checked",b.getAttribute("data-mode")===c.mode?"true":"false"); });
    $("keepDays").value=String(c.days); $("keepDaysRow").classList.toggle("hide",c.mode!=="save"); hint(); }
  function clipBytes(){ return new Promise(function(ok){ try{ var r=indexedDB.open("dipstick",2);
      r.onupgradeneeded=function(){ var d=r.result; if(!d.objectStoreNames.contains("files")) d.createObjectStore("files"); if(!d.objectStoreNames.contains("clips")) d.createObjectStore("clips"); };
      r.onsuccess=function(){ var d=r.result, n=0, c=0; if(!d.objectStoreNames.contains("clips")) return ok({n:0,c:0});
        var q=d.transaction("clips").objectStore("clips").openCursor(); q.onsuccess=function(e){ var cur=e.target.result; if(!cur) return ok({n:n,c:c}); var v=cur.value||{}; if(v.blob&&v.blob.size){ n+=v.blob.size; c++; } cur.continue(); }; q.onerror=function(){ ok({n:n,c:c}); }; };
      r.onerror=function(){ ok({n:0,c:0}); }; }catch(e){ ok({n:0,c:0}); } }); }
  async function space(){ var el=$("keepUse"), u=await clipBytes(), t=(u.c?u.c+(u.c>1?" clips use ":" clip uses ")+K.size(u.n):"No clips saved yet");
    try{ if(navigator.storage&&navigator.storage.estimate){ var e=await navigator.storage.estimate(); if(e&&e.quota) t+=" · about "+K.size(Math.max(0,e.quota-(e.usage||0)))+" free for the app"; } }catch(x){}
    el.textContent=t+". A 30-minute drive is roughly 1–2 GB."; }
  function open(){ paint(); sheet.classList.remove("hide"); space(); paintIcons(); var on=sheet.querySelector('[aria-checked="true"]'); if(on) on.focus(); }
  function close(){ sheet.classList.add("hide"); $("keepBtn").focus(); }
  $("keepBtn").addEventListener("click",open);
  $("keepDone").addEventListener("click",close);
  sheet.addEventListener("click",function(e){ if(e.target===sheet) close(); });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&!sheet.classList.contains("hide")) close(); });
  $("keepOpts").addEventListener("click",function(e){ var b=e.target.closest("[data-mode]"); if(!b) return; var m=b.getAttribute("data-mode"); K.set({mode:m}); paint(); });
  $("keepDays").addEventListener("change",function(){ K.set({days:+this.value}); paint(); });
  paint(); window.addEventListener("load",paintIcons);
})();
