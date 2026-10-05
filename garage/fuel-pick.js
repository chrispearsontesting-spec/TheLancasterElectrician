window.FUEL_PICK=window.FUEL_PICK||"diesel";
window.CYCLE=window.CYCLE||"combined";
function listMatch(name){
  var hay=String(name||"").toLowerCase();
  var list=window.TRIPS||[];
  var best=null, score=0, i;
  for(i=0;i<list.length;i++){
    var row=list[i];
    if(hay.indexOf(String(row[1]||"").toLowerCase())<0) continue;
    var pts=String(row[1]||"").length+(hay.indexOf(String(row[0]||"").toLowerCase())>=0?20:0);
    if(pts>score){ best=row; score=pts; }
  }
  return score>=4?best:null;
}
function baseMpg(kind){
  var c=window.car||{};
  if(c.kind===kind&&+c.mpg) return +c.mpg;
  var row=listMatch(c.name||c.nick||"");
  if(row&&kind!=="electric"&&+row[6]) return +row[6];
  if(kind==="diesel") return 45;
  if(kind==="petrol") return 40;
  if(kind==="hybrid") return 55;
  return 3.5;
}
function cycleMpg(kind){
  var box=document.getElementById("mpgOverride");
  if(window.CYCLE==="custom"&&box&&+box.value) return +box.value;
  var combined=baseMpg(kind);
  if(kind==="electric") return combined;
  if(window.CYCLE==="urban") return Math.round(combined*0.78);
  if(window.CYCLE==="extra") return Math.round(combined*1.16);
  return combined;
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
  var note=document.getElementById("fuelNote");
  var lab=document.getElementById("mpgLabel");
  var box=document.getElementById("mpgOverride");
  var phev=document.getElementById("phevBox");
  if(phev) phev.className="hide";
  if(box){ box.hidden=window.CYCLE!=="custom"; if(window.CYCLE!=="custom") box.value=String(fig); }
  if(lab) lab.textContent=electric?"Miles per kWh":"Economy";
  var cycleName={urban:"Urban",extra:"Extra-urban",combined:"Combined",custom:"Custom"}[window.CYCLE]||"Combined";
  if(note){
    if(electric) note.textContent=cycleName+". Using "+fig+" miles per kWh. Custom lets you type your own.";
    else if(window.CYCLE==="combined"||window.CYCLE==="custom") note.textContent=cycleName+". Using "+fig+" mpg. Urban and extra-urban are estimated from the combined figure until the official table is loaded.";
    else note.textContent=cycleName+". Using "+fig+" mpg, estimated from the combined figure. Official urban and extra-urban arrive with the VCA table.";
  }
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
    var UK=4.54609;
    var mins=(+secs||0)/60;
    if(pick==="offpeak"||pick==="peak"){
      var mpk=cycleMpg("electric")||3.5;
      var rate=(pick==="offpeak"?(+P.offpeak||14):(+P.electric||26.32))/100;
      var kwh=miles/mpk, qk=miles/(mpk*0.82);
      return {ecoGBP:kwh*rate,quickGBP:qk*rate,ecoMin:mins,quickMin:mins*0.88,ecoUse:kwh.toFixed(1)+" kWh",quickUse:qk.toFixed(1)+" kWh"};
    }
    var mpg=cycleMpg(pick);
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
  var cycles=document.querySelectorAll(".cycle");
  for(var j=0;j<cycles.length;j++) cycles[j].onclick=function(){ pickCycle(this.getAttribute("data-cycle")); };
  var box=document.getElementById("mpgOverride");
  if(box) box.addEventListener("input",function(){ window.CYCLE="custom"; markFuel(); refreshFuel(); });
  markFuel();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bootFuel);
else bootFuel();
