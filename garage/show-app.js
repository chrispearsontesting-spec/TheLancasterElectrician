/* Driv3 public showcase card (show.html?s=<showId>). Builds everything with textContent / whitelisted IDs, never raw HTML or URLs. */
(function(){
  var API=window.UPLOADS_API, P=window.Driv3Parse, app=document.getElementById("app");
  var sid=P.showId(new URLSearchParams(location.search).get("s"));
  function el(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=String(text); return e; }
  function str(v,max){ return typeof v==="string"?v.slice(0,max):""; }
  function numv(v){ return typeof v==="number"&&isFinite(v)?v:null; }
  function fileUrl(n){ n=P.fileName(n); return n?API+"/show/"+sid+"/f/"+n:null; }
  function imgSrc(g){ if(!g) return null; if(g.n) return fileUrl(g.n); if(g.url) return P.httpsImage(g.url); return null; }
  function img(src,alt){ var i=el("img"); i.alt=alt||""; i.loading="lazy"; i.decoding="async"; i.referrerPolicy="no-referrer"; i.src=src; return i; }
  function empty(title,msg){
    app.innerHTML=""; var d=el("div","empty"); d.appendChild(el("div","",String.fromCodePoint(0x1F3C1)));
    d.appendChild(el("h1","",title)); d.appendChild(el("p","",msg)); app.appendChild(d); app.appendChild(footer());
    document.title="Car showcase · Trac3";
  }
  function footer(){ var f=el("div","foot"); f.appendChild(document.createTextNode("Made with ")); var a=el("a"); a.href="./home.html"; a.setAttribute("aria-label","Trac3"); var im=el("img","footLogo"); im.src="./trac3-wordmark.svg"; im.alt="Trac3"; a.appendChild(im); f.appendChild(a); return f; }
  function fmtPlate(p){ p=String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); return p.length>=7?p.slice(0,4)+" "+p.slice(4):p; }
  function plateEl(txt){ var p=el("span","plate"); p.appendChild(el("span","uk","UK")); p.appendChild(el("span","reg",fmtPlate(txt))); p.setAttribute("aria-label","Number plate "+fmtPlate(txt)); return p; }
  if(!sid){ empty("Showcase not found","This link looks cut off. Ask the owner to send it again."); return; }
  fetch(API+"/show/"+sid).then(function(r){
    if(r.status===404) return empty("Not published right now","The owner has taken this showcase down for now. Check back later.");
    if(!r.ok) return empty("Couldn't load this showcase","Please try again in a minute.");
    return r.json().then(render);
  },function(){ empty("You're offline","Connect to the internet to see this car."); });

  // Stat bars: sensible max scales; 0-60 and weight are "lower is better".
  var STATS=[
    {k:"bhp",l:"Power",u:"bhp",pct:function(v){return v/800}},
    {k:"torque",l:"Torque",u:"Nm",pct:function(v){return v/1000}},
    {k:"zero60",l:"0-60",u:"s",pct:function(v){return (12-v)/(12-2.5)}},
    {k:"top",l:"Top speed",u:"mph",pct:function(v){return v/220}},
    {k:"weight",l:"Weight",u:"kg",pct:function(v){return (2500-v)/(2500-800)}}
  ];
  function render(c){
    if(!c||typeof c!=="object") return empty("Couldn't load this showcase","Please try again in a minute.");
    app.innerHTML="";
    var b=c.basics||{}, s=c.stats||{};
    var make=str(b.make,30), model=str(b.model,40), year=numv(b.year), plate=str(b.plate,8).replace(/[^A-Z0-9]/g,"");
    var name=str(c.title,40)||[make,model].filter(Boolean).join(" ")||"My car";
    document.title=name+" · Trac3";
    var gal=(Array.isArray(c.gallery)?c.gallery:[]).slice(0,12).map(function(g){ return {src:imgSrc(g),cap:str(g&&g.cap,80)}; }).filter(function(g){return g.src});
    var hi=typeof c.hero==="number"&&c.hero>=0&&c.hero<gal.length?c.hero:0;

    var tt=el("section","tt");
    var hero=el("div","hero");
    hero.className="hero head";
    hero.appendChild(el("span","badge","Show car"));
    if(plate && !gal.length) hero.appendChild(plateEl(plate));
    var sh=el("div","shade"); sh.appendChild(el("h1","",name));
    var sub=[year,str(b.variant,40),str(b.engine,40),str(b.colour,30)].filter(Boolean).join(" · ");
    if(sub) sh.appendChild(el("div","sub",sub));
    hero.appendChild(sh); tt.appendChild(hero);
    var st=el("div","stats"), any=false;
    STATS.forEach(function(d){
      var v=numv(s[d.k]); if(v==null) return; any=true;
      var row=el("div","stat"); row.appendChild(el("div","k",d.l));
      var tr=el("div","track"), f=el("div","fill"); tr.appendChild(f); row.appendChild(tr);
      var vv=el("div","v",String(v)); vv.appendChild(el("small","",d.u)); row.appendChild(vv); st.appendChild(row);
      var pc=Math.max(0.04,Math.min(1,d.pct(v))); setTimeout(function(){ f.style.width=(pc*100).toFixed(1)+"%"; },60);
    });
    if(any) tt.appendChild(st);
    var best=s.best||{}, bt=str(best.time,20);
    if(bt){ var bb=el("div","best"); bb.appendChild(el("div","k",str(best.label,40)||"Best time")); bb.appendChild(el("div","v",bt)); var w=str(best.venue,60); if(w) bb.appendChild(el("div","w",w)); tt.appendChild(bb); }
    app.appendChild(tt);

    var mods=(Array.isArray(c.mods)?c.mods:[]).slice(0,40).filter(function(m){return m&&str(m.name,60)});
    if(mods.length){ var ms=sec("Mods"), ul=el("ul","mods"); mods.forEach(function(m){ var li=el("li"); li.appendChild(el("b","",str(m.name,60))); var n=str(m.notes,200); if(n) li.appendChild(el("span","",n)); ul.appendChild(li); }); ms.appendChild(ul); }
    var story=str(c.story,3000); if(story){ sec("Story").appendChild(el("p","story",story)); }
    // (Photos and videos are in the gallery at the top.)
    // Videos: old cards stored plain ids, new ones {id,title}.
    var vids=(Array.isArray(c.videos)?c.videos:[]).map(function(v){ var id=P.youtubeId(v&&typeof v==="object"?v.id:v); return id?{id:id,title:str(v&&v.title,80)}:null; }).filter(Boolean).slice(0,12);
    var clips=(Array.isArray(c.clips)?c.clips:[]).slice(0,2).map(function(k){ return {src:k&&fileUrl(k.n),cap:str(k&&k.cap,80)}; }).filter(function(k){return k.src&&/^c/.test(k.src.split("/").pop())});
    gallery(gal,hi,clips,vids,name,tt,gal.length?plate:"");
    var pl=c.playlist&&typeof c.playlist==="object"?c.playlist:null;
    if(pl){
      if(pl.kind==="spotify"&&/^[A-Za-z0-9]{22}$/.test(pl.id||"")&&(pl.type==="playlist"||pl.type==="album")){
        var sp=sec("Driving playlist"), box=el("div","music"), fr=frame("https://open.spotify.com/embed/"+pl.type+"/"+pl.id+"?utm_source=generator&theme=0","Spotify playlist");
        fr.setAttribute("allow","autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"); box.appendChild(fr); sp.appendChild(box);
      } else if(pl.kind==="ytmusic"&&/^[A-Za-z0-9_-]{10,64}$/.test(pl.id||"")){
        var ym=sec("Driving playlist"), yb=el("div","music yt"); yb.appendChild(frame("https://www.youtube-nocookie.com/embed/videoseries?list="+encodeURIComponent(pl.id),"YouTube Music playlist")); ym.appendChild(yb);
        var a=el("a","btn","Open in YouTube Music"); a.href="https://music.youtube.com/playlist?list="+encodeURIComponent(pl.id); a.target="_blank"; a.rel="noopener noreferrer"; ym.appendChild(a);
      }
    }
    var ig=P.insta(c.instagram);
    if(ig){ var ia=el("a","btn ig","Follow @"+ig+" on Instagram"); ia.href="https://www.instagram.com/"+encodeURIComponent(ig)+"/"; ia.target="_blank"; ia.rel="noopener noreferrer"; app.appendChild(ia); }
    app.appendChild(footer());
  }
  // Instagram / Facebook official embeds only (never their CDN image links, which expire).
  function socialSrc(x){
    if(!x||typeof x!=="object") return null;
    var title=str(x.title,80);
    if(x.kind==="ig"&&/^(p|reel|tv)$/.test(x.type)&&/^[A-Za-z0-9_-]{5,40}$/.test(x.code||""))
      return {src:"https://www.instagram.com/"+x.type+"/"+x.code+"/embed/",label:"Instagram post",cls:"ig",title:title,from:"Instagram"};
    if(x.kind==="fb"&&typeof x.href==="string"){
      var r=P.social(x.href); if(!r||r.kind!=="fb") return null;
      var vid=r.type==="video";
      return {src:"https://www.facebook.com/plugins/"+(vid?"video":"post")+".php?href="+encodeURIComponent(r.href)+"&show_text=true&width=380",label:"Facebook "+(vid?"video":"post"),cls:vid?"fbv":"fb",title:title,from:"Facebook"};
    }
    return null;
  }
  // Collapsible section (button with aria-expanded) holding a one-at-a-time carousel: only the current embed exists,
  // switching removes the old iframe (stops it playing). Arrows, counter, swipe and arrow keys.
  function carousel(title,items,kind,make){
    var s=el("section","sec fold"), id="fold-"+kind;
    var hb=el("button","foldBtn"); hb.type="button"; hb.setAttribute("aria-expanded","false"); hb.setAttribute("aria-controls",id);
    hb.appendChild(el("span","",title)); hb.appendChild(el("span","foldN",items.length)); hb.appendChild(el("span","chev"));
    var panel=el("div","foldPanel hide"); panel.id=id; panel.setAttribute("role","region"); panel.setAttribute("aria-label",title);
    var stage=el("div","stage "+kind), row=el("div","carRow"), prev=el("button","arrow","‹"), next=el("button","arrow","›"), count=el("div","count"), cap=el("div","cap slideCap");
    prev.type=next.type="button"; prev.setAttribute("aria-label","Previous"); next.setAttribute("aria-label","Next");
    count.setAttribute("aria-live","polite");
    row.appendChild(prev); row.appendChild(count); row.appendChild(next);
    panel.appendChild(stage); panel.appendChild(cap); if(items.length>1) panel.appendChild(row);
    var i=0;
    function show(){
      stage.innerHTML=""; var it=items[i], f=make(it); f.loading="eager"; stage.appendChild(f);
      count.textContent=(i+1)+" / "+items.length; cap.textContent=it.title||(it.from?"From "+it.from:"");
      stage.dataset.i=String(i);
    }
    function go(d){ i=(i+d+items.length)%items.length; show(); }
    prev.onclick=function(){go(-1)}; next.onclick=function(){go(1)};
    hb.onclick=function(){ var open=hb.getAttribute("aria-expanded")!=="true"; hb.setAttribute("aria-expanded",String(open)); panel.classList.toggle("hide",!open);
      if(open) show(); else stage.innerHTML=""; };
    panel.addEventListener("keydown",function(e){ if(e.key==="ArrowLeft") go(-1); if(e.key==="ArrowRight") go(1); });
    // swipe on the strip around the player (iframes swallow touches inside them)
    var x0=null; panel.addEventListener("touchstart",function(e){ x0=e.touches[0].clientX; },{passive:true});
    panel.addEventListener("touchend",function(e){ if(x0==null) return; var dx=e.changedTouches[0].clientX-x0; x0=null; if(Math.abs(dx)>50&&items.length>1) go(dx<0?1:-1); },{passive:true});
    s.appendChild(hb); s.appendChild(panel); app.appendChild(s); return s;
  }
  /* Gallery: Photos / Videos tabs joined to a framed viewer. Swipe the big view (scroll-snap) or tap a thumbnail. Built with DOM APIs only. */
  function gallery(photos,start,clips,yts,name,before,plate){
    var vids=clips.map(function(k){ return {kind:"clip",src:k.src,cap:k.cap}; }).concat(yts.map(function(v){ return {kind:"yt",id:v.id,cap:v.title}; }));
    if(!photos.length&&!vids.length) return;
    var wrap=el("section","gal2"), tabs=el("div","gtabs"), bP=el("button","",""), bV=el("button","",""), frameEl=el("div","gframe"), stage=el("div","gstage"), meta=el("div","gmeta"), cap=el("b",""), pos=el("span",""), strip=el("div","gstrip");
    bP.type=bV.type="button"; bP.appendChild(document.createTextNode("Photos")); bP.appendChild(el("span","n",photos.length||""));
    bV.appendChild(document.createTextNode("Videos")); bV.appendChild(el("span","n",vids.length||""));
    tabs.setAttribute("role","tablist"); tabs.appendChild(bP); tabs.appendChild(bV); meta.appendChild(cap); meta.appendChild(pos);
    var stageWrap=el("div","stageWrap"); stageWrap.appendChild(stage);
    var logo=el("img","gBrand"); logo.src="./trac3-wordmark.svg"; logo.alt="Trac3"; stageWrap.appendChild(logo);
    if(plate) stageWrap.appendChild(plateEl(plate));
    frameEl.appendChild(stageWrap); frameEl.appendChild(meta); frameEl.appendChild(strip); wrap.appendChild(tabs); wrap.appendChild(frameEl);
    app.insertBefore(wrap,before);
    var tab=photos.length?"p":"v", list=[], cur=0, t=null;
    function fill(n){ var sl=stage.children[n]; if(!sl||sl.firstChild) return; var it=list[n];
      if(tab==="p"){ var im=img(it.src,it.cap||name); im.loading=n===cur?"eager":"lazy"; sl.appendChild(im); }
      else if(it.kind==="clip"){ var v=el("video"); v.controls=true; v.preload="metadata"; v.playsInline=true; v.src=it.src; sl.appendChild(v); }
      else if(n===cur){ var f=frame("https://www.youtube-nocookie.com/embed/"+it.id+"?rel=0&playsinline=1&modestbranding=1",it.cap||"YouTube video"); f.loading="eager"; f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture; fullscreen"); sl.appendChild(f); }
      else { sl.appendChild(img("https://i.ytimg.com/vi/"+it.id+"/hqdefault.jpg","Video")); } }
    function sel(n,scroll){ if(!list.length) return; n=Math.max(0,Math.min(list.length-1,n)); var ch=n!==cur; cur=n;
      if(ch) Array.prototype.forEach.call(stage.children,function(sl,k){ var v=sl.querySelector("video"); if(v) v.pause(); if(sl.querySelector("iframe")||(tab==="v"&&k===n&&list[k].kind==="yt")) sl.innerHTML=""; });
      [n-1,n,n+1].forEach(fill);
      if(scroll) stage.scrollTo({left:n*stage.clientWidth,behavior:"smooth"});
      Array.prototype.forEach.call(strip.children,function(b,k){ b.classList.toggle("on",k===n); });
      var tb=strip.children[n]; if(tb) strip.scrollTo({left:tb.offsetLeft-strip.clientWidth/2+tb.offsetWidth/2,behavior:"smooth"});
      cap.textContent=list[n].cap||""; pos.textContent=(n+1)+" / "+list.length; }
    function paint(){
      bP.classList.toggle("on",tab==="p"); bV.classList.toggle("on",tab==="v"); frameEl.className="gframe "+(tab==="p"?"l":"r");
      var pl=stageWrap.querySelector(".plate"); if(pl) pl.classList.toggle("hide",tab!=="p");
      list=tab==="p"?photos:vids; stage.innerHTML=""; strip.innerHTML=""; cap.textContent=""; pos.textContent="";
      if(!list.length){ stage.appendChild(el("div","gempty",tab==="p"?"No photos yet":"No videos yet")); return; }
      list.forEach(function(it,k){ stage.appendChild(el("div","sl"));
        var b=el("button"); b.type="button"; b.setAttribute("aria-label",(tab==="p"?"Photo ":"Video ")+(k+1));
        if(tab==="p") b.appendChild(img(it.src,"")); else if(it.kind==="yt") b.appendChild(img("https://i.ytimg.com/vi/"+it.id+"/default.jpg",""));
        else { var tv=el("video"); tv.muted=true; tv.preload="metadata"; tv.playsInline=true; tv.src=it.src+"#t=0.1"; b.appendChild(tv); }
        if(tab==="v") b.appendChild(el("span","play2","▶"));
        b.onclick=function(){ sel(k,true); }; strip.appendChild(b); });
      cur=-1; var s0=tab==="p"?start:0; stage.scrollLeft=s0*stage.clientWidth; sel(s0,false); requestAnimationFrame(function(){ stage.scrollLeft=s0*stage.clientWidth; });
    }
    stage.addEventListener("scroll",function(){ clearTimeout(t); t=setTimeout(function(){ var n=Math.round(stage.scrollLeft/stage.clientWidth); if(n!==cur) sel(n,false); },80); },{passive:true});
    stage.tabIndex=0; stage.addEventListener("keydown",function(e){ if(e.key==="ArrowRight") sel(cur+1,true); if(e.key==="ArrowLeft") sel(cur-1,true); });
    bP.onclick=function(){ if(tab!=="p"){ tab="p"; paint(); } }; bV.onclick=function(){ if(tab!=="v"){ tab="v"; paint(); } };
    paint();
  }
  function sec(title){ var s=el("section","sec"); s.appendChild(el("h2","",title)); app.appendChild(s); return s; }
  function frame(src,title){ var f=el("iframe"); f.src=src; f.title=title; f.loading="lazy"; f.referrerPolicy="strict-origin-when-cross-origin";
    f.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation allow-popups"); f.setAttribute("allowfullscreen",""); return f; }
  // YouTube: thumbnail first, the player only loads when tapped (no YouTube cookies or requests until then).
  function ytBox(id){
    var v=el("div","vid"), b=el("button"); b.type="button"; b.setAttribute("aria-label","Play video");
    b.appendChild(img("https://i.ytimg.com/vi/"+id+"/hqdefault.jpg","Video thumbnail")); b.appendChild(el("span","play"));
    b.onclick=function(){ var f=frame("https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&rel=0&playsinline=1","YouTube video"); f.loading="eager"; f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture; fullscreen"); v.innerHTML=""; v.appendChild(f); };
    v.appendChild(b); return v;
  }
  function lightbox(gal,i){
    var lb=el("div","lb"); lb.setAttribute("role","dialog"); lb.setAttribute("aria-modal","true");
    var im=img(gal[i].src,""), cap=el("div","lbcap"), nav=el("div","nav"), prev=el("button","","‹"), next=el("button","","›"), x=el("button","close","✕");
    prev.setAttribute("aria-label","Previous photo"); next.setAttribute("aria-label","Next photo"); x.setAttribute("aria-label","Close");
    function show(){ im.src=gal[i].src; im.alt=gal[i].cap||("Photo "+(i+1)); cap.textContent=(gal[i].cap?gal[i].cap+" · ":"")+(i+1)+" / "+gal.length; }
    prev.onclick=function(){ i=(i-1+gal.length)%gal.length; show(); }; next.onclick=function(){ i=(i+1)%gal.length; show(); };
    function close(){ lb.remove(); document.removeEventListener("keydown",key); }
    function key(e){ if(e.key==="Escape") close(); if(e.key==="ArrowLeft") prev.onclick(); if(e.key==="ArrowRight") next.onclick(); }
    x.onclick=close; lb.onclick=function(e){ if(e.target===lb) close(); }; document.addEventListener("keydown",key);
    nav.appendChild(prev); nav.appendChild(next); lb.appendChild(x); lb.appendChild(im); lb.appendChild(cap); lb.appendChild(nav); document.body.appendChild(lb); show(); x.focus();
  }
})();
