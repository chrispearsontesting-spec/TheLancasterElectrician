/* Trac3 car photo positioner. Opens full screen with a frame the exact shape of
   the home hero and lets the user drag (one finger), pinch to zoom and twist to
   tilt (two fingers). Double-tap resets. The photo always covers the frame (zoom
   1x-5x of "just covers" at the current tilt), so there are never empty edges.
   Set returns the baked crop (what the hero shows) plus the transform, so it can
   be reopened where it was left.

   D3PhotoPos.open({src, frame:{w,h}, radius, plate, transform, onSet(res), onCancel, onChange})
     res = {photo: dataURL crop, transform:{v:1,z,x,y,r}}
     transform: z zoom (1..5), x/y offset as a fraction of frame width/height, r degrees.
   D3PhotoPos.render(img, frame, transform, outW) -> canvas  (pure, used by tests) */
(function(root){
  "use strict";
  var ZMAX=5, el=null, st=null;

  function css(){
    if(document.getElementById("d3ppCss")) return;
    var s=document.createElement("style"); s.id="d3ppCss";
    s.textContent=
      "#d3pp{position:fixed;inset:0;z-index:60;background:#0b0c0e;display:flex;flex-direction:column;align-items:center;padding:calc(14px + env(safe-area-inset-top,0px)) 12px calc(16px + env(safe-area-inset-bottom,0px));box-sizing:border-box;font-family:inherit;color:#f2f2f2}"+
      "#d3pp[hidden]{display:none !important}"+
      "#d3pp h2{margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-.02em;align-self:stretch;max-width:440px;width:100%;margin-left:auto;margin-right:auto}"+
      "#d3pp .ppStage{flex:1;display:flex;align-items:center;justify-content:center;width:100%;min-height:0}"+
      "#d3ppFrame{position:relative;overflow:hidden;background:#1c1c1e;border:1px solid rgba(255,255,255,.14);touch-action:none;cursor:grab;flex-shrink:0;box-shadow:0 8px 28px rgba(0,0,0,.45)}"+
      "#d3ppFrame.drag{cursor:grabbing}"+
      "#d3ppImg{position:absolute;left:50%;top:50%;max-width:none;transform-origin:0 0;will-change:transform;pointer-events:none;user-select:none;-webkit-user-drag:none;display:block}"+
      "#d3ppFrame .ppPlate{position:absolute;inset:0;pointer-events:none;opacity:.9}"+
      "#d3ppFrame .ppGrid{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .15s;background:linear-gradient(to right,transparent calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% + .5px),transparent calc(66.66% + .5px)),linear-gradient(to bottom,transparent calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% + .5px),transparent calc(66.66% + .5px))}"+
      "#d3ppFrame.drag .ppGrid{opacity:1}"+
      "#d3pp .ppRead{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:rgba(11,12,14,.75);color:var(--accent);border-radius:10px;padding:4px 10px;font-size:13px;font-weight:700;pointer-events:none;opacity:0;transition:opacity .15s}"+
      "#d3pp .ppRead.on{opacity:1}"+
      "#d3pp .ppHint{color:#8b8b8b;font-size:13px;margin:14px 0 12px;text-align:center;line-height:1.35}"+
      "#d3pp .ppBar{width:100%;max-width:440px;display:grid;grid-template-columns:1fr 1fr;gap:8px}"+
      "#d3pp .ppBar .btn{margin:0 !important;width:100% !important}"+
      "#d3ppSet{grid-column:1 / -1;min-height:52px !important;background:var(--accent) !important;background-image:none !important;color:#0b0c0e !important;border:0 !important;font-weight:700 !important;box-shadow:none !important}"+
      "#d3ppSet .ico{color:#0b0c0e !important}"+
      "#d3ppChange{color:var(--accent) !important}#d3ppChange[hidden]{display:none !important}";
    document.head.appendChild(s);
  }
  function build(){
    if(el) return el;
    css();
    el=document.createElement("div");
    el.id="d3pp"; el.hidden=true;
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-label","Position photo");
    el.innerHTML='<h2>Position your photo</h2>'+
      '<div class="ppStage"><div id="d3ppFrame"><img id="d3ppImg" alt="Car photo"/><div class="ppGrid"></div><div class="ppPlate" id="d3ppPlate"></div><div class="ppRead" id="d3ppRead"></div></div></div>'+
      '<p class="ppHint">Drag to move, pinch to zoom, twist to tilt. Double-tap to reset.</p>'+
      '<div class="ppBar">'+
        '<button class="btn" type="button" id="d3ppChange" data-ico="photo">Change</button>'+
        '<button class="btn" type="button" id="d3ppCancel" data-ico="close">Cancel</button>'+
        '<button class="btn" type="button" id="d3ppSet" data-ico="check">Set</button>'+
      '</div>';
    document.body.appendChild(el);
    el.querySelector("#d3ppCancel").onclick=function(){ var cb=st&&st.onCancel; close(); if(cb) cb(); };
    el.querySelector("#d3ppSet").onclick=function(){ set(); };
    el.querySelector("#d3ppChange").onclick=function(){ if(st&&st.onChange) st.onChange(); };
    document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&st){ e.preventDefault(); var cb=st.onCancel; close(); if(cb) cb(); } });
    bindGestures(el.querySelector("#d3ppFrame"));
    if(root.dipstickIcons) try{ root.dipstickIcons(el); }catch(e){}
    return el;
  }

  /* ---------- geometry (frame-centred coordinates, y down) ---------- */
  function rad(d){ return d*Math.PI/180; }
  /* Smallest scale at which an iw x ih image, rotated by r, covers a fw x fh frame. */
  function coverScale(iw,ih,fw,fh,rDeg){
    var c=Math.abs(Math.cos(rad(rDeg))), s=Math.abs(Math.sin(rad(rDeg))), a=fw/2, b=fh/2;
    return Math.max((a*c+b*s)/(iw/2),(a*s+b*c)/(ih/2));
  }
  /* Clamp so the frame stays inside the image: work in the image's own (rotated) axes. */
  function clampT(t,S,iw,ih,fw,fh,rDeg){
    var r=rad(rDeg), c=Math.cos(r), s=Math.sin(r), ac=Math.abs(c), as=Math.abs(s), a=fw/2, b=fh/2;
    var lx=( c*t.x+s*t.y)/S, ly=(-s*t.x+c*t.y)/S; /* R(-r)·t / S */
    var mx=Math.max(0,iw/2-(a*ac+b*as)/S), my=Math.max(0,ih/2-(a*as+b*ac)/S);
    lx=Math.max(-mx,Math.min(mx,lx)); ly=Math.max(-my,Math.min(my,ly));
    return {x:(c*lx-s*ly)*S, y:(s*lx+c*ly)*S};
  }
  function normRot(r){ r=((r+180)%360+360)%360-180; return r; }
  function fromSaved(tr,fw,fh){
    tr=tr||{};
    return {z:Math.max(1,Math.min(ZMAX,+tr.z||1)), r:normRot(+tr.r||0), x:(+tr.x||0)*fw, y:(+tr.y||0)*fh};
  }
  /* Pure renderer: draw the image with transform into a canvas of the frame's shape. */
  function render(img,frame,tr,outW){
    var iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height, fw=frame.w, fh=frame.h;
    var t=fromSaved(tr,fw,fh), S=coverScale(iw,ih,fw,fh,t.r)*t.z;
    var p=clampT({x:t.x,y:t.y},S,iw,ih,fw,fh,t.r);
    outW=Math.round(outW||Math.max(fw*2,720)); var outH=Math.round(outW*fh/fw), k=outW/fw;
    var cv=document.createElement("canvas"); cv.width=outW; cv.height=outH;
    var x=cv.getContext("2d"); x.imageSmoothingQuality="high";
    x.fillStyle="#1c1c1e"; x.fillRect(0,0,outW,outH);
    x.translate(outW/2,outH/2); x.scale(k,k); x.translate(p.x,p.y); x.rotate(rad(t.r)); x.scale(S,S);
    x.drawImage(img,-iw/2,-ih/2);
    return cv;
  }

  /* ---------- live state ---------- */
  function S(){ return coverScale(st.iw,st.ih,st.fw,st.fh,st.r)*st.z; }
  function clamp(){
    st.z=Math.max(1,Math.min(ZMAX,st.z));
    var p=clampT({x:st.x,y:st.y},S(),st.iw,st.ih,st.fw,st.fh,st.r); st.x=p.x; st.y=p.y;
  }
  var raf=0;
  function apply(){
    if(raf) return;
    raf=requestAnimationFrame(function(){
      raf=0; if(!st) return;
      clamp();
      var img=el.querySelector("#d3ppImg"), sc=S();
      /* translate to frame centre + offset, rotate, scale, then centre the image on its own middle */
      img.style.transform="translate("+st.x+"px,"+st.y+"px) rotate("+st.r+"deg) scale("+sc+") translate("+(-st.iw/2)+"px,"+(-st.ih/2)+"px)";
    });
  }
  function readout(txt){
    var r=el.querySelector("#d3ppRead"); if(!r) return;
    if(txt){ r.textContent=txt; r.classList.add("on"); } else r.classList.remove("on");
  }
  function reset(){ st.z=1; st.x=0; st.y=0; st.r=0; apply(); }

  function bindGestures(frame){
    var ptrs={}, g=null, lastTap=0, lastTapX=0, lastTapY=0, moved=false;
    function list(){ return Object.keys(ptrs).map(function(k){ return ptrs[k]; }); }
    function centre(){ var r=frame.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }
    function snapshot(){
      var l=list(), c=centre();
      if(l.length>=2){
        var a=l[0], b=l[1];
        g={two:true, d:Math.hypot(b.x-a.x,b.y-a.y)||1, ang:Math.atan2(b.y-a.y,b.x-a.x),
           mx:(a.x+b.x)/2-c.x, my:(a.y+b.y)/2-c.y, S:S(), r:st.r, x:st.x, y:st.y};
      }else if(l.length===1){
        g={two:false, px:l[0].x, py:l[0].y, x:st.x, y:st.y};
      }else g=null;
    }
    frame.addEventListener("pointerdown",function(e){
      if(!st) return;
      e.preventDefault();
      try{ frame.setPointerCapture(e.pointerId); }catch(err){}
      ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
      if(list().length===1) moved=false;
      frame.classList.add("drag");
      snapshot();
    });
    frame.addEventListener("pointermove",function(e){
      if(!st||!ptrs[e.pointerId]) return;
      e.preventDefault();
      ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
      var l=list(); if(!g) return;
      if(g.two&&l.length>=2){
        var a=l[0], b=l[1], c=centre();
        var d=Math.hypot(b.x-a.x,b.y-a.y)||1, ang=Math.atan2(b.y-a.y,b.x-a.x);
        var mx=(a.x+b.x)/2-c.x, my=(a.y+b.y)/2-c.y;
        var dr=(ang-g.ang)*180/Math.PI, rNew=normRot(g.r+dr);
        /* zoom from the pinch, but never below "just covers" at the new tilt */
        var want=g.S*d/g.d, cov=coverScale(st.iw,st.ih,st.fw,st.fh,rNew);
        var z=Math.max(1,Math.min(ZMAX,want/cov)), Sn=cov*z, k=Sn/g.S;
        /* keep the point under the fingers fixed: T' = M' + k·R(dr)·(T - M) */
        var q=rad(dr), cs=Math.cos(q), sn=Math.sin(q), vx=g.x-g.mx, vy=g.y-g.my;
        st.r=rNew; st.z=z;
        st.x=mx+k*(cs*vx-sn*vy); st.y=my+k*(sn*vx+cs*vy);
        moved=true;
        readout(Math.round(st.z*10)/10+"x"+(Math.abs(st.r)>=0.5?" · "+Math.round(st.r)+"°":""));
        apply();
      }else if(!g.two&&l.length===1){
        var dx=l[0].x-g.px, dy=l[0].y-g.py;
        if(Math.abs(dx)+Math.abs(dy)>4) moved=true;
        st.x=g.x+dx; st.y=g.y+dy; apply();
      }
    });
    function end(e){
      if(!ptrs[e.pointerId]) return;
      var wasSingle=list().length===1;
      delete ptrs[e.pointerId];
      if(!list().length){
        frame.classList.remove("drag"); readout("");
        if(st&&Math.abs(st.r)<2&&st.r!==0){ st.r=0; apply(); } /* snap level */
        if(wasSingle&&!moved&&e.type==="pointerup"){
          var now=Date.now();
          if(now-lastTap<320&&Math.hypot(e.clientX-lastTapX,e.clientY-lastTapY)<30){ reset(); lastTap=0; }
          else { lastTap=now; lastTapX=e.clientX; lastTapY=e.clientY; }
        }
      }
      snapshot();
    }
    frame.addEventListener("pointerup",end);
    frame.addEventListener("pointercancel",end);
    frame.addEventListener("wheel",function(e){
      if(!st) return; e.preventDefault();
      if(e.shiftKey){ st.r=normRot(st.r+(e.deltaY<0?-2:2)); apply(); return; }
      var r=frame.getBoundingClientRect(), mx=e.clientX-r.left-r.width/2, my=e.clientY-r.top-r.height/2;
      var S0=S(), z0=st.z; st.z=Math.max(1,Math.min(ZMAX,st.z*(e.deltaY<0?1.1:1/1.1)));
      var k=(coverScale(st.iw,st.ih,st.fw,st.fh,st.r)*st.z)/S0;
      st.x=mx+k*(st.x-mx); st.y=my+k*(st.y-my); apply();
    },{passive:false});
    frame.addEventListener("dblclick",function(e){ if(st){ e.preventDefault(); reset(); } });
  }

  function fitFrame(frame){
    var aw=Math.min((root.innerWidth||360)-24,440), ah=Math.max(120,(root.innerHeight||800)-260);
    var w=frame.w, h=frame.h, k=Math.min(aw/w, ah/h, 1.0e9);
    return {w:w*k, h:h*k, k:k};
  }
  function open(opts){
    build();
    var frame=opts.frame||{w:Math.min(440,(root.innerWidth||360))-24,h:150};
    var fit=fitFrame(frame);
    var f=el.querySelector("#d3ppFrame"), img=el.querySelector("#d3ppImg");
    f.style.width=fit.w+"px"; f.style.height=fit.h+"px";
    f.style.borderRadius=opts.radius||"18px 18px 0 0";
    var pl=el.querySelector("#d3ppPlate"); pl.innerHTML=opts.plate||"";
    pl.style.transform="scale("+fit.k+")"; pl.style.transformOrigin=opts.plateOrigin||"bottom right";
    var ch=el.querySelector("#d3ppChange"); ch.hidden=!opts.onChange;
    el.querySelector("#d3ppCancel").style.gridColumn=opts.onChange?"":"1 / -1";
    el.hidden=false; document.documentElement.style.overflow="hidden";
    img.style.visibility="hidden";
    return new Promise(function(ok,no){
      var im=new Image();
      im.onload=function(){
        st={iw:im.naturalWidth||im.width, ih:im.naturalHeight||im.height, fw:fit.w, fh:fit.h, z:1, x:0, y:0, r:0,
            img:im, frame:frame, onSet:opts.onSet, onCancel:opts.onCancel, onChange:opts.onChange};
        var t=fromSaved(opts.transform,fit.w,fit.h); st.z=t.z; st.r=t.r; st.x=t.x; st.y=t.y;
        img.src=im.src; img.style.width=st.iw+"px"; img.style.height=st.ih+"px";
        apply();
        requestAnimationFrame(function(){ img.style.visibility="visible"; ok(); });
      };
      im.onerror=function(){ close(); no(new Error("Can't open that photo")); };
      im.src=opts.src;
    });
  }
  function current(){
    if(!st) return null;
    clamp();
    return {v:1, z:Math.round(st.z*1000)/1000, r:Math.round(st.r*10)/10, x:Math.round(st.x/st.fw*10000)/10000, y:Math.round(st.y/st.fh*10000)/10000};
  }
  function set(){
    if(!st) return;
    var tr=current(), cv=render(st.img,st.frame,tr), cb=st.onSet;
    var res={photo:cv.toDataURL("image/jpeg",0.78), transform:tr, image:st.img};
    close();
    if(cb) cb(res);
  }
  function close(){
    if(el) el.hidden=true;
    document.documentElement.style.overflow="";
    st=null;
  }
  var api={open:open, close:close, render:render, coverScale:coverScale, clampT:clampT, state:function(){ return st?Object.assign({},st,{img:null}):null; }, current:current, isOpen:function(){ return !!st; }};
  root.D3PhotoPos=api;
})(window);
