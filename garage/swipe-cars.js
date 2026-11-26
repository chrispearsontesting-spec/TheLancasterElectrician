/* Trac3: change car by swiping anywhere on the screen. The page follows the finger.
   SwipeCars.create(deck, live, effect, src, opt) -> { go(dir), set(v), busy }
     deck   the clipping wrapper (position:relative)   live  the visible page inside it
     effect SwipeCars.slide (smooth slide + photo parallax) or SwipeCars.pageTurn (book page turn), or a function returning one
     src    { has(dir,wrap):bool, make(dir,wrap):Element|null, commit(dir,wrap) }
            make() returns the NEXT page as a still copy (SwipeCars.still); commit() makes it the real page.
   Vertical scroll vs horizontal swipe:
   - the page has touch-action:pan-y, so the browser keeps native vertical scrolling and only hands us horizontal moves;
   - nothing moves until the finger has travelled 10px; then it locks to one axis (horizontal only if |dx| > 1.2*|dy|);
     a vertical lock is left alone for the whole gesture, and if the browser starts a scroll it fires pointercancel and the page snaps back;
   - drags that start in the 20px Android back-gesture edges, on form fields, sliders, open sheets, or anything marked [data-noswipe] are ignored;
   - a tap (under 10px) is never a swipe, so buttons and the photo still work; the click that follows a real swipe is blocked;
   - it commits past a third of the screen or on a quick flick (0.45px/ms); at the first/last car the page only stretches a little and springs back. */
(function(){
  var EDGE=20, SLOP=10, LOCK=1.2, COMMIT=0.33, FLICK=0.45;
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function ease(t){ return 1-Math.pow(1-t,3); }
  /* A still copy of a page: keeps its ids so the page's CSS still applies (the real page comes first in the document, so lookups find that one), but nothing in it can be tapped or focused. */
  function still(n){ n.setAttribute("inert",""); n.setAttribute("aria-hidden","true"); n.style.pointerEvents="none"; return n; }
  var css=document.createElement("style"); css.textContent=
    ".swiping *{pointer-events:none !important}"+
    ".ptFlap{position:absolute;inset:0;z-index:5;display:none;pointer-events:none;overflow:hidden}.ptGhost{display:none}.ptPaper{position:absolute;inset:0}"+
    ".ptFold{position:absolute;top:0;bottom:0;width:46px;z-index:4;display:none;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(0,0,0,.38))}"+
    ".ptCast{position:absolute;top:0;bottom:0;width:36px;filter:blur(2px);z-index:4;display:none;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(0,0,0,.5))}"+
    ".ptUnder{position:absolute;top:0;bottom:0;width:70px;z-index:2;display:none;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.55),transparent)}"+
    ".hero img{will-change:transform}";
  document.head.appendChild(css);

  function create(deck,live,effect,src,opt){ opt=opt||{};
    function FX(){ return typeof effect==="function"?effect():effect; }
    var drag=null, anim=null, p=0, ghost=null, ghostDir=0, W=0, H=0, busy=false;
    function dropGhost(){ if(ghost&&ghost.parentNode) ghost.parentNode.removeChild(ghost); ghost=null; ghostDir=0; }
    function reset(){ FX().clear(live); if(ghost) FX().clear(ghost); dropGhost(); FX().end&&FX().end(deck); p=0; }
    function render(v,wrap){ p=v; var dir=v>0?1:-1; W=deck.clientWidth; H=deck.clientHeight;
      if(v===0){ reset(); return; }
      if(!src.has(dir,wrap)){ if(ghost) { FX().clear(ghost); dropGhost(); FX().end&&FX().end(deck); } FX().clear(live); FX().bounce(live,v,W); return; }
      if(ghostDir!==dir){ if(ghost){ FX().clear(ghost); dropGhost(); } FX().clear(live); FX().end&&FX().end(deck);
        ghost=src.make(dir,wrap); if(!ghost) return; ghostDir=dir; ghost.classList.add("ghost"); deck.appendChild(ghost); }
      FX().render(deck,live,ghost,Math.abs(v),dir,W,H); }
    function animate(to,ms,done,wrap){ cancelAnimationFrame(anim); busy=true; var from=p, t0=performance.now();
      (function f(now){ var t=clamp((now-t0)/ms,0,1); render(from+(to-from)*ease(t),wrap); if(t<1) anim=requestAnimationFrame(f); else { busy=false; if(done) done(); } })(t0); }
    function finish(dir,wrap){ animate(dir,FX().ms||280,function(){ reset(); src.commit(dir,wrap); deck.dispatchEvent(new CustomEvent("carchange",{bubbles:true,detail:{dir:dir}})); },wrap); }
    function blocked(e){
      if(busy||(opt.blocked&&opt.blocked())) return true;
      var t=e.target; if(!t||!t.closest) return true;
      return !!t.closest("input,textarea,select,[contenteditable],[data-noswipe],input[type=range]");
    }
    document.addEventListener("pointerdown",function(e){ if(e.pointerType==="mouse"&&e.button!==0) return;
      if(e.clientX<EDGE||e.clientX>window.innerWidth-EDGE||blocked(e)) return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null,lx:e.clientX,lt:performance.now(),v:0}; });
    document.addEventListener("pointermove",function(e){ if(!drag||e.pointerId!==drag.id) return;
      var dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if(!drag.axis){ if(Math.hypot(dx,dy)<SLOP) return; drag.axis=Math.abs(dx)>Math.abs(dy)*LOCK?"x":"y";
        if(drag.axis==="y"){ drag=null; return; } try{ document.documentElement.setPointerCapture(e.pointerId); }catch(x){} deck.classList.add("swiping"); }
      var now=performance.now(); drag.v=(e.clientX-drag.lx)/Math.max(1,now-drag.lt); drag.lx=e.clientX; drag.lt=now;
      var v=-dx/deck.clientWidth; if(!src.has(v>0?1:-1)) v*=0.25; render(clamp(v,-1,1)); e.preventDefault(); },{passive:false});
    function up(e,cancel){ if(!drag||e.pointerId!==drag.id) return; var d=drag; drag=null; deck.classList.remove("swiping"); if(!d.axis) return;
      deck.classList.add("justSwiped"); setTimeout(function(){ deck.classList.remove("justSwiped"); },80);
      var dir=p>0?1:-1, flick=-d.v*dir>FLICK; if(!cancel&&(Math.abs(p)>COMMIT||flick)&&src.has(dir)) finish(dir); else animate(0,220); }
    document.addEventListener("pointerup",function(e){ up(e,false); });
    document.addEventListener("pointercancel",function(e){ up(e,true); });
    document.addEventListener("click",function(e){ if(deck.classList.contains("justSwiped")){ e.stopPropagation(); e.preventDefault(); } },true);
    return {
      /* the < > buttons: same animation; wrap=true lets them go round from the last car to the first */
      go:function(dir,wrap){ if(busy||!src.has(dir,wrap)) return false; p=0; render(dir*0.001,wrap); finish(dir,wrap); return true; },
      set:function(v){ cancelAnimationFrame(anim); busy=false; render(v); },
      get busy(){ return busy; }
    };
  }

  /* 1) Smooth slide with photo parallax */
  function par(pg,x){ var im=pg.querySelector(".hero img"); if(im) im.style.transform=x?"translate3d("+x+"px,0,0) scale(1.08)":""; }
  var slide={ ms:280,
    render:function(deck,cur,nxt,q,dir,W){ var x=-dir*q*W;
      cur.style.transform="translate3d("+x+"px,0,0)"; nxt.style.transform="translate3d("+(dir*W+x)+"px,0,0)";
      cur.style.zIndex=2; nxt.style.zIndex=3; nxt.style.boxShadow=dir>0?"-18px 0 40px rgba(0,0,0,.45)":"18px 0 40px rgba(0,0,0,.45)";
      par(cur,dir*q*W*0.3); par(nxt,-dir*(1-q)*W*0.3); },
    bounce:function(cur,v,W){ cur.style.transform="translate3d("+(-v*W)+"px,0,0)"; },
    clear:function(pg){ pg.style.transform=""; pg.style.boxShadow=""; pg.style.zIndex=""; par(pg,0); } };

  /* 2) Book page turn: the top page folds over from the right edge (a mirrored, shaded flap), revealing the next car beneath.
        Going back, the previous page unfolds onto the screen from the left. */
  var turnEls=null;
  function els(deck){ if(turnEls&&turnEls.deck===deck) return turnEls;
    var flap=document.createElement("div"); flap.className="ptFlap"; var ghost=document.createElement("div"); ghost.className="ptGhost"; var paper=document.createElement("div"); paper.className="ptPaper";
    flap.appendChild(ghost); flap.appendChild(paper);
    var fold=document.createElement("div"); fold.className="ptFold"; var cast=document.createElement("div"); cast.className="ptCast"; var under=document.createElement("div"); under.className="ptUnder";
    [under,fold,cast,flap].forEach(function(n){ deck.appendChild(n); }); turnEls={deck:deck,flap:flap,ghost:ghost,paper:paper,fold:fold,cast:cast,under:under,src:null}; return turnEls; }
  var pageTurn={ ms:420,
    render:function(deck,cur,nxt,q,dir,W,H){ var E=els(deck), top=dir>0?cur:nxt, bot=dir>0?nxt:cur, t=dir>0?q:1-q;
      top.style.zIndex=3; bot.style.zIndex=1; bot.style.transform="";
      if(E.src!==top){ E.ghost.innerHTML=""; var c=still(top.cloneNode(true)); c.style.cssText="position:absolute;inset:0;visibility:visible;transform:none;clip-path:none"; c.classList.remove("ghost"); E.ghost.appendChild(c); E.src=top; }
      var xf=W*(1-t), d=W*t, xe=xf-d, curl=Math.sin(Math.PI*t)*70;
      top.style.clipPath="polygon(0 0,"+(xf+curl*0.4)+"px 0,"+(xf-curl*0.4)+"px 100%,0 100%)";
      var show=t>0.001&&t<0.999; [E.flap,E.fold,E.cast,E.under].forEach(function(n){ n.style.display=show?"block":"none"; }); if(!show) return;
      E.flap.style.clipPath="polygon("+Math.max(xe+curl*1.2,0)+"px 0,"+(xf+curl*0.4)+"px 0,"+(xf-curl*0.4)+"px 100%,"+Math.max(xe-curl*0.2,0)+"px 100%)";
      E.ghost.style.transform="translateX("+(2*xf)+"px) scaleX(-1)";
      var e0=Math.max(xe,0); E.paper.style.background="linear-gradient(90deg,#121317 "+e0+"px,#1a1c21 "+(e0+d*0.3)+"px,#272a31 "+(e0+d*0.7)+"px,#3a3e48 "+(xf-14)+"px,#2b2e35 "+(xf-3)+"px,#16171b "+(xf+2)+"px)";
      E.fold.style.left=(xf-46)+"px"; E.fold.style.opacity=Math.min(1,t*4);
      E.cast.style.left=(Math.max(xe,0)-36)+"px"; E.cast.style.opacity=xe>0?Math.min(1,t*3):0;
      E.under.style.left=xf+"px"; E.under.style.opacity=1-t*0.6; },
    bounce:function(cur,v,W){ cur.style.transform="translate3d("+(-v*W*0.5)+"px,0,0)"; },
    clear:function(pg){ pg.style.clipPath=""; pg.style.transform=""; pg.style.zIndex=""; },
    end:function(deck){ var E=els(deck); [E.flap,E.fold,E.cast,E.under].forEach(function(n){ n.style.display="none"; }); E.src=null; E.ghost.innerHTML=""; } };

  window.SwipeCars={create:create,slide:slide,pageTurn:pageTurn,still:still};
})();
