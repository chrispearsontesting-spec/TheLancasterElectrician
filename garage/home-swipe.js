/* Trac3 home: swipe anywhere to change car (SwipeCars), with the effect chosen in Settings (gt.swipeFx: "slide" | "turn").
   The next car's page is built on demand as a still copy: the garage is briefly pointed at that car, the page painted and copied,
   then put back (all in one go, so nothing flickers). Committing a swipe runs the app's own step() so every other part stays in sync. */
(function(){
  var deck=document.getElementById("deck"), live=document.getElementById("pgLive");
  if(!deck||!live||!window.SwipeCars||typeof window.paint!=="function"||typeof window.step!=="function") return;
  var KEY="gt.swipeFx";
  function fx(){ try{ return localStorage.getItem(KEY)==="turn"?"turn":"slide"; }catch(e){ return "slide"; } }
  function garage(){ try{ var s=JSON.parse(localStorage.getItem("gt.garage")||"null"); return s&&s.cars&&s.cars.length?s:null; }catch(e){ return null; } }
  var src={
    has:function(dir,wrap){ var s=garage(); if(!s||s.cars.length<2) return false; var j=(s.i||0)+dir; return !!wrap||(j>=0&&j<s.cars.length); },
    make:function(dir){ var raw=localStorage.getItem("gt.garage"), s=garage(); if(!s) return null; var n=s.cars.length, copy=null;
      s.i=(((s.i||0)+dir)%n+n)%n;
      try{ localStorage.setItem("gt.garage",JSON.stringify(s)); window.paint(); copy=SwipeCars.still(live.cloneNode(true)); copy.removeAttribute("id"); }
      finally{ localStorage.setItem("gt.garage",raw); window.paint(); }
      return copy; },
    commit:function(dir){ window.step(dir); }
  };
  function blocked(){ return !!document.querySelector(".sheet.on,#d3pp:not([hidden])"); }
  var S=SwipeCars.create(deck,live,function(){ return fx()==="turn"?SwipeCars.pageTurn:SwipeCars.slide; },src,{blocked:blocked});
  // < > buttons use the same animation and still go round from the last car to the first.
  ["prev","next"].forEach(function(id){ var b=document.getElementById(id); if(!b) return; b.onclick=function(){ var dir=id==="next"?1:-1; if(!S.go(dir,true)) window.step(dir); }; });
  // Settings: Car swipe effect
  var seg=document.getElementById("fxSeg");
  function paintFx(){ if(!seg) return; [].forEach.call(seg.querySelectorAll("[data-fx]"),function(b){ b.setAttribute("aria-checked",b.getAttribute("data-fx")===fx()?"true":"false"); }); }
  if(seg){ seg.addEventListener("click",function(e){ var b=e.target.closest("[data-fx]"); if(!b) return; try{ localStorage.setItem(KEY,b.getAttribute("data-fx")); }catch(x){} paintFx(); }); paintFx(); }
})();
