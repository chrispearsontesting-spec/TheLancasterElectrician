/* Backup reminder: 7 days after the first car is added, if there is still no backup.
   "Later" waits another 7 days. Once a backup exists it stops; it comes back only if the
   last backup is over 60 days old and a lot has changed since (cheap size check).
   Keys (new, all gt.*): gt.firstUse (ms), gt.bkRemind ({next:ms}), gt.bkSize (chars at last backup).
   The Android app also schedules a local notification from due() (native-shim.js). */
(function(root){
  "use strict";
  var DAY=864e5, FIRST=7*DAY, SNOOZE=7*DAY, STALE=60*DAY;
  var ID=990001;
  var TEXT={
    title:"Back up Trac3",
    body:"Your car’s history, documents and reminders live only on this phone. If it’s lost, broken or replaced, a backup is the only way to get them back. It takes 30 seconds.",
    staleTitle:"Time for a fresh backup",
    staleBody:"Lots has changed since your last backup. Your car’s history, documents and reminders live only on this phone, so a fresh backup keeps them safe. It takes 30 seconds."
  };
  function num(v){ var n=+v; return isFinite(n)&&n>0?n:0; }
  function json(v){ try{ return JSON.parse(v||"null"); }catch(e){ return null; } }
  /* Cheap "how much is here" figure: total characters in the app's gt.* keys. */
  function sizeOf(get, keys){
    var n=0; keys.forEach(function(k){ if(/^gt\./.test(k)&&!/^gt\.(lock|lockTries|lastBackup|bkRemind|bkSize|firstUse|bkNudge)$/.test(k)) n+=(get(k)||"").length; }); return n;
  }
  function changedALot(size, base){ if(!base) return true; return size-base>=Math.max(50000, base*0.25); }
  /* s: {hasCar, firstUse, lastBackup, snooze, size, baseSize}. Returns {at, kind} or null. */
  function due(s){
    if(!s||!s.hasCar||!s.firstUse) return null;
    var snooze=num(s.snooze);
    if(!num(s.lastBackup)) return {at:Math.max(s.firstUse+FIRST, snooze), kind:"first"};
    if(!changedALot(s.size||0, num(s.baseSize))) return null;
    return {at:Math.max(num(s.lastBackup)+STALE, snooze), kind:"stale"};
  }
  var core={due:due,changedALot:changedALot,sizeOf:sizeOf,DAY:DAY,FIRST:FIRST,SNOOZE:SNOOZE,STALE:STALE,ID:ID,TEXT:TEXT};
  if(typeof module!=="undefined"&&module.exports){ module.exports=core; return; }

  var ls=root.localStorage;
  function now(){ return root.__d3Now?root.__d3Now():Date.now(); }   // tests can mock the clock
  function keys(){ var a=[]; for(var i=0;i<ls.length;i++) a.push(ls.key(i)); return a; }
  function hasCar(){ var g=json(ls.getItem("gt.garage")); return !!(g&&g.cars&&g.cars.length); }
  /* First use = the first time Trac3 sees a car on this phone. */
  function markFirstUse(){ try{ if(hasCar()&&!num(ls.getItem("gt.firstUse"))) ls.setItem("gt.firstUse",String(now())); }catch(e){} }
  function state(){
    markFirstUse();
    var r=json(ls.getItem("gt.bkRemind"))||{};
    return {hasCar:hasCar(), firstUse:num(ls.getItem("gt.firstUse")), lastBackup:num(ls.getItem("gt.lastBackup")),
      snooze:num(r.next), size:sizeOf(function(k){ return ls.getItem(k); }, keys()), baseSize:num(ls.getItem("gt.bkSize"))};
  }
  function current(){ var d=due(state()); if(!d) return null; d.title=d.kind==="stale"?TEXT.staleTitle:TEXT.title; d.body=d.kind==="stale"?TEXT.staleBody:TEXT.body; d.id=ID; return d; }
  function later(){ try{ ls.setItem("gt.bkRemind",JSON.stringify({next:now()+SNOOZE})); }catch(e){} }
  /* Called by Security & backup after a backup file is saved. */
  function backedUp(at){
    try{ ls.setItem("gt.bkSize",String(sizeOf(function(k){ return ls.getItem(k); }, keys()))); ls.removeItem("gt.bkRemind"); }catch(e){}
  }
  function show(d){
    var doc=root.document; if(doc.getElementById("bkRemind")) return;
    var el=doc.createElement("div"); el.id="bkRemind"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-labelledby","bkRemindT");
    el.innerHTML='<style>#bkRemind{position:fixed;inset:0;z-index:55;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:12px 12px calc(16px + env(safe-area-inset-bottom))}'+
      '#bkRemind .p{width:100%;max-width:440px;background:#141416;border:1px solid #2a2a2e;border-radius:20px;padding:18px 16px 14px;color:#f2f2f2}'+
      '#bkRemind h2{margin:8px 0 6px;font-size:19px;letter-spacing:-.01em}#bkRemind p{margin:0 0 8px;color:#b9b9b9;font-size:14.5px;line-height:1.45}'+
      '#bkRemind .ic{width:44px;height:44px;border-radius:50%;background:#101a22;border:1px solid #23425a;display:flex;align-items:center;justify-content:center;color:#7dd3fc}'+
      '#bkRemind .ic svg{width:24px;height:24px;fill:currentColor}'+
      '#bkRemind .go{background:#7dd3fc !important;background-image:none !important;color:#0b0c0e !important;justify-content:center !important}#bkRemind .later{justify-content:center !important}</style>'+
      '<div class="p"><div class="ic">'+((root.dipstickIcon&&root.dipstickIcon("shield"))||"")+'</div><h2 id="bkRemindT"></h2><p id="bkRemindB"></p>'+
      '<a class="btn wide go" href="security.html#bkCard" id="bkRemindGo">Back up now</a><button class="btn wide later" type="button" id="bkRemindLater">Later</button></div>';
    el.querySelector("#bkRemindT").textContent=d.title; el.querySelector("#bkRemindB").textContent=d.body;
    doc.body.appendChild(el);
    function close(){ el.remove(); if(root.driv3Reschedule) try{ root.driv3Reschedule(); }catch(e){} }
    el.querySelector("#bkRemindLater").onclick=function(){ later(); close(); };
    el.querySelector("#bkRemindGo").addEventListener("click",function(){ later(); });  // if they leave without saving, ask again in 7 days
    el.addEventListener("click",function(e){ if(e.target===el){ later(); close(); } });
  }
  /* In-app: the next time Trac3 opens on or after the due day. */
  function check(){
    try{
      var d=current(); if(!d||now()<d.at) return null;
      if(root.document.querySelector(".sheet.on,#d3lock")) return null;
      show(d); return d;
    }catch(e){ return null; }
  }
  root.D3BackupRemind={core:core,current:current,check:check,later:later,backedUp:backedUp,markFirstUse:markFirstUse,state:state};
})(typeof window!=="undefined"?window:globalThis);
