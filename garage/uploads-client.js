/* Dipstick owner side of mechanic uploads.
   Each car in gt.garage gets upId (public, goes in the QR/link) and upKey (secret, never leaves this phone
   except in the X-Owner-Key header to the Worker, which only stores its SHA-256).
   Downloaded jobs go to IndexedDB "dipstick-uploads": store "jobs" (metadata) + "files" (blobs). */
(function(){
  var API = window.UPLOADS_API;
  function b64url(n){
    var a=new Uint8Array(n); crypto.getRandomValues(a);
    var s=""; for(var i=0;i<a.length;i++) s+=String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  async function sha256hex(s){
    var d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
    return Array.from(new Uint8Array(d)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");
  }
  function garage(){
    try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null"); if(s&&s.cars&&s.cars.length){ if(typeof s.i!=="number"||s.i<0||s.i>=s.cars.length) s.i=0; return s; }}catch(e){}
    return null;
  }
  function saveGarage(s){ localStorage.setItem("gt.garage",JSON.stringify(s)); }
  function cleanPlate(p){ return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  // Mechanic's per-file title (jobs from before titles existed fall back to the file name).
  function cleanTitle(v){ return String(v||"").replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g," ").replace(/\s+/g," ").trim().slice(0,80).trim(); }
  function fileTitle(f){ return (f&&cleanTitle(f.title))||(f&&f.name)||"File"; }
  function niceName(c){ return c.nick||c.name||cleanPlate(c.plate)||"Car"; }
  // Make sure the car at index i has an upload ID + owner key. Returns the car.
  function ensureIds(i){
    var s=garage(); if(!s) return null;
    if(typeof i!=="number") i=s.i;
    var c=s.cars[i]; if(!c) return null;
    if(!c.upId||!c.upKey){ c.upId=b64url(16); c.upKey=b64url(32); saveGarage(s); }
    return c;
  }
  function link(c){
    var u=new URL("upload.html",location.href);
    u.search="";u.hash="";
    u.searchParams.set("u",c.upId);
    if(c.plate) u.searchParams.set("p",cleanPlate(c.plate));
    u.searchParams.set("n",niceName(c));
    return u.toString();
  }
  async function api(path,opt){
    var r=await fetch(API+path,opt||{});
    if(!r.ok){ var m=""; try{m=(await r.json()).error}catch(e){} var err=new Error(m||("HTTP "+r.status)); err.status=r.status; throw err; }
    return r;
  }
  async function register(c){
    var h=await sha256hex(c.upKey);
    return (await api("/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uploadId:c.upId,ownerKeyHash:h})})).json();
  }
  // ---- IndexedDB ----
  var dbp=null;
  function db(){
    if(dbp) return dbp;
    dbp=new Promise(function(res,rej){
      var r=indexedDB.open("dipstick-uploads",1);
      r.onupgradeneeded=function(){
        var d=r.result;
        var j=d.createObjectStore("jobs",{keyPath:"id"}); j.createIndex("up","up");
        d.createObjectStore("files");
      };
      r.onsuccess=function(){res(r.result)}; r.onerror=function(){rej(r.error)};
    });
    return dbp;
  }
  function req2p(r){return new Promise(function(res,rej){r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
  async function getJob(id){ var d=await db(); return req2p(d.transaction("jobs").objectStore("jobs").get(id)); }
  async function jobsFor(upId){
    var d=await db(); var list=await req2p(d.transaction("jobs").objectStore("jobs").index("up").getAll(upId));
    return list.sort(function(a,b){return b.created-a.created});
  }
  async function getFile(jobId,key){ var d=await db(); return req2p(d.transaction("files").objectStore("files").get(jobId+"/"+key)); }
  async function saveJob(job,blobs){
    var d=await db();
    return new Promise(function(res,rej){
      var tx=d.transaction(["jobs","files"],"readwrite");
      blobs.forEach(function(b){ tx.objectStore("files").put({blob:b.blob,type:b.type,name:b.name,title:b.title||""}, job.id+"/"+b.key); });
      tx.objectStore("jobs").put(job);
      tx.oncomplete=function(){res()}; tx.onerror=function(){rej(tx.error)}; tx.onabort=function(){rej(tx.error||new Error("Storage full?"))};
    });
  }
  async function removeLocal(job){
    var d=await db();
    return new Promise(function(res,rej){
      var tx=d.transaction(["jobs","files"],"readwrite");
      (job.files||[]).forEach(function(f){ tx.objectStore("files").delete(job.id+"/"+f.key); });
      tx.objectStore("jobs").delete(job.id);
      tx.oncomplete=function(){res()}; tx.onerror=function(){rej(tx.error)};
    });
  }
  // Download every waiting job for one car into IndexedDB, then delete it from Cloudflare.
  async function checkCar(c){
    if(!c||!c.upId||!c.upKey) return {downloaded:0};
    var hdr={"X-Owner-Key":c.upKey};
    try{ var rg=await register(c); if(rg){ c.srvPaused=!!rg.paused; c.srvCode=!!rg.hasCode; } }catch(e){ if(e.status===409) throw new Error("This car's upload link belongs to someone else. Make a new link."); }
    var list=await (await api("/list/"+c.upId,{headers:hdr})).json();
    var n=0;
    for(var i=0;i<list.jobs.length;i++){
      var j=list.jobs[i];
      var have=await getJob(j.id);
      if(!have){
        var blobs=[];
        for(var k=0;k<j.files.length;k++){
          var f=j.files[k];
          var r=await api("/file/"+c.upId+"/"+j.id+"/"+f.key,{headers:hdr});
          var b=await r.blob();
          blobs.push({key:f.key,type:f.type,name:f.name,title:cleanTitle(f.title),blob:new Blob([b],{type:f.type})});
        }
        await saveJob({id:j.id,up:c.upId,plate:cleanPlate(c.plate),car:niceName(c),created:j.created,received:Date.now(),
          note:j.note||"",garage:j.garage||"",mechanic:j.mechanic||"",mileage:j.mileage,
          files:j.files.map(function(f){ return {key:f.key,name:f.name,type:f.type,size:f.size,title:cleanTitle(f.title)}; }),seen:false},blobs);
        n++;
      }
      // Safe to delete: everything is in IndexedDB now.
      await api("/job/"+c.upId+"/"+j.id,{method:"DELETE",headers:hdr});
    }
    return {downloaded:n};
  }
  async function checkAll(){
    var s=garage(); if(!s) return {downloaded:0,errors:[]};
    var total=0, errors=[];
    for(var i=0;i<s.cars.length;i++){
      var c=s.cars[i]; if(!c.upId) continue;
      try{ total+=(await checkCar(c)).downloaded; }catch(e){ errors.push(niceName(c)+": "+e.message); }
    }
    return {downloaded:total,errors:errors};
  }
  async function unseenCount(){
    var d=await db(); var all=await req2p(d.transaction("jobs").objectStore("jobs").getAll());
    return all.filter(function(j){return !j.seen}).length;
  }
  async function markSeen(upId){
    var list=await jobsFor(upId); var d=await db();
    var tx=d.transaction("jobs","readwrite");
    list.forEach(function(j){ if(!j.seen){ j.seen=true; tx.objectStore("jobs").put(j); } });
    return new Promise(function(res){tx.oncomplete=res;tx.onerror=res});
  }
  // ---- Phase 2 owner controls ----
  // Pause uploads / set or clear the 4-digit job code (server keeps only a salted hash; the code itself stays on this phone).
  async function setControls(i,body){
    var s=garage(); var c=s.cars[i]; if(!c||!c.upId) throw new Error("No upload link yet");
    var r=await (await api("/settings/"+c.upId,{method:"POST",headers:{"Content-Type":"application/json","X-Owner-Key":c.upKey},body:JSON.stringify(body)})).json();
    s=garage(); c=s.cars[i];
    c.upPaused=!!r.paused; c.srvCode=!!r.hasCode;
    if("code" in body){ if(body.code) c.upCode=String(body.code); else delete c.upCode; }
    saveGarage(s); return r;
  }
  async function retagLocal(oldId,newId){
    var d=await db(); var list=await req2p(d.transaction("jobs").objectStore("jobs").index("up").getAll(oldId));
    if(!list.length) return 0;
    return new Promise(function(res,rej){ var tx=d.transaction("jobs","readwrite");
      list.forEach(function(j){ j.up=newId; tx.objectStore("jobs").put(j); });
      tx.oncomplete=function(){res(list.length)}; tx.onerror=function(){rej(tx.error)}; });
  }
  // "New link": collect anything waiting, retire the old ID on the server (refused straight away), then make a fresh ID + key.
  // Pause and job code carry over to the new link.
  async function rotate(i){
    var s=garage(); var old=s.cars[i]; if(!old||!old.upId) throw new Error("No upload link yet");
    var got=(await checkCar(old)).downloaded;
    var hdr={"X-Owner-Key":old.upKey};
    var ret=await (await api("/retire/"+old.upId,{method:"POST",headers:hdr})).json();
    if(ret.pending) got+=(await checkCar(old)).downloaded; // something arrived mid-way: collect it with the old key
    var oldId=old.upId;
    s=garage(); var c=s.cars[i];
    c.upId=b64url(16); c.upKey=b64url(32);
    (c.upOld=c.upOld||[]).push(oldId); if(c.upOld.length>10) c.upOld=c.upOld.slice(-10);
    saveGarage(s);
    await retagLocal(oldId,c.upId);
    await register(c);
    var body={}; if(c.upPaused) body.paused=true; if(c.upCode) body.code=c.upCode;
    if(Object.keys(body).length) await setControls(i,body);
    return {car:garage().cars[i],downloaded:got};
  }
  window.DipUploads={setControls:setControls,rotate:rotate,api:API,garage:garage,ensureIds:ensureIds,link:link,register:register,checkCar:checkCar,checkAll:checkAll,
    jobsFor:jobsFor,getFile:getFile,removeLocal:removeLocal,unseenCount:unseenCount,markSeen:markSeen,niceName:niceName,cleanPlate:cleanPlate,fileTitle:fileTitle,cleanTitle:cleanTitle};
})();
