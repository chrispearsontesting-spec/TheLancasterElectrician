/* Trac3 home Settings: Logo position (gt.logoPos: left | centre | right) and the App colour picker. */
(function(){
  var KEY="gt.logoPos", root=document.documentElement;
  function get(){ var v=""; try{ v=localStorage.getItem(KEY)||""; }catch(e){} return v==="centre"||v==="right"?v:"left"; }
  function paint(){ root.setAttribute("data-logo",get()); [].forEach.call(document.querySelectorAll("#lpSeg [data-lp]"),function(b){ b.setAttribute("aria-checked",b.getAttribute("data-lp")===get()?"true":"false"); }); }
  var seg=document.getElementById("lpSeg");
  if(seg) seg.addEventListener("click",function(e){ var b=e.target.closest("[data-lp]"); if(!b) return; var v=b.getAttribute("data-lp");
    try{ if(v==="left") localStorage.removeItem(KEY); else localStorage.setItem(KEY,v); }catch(x){} paint(); });
  paint();
  var host=document.getElementById("accSet"); if(host&&window.T3AccentPicker) T3AccentPicker.mount(host);
})();
