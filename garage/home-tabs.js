/* Driv3 home: 4 tabs, gear settings, per-car links. Last tab kept in localStorage 'driv3.homeTab'. */
(function(){
  // Simple home (groups open their own pages). Old tab hashes go to the matching page.
  function jump(){
    var h=(location.hash||"").replace("#","");
    var to={drive:"drive-hub.html",docs:"history.html",qr:"history.html#share"}[h];
    if(to){ location.replace(to); return; }
    if(h==="car"){ var el=document.getElementById("datesToggle"); if(el) el.scrollIntoView({block:"start"}); }
  }
  jump(); window.addEventListener("hashchange",jump);
  var st=document.getElementById("settings");
  document.getElementById("gear").onclick=function(){st.classList.add("on")};
  document.getElementById("setClose").onclick=function(){st.classList.remove("on")};
  st.onclick=function(e){ if(e.target===st) st.classList.remove("on") };
  // Car showcase chip: Published / Draft, from data on the phone (no network).
  window.driv3ShowChip=function(){
    var chip=document.getElementById("showChip"); if(!chip) return;
    try{
      var g=JSON.parse(localStorage.getItem("gt.garage")||"null"), c=g&&g.cars&&g.cars[g.i||0]||{}, dr=JSON.parse(localStorage.getItem("gt.showDrafts")||"{}")||{};
      if(c.showId&&c.showPublished){ chip.textContent="Published"; chip.className="chip pub"; chip.hidden=false; }
      else if(c.showLocal&&dr[c.showLocal]){ chip.textContent="Draft"; chip.className="chip"; chip.hidden=false; }
      else chip.hidden=true;
    }catch(e){ chip.hidden=true; }
  };
  function links(){
    try{
      var g=JSON.parse(localStorage.getItem("gt.garage")||"null"), c=g&&g.cars&&g.cars[g.i||0]||{};
      var p=String(c.plate||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
      document.getElementById("lnkTax").href="tax.html"+(p?"?plate="+p:"");
      document.getElementById("lnkMot").href="mot.html"+(p?"?plate="+p:"")+"#history";
    }catch(e){}
    if(window.driv3ShowChip) window.driv3ShowChip();
  }
  var _p=window.paint; if(typeof _p==="function"){ window.paint=function(){ _p.apply(this,arguments); links(); }; }
  links();
})();
