/* Trac3 app colour. Load first in <head> on every page (sync, before CSS) so there is no flash.
   Choice is saved on this phone in localStorage "gt.accent" (blue|green|red|orange|white; default blue).
   CSS uses var(--accent) / rgba(var(--accent-rgb),a) / var(--on-accent) (text on a solid accent button). */
(function(){
  var P={
    blue:  {name:"Blue",  hex:"#7dd3fc", rgb:"125,211,252"},
    green: {name:"Green", hex:"#86efac", rgb:"134,239,172"},
    red:   {name:"Red",   hex:"#fca5a5", rgb:"252,165,165"},
    orange:{name:"Orange",hex:"#fdba74", rgb:"253,186,116"},
    white: {name:"White", hex:"#f1f5f9", rgb:"241,245,249"}
  };
  var KEY="gt.accent", ORDER=["blue","green","red","orange","white"];
  function get(){ var k="blue"; try{ k=localStorage.getItem(KEY)||"blue"; }catch(e){} return P[k]?k:"blue"; }
  function apply(k){
    var c=P[k]||P.blue, s=document.documentElement.style;
    s.setProperty("--accent",c.hex); s.setProperty("--accent-rgb",c.rgb); s.setProperty("--on-accent","#0b0c0e");
    document.documentElement.setAttribute("data-accent",k);
    window.T3Accent.key=k; window.T3Accent.hex=c.hex; window.T3Accent.rgb=c.rgb;
  }
  window.T3Accent={ palette:P, order:ORDER, key:"blue", hex:P.blue.hex, rgb:P.blue.rgb,
    get:get,
    set:function(k){ if(!P[k]) return; try{ if(k==="blue") localStorage.removeItem(KEY); else localStorage.setItem(KEY,k); }catch(e){} apply(k);
      try{ window.dispatchEvent(new CustomEvent("t3accent",{detail:{key:k,hex:P[k].hex}})); }catch(e){} },
    rgba:function(a){ return "rgba("+window.T3Accent.rgb+","+a+")"; } };
  apply(get());
  // Another page or tab changed it (or a backup was restored): follow along.
  window.addEventListener("storage",function(e){ if(e.key===KEY||e.key===null){ apply(get()); try{ window.dispatchEvent(new CustomEvent("t3accent",{detail:{key:get()}})); }catch(x){} } });
  window.addEventListener("pageshow",function(){ if(window.T3Accent.key!==get()) apply(get()); });
})();
