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
    document.title="Car showcase · Driv3";
  }
  function footer(){ var f=el("div","foot"); f.appendChild(document.createTextNode("Made with ")); var a=el("a","","Driv3"); a.href="./home.html"; f.appendChild(a); return f; }
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
    document.title=name+" · Driv3";
    var gal=(Array.isArray(c.gallery)?c.gallery:[]).slice(0,12).map(function(g){ return {src:imgSrc(g),cap:str(g&&g.cap,80)}; }).filter(function(g){return g.src});
    var hi=typeof c.hero==="number"&&c.hero>=0&&c.hero<gal.length?c.hero:0;

    var tt=el("section","tt");
    var hero=el("div","hero");
    if(gal.length){ var hImg=img(gal[hi].src,name); hImg.loading="eager"; hero.appendChild(hImg); } else hero.appendChild(el("div","noimg","No photo yet"));
    hero.appendChild(el("span","badge","Show car"));
    if(plate){ var p=el("span","plate"); p.appendChild(el("span","uk","UK")); p.appendChild(el("span","reg",plate)); hero.appendChild(p); }
    var sh=el("div","shade"); sh.appendChild(el("h1","",name));
    var sub=[year,str(c.title,40)?[make,model].filter(Boolean).join(" "):"",str(b.variant,40),str(b.colour,30)].filter(Boolean).join(" · ");
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
    if(gal.length>1){ var gs=sec("Gallery"), grid=el("div","gal");
      gal.forEach(function(g,i){ var bt=el("button"); bt.type="button"; bt.setAttribute("aria-label","Open photo "+(i+1)); bt.appendChild(img(g.src,g.cap||("Photo "+(i+1)))); bt.onclick=function(){ lightbox(gal,i); }; grid.appendChild(bt); });
      gs.appendChild(grid); }
    var vids=(Array.isArray(c.videos)?c.videos:[]).map(P.youtubeId).filter(Boolean).slice(0,6);
    if(vids.length){ var vs=sec("Videos"); vids.forEach(function(id){ vs.appendChild(ytBox(id)); }); }
    var clips=(Array.isArray(c.clips)?c.clips:[]).slice(0,2).map(function(k){ return {src:k&&fileUrl(k.n),cap:str(k&&k.cap,80)}; }).filter(function(k){return k.src&&/^c/.test(k.src.split("/").pop())});
    if(clips.length){ var cs=sec("Clips"); clips.forEach(function(k){ var w=el("div","clip"), v=el("video"); v.controls=true; v.preload="metadata"; v.playsInline=true; v.src=k.src; w.appendChild(v); if(k.cap) w.appendChild(el("div","cap",k.cap)); cs.appendChild(w); }); }
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
