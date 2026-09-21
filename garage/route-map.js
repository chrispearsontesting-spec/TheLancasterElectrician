function drawRoute(geo){
  if(!map){
    map=L.map("map",{zoomControl:false}).setView([54.05,-2.7],9);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{
      maxZoom:19,
      attribution:"\u00a9 OpenStreetMap \u00a9 CARTO"
    }).addTo(map);
  }
  if(line) map.removeLayer(line);
  line=L.geoJSON(geo,{style:{color:"#2563eb",weight:5,opacity:.95}}).addTo(map);
  setTimeout(function(){map.invalidateSize();map.fitBounds(line.getBounds(),{padding:[20,20]})},80);
}
function syncYearUi(){
  var on=$("isYear") && $("isYear").checked;
  if($("yearBox")) $("yearBox").className=on?"":"hide";
  if($("yearCol")) $("yearCol").className=on?"mode split":"mode split hide";
  if($("costRow")) $("costRow").className=on?"triple withYear":"triple";
  if($("rYear")) $("rYear").className=on?"muted":"muted hide";
}
if($("isYear")){
  $("isYear").addEventListener("change",function(){syncYearUi();if(typeof refreshOpts==="function")refreshOpts()});
  syncYearUi();
}
