window.FUEL_PICK=window.FUEL_PICK||"diesel";
function carMpg(kind){
  var c=window.car||{};
  var own=c.kind===kind&&+c.mpg?+c.mpg:0;
  if(own) return own;
  if(kind==="diesel") return 45;
  if(kind==="petrol") return 40;
  if(kind==="hybrid") return 55;
  return 3.5;
}
function markFuel(){
  var cells=document.querySelectorAll(".pcell[data-fuel]");
  for(var i=0;i<cells.length;i++){
    cells[i].className="pcell"+(cells[i].getAttribute("data-fuel")===window.FUEL_PICK?" on":"");
  }
  var pick=window.FUEL_PICK;
  var note=document.getElementById("fuelNote");
  var lab=document.getElementById("mpgLabel");
  var box=document.getElementById("mpgOverride");
  var phev=document.getElementById("phevBox");
  if(phev) phev.className="hide";
  if(pick==="offpeak"||pick==="peak"){
    if(lab) lab.textContent=pick==="offpeak"?"Off-peak electric":"Day-rate electric";
    if(box){ box.value="3.5"; box.readOnly=true; }
    if(note) note.textContent="Using 3.5 miles per kWh. A typical electric car. Nothing to type.";
    if(window.car) car.kind="electric";
  }else{
    var mpg=carMpg(pick);
    var own=window.car&&car.kind===pick&&+car.mpg;
    if(lab) lab.textContent=pick==="diesel"?"Diesel":"Petrol";
    if(box){ box.value=String(mpg); box.readOnly=true; }
    if(note) note.textContent="Using "+mpg+" mpg"+(own?" from this car.":" typical. Nothing to type.");
    if(window.car) car.kind=pick;
  }
}
function pickFuel(kind){
  window.FUEL_PICK=kind;
  markFuel();
  if(window.lastTrip&&typeof paintResult==="function"){
    paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);
  }
}
function wrapCosts(){
  if(window.__fuelWrapped||typeof costs!=="function") return;
  var base=costs;
  window.costs=function(miles,secs){
    var pick=window.FUEL_PICK||"diesel";
    var P=window.PRICE||{};
    var UK=4.54609;
    var mins=(+secs||0)/60;
    if(pick==="offpeak"||pick==="peak"){
      var mpk=3.5;
      var rate=(pick==="offpeak"?(+P.offpeak||14):(+P.electric||26.32))/100;
      var kwh=miles/mpk, qk=miles/(mpk*0.82);
      return {ecoGBP:kwh*rate,quickGBP:qk*rate,ecoMin:mins,quickMin:mins*0.88,ecoUse:kwh.toFixed(1)+" kWh",quickUse:qk.toFixed(1)+" kWh"};
    }
    var mpg=carMpg(pick);
    var ppl=((pick==="diesel"?P.diesel:P.petrol)||0)/100;
    var ecoL=miles/Math.max(mpg,1)*UK;
    var qL=miles/Math.max(mpg*0.8,1)*UK;
    return {ecoGBP:ecoL*ppl,quickGBP:qL*ppl,ecoMin:mins,quickMin:mins*0.88,ecoUse:ecoL.toFixed(1)+" L",quickUse:qL.toFixed(1)+" L"};
  };
  window.__fuelWrapped=true;
}
function bootFuel(){
  wrapCosts();
  var g=null;
  try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null"); g=s&&s.cars&&(s.cars[s.i]||s.cars[0]);}catch(e){}
  var fuel=String((g&&g.fuel)||(window.car&&car.fuel)||"diesel").toLowerCase();
  window.FUEL_PICK=fuel.indexOf("electric")>=0&&fuel.indexOf("hybrid")<0?"offpeak":(fuel.indexOf("petrol")>=0||fuel.indexOf("hybrid")>=0?"petrol":"diesel");
  var cells=document.querySelectorAll(".pcell[data-fuel]");
  for(var i=0;i<cells.length;i++){
    cells[i].onclick=function(){ pickFuel(this.getAttribute("data-fuel")); };
  }
  markFuel();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bootFuel);
else bootFuel();
