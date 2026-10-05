window.FUEL_PICK=window.FUEL_PICK||"diesel";
window.CYCLE=window.CYCLE||"combined";
function mpgRow(){
  var c=window.car||{};
  var hay=String(c.name||c.nick||"").toLowerCase();
  var list=window.MPG_UK||[];
  var best=null, score=0, i;
  var want=window.FUEL_PICK==="offpeak"||window.FUEL_PICK==="peak"?"electric":window.FUEL_PICK;
  for(i=0;i<list.length;i++){
    var row=list[i];
    var model=String(row[1]||"").toLowerCase();
    if(model.length<3||hay.indexOf(model)<0) continue;
    var fuel=String(row[3]||"").toLowerCase();
    var pts=model.length;
    if(hay.indexOf(String(row[0]||"").toLowerCase())>=0) pts+=20;
    if(want==="electric"&&fuel.indexOf("elect")>=0) pts+=30;
    if(want==="diesel"&&fuel.indexOf("diesel")>=0) pts+=25;
    if(want==="petrol"&&fuel.indexOf("petrol")>=0) pts+=25;
    if(pts>score){ best=row; score=pts; }
  }
  return score>=8?best:null;
}
function cycleMpg(kind){
  var box=document.getElementById("mpgOverride");
  if(window.CYCLE==="custom"&&box&&+box.value) return +box.value;
  var row=mpgRow();
  if(kind==="electric") return (row&&row[7])||3.5;
  if(!row) return kind==="diesel"?45:kind==="petrol"?40:55;
  var urban=row[4], extra=row[5], comb=row[6];
  if(window.CYCLE==="urban") return urban||comb||45;
  if(window.CYCLE==="extra") return extra||comb||45;
  return comb||urban||extra||45;
}
function markCycles(){
  var nodes=document.querySelectorAll(".cycle");
  for(var i=0;i<nodes.length;i++) nodes[i].className="cycle"+(nodes[i].getAttribute("data-cycle")===window.CYCLE?" on":"");
}
function markFuel(){
  var cells=document.querySelectorAll(".pcell[data-fuel]");
  for(var i=0;i<cells.length;i++) cells[i].className="pcell"+(cells[i].getAttribute("data-fuel")===window.FUEL_PICK?" on":"");
  markCycles();
  var pick=window.FUEL_PICK;
  var electric=pick==="offpeak"||pick==="peak";
  var kind=electric?"electric":pick;
  var fig=cycleMpg(kind);
  var row=mpgRow();
  var note=document.getElementById("fuelNote");
  var lab=document.getElementById("mpgLabel");
  var box=document.getElementById("mpgOverride");
  if(box){ box.hidden=window.CYCLE!=="custom"; if(window.CYCLE!=="custom") box.value=String(fig); }
  if(lab) lab.textContent=electric?"Miles per kWh":"Economy";
  var cycleName={urban:"Urban",extra:"Extra-urban",combined:"Combined",custom:"Custom"}[window.CYCLE]||"Combined";
  var src=row?(row[0]+" "+row[1]+" "+(row[2]||"")+" \u00b7 "+(row[8]||"official")):"typical, this model is not in the official table";
  if(note) note.textContent=cycleName+". Using "+fig+(electric?" miles per kWh. ":" mpg. ")+src;
  if(window.car) car.kind=kind;
}
function refreshFuel(){
  if(window.lastTrip&&typeof paintResult==="function") paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);
}
function pickFuel(kind){ window.FUEL_PICK=kind; markFuel(); refreshFuel(); }
function pickCycle(cycle){ window.CYCLE=cycle; markFuel(); refreshFuel(); }
function wrapCosts(){
  if(window.__fuelWrapped||typeof costs!=="function") return;
  window.costs=function(miles,secs){
    var pick=window.FUEL_PICK||"diesel";
    var P=window.PRICE||{};
    var UK=4.54609, mins=(+secs||0)/60;
    if(pick==="offpeak"||pick==="peak"){
      var mpk=cycleMpg("electric")||3.5;
      var rate=(pick==="offpeak"?(+P.offpeak||14):(+P.electric||26.32))/100;
      var kwh=miles/mpk, qk=miles/(mpk*0.82);
      return {ecoGBP:kwh*rate,quickGBP:qk*rate,ecoMin:mins,quickMin:mins*0.88,ecoUse:kwh.toFixed(1)+" kWh",quickUse:qk.toFixed(1)+" kWh"};
    }
    var mpg=cycleMpg(pick);
    var ppl=((pick==="diesel"?P.diesel:P.petrol)||0)/100;
    var ecoL=miles/Math.max(mpg,1)*UK, qL=miles/Math.max(mpg*0.8,1)*UK;
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
  var cycles=document.querySelectorAll(".cycle");
  for(var j=0;j<cycles.length;j++) cycles[j].onclick=function(){ pickCycle(this.getAttribute("data-cycle")); };
  var box=document.getElementById("mpgOverride");
  if(box) box.addEventListener("input",function(){ window.CYCLE="custom"; markFuel(); refreshFuel(); });
  markFuel();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bootFuel);
else bootFuel();
