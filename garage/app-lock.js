/* Driv3 app lock: a light PRIVACY SCREEN for the web version (not encryption).
   Include early in <head> on owner pages only (never upload.html / report.html).
   localStorage "gt.lock"     = {v:1, kind:"pin", len, salt(b64), iter, hash(b64)}  - salted PBKDF2-SHA256, never the PIN
   localStorage "gt.lockTries"= {n, until, rounds}                                - wrong-try backoff
   sessionStorage "d3.unlock" = "1" while unlocked this session; "d3.hiddenAt" = ms when the app went to background.
   Biometric-ready: a native wrap (Capacitor) can call Driv3Lock.setProvider({name:"Fingerprint", available:()=>Promise<bool>,
   unlock:()=>Promise<bool>}) and the overlay offers it before the number pad. All lock logic lives in this one file. */
(function(root){
  "use strict";
  var KEY="gt.lock", TRIES="gt.lockTries", ITER=200000, RELOCK_MS=5*60000, MAX_TRIES=5, BASE_WAIT=30000;
  var enc=new TextEncoder();
  function b64(u8){ var s=""; for(var i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s){ return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)}); }
  async function derive(pin,salt,iter){
    var k=await crypto.subtle.importKey("raw",enc.encode(String(pin)),"PBKDF2",false,["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:salt,iterations:iter},k,256));
  }
  function same(a,b){ if(a.length!==b.length) return false; var x=0; for(var i=0;i<a.length;i++) x|=a[i]^b[i]; return x===0; }
  function validPin(p){ return /^\d{4,6}$/.test(String(p)); }
  async function makeRecord(pin,iter){
    if(!validPin(pin)) throw new Error("The PIN must be 4 to 6 digits.");
    var salt=crypto.getRandomValues(new Uint8Array(16)); iter=iter||ITER;
    return {v:1,kind:"pin",len:String(pin).length,salt:b64(salt),iter:iter,hash:b64(await derive(pin,salt,iter))};
  }
  async function check(rec,pin){ return !!rec&&validPin(pin)&&same(await derive(pin,unb64(rec.salt),rec.iter),unb64(rec.hash)); }
  // Backoff: after every 5 wrong tries wait 30 s, then 60 s, 120 s ... (max 1 hour).
  function nextTries(t,ok,now){
    t=t||{n:0,until:0,rounds:0}; if(ok) return {n:0,until:0,rounds:0};
    var n=t.n+1;
    if(n>=MAX_TRIES) return {n:0,until:now+Math.min(BASE_WAIT*Math.pow(2,t.rounds||0),3600000),rounds:(t.rounds||0)+1};
    return {n:n,until:t.until||0,rounds:t.rounds||0};
  }
  var core={derive:derive,makeRecord:makeRecord,check:check,nextTries:nextTries,validPin:validPin,ITER:ITER,RELOCK_MS:RELOCK_MS,MAX_TRIES:MAX_TRIES,BASE_WAIT:BASE_WAIT};
  if(typeof module!=="undefined"&&module.exports){ module.exports=core; return; }

  // ---------------- browser ----------------
  var doc=root.document, ls=root.localStorage, ss=root.sessionStorage;
  function J(k,s){ try{ return JSON.parse((s||ls).getItem(k)||"null"); }catch(e){ return null; } }
  function rec(){ var r=J(KEY); return r&&r.hash?r:null; }
  function isOn(){ return !!rec(); }
  function unlocked(){
    if(ss.getItem("d3.unlock")!=="1") return false;
    var h=+ss.getItem("d3.hiddenAt")||0;
    if(h&&Date.now()-h>RELOCK_MS){ ss.removeItem("d3.unlock"); return false; }
    return true;
  }
  var provider=null, el=null, entry="", busy=false, timer=null;
  var css='html.d3lk,html.d3lk body{overflow:hidden!important}html.d3lk body>*:not(#d3lock){visibility:hidden!important}'+
    '#d3lock{position:fixed;inset:0;z-index:2147483000;background:#0b0c0e;color:#f2f2f2;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px calc(24px + env(safe-area-inset-bottom));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;visibility:visible!important}'+
    '#d3lock .t{font-size:20px;font-weight:650;margin:10px 0 4px;letter-spacing:-.02em}#d3lock .s{font-size:13.5px;color:#8b8b8b;min-height:20px;text-align:center;max-width:320px;line-height:1.4}'+
    '#d3lock .ico{width:46px;height:46px;border-radius:50%;background:#161618;border:1px solid #2a2a2e;display:flex;align-items:center;justify-content:center}'+
    '#d3lock .dots{display:flex;gap:14px;margin:22px 0 26px;height:16px}#d3lock .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #555;display:block}#d3lock .dots i.on{background:#f2f2f2;border-color:#f2f2f2}'+
    '#d3lock .dots.bad{animation:d3sh .35s}@keyframes d3sh{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}'+
    '#d3lock .pad{display:grid;grid-template-columns:repeat(3,76px);gap:14px 22px}#d3lock .pad button{width:76px;height:76px;border-radius:50%;background:#161618;border:1px solid #26262a;color:#f2f2f2;font-size:28px;font-weight:500;font-family:inherit;-webkit-tap-highlight-color:transparent;padding:0}'+
    '#d3lock .pad button:active{background:#2a2a2e}#d3lock .pad button.k{background:none;border:0;font-size:15px;color:#b0b0b0}#d3lock .pad button:disabled{opacity:.35}'+
    '#d3lock .lnk{background:none;border:0;color:#8ab4ff;font-size:14px;margin-top:22px;padding:8px;font-family:inherit}'+
    '#d3lock .bio{margin-bottom:14px;background:#161618;border:1px solid #2a2a2e;color:#f2f2f2;border-radius:999px;padding:10px 18px;font-size:15px;font-family:inherit}'+
    '#d3lock .help{max-width:360px;font-size:14px;line-height:1.5;color:#c8c8c8}#d3lock .help p{margin:0 0 10px}#d3lock .help a{color:#8ab4ff}';
  function addStyle(){ if(doc.getElementById("d3lockcss")) return; var s=doc.createElement("style"); s.id="d3lockcss"; s.textContent=css; (doc.head||doc.documentElement).appendChild(s); }
  var LOCK_SVG='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f2f2f2" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  function build(){
    if(el) return;
    el=doc.createElement("div"); el.id="d3lock"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-label","Driv3 is locked");
    var keys=[1,2,3,4,5,6,7,8,9].map(function(n){return '<button type="button" data-n="'+n+'">'+n+'</button>'}).join("");
    el.innerHTML='<div class="ico">'+LOCK_SVG+'</div><div class="t">Enter your Driv3 PIN</div><div class="s" id="d3msg"></div>'+
      '<button type="button" class="bio" id="d3bio" style="display:none"></button>'+
      '<div class="dots" id="d3dots"></div><div class="pad">'+keys+'<span></span><button type="button" data-n="0">0</button><button type="button" class="k" data-n="del" aria-label="Delete">Delete</button></div>'+
      '<button type="button" class="lnk" id="d3forgot">Forgot PIN?</button>';
    el.addEventListener("click",function(e){ var b=e.target.closest("button"); if(!b) return;
      if(b.id==="d3forgot") return forgot(); if(b.id==="d3bio") return bio(); if(b.id==="d3back") return pad();
      var n=b.getAttribute("data-n"); if(n==null) return; if(n==="del") entry=entry.slice(0,-1); else press(n); dots(); });
    if(!api._kd) api._kd=doc.addEventListener("keydown",function(e){ if(!el||!el.parentNode) return; if(/^\d$/.test(e.key)) { press(e.key); dots(); } else if(e.key==="Backspace"){ entry=entry.slice(0,-1); dots(); } })||1;
  }
  function msg(t){ var m=doc.getElementById("d3msg"); if(m) m.textContent=t||""; }
  function dots(bad){ var d=doc.getElementById("d3dots"); if(!d) return; var r=rec(), n=r?r.len:4, h="";
    for(var i=0;i<n;i++) h+='<i class="'+(i<entry.length?"on":"")+'"></i>'; d.innerHTML=h;
    if(bad){ d.classList.remove("bad"); void d.offsetWidth; d.classList.add("bad"); } }
  function waitLeft(){ var t=J(TRIES); return t&&t.until>Date.now()?t.until-Date.now():0; }
  function setPad(on){ el.querySelectorAll(".pad button").forEach(function(b){ b.disabled=!on; }); }
  function tick(){
    clearTimeout(timer); var w=waitLeft();
    if(w>0){ setPad(false); msg("Too many wrong tries. Try again in "+Math.ceil(w/1000)+" seconds."); timer=setTimeout(tick,1000); }
    else { setPad(true); var t=J(TRIES); if(t&&t.n) msg((MAX_TRIES-t.n)+" tr"+(MAX_TRIES-t.n===1?"y":"ies")+" left before a wait."); else if(/seconds/.test((doc.getElementById("d3msg")||{}).textContent||"")) msg(""); }
  }
  function press(n){
    var r=rec(); if(busy||!r||waitLeft()>0||entry.length>=r.len) return;
    entry+=n; if(entry.length===r.len){ dots(); submit(entry); }
  }
  async function submit(pin){
    busy=true; msg("Checking…"); var r=rec(), ok=false;
    try{ ok=await check(r,pin); }catch(e){}
    ls.setItem(TRIES,JSON.stringify(nextTries(J(TRIES),ok,Date.now())));
    busy=false; entry="";
    if(ok){ unlock(); return; }
    dots(true); msg("Wrong PIN."); setTimeout(tick,600);
  }
  function unlock(){ ss.setItem("d3.unlock","1"); ss.removeItem("d3.hiddenAt"); clearTimeout(timer);
    doc.documentElement.classList.remove("d3lk"); if(el&&el.parentNode) el.parentNode.removeChild(el); entry="";
    try{ root.dispatchEvent(new CustomEvent("driv3:unlock")); }catch(e){} }
  function forgot(){
    clearTimeout(timer);
    el.innerHTML='<div class="ico">'+LOCK_SVG+'</div><div class="t">Forgot your PIN?</div><div class="help">'+
      '<p>This PIN is a light privacy screen for the web version of Driv3. It stops someone casually opening the app on your phone. It does not encrypt your data.</p>'+
      '<p>There is no reset by email, because nothing is stored on a server. The only way past it is to clear Driv3\'s data in your browser: in Brave, open Settings, Site settings, find thelancasterelectrician.com and clear its data.</p>'+
      '<p><b>That deletes your cars, history and photos on this phone.</b> If you made a Driv3 backup file, you can restore everything afterwards from Security &amp; backup on the home page. Without a backup the data is gone.</p></div>'+
      '<button type="button" class="lnk" id="d3back">Back to PIN</button>';
  }
  function pad(){ var p=el.parentNode; if(p) p.removeChild(el); el=null; build(); show(); }
  async function bio(){ if(!provider) return; try{ if(await provider.unlock()) unlock(); else msg("Not recognised. Use your PIN."); }catch(e){ msg("Use your PIN."); } }
  function show(){
    addStyle(); build(); doc.documentElement.classList.add("d3lk");
    if(!el.parentNode){ if(doc.body) doc.body.appendChild(el); else doc.addEventListener("DOMContentLoaded",function(){ if(doc.documentElement.classList.contains("d3lk")) doc.body.appendChild(el); }); }
    entry=""; dots(); tick();
    var b=doc.getElementById("d3bio");
    if(provider&&b){ Promise.resolve(provider.available()).then(function(ok){ if(ok){ b.style.display=""; b.textContent="Use "+(provider.name||"fingerprint"); } }).catch(function(){}); }
  }
  function lockNow(){ ss.removeItem("d3.unlock"); if(isOn()) show(); }
  function guard(){ if(isOn()&&!unlocked()) show(); }
  doc.addEventListener("visibilitychange",function(){
    if(doc.visibilityState==="hidden"){ if(isOn()) ss.setItem("d3.hiddenAt",String(Date.now())); }
    else { if(isOn()&&!unlocked()) show(); else ss.removeItem("d3.hiddenAt"); }
  });
  root.addEventListener("pageshow",function(e){ if(e.persisted) guard(); });
  var api={
    isOn:isOn, lockNow:lockNow, guard:guard,
    // Turn on / change: needs the current PIN when one is set. Returns true on success.
    setPin:async function(pin,current){ if(isOn()&&!(await check(rec(),current))) throw new Error("The current PIN isn't right."); ls.setItem(KEY,JSON.stringify(await makeRecord(pin))); ls.removeItem(TRIES); ss.setItem("d3.unlock","1"); return true; },
    disable:async function(current){ if(isOn()&&!(await check(rec(),current))) throw new Error("The current PIN isn't right."); ls.removeItem(KEY); ls.removeItem(TRIES); return true; },
    verify:function(pin){ return check(rec(),pin); },
    setProvider:function(p){ provider=p; }, core:core
  };
  root.Driv3Lock=api;
  if(root.Driv3LockProvider) provider=root.Driv3LockProvider;
  guard();
})(typeof window!=="undefined"?window:globalThis);
