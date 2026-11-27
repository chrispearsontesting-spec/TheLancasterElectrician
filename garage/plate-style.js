/* Trac3 number plate: the style (gt.plateStyle), the header plate, and "Place on photo" per car (gt.platePlace).
   gt.plateStyle  "glass" (default, key removed) | carbon | four | gel | classic | neon | brushed
   gt.platePlace  { <car id>: {x,y,s,r,tx,ty,iw,ih} }  x,y = centre as a fraction of the car photo; s = plate font-size as a fraction
                  of the photo width (so size follows the photo on any screen); r = turn in degrees; tx/ty = tilt up/down and left/right.
   A car with a placement shows its plate on the photo and none in the header. Reset removes the placement. */
(function(){
  "use strict";
  var SKEY="gt.plateStyle", PKEY="gt.platePlace";
  var STYLES=[["glass","Glass"],["carbon","Carbon"],["four","4D raised"],["gel","Gel dome"],["classic","Classic"],["neon","Neon"],["brushed","Brushed"]];
  var OBJ_Y=.74; // the home photo is shown with object-position 50% 74%
  function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){} }
  function style(){ var v=ls(SKEY); for(var i=0;i<STYLES.length;i++) if(STYLES[i][0]===v) return v; return "glass"; }
  function nameOf(k){ for(var i=0;i<STYLES.length;i++) if(STYLES[i][0]===k) return STYLES[i][1]; return "Glass"; }
  function num(v,lo,hi,d){ v=+v; if(!isFinite(v)) return d; return Math.max(lo,Math.min(hi,v)); }
  function clean(p){ if(!p||typeof p!=="object") return null;
    var r=num(p.r,-1e4,1e4,0); r=((r+180)%360+360)%360-180;
    return {x:num(p.x,0,1,.5),y:num(p.y,0,1,.6),s:num(p.s,.02,.45,.07),r:r,tx:num(p.tx,-70,70,0),ty:num(p.ty,-70,70,0),iw:num(p.iw,0,1e5,0),ih:num(p.ih,0,1e5,0)}; }
  function all(){ try{ var o=JSON.parse(ls(PKEY)||"{}"); return o&&typeof o==="object"&&!Array.isArray(o)?o:{}; }catch(e){ return {}; } }
  function key(c){ return c?String(c.id||String(c.plate||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase()):""; }
  function getPlace(c){ var k=key(c); if(!k||!c.photo) return null; return clean(all()[k]); }
  function setPlace(c,p){ var k=key(c); if(!k) return; var o=all(); if(p) o[k]=clean(p); else delete o[k];
    lsSet(PKEY,Object.keys(o).length?JSON.stringify(o):null); }
  function text(c){ var p=String(c&&c.plate||"").toUpperCase().replace(/[^A-Z0-9]/g,""); if(!p) return ""; return p.length>=7?p.slice(0,4)+" "+p.slice(4):p; }
  function markup(t,cls,st){ return "<div class='t3-plate t3-plate--"+style()+" "+cls+"' data-ps='1'"+(st?" style='"+st+"'":"")+" aria-label='Number plate "+t+"'><span class='t3-plate__band'><i>UK</i></span><span class='t3-plate__reg'>"+t+"</span></div>"; }
  function hfs(t){ var n=t.replace(/ /g,"").length; return n>7?"font-size:"+Math.max(16,Math.round(26*7.5/n*10)/10)+"px":""; }

  // photo geometry: the hero shows the photo as object-fit:cover; the editor shows it whole (contain)
  function geom(W,H,iw,ih,contain){ var s=contain?Math.min(W/iw,H/ih):Math.max(W/iw,H/ih), dw=iw*s, dh=ih*s;
    return {dw:dw,dh:dh,ox:(W-dw)*.5,oy:(H-dh)*(contain?.5:OBJ_Y)}; }
  function css(p,g){ var fs=p.s*g.dw;
    return "left:"+(g.ox+p.x*g.dw).toFixed(2)+"px;top:"+(g.oy+p.y*g.dh).toFixed(2)+"px;font-size:"+fs.toFixed(2)+"px;transform:translate(-50%,-50%) rotate("+p.r.toFixed(2)+"deg) perspective("+(fs*14).toFixed(1)+"px) rotateY("+p.ty.toFixed(2)+"deg) rotateX("+p.tx.toFixed(2)+"deg)"; }

  // markup for the hero: header plate, or the plate on the photo
  function heroHtml(c,hero){
    var t=text(c);
    if(!t) return c?"<button type='button' class='hplate regchip' data-addreg='1' aria-label='Add registration'>+ Add reg</button>":"";
    var p=getPlace(c);
    if(!p) return markup(t,"hplate",hfs(t));
    var st="visibility:hidden";
    if(hero&&hero.clientWidth&&p.iw&&p.ih) st=css(p,geom(hero.clientWidth,hero.clientHeight,p.iw,p.ih,false));
    return markup(t,"pplate",st);
  }
  function layout(hero,c){
    var el=hero&&hero.querySelector(".pplate"); if(!el) return;
    var p=getPlace(c); if(!p) return;
    var img=hero.querySelector("img"), iw=img&&img.naturalWidth||p.iw, ih=img&&img.naturalHeight||p.ih;
    if(img&&!img.complete&&!img.__plcL){ img.__plcL=1; img.addEventListener("load",function(){ layout(hero,c); }); }
    if(!iw||!ih||!hero.clientWidth) return;
    el.style.cssText=css(p,geom(hero.clientWidth,hero.clientHeight,iw,ih,false));
  }
  function curCar(){ try{ return typeof window.car==="function"?window.car():null; }catch(e){ return null; } }
  function relayout(){ var hero=document.getElementById("hero"); if(hero) layout(hero,curCar()); }
  window.addEventListener("resize",relayout);
  window.addEventListener("orientationchange",function(){ setTimeout(relayout,250); });
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(relayout).catch(function(){});

  function restyle(){ var st=style(); [].forEach.call(document.querySelectorAll(".t3-plate[data-ps]"),function(el){ el.className=el.className.replace(/t3-plate--\w+/,"t3-plate--"+st); }); }
  function repaint(){ if(typeof window.paint==="function") window.paint(); }

  // The photo positioner (photo-pos.js) shows the header plate where it will sit
  function posterHtml(c){
    var t=text(c); if(!t||getPlace(c)) return "";
    var pos=document.documentElement.getAttribute("data-logo")||"left", a=pos==="right"?"left:16px;top:13px":pos==="centre"?"left:50%;top:68px;margin-left:-48px":"right:16px;top:13px";
    return markup(t,"hplate","position:absolute;pointer-events:none;"+a+";font-size:26px");
  }
  function posterOrigin(){ var pos=document.documentElement.getAttribute("data-logo")||"left"; return pos==="right"?"top left":pos==="centre"?"top center":"top right"; }

  /* ---- Settings: Plate style ---- */
  var host=null;
  function sample(){ var c=curCar(); return text(c)||"AB12 CDE"; }
  function mount(el){ host=el; refresh(); el.addEventListener("click",function(e){
      var b=e.target.closest("[data-ps-style]"); if(b){ lsSet(SKEY,b.getAttribute("data-ps-style")==="glass"?null:b.getAttribute("data-ps-style")); restyle(); refresh(); return; }
      if(e.target.closest("#psPlace")){ var s=document.getElementById("settings"); if(s) s.classList.remove("on"); openEditor(); return; }
      if(e.target.closest("#psReset")){ var c=curCar(); if(c){ setPlace(c,null); repaint(); refresh(); } } }); }
  function inner(t,k){ return "<div class='t3-plate t3-plate--"+k+"'><span class='t3-plate__band'><i>UK</i></span><span class='t3-plate__reg'>"+t+"</span></div>"; }
  function refresh(){
    if(!host) return;
    var c=curCar(), cur=style(), t=sample(), placed=!!getPlace(c), can=!!(c&&c.photo&&text(c));
    var bg=c&&c.photo?" style=\"background-image:url('"+String(c.photo).replace(/'/g,"%27")+"')\"":"";
    host.innerHTML="<div class='apHead'><span class='apLab' id='psLab'>Plate style</span><span class='apName'>"+nameOf(cur)+"</span></div>"+
      "<div class='psPrev'"+bg+">"+inner(t,cur)+"</div>"+
      "<div class='psGrid' role='radiogroup' aria-labelledby='psLab'>"+STYLES.map(function(s){ return "<button type='button' role='radio' class='psSw' data-ps-style='"+s[0]+"' aria-checked='"+(s[0]===cur)+"'>"+inner(t,s[0])+"<span>"+s[1]+"</span></button>"; }).join("")+"</div>"+
      "<div class='psAct'><button type='button' class='psBtn' id='psPlace'"+(can?"":" disabled")+">"+(placed?"Edit on photo":"Place on photo")+"</button>"+(placed?"<button type='button' class='psBtn ghost' id='psReset'>Back to header</button>":"")+"</div>"+
      (can?"":"<p class='psNote'>"+(c&&text(c)?"Add a car photo first.":"Add the registration first.")+"</p>");
  }
  var st=document.getElementById("settings");
  if(st&&window.MutationObserver) new MutationObserver(function(){ if(st.classList.contains("on")) refresh(); }).observe(st,{attributes:true,attributeFilter:["class"]});

  /* ---- Place on photo editor ---- */
  var ed=null, P=null, G=null, car0=null, ptr={}, gs=null;
  function build(){
    ed=document.createElement("div"); ed.id="d3plc"; ed.hidden=true; ed.setAttribute("role","dialog"); ed.setAttribute("aria-label","Place plate on photo");
    ed.innerHTML="<div class='plcStage'><div class='plcFrame' id='plcFrame'><img id='plcImg' alt='Car photo' draggable='false'/><div id='plcPlate'></div></div></div>"+
      "<div class='plcCtl'><p class='plcHint'>Drag to move. Pinch to resize and turn.</p>"+
      "<label><span>Size</span><input type='range' id='plcS' min='2' max='40' step='0.1' aria-label='Size'/></label>"+
      "<label><span>Turn</span><input type='range' id='plcR' min='-90' max='90' step='0.5' aria-label='Turn'/></label>"+
      "<label><span>Tilt left/right</span><input type='range' id='plcTY' min='-60' max='60' step='0.5' aria-label='Tilt left or right'/></label>"+
      "<label><span>Tilt up/down</span><input type='range' id='plcTX' min='-60' max='60' step='0.5' aria-label='Tilt up or down'/></label>"+
      "<div class='plcBtns'><button type='button' id='plcReset'>Reset</button><button type='button' id='plcDone' class='primary'>Done</button></div></div>"+
      "<button type='button' class='plcBack' id='plcBack' aria-label='Cancel'><svg viewBox='0 -960 960 960' width='24' height='24' fill='currentColor' aria-hidden='true'><path d='M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z'/></svg></button>";
    document.body.appendChild(ed);
    var f=ed.querySelector("#plcFrame");
    f.addEventListener("pointerdown",down); f.addEventListener("pointermove",move); f.addEventListener("pointerup",up); f.addEventListener("pointercancel",up);
    f.addEventListener("wheel",function(e){ e.preventDefault(); if(e.shiftKey) P.r=clampR(P.r-e.deltaY*.05); else P.s=num(P.s*(e.deltaY<0?1.05:.95),.02,.45,P.s); draw(); },{passive:false});
    ed.querySelector("#plcS").oninput=function(){ P.s=this.value/100; draw(true); };
    ed.querySelector("#plcR").oninput=function(){ P.r=+this.value; draw(true); };
    ed.querySelector("#plcTY").oninput=function(){ P.ty=+this.value; draw(true); };
    ed.querySelector("#plcTX").oninput=function(){ P.tx=+this.value; draw(true); };
    ed.querySelector("#plcDone").onclick=function(){ var o=clean({x:P.x,y:P.y,s:P.s,r:P.r,tx:P.tx,ty:P.ty,iw:G.iw,ih:G.ih}); setPlace(car0,o); close(); repaint(); refresh(); };
    ed.querySelector("#plcReset").onclick=function(){ setPlace(car0,null); close(); repaint(); refresh(); };
    ed.querySelector("#plcBack").onclick=close;
    window.addEventListener("resize",function(){ if(ed&&!ed.hidden) fit(); });
  }
  function clampR(r){ return Math.max(-180,Math.min(180,r)); }
  function fit(){
    var land=window.innerWidth>window.innerHeight, ctl=ed.querySelector(".plcCtl");
    var aw=land?window.innerWidth-ctl.offsetWidth-24:window.innerWidth-24, ah=land?window.innerHeight-24:window.innerHeight-ctl.offsetHeight-24;
    var s=Math.min(aw/G.iw,ah/G.ih), f=ed.querySelector("#plcFrame");
    G.W=Math.max(60,Math.floor(G.iw*s)); G.H=Math.max(40,Math.floor(G.ih*s)); f.style.width=G.W+"px"; f.style.height=G.H+"px"; draw();
  }
  function draw(fromSlider){
    var el=ed.querySelector("#plcPlate"), g=geom(G.W,G.H,G.iw,G.ih,true);
    el.style.cssText=css(P,g); G.dw=g.dw; G.dh=g.dh;
    if(!fromSlider){ ed.querySelector("#plcS").value=(P.s*100).toFixed(1); ed.querySelector("#plcR").value=Math.max(-90,Math.min(90,P.r)); ed.querySelector("#plcTY").value=P.ty; ed.querySelector("#plcTX").value=P.tx; }
  }
  function snap(){ var ids=Object.keys(ptr); if(ids.length>=2){ var a=ptr[ids[0]],b=ptr[ids[1]]; return {n:2,d:Math.hypot(b.x-a.x,b.y-a.y)||1,a:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,p:JSON.parse(JSON.stringify(P))}; }
    if(ids.length===1){ var q=ptr[ids[0]]; return {n:1,cx:q.x,cy:q.y,p:JSON.parse(JSON.stringify(P))}; } return null; }
  function down(e){ e.preventDefault(); try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(x){} ptr[e.pointerId]={x:e.clientX,y:e.clientY}; gs=snap(); }
  function move(e){ if(!ptr[e.pointerId]||!gs) return; ptr[e.pointerId]={x:e.clientX,y:e.clientY}; var n=Object.keys(ptr).length, s=snap();
    if(gs.n===1&&n===1){ P.x=num(gs.p.x+(s.cx-gs.cx)/G.dw,0,1,P.x); P.y=num(gs.p.y+(s.cy-gs.cy)/G.dh,0,1,P.y); }
    else if(gs.n===2&&n>=2){ P.s=num(gs.p.s*s.d/gs.d,.02,.45,P.s); var da=s.a-gs.a; da=((da+540)%360)-180; P.r=clampR(gs.p.r+da);
      P.x=num(gs.p.x+(s.cx-gs.cx)/G.dw,0,1,P.x); P.y=num(gs.p.y+(s.cy-gs.cy)/G.dh,0,1,P.y); }
    draw(); }
  function up(e){ delete ptr[e.pointerId]; gs=snap(); }
  function openEditor(){
    var c=curCar(); if(!c||!c.photo||!text(c)) return;
    if(!ed) build();
    car0=c; ptr={}; gs=null;
    var img=ed.querySelector("#plcImg"), done=false, ready=function(){
      if(done||!img.naturalWidth) return; done=true;
      G={iw:img.naturalWidth,ih:img.naturalHeight,W:0,H:0,dw:1,dh:1};
      var old=getPlace(c); P=old?{x:old.x,y:old.y,s:old.s,r:old.r,tx:old.tx,ty:old.ty}:{x:.5,y:.7,s:.08,r:0,tx:0,ty:0};
      var t=text(c), pl=ed.querySelector("#plcPlate"); pl.outerHTML=markup(t,"plcP"," ").replace("<div ","<div id='plcPlate' ");
      ed.hidden=false; document.documentElement.style.overflow="hidden"; fit(); };
    img.onload=ready; img.src=c.photo; if(img.complete&&img.naturalWidth) ready();
  }
  function close(){ if(ed) ed.hidden=true; document.documentElement.style.overflow=""; ptr={}; gs=null; }

  /* ---- long-press on the plate opens the editor ---- */
  var lp=null, swallowUntil=0;
  function lpClear(){ if(lp){ clearTimeout(lp.t); lp=null; } }
  document.addEventListener("pointerdown",function(e){
    var t=e.target.closest&&e.target.closest("#pgLive .hplate:not(.regchip),#pgLive .pplate"); if(!t) return; lpClear();
    lp={x:e.clientX,y:e.clientY,t:setTimeout(function(){ lp=null; swallowUntil=Date.now()+900; try{ navigator.vibrate&&navigator.vibrate(12); }catch(x){} openEditor(); },550)}; },true);
  document.addEventListener("pointermove",function(e){ if(lp&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10) lpClear(); },true);
  document.addEventListener("pointerup",lpClear,true); document.addEventListener("pointercancel",lpClear,true);
  document.addEventListener("click",function(e){ if(Date.now()<swallowUntil){ e.stopPropagation(); e.preventDefault(); swallowUntil=0; } },true);
  document.addEventListener("contextmenu",function(e){ if(e.target.closest&&e.target.closest(".hplate,.pplate")) e.preventDefault(); });

  window.D3Plate={html:heroHtml,layout:layout,posterHtml:posterHtml,posterOrigin:posterOrigin,mount:mount,open:openEditor,style:style,place:getPlace,STYLES:STYLES};
  var m=document.getElementById("psSet"); if(m) mount(m);
  repaint(); // home-app.js painted before this file loaded: paint again so the plate shows
})();
