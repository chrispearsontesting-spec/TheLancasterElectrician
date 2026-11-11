/* Driv3 Car showcase: "My car" (private summary) / "Show view" (public card preview) switch + gallery.
   Read only - nothing is moved or deleted. Media for the selected car:
   - Showcase photos/clips: gt.showDrafts + IndexedDB driv3-show (Driv3Show)       [both views]
   - Showcase YouTube links: gt.showDrafts videos                                   [both views]
   - Home photo: gt.garage car.photo                                                 [My car]
   - Work done photos: gt.diy + IndexedDB dipstick files (D3Diy)                      [My car]
   - Mechanic upload photos: IndexedDB dipstick-uploads (DipUploads)                  [My car]
   - Old History photos: localStorage dipstick-history                               [My car]
   - Performance run videos: IndexedDB driv3-runs (PerfG)                             [My car]
   Money (My car only, never in Show view): Work done receipts (D3Diy.cost) + journey costs (gt.driveLog). */
(function(){
  var U=window.DipUploads, S=window.Driv3Show, P=window.Driv3Parse;
  var $=function(id){return document.getElementById(id)};
  function esc(x){ return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]}); }
  function rd(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)||"null"); return v==null?d:v; }catch(e){ return d; } }
  function vrn(p){ return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  function gbp(n){ return "£"+(n>=1000?Math.round(n).toLocaleString("en-GB"):(Math.round(n*100)/100).toFixed(n%1?2:0)); }
  var g=U&&U.garage(); if(!g||!g.cars||!g.cars.length) return;
  var idx=g.i, qi=parseInt(new URLSearchParams(location.search).get("car"),10); if(!isNaN(qi)&&g.cars[qi]) idx=qi; if(!g.cars[idx]) idx=0;
  var car=g.cars[idx], PL=vrn(car.plate);
  function owns(p){ return window.D3Car?D3Car.owns(p,PL):(!PL||!p||vrn(p)===PL); }
  var view=localStorage.getItem("gt.showcaseView")==="show"?"show":"mine", tab="photo";
  var urls=[]; function ou(b){ var u=URL.createObjectURL(b); urls.push(u); return u; }
  var gen=0; function revokeAll(){ urls.forEach(function(u){ try{URL.revokeObjectURL(u)}catch(e){} }); urls=[]; gen++; }
  window.addEventListener("pagehide",revokeAll);

  // ---------- collect media (items load lazily: get() -> Promise<{src,type}>) ----------
  var MEDIA={mine:{photo:[],video:[]},show:{photo:[],video:[]}}, workCount=0, jobs=[], diy=[];
  function blobItem(kind,cap,from,getBlob,when){ var c=null, cg=-1; return {kind:kind,cap:cap||"",from:from,when:when||0,get:function(){ if(c&&cg===gen) return c; cg=gen; c=Promise.resolve(getBlob()).then(function(b){ if(!b) return null; return {src:ou(b),type:b.type||(kind==="video"?"video/mp4":"image/jpeg")}; }).catch(function(){ c=null; return null; }); return c; }}; }
  function urlItem(kind,cap,from,src,type,when){ return {kind:kind,cap:cap||"",from:from,when:when||0,get:function(){ return Promise.resolve({src:src,type:type}); }}; }
  function ytItem(v){ var id=P&&P.youtubeId(v.url); if(!id) return null; return {kind:"video",yt:id,cap:v.title||"YouTube video",from:"Showcase",thumb:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",get:function(){ return Promise.resolve({src:"https://www.youtube-nocookie.com/embed/"+id+"?playsinline=1&rel=0",type:"yt"}); }}; }
  // Sharing: the show card draft (gt.showDrafts, per car) is the list of shared items. Items from other sources are copied into it
  // when ticked (entry.src = source key) and removed when unticked; the card's own photos/clips/links toggle entry.off.
  var D=null, bySrc={};
  function entryOf(it){ var arr=D[it.arr]||[]; for(var i=0;i<arr.length;i++){ var e=arr[i]; if((it.m&&e.m===it.m)||(!it.m&&it.url&&e.url===it.url)) return e; } return null; }
  function isShared(it){ if(it.arr){ var e=entryOf(it); return !!(e&&!e.off); } var c=bySrc[it.key]; return !!(c&&!c.off); }
  function draftItem(arr,e){ var it;
    if(arr==="videos"){ it=ytItem(e); if(!it) return null; it.url=e.url; }
    else if(e.m) it=blobItem(arr==="clips"?"video":"photo",e.cap,"Showcase"+(arr==="clips"?" clip":""),function(){ return S.getMedia(e.m).then(function(r){return r&&r.blob}); });
    else it=urlItem("photo",e.cap,"Showcase",e.url,"image/jpeg");
    it.arr=arr; it.m=e.m; it.url=it.url||e.url; it.key="show:"+(e.m||e.url); return it; }
  async function collect(){
    D=S.getDraft(idx); bySrc={};
    var sp=[], sv=[], mp=[], mv=[], seenPhoto={};
    ["gallery","clips","videos"].forEach(function(arr){ (D[arr]||[]).forEach(function(e,i){ if(!e) return; var it=draftItem(arr,e); if(!it) return;
      if(e.src){ bySrc[e.src]=e; it.from={"home":"Home","diy":"Work done","hist":"History","mech":"Mechanic","run":"Performance"}[e.src.split(":")[0]]||"Shared"; }
      var vid=arr!=="gallery";
      if(!e.off){ if(vid) sv.push(it); else { it.cover=i===D.hero; sp.push(it); } }
      if(!e.src){ if(vid) mv.push(it); else mp.push(it); } }); });
    MEDIA.show={photo:sp,video:sv};
    function src(it,key,blob){ it.key=key; it.blob=blob; return it; }
    if(car.photo){ mp.push(src(urlItem("photo","Home photo","Home",car.photo,"image/jpeg"),"home",function(){ return fetch(car.photo).then(function(r){return r.blob()}); })); }
    try{ diy=window.D3Diy?D3Diy.forPlate(car.plate):[]; }catch(e){ diy=[]; }
    diy.slice().sort(function(a,b){return String(b.date||"").localeCompare(String(a.date||""))}).forEach(function(w){ (w.files||[]).forEach(function(f){ if(f.kind==="photo"&&!seenPhoto[f.id]){ seenPhoto[f.id]=1; var g=function(){ return D3Diy.getBlob(f.id); }; mp.push(src(blobItem("photo",w.title||"Work done","Work done",g),"diy:"+f.id,g)); } }); });
    rd("dipstick-history",[]).forEach(function(it,i){ if(it&&/^image\//.test(it.type||"")&&it.data&&owns(it.plate)){ var key="hist:"+(it.ts||it.date||"")+":"+i; mp.push(src(urlItem("photo",it.note||"History photo","History",it.data,it.type),key,function(){ return fetch(it.data).then(function(r){return r.blob()}); })); } });
    if(U.allJobs){ try{ jobs=(await U.allJobs()).filter(function(j){ return (car.upId&&j.up===car.upId)||(PL&&j.plate===PL); }); }catch(e){ jobs=[]; } }
    jobs.forEach(function(j){ (j.files||[]).forEach(function(f){ var g=function(){ return U.getFile(j.id,f.key).then(function(r){return r&&r.blob}); }, k="mech:"+j.id+"/"+f.key;
      if(/^image\//.test(f.type)) mp.push(src(blobItem("photo",j.note||U.fileTitle(f),"Mechanic",g),k,g));
      if(/^video\//.test(f.type)) mv.push(src(blobItem("video",j.note||U.fileTitle(f),"Mechanic",g),k,g)); }); });
    if(window.PerfG){ try{ (await PerfG.list()).forEach(function(r){ if(r&&r.video&&owns(r.plate)){ var g=function(){ return r.video; }; mv.push(src(blobItem("video",(r.label||"Performance run")+(r.time?" · "+r.time+"s":""),"Performance",g,r.when),"run:"+r.id,g)); } }); }catch(e){} }
    MEDIA.mine={photo:mp,video:mv};
    workCount=diy.length+jobs.length;
  }
  var selfT=0; function saveD(){ selfT=Date.now(); S.saveDraft(idx,D); if(window.D3ShowcaseEditorReload) try{ window.D3ShowcaseEditorReload(); }catch(e){} }
  function sayG(t,bad){ var e=$("gSay"); if(!e) return; e.textContent=t||""; e.className="gsay"+(bad?" bad":""); clearTimeout(e._t); if(t) e._t=setTimeout(function(){ e.textContent=""; },5000); }
  // Tick / untick one item. Returns true if the state changed.
  async function setShared(it,on){
    D=S.getDraft(idx);
    if(it.arr){ var e=entryOf(it); if(!e) return false;
      if(!on&&e.src){ var A=D[it.arr], k=A.indexOf(e); A.splice(k,1); if(it.arr==="gallery"){ if(D.hero===k) D.hero=0; else if(D.hero>k) D.hero--; } saveD(); try{ await S.delMedia(e.m); }catch(x){} return true; }
      if(on&&it.arr==="clips"&&e.off){ var live=D.clips.filter(function(k){return !k.off}); if(live.length>=2){ sayG("2 clips max on the public card. Untick one first, or use a YouTube link.",true); return false; } } e.off=!on; saveD(); return true; }
    var cur=bySrc[it.key]&&D[it.kind==="video"?"clips":"gallery"].filter(function(e){return e.src===it.key})[0];
    if(!on){ if(!cur) return false; var arr=it.kind==="video"?D.clips:D.gallery, i=arr.indexOf(cur); arr.splice(i,1); if(it.kind!=="video"){ if(D.hero===i) D.hero=0; else if(D.hero>i) D.hero--; } saveD(); try{ await S.delMedia(cur.m); }catch(x){} return true; }
    if(cur){ cur.off=false; saveD(); return true; }
    var blob=null; try{ blob=await it.blob(); }catch(x){}
    if(!blob){ sayG("Couldn't read that one.",true); return false; }
    if(it.kind==="video"){
      var live=D.clips.filter(function(k){return !k.off});
      if(!/^video\/(mp4|webm)/.test(blob.type||"")){ sayG("Only MP4 or WebM videos can go on the public card.",true); return false; }
      if(live.length>=2){ sayG("2 video clips max on the public card. Untick one first. Longer videos: add a YouTube link.",true); return false; }
      var used=live.reduce(function(t,k){return t+(k.size||0)},0);
      if(used+blob.size>S.LIM.clipBytes){ sayG("Public clips must be under 20 MB together. This one's "+(blob.size/1048576).toFixed(1)+" MB. Use a YouTube link instead.",true); return false; }
      var id=await S.addMedia(blob); D=S.getDraft(idx); D.clips.push({m:id,cap:it.cap||"",size:blob.size,src:it.key}); saveD(); return true;
    }
    if(D.gallery.filter(function(g){return !g.off}).length>=S.LIM.gallery){ sayG("12 photos max on the public card. Untick one first.",true); return false; }
    sayG("Preparing photo…");
    var small=await S.compress(blob), pid=await S.addMedia(small); D=S.getDraft(idx); D.gallery.push({m:pid,cap:it.cap||"",src:it.key}); saveD(); sayG(""); return true;
  }
  async function moveShared(it,dir){ // reorder within the shared photos / clips / links
    D=S.getDraft(idx); var arrN=it.arr||(it.kind==="video"?"clips":"gallery"), arr=D[arrN], e=it.arr?entryOf(it):arr.filter(function(x){return x.src===it.key})[0]; if(!e) return;
    var i=arr.indexOf(e), j=i; do{ j+=dir; }while(j>=0&&j<arr.length&&arr[j].off);
    if(j<0||j>=arr.length) return; arr[i]=arr[j]; arr[j]=e; if(arrN==="gallery"){ if(D.hero===i) D.hero=j; else if(D.hero===j) D.hero=i; } saveD(); }
  function makeCover(it){ D=S.getDraft(idx); var e=it.arr?entryOf(it):D.gallery.filter(function(x){return x.src===it.key})[0]; var i=D.gallery.indexOf(e); if(i>=0){ D.gallery.splice(i,1); D.gallery.unshift(e); D.hero=0; saveD(); } }

  // ---------- page shell ----------
  var head=document.createElement("div");
  head.innerHTML=
    '<div class="vsw" id="vsw" role="tablist" aria-label="Showcase view"><button type="button" role="tab" id="vMine">My car</button><button type="button" role="tab" id="vShow">Show view<span class="pb">Public</span></button></div>'+
    '<div class="privBan" id="privBan">🔒 <span>Private — only you see this on your phone.</span></div>'+
    '<div class="pubBan vhide" id="pubBan">👁 <span id="pubBanTxt">What people see if they scan your sticker in Show mode, or open your link.</span></div>'+
    '<div class="gal"><div class="tabs" role="tablist"><button type="button" id="gPh" class="on">Photos<span class="n" id="nPh"></span></button><button type="button" id="gVi">Videos<span class="n" id="nVi"></span></button></div>'+
    '<div class="gframe l" id="gframe"><div class="stageWrap" id="stageWrap"><div class="stage" id="stage" aria-live="polite"></div><img class="gBrand hide" src="./driv3-wordmark.svg" alt="Driv3" id="gBrand"/><div class="gPlate hide" id="gPlate" aria-hidden="true"><span class="uk">UK</span><span class="reg" id="gPlateReg"></span></div></div><div class="gmeta"><b id="gCap"></b><span id="gPos"></span></div><div class="gctl" id="gCtl"></div><div class="gsay" id="gSay" aria-live="polite"></div><div class="strip" id="strip"></div></div></div>'+
    '<div id="mineBox"></div><div id="showBox" class="vhide"></div>';
  var h1=document.querySelector("body > h1"), lead=document.querySelector("body > p.lead");
  h1.parentNode.insertBefore(head,lead.nextSibling);
  // Switch at the very top, above the title.
  h1.parentNode.insertBefore($("vsw"),h1);
  // Existing editor (publish card + all edit cards + bar): kept as-is, shown in Show view.
  var wrap=document.createElement("div"); wrap.id="editWrap";
  var first=$("pubCard"), back=document.querySelector("body > a.btn[href='home.html']");
  first.parentNode.insertBefore(wrap,first);
  while(wrap.nextSibling&&wrap.nextSibling!==back&&wrap.nextSibling.tagName!=="SCRIPT") wrap.appendChild(wrap.nextSibling);
  var editHead=document.createElement("h2"); editHead.textContent="Edit your show card"; editHead.style.cssText="font-size:18px;margin:18px 0 8px"; wrap.insertBefore(editHead,wrap.firstChild);

  // ---------- gallery ----------
  var list=[], cur=0, io=null, stageT=null;
  function poster(it){ // first frame of a local video, small JPEG, cached on the item
    if(it.thumb) return Promise.resolve(it.thumb);
    if(it._poster) return it._poster;
    it._poster=it.get().then(function(m){ if(!m) return ""; return new Promise(function(res){
      var v=document.createElement("video"); v.muted=true; v.playsInline=true; v.preload="auto"; var done=false;
      function fin(x){ if(done) return; done=true; v.removeAttribute("src"); try{v.load()}catch(e){} res(x); }
      v.onloadeddata=function(){ try{ v.currentTime=Math.min(0.5,(v.duration||1)/3); }catch(e){ fin(""); } };
      v.onseeked=function(){ try{ var c=document.createElement("canvas"), s=160/Math.max(v.videoWidth||1,v.videoHeight||1); c.width=Math.round((v.videoWidth||160)*s); c.height=Math.round((v.videoHeight||90)*s); c.getContext("2d").drawImage(v,0,0,c.width,c.height); fin(c.toDataURL("image/jpeg",0.7)); }catch(e){ fin(""); } };
      v.onerror=function(){ fin(""); }; setTimeout(function(){ fin(""); },6000); v.src=m.src; }); });
    return it._poster;
  }
  function fill(sl){ // load the big slide's media
    if(!sl||sl._done) return; sl._done=true; var it=list[+sl.dataset.i]; sl.classList.add("ld");
    it.get().then(function(m){ sl.classList.remove("ld"); if(!m){ sl.innerHTML='<p class="note">Couldn\'t open this one.</p>'; return; }
      var el;
      if(m.type==="yt"){ el=document.createElement("iframe"); el.src=m.src; el.allow="encrypted-media; picture-in-picture; fullscreen"; el.setAttribute("allowfullscreen",""); el.title=it.cap; el.loading="lazy"; }
      else if(it.kind==="video"){ el=document.createElement("video"); el.controls=true; el.playsInline=true; el.preload="metadata"; el.src=m.src; poster(it).then(function(p){ if(p) el.poster=p; }); }
      else { el=document.createElement("img"); el.alt=it.cap||"Car photo"; el.decoding="async"; if(it.from!=="Showcase"||/^https?:/.test(m.src)) el.referrerPolicy="no-referrer"; el.src=m.src; }
      sl.appendChild(el); });
  }
  function select(i,scroll){
    if(!list.length) return; i=Math.max(0,Math.min(list.length-1,i)); var changed=i!==cur; cur=i;
    var st=$("stage"); [i-1,i,i+1].forEach(function(n){ fill(st.children[n]); });
    if(changed) st.querySelectorAll("video").forEach(function(v){ v.pause(); });
    if(changed) st.querySelectorAll("iframe").forEach(function(f){ if(f.parentNode!==st.children[i]){ var s=f.parentNode; s._done=false; s.innerHTML=""; } });
    if(scroll) st.scrollTo({left:i*st.clientWidth,behavior:Math.abs(st.scrollLeft-i*st.clientWidth)>st.clientWidth*1.5?"auto":"smooth"});
    $("strip").querySelectorAll("button").forEach(function(b,n){ b.classList.toggle("on",n===i); b.setAttribute("aria-current",n===i?"true":"false"); });
    var tb=$("strip").children[i]; if(tb){ var sp=$("strip"), x=tb.offsetLeft-sp.clientWidth/2+tb.offsetWidth/2; sp.scrollTo({left:x,behavior:"smooth"}); }
    var it=list[i]; $("gCap").textContent=it.cap||(it.kind==="video"?"Video":"Photo"); $("gPos").textContent=(view==="mine"&&it.from?it.from+" · ":"")+(i+1)+" / "+list.length;
    paintCtl();
  }
  var busy=false;
  function paintCtl(){
    var box=$("gCtl"), it=list[cur]; if(!box) return; if(!it){ box.innerHTML=""; return; }
    if(view==="mine"){ var on=isShared(it);
      box.innerHTML='<button type="button" class="shr'+(on?' on':'')+'" id="gShare" aria-pressed="'+on+'"><span class="tk">'+(on?'✓':'')+'</span>'+(on?'Shared in Show view':'Share in Show view')+'</button>';
      $("gShare").onclick=async function(){ if(busy) return; busy=true; this.disabled=true; var keep=cur, k=tab;
        try{ var ch=await setShared(it,!on); if(ch){ sayG(!on?"Shared. It's on your public card after you publish.":"Removed from Show view."+(car.showPublished?" Publish to update the live card.":"")); await relist(keep,k); } }
        catch(e){ sayG("Couldn't change that: "+e.message,true); }
        busy=false; var b=$("gShare"); if(b) b.disabled=false; };
    } else {
      var vids=tab==="video";
      box.innerHTML='<div class="mgr"><button type="button" data-a="l" aria-label="Move left">◀</button><button type="button" data-a="r" aria-label="Move right">▶</button>'+(vids?'':'<button type="button" data-a="c"'+(it.cover?' class="on"':'')+'>★ '+(it.cover?'Cover':'Make cover')+'</button>')+'<button type="button" data-a="x" class="x">Remove</button></div>';
      box.querySelectorAll("button").forEach(function(b){ b.onclick=async function(){ if(busy) return; busy=true; var a=b.dataset.a, keep=cur;
        try{ if(a==="l"){ await moveShared(it,-1); keep--; } if(a==="r"){ await moveShared(it,1); keep++; } if(a==="c"){ makeCover(it); keep=0; } if(a==="x"){ await setShared(it,false); sayG("Removed from Show view. It's still in My car."); }
          await relist(keep,tab); }catch(e){ sayG("Couldn't change that: "+e.message,true); } busy=false; }; });
    }
  }
  async function relist(keep,k){ await collect(); tab=k; if(view==="show") paintShow(); else paintMine(); paintGallery(); var st=$("stage"); if(list.length&&st.children.length){ keep=Math.max(0,Math.min(list.length-1,keep)); st.scrollLeft=keep*st.clientWidth; select(keep,false); } }
  function paintGallery(){
    if(io) io.disconnect();
    // Drop old object URLs (lists are rebuilt from the stores each time).
    revokeAll();
    var set=MEDIA[view]; list=set[tab]; cur=0;
    $("nPh").textContent=set.photo.length?" "+set.photo.length:""; $("nVi").textContent=set.video.length?" "+set.video.length:"";
    $("gPh").classList.toggle("on",tab==="photo"); $("gVi").classList.toggle("on",tab==="video");
    $("gPh").setAttribute("aria-selected",tab==="photo"); $("gVi").setAttribute("aria-selected",tab==="video");
    $("gframe").className="gframe "+(tab==="photo"?"l":"r");
    var st=$("stage"), sp=$("strip");
    if(!list.length){
      var add=view==="show"||tab==="photo";
      st.outerHTML='<div class="stage" id="stage"><div class="gempty" style="flex:1 0 100%">'+(tab==="photo"?"📷":"🎬")+'<div>'+(tab==="photo"?(view==="show"?"Nothing shared yet. Tick photos in My car to add them.":"No photos of this car yet."):(view==="show"?"No videos shared yet. Tick clips in My car, or add a YouTube link below.":"No videos yet. Performance runs and show clips appear here."))+'</div>'+(add?'<button class="btn small" type="button" id="gAdd">'+(tab==="photo"?"+ Add photos":"+ Add a clip")+'</button>':'<a class="btn small" href="performance.html">Record a run</a>')+'</div></div>';
      sp.innerHTML=""; $("gCap").textContent=""; $("gPos").textContent=""; $("gCtl").innerHTML="";
      var ga=$("gAdd"); if(ga) ga.onclick=function(){ (tab==="photo"?$("pick"):$("pickClip")).click(); };
      paintPlate();
      return;
    }
    var ns=document.createElement("div"); ns.className="stage"; ns.id="stage";
    ns.innerHTML=list.map(function(it,i){ return '<div class="sl" data-i="'+i+'"></div>'; }).join(""); st.replaceWith(ns); st=ns;
    sp.innerHTML=list.map(function(it,i){ return '<button type="button" data-i="'+i+'" aria-label="'+esc((it.kind==="video"?"Video ":"Photo ")+(i+1))+'"><img alt="" decoding="async"/>'+(it.kind==="video"?'<span class="play">▶</span>':'')+(view==="mine"&&isShared(it)?'<span class="sb" title="Shared in Show view">✓</span>':'')+(view==="show"&&it.cover?'<span class="sb cv">★</span>':'')+'</button>'; }).join("");
    io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(!e.isIntersecting) return; io.unobserve(e.target); var it=list[+e.target.dataset.i], im=e.target.querySelector("img");
      im.onload=function(){ im.classList.add("in"); };
      (it.kind==="video"?poster(it):it.get().then(function(m){return m&&m.src})).then(function(s){ if(s){ if(/^https?:/.test(s)) im.referrerPolicy="no-referrer"; im.src=s; } }); }); },{root:sp,rootMargin:"0px 200px"});
    sp.querySelectorAll("button").forEach(function(b){ io.observe(b); b.onclick=function(){ select(+b.dataset.i,true); }; });
    st.addEventListener("scroll",function(){ clearTimeout(stageT); stageT=setTimeout(function(){ var n=Math.round(st.scrollLeft/st.clientWidth); if(n!==cur) select(n,false); },70); },{passive:true});
    st.tabIndex=0; st.onkeydown=function(e){ if(e.key==="ArrowRight") select(cur+1,true); if(e.key==="ArrowLeft") select(cur-1,true); };
    cur=-1; select(0,false);
    paintPlate();
  }
  $("gPh").onclick=function(){ if(tab!=="photo"){ tab="photo"; paintGallery(); } };
  $("gVi").onclick=function(){ if(tab!=="video"){ tab="video"; paintGallery(); } };

  function fmtPlate(p){ p=String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); return p.length>=7?p.slice(0,4)+" "+p.slice(4):p; }
  function paintPlate(){
    var d=S.getDraft(idx), b=d.basics||{}, hide=!!b.hidePlate, txt=fmtPlate(b.plate||car.plate);
    var on=view==="show"&&!!txt&&!hide&&tab==="photo";
    var el=$("gPlate"), reg=$("gPlateReg"), brand=$("gBrand");
    if(reg) reg.textContent=txt;
    if(el){ el.classList.toggle("hide",!on); el.setAttribute("aria-hidden", on?"false":"true"); if(on) el.setAttribute("aria-label","Number plate "+txt); }
    if(brand) brand.classList.toggle("hide", view!=="show");
  }

  // ---------- My car summary ----------
  function due(dt){ if(!dt) return null; var t=new Date(dt+"T12:00:00"); if(isNaN(t)) return null; var days=Math.round((t-Date.now())/86400000);
    return {days:days,cls:days<0?"bad":days<=30?"amb":"ok",txt:days<0?"Overdue":days===0?"Due today":days<=60?days+" days":t.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}),sub:days<0?"Was due "+t.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Due "+t.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}; }
  function paintMine(){
    var d=S.getDraft(idx), b=d.basics||{};
    var work=diy.reduce(function(s,w){ return s+(window.D3Diy?D3Diy.cost(w):0); },0);
    var trips=rd("gt.driveLog",[]).filter(function(t){ return t&&owns(t.plate); }), tripCost=trips.reduce(function(s,t){return s+(+t.cost||0)},0), tripMiles=trips.reduce(function(s,t){return s+(+t.miles||0)},0);
    var mot=due(car.mot), tax=due(car.tax), M=MEDIA.mine;
    var title=[b.year,b.make,b.model].filter(Boolean).join(" ");
    var chips=[car.plate&&String(car.plate).toUpperCase(),b.variant,b.colour||car.colour,car.engine,car.fuel,car.miles&&(Number(car.miles).toLocaleString("en-GB")+" miles a year")].filter(Boolean);
    function tile(k,v,s,cls,href,w){ return '<'+(href?'a href="'+href+'"':'div')+' class="tile'+(w?" w":"")+'"><div class="k">'+k+'</div><div class="v'+(cls?" "+cls:"")+'">'+v+'</div>'+(s?'<div class="s">'+s+'</div>':'')+'</'+(href?'a':'div')+'>'; }
    $("mineBox").innerHTML='<div class="tiles">'+
      tile(esc(U.niceName(car)),esc(title||"Your car"),'<div class="spec">'+chips.map(function(c){return "<span>"+esc(c)+"</span>"}).join("")+'</div>',"","",1)+
      tile("Money spent",gbp(work+tripCost),"Work receipts "+gbp(work)+" · Journeys "+gbp(tripCost),"","calendar.html",1)+
      tile("Work done",String(workCount),diy.length+" logged by you · "+jobs.length+" from your mechanic","","calendar.html")+
      tile("Journeys",String(trips.length),tripMiles?tripMiles.toFixed(0)+" miles recorded":"None recorded yet","","drive.html")+
      tile("Photos",String(M.photo.length),"Across showcase, work and uploads")+
      tile("Videos",String(M.video.length),"Clips, runs and links")+
      tile("MOT",mot?mot.txt:"Not set",mot?mot.sub:"Add it on the home screen",mot?mot.cls:"","mot.html")+
      tile("Tax",tax?tax.txt:"Not set",tax?tax.sub:"Add it on the home screen",tax?tax.cls:"","tax.html?plate="+encodeURIComponent(PL))+
      '</div><button class="btn wide" type="button" id="toShowView">See my public Show view</button>';
    $("toShowView").onclick=function(){ setView("show"); window.scrollTo({top:0,behavior:"smooth"}); };
  }

  // ---------- Show view preview (only what the show card shares) ----------
  function paintShow(){
    var d=S.getDraft(idx), b=d.basics||{}, s=d.stats||{}, pub=!!(car.showId&&car.showPublished);
    var name=d.title||[b.make,b.model].filter(Boolean).join(" ")||U.niceName(car);
    var sub=[b.year,b.variant,car.engine||b.engine,b.colour].filter(Boolean).join(" · ");
    var sts=[["bhp","bhp"],["torque","Nm"],["zero60","0-60 (s)"],["top","mph top"],["weight","kg"]].filter(function(x){return s[x[0]]!==""&&s[x[0]]!=null}).map(function(x){return '<div class="st"><b>'+esc(s[x[0]])+'</b><span>'+x[1]+'</span></div>'}).join("");
    var best=s.best&&s.best.time?'<p class="note">🏁 Best: <b style="color:#f2f2f2">'+esc(s.best.time)+'</b> '+esc([s.best.label,s.best.venue].filter(Boolean).join(" · "))+'</p>':"";
    var mods=(d.mods||[]).map(function(m){ var t=typeof m==="string"?m:(m&&(m.t||m.name||m.title||m.text))||""; return t?"<li>"+esc(t)+"</li>":""; }).join("");
    $("pubBanTxt").textContent=pub?"What people see if they scan your sticker in Show mode, or open your link.":"What the public will see once you publish. Only on this phone for now.";
    $("showBox").innerHTML='<div class="card pv"><h2>'+esc(name)+'</h2>'+
      (sub?'<p class="sub">'+esc(sub)+'</p>':'')+
      (sts?'<div class="sts">'+sts+'</div>':'<p class="note">No stats yet. Add them below.</p>')+best+
      (mods?'<h2 class="sh">Mods</h2><ul>'+mods+'</ul>':'')+
      (d.story?'<h2 class="sh">Story</h2><p class="story">'+esc(d.story)+'</p>':'')+
      (pub?'<a class="btn small wide" style="margin-top:12px" target="_blank" rel="noopener" href="'+esc(U.showLink?U.showLink(car):"#")+'">Open the live card</a>':'')+
      '</div>';
  }

  function setView(v){
    view=v; try{ localStorage.setItem("gt.showcaseView",v); }catch(e){}
    var sh=v==="show"; $("vsw").classList.toggle("show",sh); $("vMine").classList.toggle("on",!sh); $("vShow").classList.toggle("on",sh);
    $("vMine").setAttribute("aria-selected",!sh); $("vShow").setAttribute("aria-selected",sh);
    $("privBan").classList.toggle("vhide",sh); $("pubBan").classList.toggle("vhide",!sh);
    $("mineBox").classList.toggle("vhide",sh); $("showBox").classList.toggle("vhide",!sh); $("editWrap").classList.toggle("vhide",!sh);
    h1.textContent=sh?"Show view":"My car"; lead.textContent=sh?"Your public show card — only what you share. Money, receipts and journeys stay off it.":"A private summary of "+U.niceName(car)+". Tick a photo or video to share it in Show view.";
    if(sh) paintShow(); else paintMine();
    paintGallery();
  }
  $("vMine").onclick=function(){ if(view!=="mine") setView("mine"); };
  $("vShow").onclick=function(){ if(view!=="show") setView("show"); };
  async function refresh(){ await collect(); setView(view); }
  window.D3ShowcaseRefresh=function(){ if(Date.now()-selfT<1500) return; clearTimeout(window.__scR); window.__scR=setTimeout(function(){ relist(cur,tab); },250); };
  // Re-read when the editor adds/removes photos or clips.
  ["photos","clips"].forEach(function(id){ var el=$(id); if(el) new MutationObserver(window.D3ShowcaseRefresh).observe(el,{childList:true}); });
  // Show view preview follows the editor fields as you type.
  document.addEventListener("input",function(e){ if(view==="show"&&e.target.closest("#editWrap")){ clearTimeout(window.__scP); window.__scP=setTimeout(paintShow,500); } });
  setView(view); refresh();
})();
