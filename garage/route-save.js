function currentPpl(){
  var k=car&&car.kind?car.kind:"diesel";
  if(k==="electric") return PRICE.electric;
  if(k==="diesel") return PRICE.diesel;
  return PRICE.petrol;
}
function snapshotRoute(){
  if(!lastTrip) return null;
  var oneMiles=+lastTrip.oneMiles||+lastTrip.miles||0;
  var oneSecs=+lastTrip.oneSecs||+lastTrip.secs||0;
  var one=costs(oneMiles,oneSecs);
  var ret=costs(oneMiles*2,oneSecs*2);
  var n=yearTrips();
  var isRet=$("isReturn")&&$("isReturn").checked;
  var isYr=$("isYear")&&$("isYear").checked;
  var parts=(lastTrip.title||"").split("\u2192");
  return {
    source:"route",
    when:Date.now(),
    title:lastTrip.title||"Route",
    from:(parts[0]||$("from").value||"From").trim(),
    to:(parts[1]||$("to").value||"To").trim(),
    miles:oneMiles,
    mins:Math.round(oneSecs/60),
    rated:parseFloat($("mpgOverride").value)||garageFuel().mpg,
    ppl:currentPpl(),
    isReturn:!!isRet,
    isYear:!!isYr,
    days:parseFloat($("days").value)||5,
    weeks:parseFloat($("weeks").value)||46,
    oneGBP:one.ecoGBP,
    retGBP:ret.ecoGBP,
    yearGBP:ret.ecoGBP*n,
    oneUse:one.ecoUse,
    retUse:ret.ecoUse,
    roads:lastTrip.roads||[],
    query:$("to").value.trim()
  };
}
if($("saveFav")){
  $("saveFav").onclick=function(){
    var entry=snapshotRoute();
    if(!entry||!entry.miles){showErr("Check a route first.");return}
    pushLoggedRoute(entry);
    showErr("");
    $("saveFav").textContent="Saved to journey log";
    setTimeout(function(){$("saveFav").textContent="Save"},1200);
  };
}
