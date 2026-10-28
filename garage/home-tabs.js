/* Driv3 home: 4 tabs, gear settings, per-car links. Last tab kept in localStorage 'driv3.homeTab'. */
(function(){
  var KEY="driv3.homeTab", tabs=document.querySelectorAll("#tabs [data-tab]"), panes=document.querySelectorAll(".tabp");
  function show(t){
    var ok=false; for(var i=0;i<tabs.length;i++) if(tabs[i].dataset.tab===t) ok=true;
    if(!ok) t="car";
    for(var i=0;i<tabs.length;i++) tabs[i].setAttribute("aria-selected", tabs[i].dataset.tab===t?"true":"false");
    for(var j=0;j<panes.length;j++) panes[j].classList.toggle("on", panes[j].dataset.tab===t);
    try{localStorage.setItem(KEY,t)}catch(e){}
  }
  for(var i=0;i<tabs.length;i++) tabs[i].onclick=function(){show(this.dataset.tab)};
  var h=(location.hash||"").replace("#","");
  show(/^(car|docs|qr|drive)$/.test(h)?h:(localStorage.getItem(KEY)||"car"));
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
