function drawRoute(geo){
  var el=document.getElementById("map");
  if(el) el.classList.remove("hide");
  if(map){ try{ map.remove(); }catch(e){} map=null; line=null; }
  map=L.map("map",{zoomControl:false,attributionControl:false}).setView([54.05,-2.7],9);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
  line=L.geoJSON(geo,{style:{color:"#2563eb",weight:5,opacity:.95}}).addTo(map);
  setTimeout(function(){map.invalidateSize();map.fitBounds(line.getBounds(),{padding:[20,20]})},80);
}
function showRouteExtras(){
  var opts=document.querySelector(".opts");
  if(opts) opts.classList.remove("hide");
}
function syncYearUi(){
  var on=$("isYear") && $("isYear").checked;
  if($("yearBox")) $("yearBox").className=on?"":"hide";
  if($("yearCol")) $("yearCol").className=on?"mode split":"mode split hide";
  if($("costRow")) $("costRow").className=on?"triple withYear":"triple";
  if($("rYear")) $("rYear").className=on?"muted":"muted hide";
}
if(typeof paintResult==="function"){
  var _paint=paintResult;
  paintResult=function(){ _paint.apply(this, arguments); showRouteExtras(); syncYearUi(); };
}
if($("isYear")){
  $("isYear").addEventListener("change",function(){syncYearUi();if(typeof refreshOpts==="function")refreshOpts()});
  syncYearUi();
}
