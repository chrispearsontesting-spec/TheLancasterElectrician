/* Driv3 Drive diary: everything the old History timeline showed, on its calendar day, with a photo/video viewer.
   Sources (read only, nothing is moved or deleted): DIY work (gt.diy + IndexedDB dipstick gt.diyFile.<id>), old History notes/photos
   (localStorage dipstick-history), mechanic uploads (DipUploads, collected on open), Performance runs (IndexedDB driv3-runs via PerfG). */
(function(){
  var M={byDay:{}, runs:[], jobs:[], ready:false}, urls=[];
  function esc(x){ return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]}); }
  function k(t){ var d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function car(){ try{ var g=JSON.parse(localStorage.getItem("gt.garage")||"null"); return g&&g.cars&&(g.cars[g.i]||g.cars[0])||null; }catch(e){ return null; } }
  function vrn(p){ return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  function tsOf(it){ if(it.ts) return +it.ts; var m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(it.date||""); return m?new Date(+m[3],+m[2]-1,+m[1],12).getTime():0; }
  function add(day,e){ (M.byDay[day]=M.byDay[day]||[]).push(e); }
  function url(b){ var u=URL.createObjectURL(b); urls.push(u); return u; }

  async function load(){
    M.byDay={}; var c=car(), pl=vrn(c&&c.plate);
    var own=[]; try{ own=JSON.parse(localStorage.getItem("dipstick-history")||"[]")||[]; }catch(e){}
    own.forEach(function(it,i){ if(!it) return; if(window.D3Car&&!D3Car.owns(it.plate)) return; var t=tsOf(it); if(t) add(k(t),{k:"own",t:t,it:it}); });
    var U=window.DipUploads;
    if(U&&U.allJobs){ try{ M.jobs=(await U.allJobs()).filter(function(j){ return (c&&c.upId&&j.up===c.upId)||(pl&&j.plate===pl); }); }catch(e){ M.jobs=[]; } }
    M.jobs.forEach(function(j){ var t=j.created||j.received||0; if(t) add(k(t),{k:"mech",t:t,j:j}); });
    if(window.PerfG){ try{ M.runs=(await PerfG.list()).filter(function(r){ return !window.D3Car||D3Car.owns(r.plate); }); }catch(e){ M.runs=[]; } }
    M.runs.forEach(function(r){ add(k(r.when),{k:"run",t:r.when,r:r}); });
    M.ready=true;
  }

  function hasMedia(day){
    if((M.byDay[day]||[]).some(function(e){ return (e.k==="run"&&e.r.video)||(e.k==="own"&&/^image\//.test(e.it.type||""))||(e.k==="mech"&&(e.j.files||[]).some(function(f){return /^image\//.test(f.type)})); })) return true;
    return window.D3Diy&&D3Diy.forPlate((car()||{}).plate).some(function(w){ return w.date===day&&(w.files||[]).some(function(f){return f.kind==="photo"}); });
  }

  function card(e,i){
    var day=k(e.t), when=new Date(e.t).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
    if(e.k==="run"){ var r=e.r, st=r.stats||{};
      return "<div class='card media run'><b class='title'>🏁 "+esc(r.label||"Performance run")+" · "+esc(r.time)+"s</b><p class='muted'>Performance · "+when+(st.maxComb!=null?" · peak "+(+st.maxComb).toFixed(2)+" G":"")+(r.video?" · video":"")+"</p>"+
        "<div class='row'>"+(r.video?"<button class='btn' type='button' data-mv='run:"+esc(r.id)+"'>▶ Watch video</button>":"")+"<button class='btn' type='button' data-mg='"+esc(r.id)+"'>📈 G chart</button></div>"+
        "<a class='inv' href='performance.html?v=3&run="+encodeURIComponent(r.id)+"'>Open in Performance</a></div>";
    }
    if(e.k==="own"){ var it=e.it, img=/^image\//.test(it.type||"");
      return "<div class='card media own'><b class='title'>📝 "+esc(it.note||"Work")+"</b><p class='muted'>Your note"+(img?" · 1 photo":it.data?" · PDF":"")+"</p>"+
        (img?"<div class='ph'><img alt='' src='"+esc(it.data)+"' data-mo='"+day+":"+i+"'/></div><div class='row'><button class='btn' type='button' data-mo='"+day+":"+i+"'>🖼 View photos</button></div>":it.data?"<a class='inv' href='"+esc(it.data)+"' target='_blank' rel='noopener' download='invoice.pdf'>🧾 Open PDF</a>":"")+"</div>";
    }
    var j=e.j, who=[j.garage,j.mechanic].filter(Boolean).join(" · "), ph=(j.files||[]).filter(function(f){return /^image\//.test(f.type)}), docs=(j.files||[]).filter(function(f){return !/^image\//.test(f.type)});
    return "<div class='card media mech'><b class='title'>🛠 "+esc(j.note||"Work from your mechanic")+(j.seen?"":" <span class='newTag'>NEW</span>")+"</b><p class='muted'>Mechanic"+(who?" · "+esc(who):"")+(j.mileage!=null?" · "+esc(Number(j.mileage).toLocaleString("en-GB"))+" miles":"")+(ph.length?" · "+ph.length+" photo"+(ph.length>1?"s":""):"")+"</p>"+
      (ph.length?"<div class='ph'>"+ph.map(function(f){return "<img alt='' data-jf='"+esc(j.id)+"|"+esc(f.key)+"' data-mj='"+esc(j.id)+"'/>"}).join("")+"</div>":"")+
      docs.map(function(f){return "<a class='inv' data-jd='"+esc(j.id)+"|"+esc(f.key)+"' target='_blank' rel='noopener'>🧾 "+esc(window.DipUploads?DipUploads.fileTitle(f):f.name)+"</a>"}).join("")+
      "<div class='row'>"+(ph.length?"<button class='btn' type='button' data-mj='"+esc(j.id)+"'>🖼 View photos</button>":"")+"<button class='btn' type='button' data-mrm='"+esc(j.id)+"'>Remove from phone</button></div></div>";
  }

  function decorate(sel){
    if(!M.ready) return;
    var grid=document.getElementById("grid");
    grid.querySelectorAll("[data-k]").forEach(function(b){ var d=b.getAttribute("data-k"), ev=M.byDay[d];
      if(ev&&ev.length&&!b.querySelector(".dot.w")){ var s=document.createElement("span"); s.className="dot w"; s.title="Work done"; b.insertBefore(s,b.querySelector(".evs")); }
      if(hasMedia(d)){ var m=document.createElement("span"); m.className="dot m"; m.title="Photos or video"; b.insertBefore(m,b.querySelector(".evs")); }
    });
    var box=document.getElementById("list"), ev=(M.byDay[sel]||[]).slice().sort(function(a,b){return a.t-b.t});
    // DIY cards: a View photos button + tap a thumbnail to open the viewer.
    box.querySelectorAll(".card.diy").forEach(function(c){ var ob=c.querySelector("[data-openw]"); if(!ob) return; var id=ob.getAttribute("data-openw"), w=D3Diy.get(id);
      if(w&&(w.files||[]).some(function(f){return f.kind==="photo"})&&!c.querySelector("[data-mw]")){ var b=document.createElement("button"); b.className="btn"; b.type="button"; b.setAttribute("data-mw",id); b.textContent="🖼 View photos"; ob.parentNode.insertBefore(b,ob); }
      c.querySelectorAll(".ph img").forEach(function(im){ im.setAttribute("data-mw",id); });
    });
    if(!ev.length) return;
    // Performance runs already logged in the diary list: drop that plain card in favour of the richer one.
    ev.filter(function(e){return e.k==="run"}).forEach(function(e){ box.querySelectorAll(".card[data-id^='run-']").forEach(function(c){ var t=+c.getAttribute("data-id").slice(4); if(Math.abs(t-e.r.when)<120000) c.remove(); }); });
    var wrap=document.createElement("div"); wrap.className="mediaEvs"; wrap.innerHTML=ev.map(card).join("");
    var nothing=Array.prototype.filter.call(box.querySelectorAll("p.muted"),function(p){return /Nothing else on this day/.test(p.textContent)})[0]; if(nothing) nothing.remove();
    var addw=box.querySelector(".addw"); if(addw) box.insertBefore(wrap,addw); else box.insertBefore(wrap,box.firstChild);
    wrap.querySelectorAll("[data-jf]").forEach(function(im){ var p=im.getAttribute("data-jf").split("|"); DipUploads.getFile(p[0],p[1]).then(function(r){ if(r&&r.blob) im.src=url(r.blob); }).catch(function(){}); });
    wrap.querySelectorAll("[data-jd]").forEach(function(a){ var p=a.getAttribute("data-jd").split("|"); DipUploads.getFile(p[0],p[1]).then(function(r){ if(r&&r.blob) a.href=url(r.blob); }).catch(function(){}); });
    if(ev.some(function(e){return e.k==="mech"&&!e.j.seen})){ var c=car(); if(c&&c.upId&&DipUploads.markSeen) DipUploads.markSeen(c.upId).catch(function(){}); }
  }

  /* Fullscreen viewer: swipe (scroll-snap) between items; videos play inline. items: [{src,type,cap}] */
  function viewer(items,start){
    if(!items.length) return;
    var v=document.createElement("div"); v.className="mviewer"; v.setAttribute("role","dialog"); v.setAttribute("aria-label","Photos and video");
    v.innerHTML="<div class='mvtop'><span id='mvN'>1 / "+items.length+"</span><button type='button' class='mvx' aria-label='Close'>✕</button></div><div class='mvstrip'>"+
      items.map(function(it){ return "<figure>"+(/^video\//.test(it.type)?"<video src='"+it.src+"' controls playsinline preload='metadata'></video>":"<img alt='' src='"+it.src+"'/>")+(it.cap?"<figcaption>"+esc(it.cap)+"</figcaption>":"")+"</figure>"; }).join("")+"</div>";
    document.body.appendChild(v); document.body.style.overflow="hidden";
    var strip=v.querySelector(".mvstrip"); strip.scrollLeft=(start||0)*strip.clientWidth;
    strip.addEventListener("scroll",function(){ var n=Math.round(strip.scrollLeft/strip.clientWidth); v.querySelector("#mvN").textContent=(n+1)+" / "+items.length; v.querySelectorAll("video").forEach(function(x,i){ if(x.closest("figure")!==strip.children[n]) x.pause(); }); },{passive:true});
    function close(){ v.querySelectorAll("video").forEach(function(x){x.pause()}); v.remove(); document.body.style.overflow=""; document.removeEventListener("keydown",key); }
    function key(e){ if(e.key==="Escape") close(); if(e.key==="ArrowRight") strip.scrollBy({left:strip.clientWidth,behavior:"smooth"}); if(e.key==="ArrowLeft") strip.scrollBy({left:-strip.clientWidth,behavior:"smooth"}); }
    v.querySelector(".mvx").onclick=close; document.addEventListener("keydown",key);
    var vid=v.querySelector("video"); if(vid&&!start) vid.play().catch(function(){});
    window.__mviewer=v;
  }
  M.viewer=viewer;

  document.addEventListener("click",async function(e){
    var t=e.target.closest("[data-mw],[data-mo],[data-mj],[data-mv],[data-mg],[data-mrm]"); if(!t||!document.getElementById("list").contains(t)) return;
    e.preventDefault(); e.stopPropagation();
    if(t.hasAttribute("data-mw")){ var w=D3Diy.get(t.getAttribute("data-mw")), ph=(w&&w.files||[]).filter(function(f){return f.kind==="photo"}), items=[];
      for(var i=0;i<ph.length;i++){ var b=null; try{ b=await D3Diy.getBlob(ph[i].id); }catch(x){} if(b) items.push({src:url(b),type:b.type||"image/jpeg",cap:w.title}); }
      var idx=0; if(t.tagName==="IMG"){ idx=Array.prototype.indexOf.call(t.parentNode.querySelectorAll("img"),t); } viewer(items,Math.max(0,idx)); return; }
    if(t.hasAttribute("data-mo")){ var p=t.getAttribute("data-mo").split(":"), e2=(M.byDay[p[0]]||[]).slice().sort(function(a,b){return a.t-b.t})[+p[1]]; if(e2) viewer([{src:e2.it.data,type:e2.it.type,cap:e2.it.note}],0); return; }
    if(t.hasAttribute("data-mj")){ var j=M.jobs.filter(function(x){return x.id===t.getAttribute("data-mj")})[0]; if(!j) return; var it2=[];
      for(var q=0;q<(j.files||[]).length;q++){ var f=j.files[q]; if(!/^image\//.test(f.type)) continue; var rec=null; try{ rec=await DipUploads.getFile(j.id,f.key); }catch(x){} if(rec&&rec.blob) it2.push({src:url(rec.blob),type:f.type,cap:DipUploads.fileTitle(f)}); }
      var i3=0; if(t.tagName==="IMG") i3=Array.prototype.indexOf.call(t.parentNode.querySelectorAll("img"),t); viewer(it2,Math.max(0,i3)); return; }
    if(t.hasAttribute("data-mv")){ var r=M.runs.filter(function(x){return "run:"+x.id===t.getAttribute("data-mv")})[0]; if(!r||!r.video) return;
      var its=[{src:url(r.video),type:r.video.type||"video/webm",cap:(r.label||"Run")+" · "+r.time+"s"}]; if(r.chart) its.push({src:url(r.chart),type:"image/png",cap:"G chart"}); viewer(its,0); return; }
    if(t.hasAttribute("data-mg")){ var r2=M.runs.filter(function(x){return x.id===t.getAttribute("data-mg")})[0]; if(!r2) return;
      if(r2.chart) viewer([{src:url(r2.chart),type:"image/png",cap:(r2.label||"Run")+" · G chart"}],0); else location.href="performance.html?v=3&run="+encodeURIComponent(r2.id); return; }
    if(t.hasAttribute("data-mrm")){ var jj=M.jobs.filter(function(x){return x.id===t.getAttribute("data-mrm")})[0]; if(jj&&confirm("Remove this upload from your phone?")){ await DipUploads.removeLocal(jj); await load(); window.render(window.selected); } }
  },true);

  // Re-decorate after every calendar render.
  var orig=window.render; window.render=function(sel){ orig.apply(this,arguments); try{ decorate(sel); }catch(e){ console.warn(e); } };
  window.CalMedia=M;
  function refresh(){ return load().then(function(){ window.render(window.selected); }); }
  refresh();
  // Collect waiting mechanic uploads (this used to happen when History was opened), then redraw.
  var U=window.DipUploads, st=document.getElementById("mechStatus");
  if(U&&U.checkAll){ U.checkAll().then(function(r){ if(st){ st.textContent=r.downloaded?(r.downloaded+" new upload"+(r.downloaded>1?"s":"")+" from your mechanic, shown on their day."):(r.errors&&r.errors.length?"Couldn't check for mechanic uploads just now.":""); st.style.display=st.textContent?"block":"none"; } if(r.downloaded) return refresh(); }).catch(function(){}); }
})();
