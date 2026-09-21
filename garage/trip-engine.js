var UK_GALLON=4.54609;
function tripStore(){try{return JSON.parse(localStorage.getItem("gt.loggedTrips")||"[]")}catch(e){return[]}}
function saveTrips(list){localStorage.setItem("gt.loggedTrips",JSON.stringify(list.slice(0,80)))}
function garageFuel(){
  try{
    var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
    var c=s&&s.cars&&(s.cars[s.i]||s.cars[0]);
    return {mpg:+(c&&c.mpg)||38, fuel:(c&&c.fuel)||"Diesel"};
  }catch(e){return {mpg:38,fuel:"Diesel"}}
}
function mpgFromSpeed(rated, mph){
  rated=+rated||38; mph=+mph||0;
  var f=1;
  if(mph<=0) f=1;
  else if(mph<20) f=0.58;
  else if(mph<30) f=0.70;
  else if(mph<40) f=0.82;
  else if(mph<50) f=0.92;
  else if(mph<=62) f=1;
  else if(mph<=70) f=0.90;
  else if(mph<=78) f=0.80;
  else f=0.70;
  return Math.max(12, rated*f);
}
function tripCost(miles, mpg, ppl){
  return (miles/Math.max(+mpg||1,1))*UK_GALLON*((+ppl||195.2)/100);
}
function scoreTrip(o){
  var miles=+o.miles||0, mins=+o.mins||0;
  var mph=mins>0? miles/(mins/60):0;
  var rated=+o.rated||garageFuel().mpg;
  var mpg=mpgFromSpeed(rated, mph);
  var gbp=tripCost(miles, mpg, o.ppl);
  return {miles:miles, mins:mins, mph:mph, mpg:mpg, gbp:gbp, rated:rated};
}
function moneyTxt(n){return "\u00a3"+(+n||0).toFixed(2)}
function pushLoggedRoute(entry){
  var list=tripStore().filter(function(x){return !(x.title===entry.title && x.source==="route")});
  list.unshift(entry);
  saveTrips(list);
}
