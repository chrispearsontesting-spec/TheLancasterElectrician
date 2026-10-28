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
    // Videos: old cards stored plain ids, new ones {id,title}.
    var vids=(Array.isArray(c.videos)?c.videos:[]).map(function(v){ var id=P.youtubeId(v&&typeof v==="object"?v.id:v); return id?{id:id,title:str(v&&v.title,80)}:null; }).filter(Boolean).slice(0,12);
    if(vids.length) carousel("Videos",vids,"video",function(v){
      var f=frame("https://www.youtube-nocookie.com/embed/"+v.id+"?rel=0&playsinline=1&modestbranding=1",v.title||"YouTube video");
      f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture; fullscreen"); return f; });
    var socs=(Array.isArray(c.socials)?c.socials:[]).map(socialSrc).filter(Boolean).slice(0,12);
    if(socs.length) carousel("Photos from socials",socs,"social",function(x){ var f=frame(x.src,x.label); f.classList.add(x.cls); return f; });
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
