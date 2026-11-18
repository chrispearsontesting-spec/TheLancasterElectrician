/* Insurance compare helpers. GoCompare cannot be pre-filled by URL, so we
   copy the plate in standard UK format (AB12 CDE) and then open the site. */
(function(root){
  function car(){
    try{
      var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
      if(s&&s.cars&&s.cars.length) return s.cars[s.i]||s.cars[0];
    }catch(e){}
    return {};
  }
  function vrnOf(c){ return String((c&&c.plate)||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  function formatPlate(c){
    var v=vrnOf(c||car());
    if(!v) return "";
    if(v.length>4) return v.slice(0,-3)+" "+v.slice(-3);
    return v;
  }
  function compareUrl(){ return "https://www.gocompare.com/journeys/car/vehicle"; }
  function toast(msg){
    var t=document.getElementById("plateToast");
    if(!t){
      t=document.createElement("div");
      t.id="plateToast";
      t.setAttribute("role","status");
      t.style.cssText="position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:90;background:#1c1c1e;color:#f2f2f2;border:1px solid #2a2a2e;border-radius:14px;padding:10px 16px;font-weight:600;font-size:14px;text-align:center;max-width:90%;box-shadow:0 4px 16px rgba(0,0,0,.4)";
      document.body.appendChild(t);
    }
    t.textContent=msg;
    t.style.display="block";
    clearTimeout(toast._t);
    toast._t=setTimeout(function(){ t.style.display="none"; },3500);
  }
  function fallbackCopy(text){
    var a=document.createElement("textarea");
    a.value=text; a.setAttribute("readonly",""); a.style.position="fixed"; a.style.left="-9999px";
    document.body.appendChild(a); a.select();
    try{ document.execCommand("copy"); }catch(e){}
    document.body.removeChild(a);
  }
  function openUrl(url){
    if(root.driv3OpenExternal) return root.driv3OpenExternal(url);
    /* "noopener" makes window.open return null even when it worked, so open
       plainly and cut the opener; only fall back to navigating if truly blocked. */
    var w=null;
    try{ w=root.open(url,"_blank"); }catch(e){}
    if(w){ try{ w.opener=null; }catch(e){} }
    else root.location.href=url;
  }
  function copyPlateAndOpen(url){
    var text=formatPlate();
    var dest=url||compareUrl();
    function go(){
      if(text) toast("Plate copied — paste it in");
      openUrl(dest);
    }
    if(!text){ openUrl(dest); return; }
    if(root.navigator&&root.navigator.clipboard&&root.navigator.clipboard.writeText){
      root.navigator.clipboard.writeText(text).then(go).catch(function(){ fallbackCopy(text); go(); });
    }else{ fallbackCopy(text); go(); }
  }
  document.addEventListener("click",function(e){
    var b=e.target&&e.target.closest&&e.target.closest("[data-copy-plate]");
    if(!b) return;
    e.preventDefault();
    copyPlateAndOpen(b.getAttribute("data-copy-plate")||b.getAttribute("href")||compareUrl());
  });
  root.d3CompareUrl=function(c){ return compareUrl(); };
  root.d3FormatPlate=formatPlate;
  root.d3CopyPlateAndOpen=copyPlateAndOpen;
})(typeof window!=="undefined"?window:this);
