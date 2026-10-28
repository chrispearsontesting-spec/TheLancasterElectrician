/* Driv3 Show mode, owner side. Needs uploads-config.js + uploads-client.js first.
   Draft (text) lives in localStorage "gt.showDrafts" keyed by car.showLocal; photos/clips live in IndexedDB "driv3-show"
   (store "media": {blob,type,n,sid}). Both are included in the encrypted backup automatically.
   The car keeps showId (public) + showKey (secret, the Worker only stores its SHA-256). */
(function(){
  var API=window.UPLOADS_API, U=window.DipUploads;
  var LIM={gallery:12,videos:12,socials:12,mods:40,clipBytes:20*1024*1024,photoBytes:1.5*1024*1024};
  function rid(){ var a=new Uint8Array(9); crypto.getRandomValues(a); return Array.from(a).map(function(b){return b.toString(16).padStart(2,"0")}).join(""); }
  function drafts(){ try{ return JSON.parse(localStorage.getItem("gt.showDrafts")||"{}")||{}; }catch(e){ return {}; } }
  function carAt(i){ var s=U.garage(); return s&&s.cars[i]; }
  function localId(i){
    var s=U.garage(), c=s.cars[i];
    if(!c.showLocal){ c.showLocal=rid(); localStorage.setItem("gt.garage",JSON.stringify(s)); }
    return c.showLocal;
  }
  function blank(c){
    return {title:"",basics:{make:c.make||"",model:c.model||(c.make?"":(c.nick||c.name||"")),variant:"",year:c.year||"",colour:c.colour||c.color||"",plate:U.cleanPlate(c.plate),hidePlate:false},
      stats:{bhp:"",torque:"",zero60:"",top:"",weight:"",best:{time:"",label:"",venue:""}},mods:[],story:"",gallery:[],hero:0,videos:[],socials:[],playlist:"",instagram:"",clips:[]};
  }
  function getDraft(i){ var c=carAt(i); var d=drafts()[localId(i)]||blank(c);
    d.videos=(d.videos||[]).map(function(v){ return typeof v==="string"?{url:v,title:""}:v; }); d.socials=d.socials||[]; return d; }
  function saveDraft(i,d){ var all=drafts(); d.saved=Date.now(); all[localId(i)]=d; localStorage.setItem("gt.showDrafts",JSON.stringify(all)); }
  // ---- media store ----
  var dbp=null;
  function db(){
    if(dbp) return dbp;
    dbp=new Promise(function(res,rej){ var r=indexedDB.open("driv3-show",1);
      r.onupgradeneeded=function(){ r.result.createObjectStore("media"); };
      r.onsuccess=function(){res(r.result)}; r.onerror=function(){rej(r.error)}; });
    return dbp;
  }
  function p(r){return new Promise(function(res,rej){r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
  async function getMedia(id){ var d=await db(); return p(d.transaction("media").objectStore("media").get(id)); }
  async function putMedia(id,rec){ var d=await db(); return p(d.transaction("media","readwrite").objectStore("media").put(rec,id)); }
  async function delMedia(id){ var d=await db(); return p(d.transaction("media","readwrite").objectStore("media").delete(id)); }
  async function addMedia(blob){ var id=rid(); await putMedia(id,{blob:blob,type:blob.type,n:null,sid:null}); return id; }
  // Re-compress a photo: max 1600px long edge, JPEG ~200 KB. Drawing to a canvas drops EXIF (GPS, phone model).
  async function compress(file){
    var bmp;
    try{ bmp=await createImageBitmap(file,{imageOrientation:"from-image"}); }
    catch(e){ bmp=await new Promise(function(res,rej){ var im=new Image(); im.onload=function(){res(im)}; im.onerror=function(){rej(new Error("Can't read that photo"))}; im.src=URL.createObjectURL(file); }); }
    var w=bmp.width, h=bmp.height, edge=1600, out=null;
    for(var round=0;round<3&&!out;round++){
      var sc=Math.min(1,edge/Math.max(w,h)), cv=document.createElement("canvas");
      cv.width=Math.max(1,Math.round(w*sc)); cv.height=Math.max(1,Math.round(h*sc));
      var g=cv.getContext("2d"); g.fillStyle="#000"; g.fillRect(0,0,cv.width,cv.height); g.drawImage(bmp,0,0,cv.width,cv.height);
      for(var q=0.82;q>=0.5;q-=0.08){
        var b=await new Promise(function(res){cv.toBlob(res,"image/jpeg",q)});
        if(b&&b.size<=220*1024){ out=b; break; }
        if(q-0.08<0.5&&round===2) out=b;
      }
      edge=Math.round(edge*0.8);
    }
    if(bmp.close) bmp.close();
    return out;
  }
  // ---- server ----
  async function api(path,opt){
    var r=await fetch(API+path,opt||{});
    if(!r.ok){ var m=""; try{m=(await r.json()).error}catch(e){} var err=new Error(m||("HTTP "+r.status)); err.status=r.status; throw err; }
    return r;
  }
  function setCar(i,f){ var s=U.garage(), c=s.cars[i]; f(c); localStorage.setItem("gt.garage",JSON.stringify(s)); return c; }
  async function ensureShow(i,fresh){
    var c=carAt(i);
    if(c.showId&&c.showKey&&!fresh) return c;
    var r=await (await api("/show",{method:"POST"})).json();
    return setCar(i,function(c){ c.showId=r.showId; c.showKey=r.showKey; });
  }
  async function sendMedia(c,id,kind){
    var rec=await getMedia(id); if(!rec) return null;
    if(rec.n&&rec.sid===c.showId) return rec.n;
    var r=await (await api("/show/"+c.showId+"/"+kind,{method:"POST",headers:{"X-Show-Key":c.showKey,"Content-Type":rec.type||"application/octet-stream"},body:rec.blob})).json();
    rec.n=r.name; rec.sid=c.showId; await putMedia(id,rec); return r.name;
  }
  // Publish (or update): upload new media, then the card. A dead key (after Unpublish) starts a fresh showcase.
  async function publish(i,say){
    say=say||function(){};
    var d=getDraft(i), c;
    for(var attempt=0;attempt<2;attempt++){
      c=await ensureShow(i,attempt===1);
      try{
        var gal=[], clips=[], done=0, total=d.gallery.filter(function(g){return g.m}).length+d.clips.length;
        for(var k=0;k<d.gallery.length;k++){
          var g=d.gallery[k];
          if(g.m){ say("Uploading photo "+(++done)+" of "+total+"…"); var n=await sendMedia(c,g.m,"photo"); if(n) gal.push({n:n,cap:g.cap||""}); }
          else if(g.url) gal.push({url:g.url,cap:g.cap||""});
        }
        for(var j=0;j<d.clips.length;j++){ say("Uploading clip…"); var cn=await sendMedia(c,d.clips[j].m,"clip"); if(cn) clips.push({n:cn,cap:d.clips[j].cap||""}); }
        say("Publishing…");
        var card={title:d.title,basics:d.basics,stats:d.stats,mods:d.mods,story:d.story,gallery:gal,hero:d.hero,videos:d.videos.filter(function(v){return v.url}),socials:d.socials.filter(function(v){return v.url}),playlist:d.playlist,instagram:d.instagram,clips:clips};
        var r=await (await api("/show/"+c.showId,{method:"PUT",headers:{"X-Show-Key":c.showKey,"Content-Type":"application/json"},body:JSON.stringify(card)})).json();
        setCar(i,function(c){ c.showPublished=Date.now(); });
        // Keep the sticker pointing at this showcase (and register the link if this car never had one).
        c=U.ensureIds(i);
        try{ await U.register(c); }catch(e){}
        await U.setMode(i,carAt(i).upMode==="show"?"show":"mechanic");
        return r;
      }catch(e){ if(e.status===401&&attempt===0) continue; throw e; }
    }
  }
  async function unpublish(i){
    var c=carAt(i); if(!c.showId) return;
    try{ await api("/show/"+c.showId,{method:"DELETE",headers:{"X-Show-Key":c.showKey}}); }catch(e){ if(e.status!==401) throw e; }
    setCar(i,function(c){ delete c.showPublished; });
  }
  async function status(i){
    var c=carAt(i); if(!c||!c.showId) return {published:false};
    try{ var r=await fetch(API+"/show/"+c.showId,{cache:"no-store"}); return {published:r.ok}; }catch(e){ return {published:!!c.showPublished,offline:true}; }
  }
  window.Driv3Show={LIM:LIM,getDraft:getDraft,saveDraft:saveDraft,getMedia:getMedia,addMedia:addMedia,delMedia:delMedia,compress:compress,publish:publish,unpublish:unpublish,status:status};
})();
