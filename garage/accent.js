/* Trac3 app colour. Load first in <head> on every page (sync, before CSS) so there is no flash.
   Choice is saved on this phone in localStorage "gt.accent": a preset name (blue|green|red|orange|white; default blue) or, for a colour
   picked on the wheel, a "#rrggbb" string. --on-accent (text on a solid accent button) is worked out from the colour's contrast.
   CSS uses var(--accent) / rgba(var(--accent-rgb),a) / var(--on-accent) (text on a solid accent button). */
(function(){
  var P={
    blue:  {name:"Blue",  hex:"#7dd3fc", rgb:"125,211,252"},
    green: {name:"Green", hex:"#86efac", rgb:"134,239,172"},
    red:   {name:"Red",   hex:"#fca5a5", rgb:"252,165,165"},
    orange:{name:"Orange",hex:"#fdba74", rgb:"253,186,116"},
    white: {name:"White", hex:"#f1f5f9", rgb:"241,245,249"}
  };
  var KEY="gt.accent", ORDER=["blue","green","red","orange","white"], HEX=/^#[0-9a-f]{6}$/i;
  function get(){ var k="blue"; try{ k=localStorage.getItem(KEY)||"blue"; }catch(e){} return P[k]?k:(HEX.test(k)?k.toLowerCase():"blue"); }
  function lum(r,g,b){ function f(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); } return .2126*f(r)+.7152*f(g)+.0722*f(b); }
  function parse(hex){ return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]; }
  /* text colour for a solid accent button: whichever of near-black / white has the better contrast */
  function onAccent(hex){ var c=parse(hex), L=lum(c[0],c[1],c[2]), dark=(L+.05)/(lum(11,12,14)+.05), light=1.05/(L+.05); return dark>=light?"#0b0c0e":"#ffffff"; }
  function hsv2hex(h,s,v){ h=((h%360)+360)%360; var c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c, r=0,g=0,b=0;
    if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
    var t=function(n){ return ("0"+Math.round((n+m)*255).toString(16)).slice(-2); }; return "#"+t(r)+t(g)+t(b); }
  function hex2hsv(hex){ var c=parse(hex), r=c[0]/255,g=c[1]/255,b=c[2]/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn, h=0;
    if(d){ if(mx===r) h=60*(((g-b)/d)%6); else if(mx===g) h=60*((b-r)/d+2); else h=60*((r-g)/d+4); } return {h:(h+360)%360,s:mx?d/mx:0,v:mx}; }
  function entry(k){ if(P[k]) return P[k]; var c=parse(k); return {name:"Custom",hex:k,rgb:c.join(",")}; }
  function apply(k){
    var c=entry(k), s=document.documentElement.style;
    s.setProperty("--accent",c.hex); s.setProperty("--accent-rgb",c.rgb); s.setProperty("--on-accent",P[k]?"#0b0c0e":onAccent(c.hex));
    document.documentElement.setAttribute("data-accent",P[k]?k:"custom");
    window.T3Accent.key=k; window.T3Accent.hex=c.hex; window.T3Accent.rgb=c.rgb; window.T3Accent.onAccent=P[k]?"#0b0c0e":onAccent(c.hex);
  }
  window.T3Accent={ palette:P, order:ORDER, key:"blue", hex:P.blue.hex, rgb:P.blue.rgb, onAccent:"#0b0c0e",
    get:get, onAccentFor:onAccent, hsv2hex:hsv2hex, hex2hsv:hex2hsv,
    isCustom:function(){ return !P[window.T3Accent.key]; },
    /* k = preset name, or "#rrggbb" for any colour */
    set:function(k){ k=String(k||""); if(!P[k]){ if(!HEX.test(k)) return; k=k.toLowerCase(); }
      try{ if(k==="blue") localStorage.removeItem(KEY); else localStorage.setItem(KEY,k); }catch(e){} apply(k);
      try{ window.dispatchEvent(new CustomEvent("t3accent",{detail:{key:k,hex:entry(k).hex}})); }catch(e){} },
    rgba:function(a){ return "rgba("+window.T3Accent.rgb+","+a+")"; } };
  apply(get());
  // Another page or tab changed it (or a backup was restored): follow along.
  window.addEventListener("storage",function(e){ if(e.key===KEY||e.key===null){ apply(get()); try{ window.dispatchEvent(new CustomEvent("t3accent",{detail:{key:get()}})); }catch(x){} } });
  window.addEventListener("pageshow",function(){ if(window.T3Accent.key!==get()) apply(get()); });
})();
