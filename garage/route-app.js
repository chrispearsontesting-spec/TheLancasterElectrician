var PRICE={date:"20 Sep 2026",petrol:171.1,diesel:195.2,electric:26.1,source:"UK pump average"};
var car=null,lastTrip=null,map,line,UK_GALLON=4.54609,MILE=1609.34;
function $(id){return document.getElementById(id)}
function money(n){return (n==null||isNaN(n))?"-":"\u00a3"+n.toFixed(2)}
function money0(n){return (n==null||isNaN(n))?"-":"\u00a3"+Math.round(n)}
function kind(fuel){fuel=String(fuel||"").toLowerCase();if(fuel.indexOf("electric")>=0&&fuel.indexOf("hybrid")<0&&fuel.indexOf("plug")<0)return "electric";if(fuel.indexOf("plug")>=0||fuel.indexOf("phev")>=0)return "phev";if(fuel.indexOf("diesel")>=0)return "diesel";if(fuel.indexOf("hybrid")>=0)return "hybrid";return "petrol"}
function garageCar(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");return s&&s.cars&&s.cars.length?(s.cars[s.i]||s.cars[0]):null}catch(e){return null}}
function tripState(){try{return JSON.parse(localStorage.getItem("gt.trip.v1")||"null")||{}}catch(e){return {}}}
function saveTrip(t){localStorage.setItem("gt.trip.v1",JSON.stringify(t))}
function setCar(c){car=c;if(c&&c.mpg&&$("mpgOverride"))$("mpgOverride").value=c.mpg;if(lastTrip)paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);paintFavs()}
function pplFor(k){return k==="diesel"?PRICE.diesel:(k==="electric"?PRICE.electric:PRICE.petrol)}
function tripMult(){return $("isReturn").checked?2:1}
function yearTrips(){var d=parseFloat($("days").value)||5,w=parseFloat($("weeks").value)||46;return Math.max(1,d)*Math.max(1,w)}
function costs(miles,secs){var over=parseFloat($("mpgOverride").value),evR=parseFloat($("evRange").value),k=car?car.kind:"diesel",mins=secs/60;if(k==="electric"){var mpk=over||(car.range&&car.kwh?car.range/car.kwh:3.5),eco=miles/Math.max(mpk,.4),q=miles/Math.max(mpk*.82,.3),p=PRICE.electric/100;return{ecoGBP:eco*p,quickGBP:q*p,ecoMin:mins,quickMin:mins*.88,ecoUse:eco.toFixed(1)+" kWh",quickUse:q.toFixed(1)+" kWh"}}var mpg=over||car.mpg||38,ppl=pplFor(k==="diesel"?"diesel":"petrol")/100;if(k==="phev"){var eMiles=Math.min(miles,evR||car.range||30),pMiles=Math.max(0,miles-eMiles),mpk=car.range&&car.kwh?car.range/car.kwh:3.5,ecoL=pMiles/Math.max(mpg,1)*UK_GALLON,qL=pMiles/Math.max(mpg*.8,1)*UK_GALLON,ep=PRICE.electric/100;return{ecoGBP:(eMiles/mpk)*ep+ecoL*ppl,quickGBP:(eMiles/(mpk*.82))*ep+qL*ppl,ecoMin:mins,quickMin:mins*.88,ecoUse:(eMiles?eMiles.toFixed(0)+" mi EV + ":"")+ecoL.toFixed(1)+" L",quickUse:(eMiles?eMiles.toFixed(0)+" mi EV + ":"")+qL.toFixed(1)+" L"}}var ecoL=miles/Math.max(mpg,1)*UK_GALLON,qL=miles/Math.max(mpg*.8,1)*UK_GALLON;return{ecoGBP:ecoL*ppl,quickGBP:qL*ppl,ecoMin:mins,quickMin:mins*.88,ecoUse:ecoL.toFixed(1)+" L",quickUse:qL.toFixed(1)+" L"}}
async function geocode(q){var res=await fetch("https://photon.komoot.io/api/?q="+encodeURIComponent(q+", United Kingdom")+"&limit=1&lang=en");if(!res.ok)throw new Error("Place lookup failed");var data=await res.json(),f=data.features&&data.features[0];if(!f)throw new Error("Could not find that place");var p=f.properties||{};return{lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],name:[p.name,p.postcode,p.city||p.town||p.village].filter(Boolean).slice(0,3).join(", ")||q}}
async function route(a,b){var res=await fetch("https://router.project-osrm.org/route/v1/driving/"+a.lon+","+a.lat+";"+b.lon+","+b.lat+"?overview=full&geometries=geojson&steps=true");if(!res.ok)throw new Error("Route failed");var data=await res.json();if(data.code!=="Ok")throw new Error("No driving route");var r=data.routes[0],merged=[];r.legs.forEach(function(leg){(leg.steps||[]).forEach(function(st){var name=st.ref||st.name;if(!name)return;if(merged.length&&merged[merged.length-1].n===name)merged[merged.length-1].m+=st.distance;else merged.push({n:name,m:st.distance})})});return{miles:r.distance/MILE,secs:r.duration,roads:merged.filter(function(x){return x.m>=1500}).sort(function(a,b){return b.m-a.m}).slice(0,4).map(function(x){return x.n+" "+(x.m/MILE).toFixed(1)+" mi"}),geo:r.geometry}}
function showErr(m){$("err").textContent=m||""}
function drawRoute(geo){if(!map){map=L.map("map",{zoomControl:false}).setView([54.05,-2.7],9);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"\u00a9 OpenStreetMap"}).addTo(map)}if(line)map.removeLayer(line);line=L.geoJSON(geo,{style:{color:"#14b8a6",weight:5,opacity:.95}}).addTo(map);setTimeout(function(){map.invalidateSize();map.fitBounds(line.getBounds(),{padding:[20,20]})},80)}
function paintPrices(){$("priceLine").textContent="Diesel "+PRICE.diesel+"p \u00b7 petrol "+PRICE.petrol+"p \u00b7 "+PRICE.date+(PRICE.source?" \u00b7 "+PRICE.source:"")}
function paintResult(title,oneMiles,oneSecs,roads){
  oneMiles=+oneMiles||0;oneSecs=+oneSecs||0;
  var one=costs(oneMiles,oneSecs);
  var ret=costs(oneMiles*2,oneSecs*2);
  var n=yearTrips();
  var yearEco=ret.ecoGBP*n;
  var yearQuick=ret.quickGBP*n;
  var show=tripMult()===2?ret:one;
  $("result").className="card";
  $("rTitle").textContent=title;
  $("rMeta").textContent=oneMiles.toFixed(1)+" mi each way \u00b7 ~"+Math.round(one.ecoMin)+" min one way";
  $("rOne").textContent=money(one.ecoGBP);
  $("rOneMeta").textContent=one.ecoUse;
  $("rRet").textContent=money(ret.ecoGBP);
  $("rRetMeta").textContent=ret.ecoUse;
  $("rAnn").textContent=money0(yearEco);
  $("rAnnMeta").textContent=n+" return days";
  $("rEco").textContent=money(show.ecoGBP);
  $("rQuick").textContent=money(show.quickGBP);
  $("rEcoMeta").textContent=show.ecoUse;
  $("rQuickMeta").textContent=show.quickUse;
  $("rYear").textContent=$("isYear").checked?("Yearly commute \u00b7 "+n+" return journeys \u00b7 "+money(yearEco)+" steady \u00b7 "+money(yearQuick)+" quick"):("Tick yearly commute to use "+n+" working days \u00b7 "+money(yearEco)+" / year");
  $("rRoads").textContent=roads&&roads.length?roads.join(" \u00b7 "):"";
  lastTrip={title:title,oneMiles:oneMiles,oneSecs:oneSecs,miles:oneMiles,secs:oneSecs,roads:roads||[]};
}
function refreshOpts(){if(lastTrip)paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);paintFavs()}
$("isReturn").addEventListener("change",refreshOpts);
$("isYear").addEventListener("change",refreshOpts);
$("days").addEventListener("input",refreshOpts);
$("weeks").addEventListener("input",refreshOpts);
$("mpgOverride").addEventListener("input",refreshOpts);
$("go").onclick=async function(){showErr("");if(!car){showErr("No car loaded.");return}var destQ=$("to").value.trim();if(!destQ){showErr("Enter a destination.");return}var t=tripState();$("go").textContent="Looking up\u2026";try{var startQ=$("from").value.trim()||t.home||"";if(!startQ)throw new Error("Set a start point first.");var start=(t.homeLat&&startQ===t.home)?{lat:t.homeLat,lon:t.homeLon,name:t.home}:await geocode(startQ);if(startQ!==t.home){t.home=start.name;t.homeLat=start.lat;t.homeLon=start.lon;saveTrip(t)}var dest=await geocode(destQ);var rt=await route(start,dest);paintResult((start.name.split(",")[0])+" \u2192 "+(dest.name.split(",")[0]),rt.miles,rt.secs,rt.roads);if(rt.geo)drawRoute(rt.geo)}catch(err){showErr(err.message||"Could not check that route")}$("go").textContent="Check route"};
function paintFavs(){var favs=(tripState().favs)||[];$("favs").innerHTML=favs.map(function(f,i){var miles=(f.oneMiles||f.miles||0)*tripMult(),c=car?costs(miles,((f.oneSecs||f.secs||0)*tripMult())):null;return '<button class="hit" type="button" data-f="'+i+'">'+f.label+(c?" \u00b7 "+money(c.ecoGBP):"")+"</button>"}).join("")}
$("favs").addEventListener("click",function(e){var b=e.target.closest("[data-f]");if(!b)return;var f=(tripState().favs||[])[+b.getAttribute("data-f")];if(!f)return;$("to").value=f.query||f.label;paintResult((tripState().home||"Home").split(",")[0]+" \u2192 "+f.label,f.oneMiles||f.miles,f.oneSecs||f.secs||0,f.roads||[])});
$("saveFav").onclick=function(){if(!lastTrip||!(lastTrip.oneMiles||lastTrip.miles)){showErr("Check a route first.");return}var label=prompt("Name",(lastTrip.title||"").split("\u2192").pop().trim()||"Favourite");if(!label)return;var t=tripState();t.favs=(t.favs||[]).filter(function(x){return x.label!==label});t.favs.unshift({label:label,query:$("to").value.trim(),miles:lastTrip.oneMiles||lastTrip.miles,oneMiles:lastTrip.oneMiles||lastTrip.miles,secs:lastTrip.oneSecs||lastTrip.secs,oneSecs:lastTrip.oneSecs||lastTrip.secs,roads:lastTrip.roads||[]});t.favs=t.favs.slice(0,5);saveTrip(t);paintFavs()};
$("setHome").onclick=async function(){var q=$("from").value.trim();if(!q){showErr("Type a start first.");return}try{var g=await geocode(q);var t=tripState();t.home=g.name;t.homeLat=g.lat;t.homeLon=g.lon;saveTrip(t);$("from").value=g.name;showErr("")}catch(err){showErr(err.message)}};
function todayKey(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function applyLivePrices(p){if(!p)return;if(+p.petrol)PRICE.petrol=+p.petrol;if(+p.diesel)PRICE.diesel=+p.diesel;if(+p.electric)PRICE.electric=+p.electric;PRICE.date=p.date||PRICE.date;PRICE.source=p.source||PRICE.source;paintPrices();if(lastTrip)paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads)}
function loadLivePrices(){
  fetch("prices.json?t="+Date.now()).then(function(r){return r.json()}).then(function(p){
    applyLivePrices({petrol:+p.petrol_ppl||PRICE.petrol,diesel:+p.diesel_ppl||PRICE.diesel,electric:+p.electric_pkwh||PRICE.electric,date:p.date||PRICE.date,source:p.source||"saved snapshot"});
  }).catch(function(){});
}
(function init(){var t=tripState(),g=garageCar();$("from").value=t.home||"Lancaster";$("to").value=$("to").value||"Samlesbury brewery";if(g)setCar({name:g.nick||g.name||"Garage car",fuel:g.fuel||"Diesel",kind:kind(g.fuel),mpg:+g.mpg||38,range:+g.range||null,kwh:+g.kwh||null});else setCar({name:"Volvo XC60 D5",fuel:"Diesel",kind:"diesel",mpg:38});paintPrices();paintFavs();loadLivePrices()})();
