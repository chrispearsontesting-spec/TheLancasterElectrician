window.FUEL_PICK=window.FUEL_PICK||"diesel";
function listMatch(name){
  var hay=String(name||"").toLowerCase();
  var list=window.TRIPS||[];
  var best=null, score=0, i;
  for(i=0;i<list.length;i++){
    var row=list[i];
    var label=(row[0]+" "+row[1]+" "+(row[2]||"")).toLowerCase();
    if(hay.indexOf(String(row[1]||"").toLowerCase())<0) continue;
    var pts=String(row[1]||"").length+(hay.indexOf(String(row[0]||"").toLowerCase())>=0?20:0);
    if(pts>score){ best=row; score=pts; }
  }
  return score>=4?best:null;
}
function carMpg(kind){
  var typed=document.getElementById("mpgOverride");
  if(typed&&typed.dataset.user==="1"&&+typed.value) return +typed.value;
  var c=window.car||{};
  if(c.kind===kind&&+c.mpg) return +c.mpg;
  var row=listMatch(c.name||c.nick||"");
  if(row&&kind!=="electric"&&+row[6]) return +row[6];
  if(kind==="diesel") return 45;
  if(kind==="petrol") return 40;
  if(kind==="hybrid") return 55;
  return 3.5;
}
function mpgSource(kind){
  var typed=document.getElementById("mpgOverride");
  if(typed&&typed.dataset.user==="1"&&+typed.value) return "your figure";
  var c=window.car||{};
  if(c.kind===kind&&+c.mpg) return "saved on this car";
  var row=listMatch(c.name||c.nick||"");
  if(row&&kind!=="electric"&&+row[6]) return "typical for this model";
  return "typical, not this exact car";
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
    if(lab) lab.textContent="Miles per kWh, optional";
    if(box){ if(box.dataset.user!=="1") box.value="3.5"; box.hidden=false; box.readOnly=false; }
    if(note) note.textContent="Using "+(box&&box.value?box.value:"3.5")+" miles per kWh. "+mpgSource("electric")+". Type over it if you know better.";
    if(window.car) car.kind="electric";
  }else{
    var mpg=carMpg(pick);
    if(lab) lab.textContent=(pick==="diesel"?"Diesel":"Petrol")+" mpg, optional";
    if(box){ if(box.dataset.user!=="1") box.value=String(mpg); box.hidden=false; box.readOnly=false; }
    if(note) note.textContent="Using "+mpg+" mpg. "+mpgSource(pick)+". Type over it if yours is different.";
    if(window.car) car.kind=pick;
  }
}
function pickFuel(kind){
  var box=document.getElementById("mpgOverride");
  if(box) box.dataset.user="";
  window.FUEL_PICK=kind;
  markFuel();
  if(window.lastTrip&&typeof paintResult==="function"){
    paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);
  }
}
function wrapCosts(){
  if(window.__fuelWrapped||typeof costs!=="function") return;
  window.costs=function(miles,secs){
    var pick=window.FUEL_PICK||"diesel";
    var P=window.PRICE||{};
    var UK=4.54609;
    var mins=(+secs||0)/60;
    if(pick==="offpeak"||pick==="peak"){
      var mpk=carMpg("electric")||3.5;
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
  for(var i=0;i<cells.length;i++) cells[i].onclick=function(){ pickFuel(this.getAttribute("data-fuel")); };
  var box=document.getElementById("mpgOverride");
  if(box) box.addEventListener("input",function(){
    box.dataset.user="1";
    markFuel();
    if(window.lastTrip&&typeof paintResult==="function") paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);
  });
  markFuel();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bootFuel);
else bootFuel();
