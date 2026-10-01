function drawRoute(geo){
  var el=document.getElementById("map");
  if(el) el.classList.remove("hide");
  if(map){ try{ map.remove(); }catch(e){} map=null; line=null; }
  if(!window.maplibregl){ el.textContent="Map could not load."; return; }
  map=new maplibregl.Map({
    container:"map",
    style:"https://tiles.openfreemap.org/styles/bright",
    center:[-2.7,54.05],
    zoom:9,
    attributionControl:true
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:false}), "top-right");
  map.on("load", function(){
    map.addSource("route",{type:"geojson",data:geo});
    map.addLayer({id:"route",type:"line",source:"route",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#1a73e8","line-width":5}});
    var coords=(geo&&geo.coordinates)||[];
    if(!coords.length) return;
    var b=coords.reduce(function(a,c){
      a[0]=Math.min(a[0],c[0]); a[1]=Math.min(a[1],c[1]);
      a[2]=Math.max(a[2],c[0]); a[3]=Math.max(a[3],c[1]);
      return a;
    },[180,90,-180,-90]);
    map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:28,duration:0});
  });
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
