function dipPrice(){
  return window.PRICE||{petrol:174.8,diesel:199.9,electric:26.32,offpeak:14};
}
function fuelCost(mpg,ppl,miles){return miles/Math.max(mpg,1)*4.54609*(ppl/100)}
function evCost(mpk,pkwh,miles){return miles/Math.max(mpk,0.4)*(pkwh/100)}
function paintCompare(miles){
  var el=document.getElementById("compareBody");
  if(!el) return;
  miles=+miles||10;
  var P=dipPrice();
  var off=+P.offpeak||14, peak=+P.electric||26.32;
  var rows=[];
  var mpgEl=document.getElementById("mpgOverride");
  if(mpgEl&&+mpgEl.value){
    var k=(window.car&&car.kind)||"diesel";
    var mine=k==="electric"?evCost(+mpgEl.value,peak,miles):fuelCost(+mpgEl.value,k==="diesel"?P.diesel:P.petrol,miles);
    rows.push(["This car",mine]);
  }
  rows.push(["50 mpg petrol",fuelCost(50,P.petrol,miles)]);
  rows.push(["Hybrid, 55 mpg",fuelCost(55,P.petrol,miles)]);
  rows.push(["Electric, off-peak",evCost(3.5,off,miles)]);
  rows.push(["Electric, day rate",evCost(3.5,peak,miles)]);
  el.innerHTML=rows.map(function(r){
    return "<div class='crow'><span>"+r[0]+"</span><b>\u00a3"+r[1].toFixed(2)+"</b></div>";
  }).join("")+"<p class='muted'>For "+miles.toFixed(1)+" miles. Electric uses 3.5 miles per kWh. Off-peak is a typical Economy 7 night rate.</p>";
}
if(typeof paintResult==="function"){
  var _cmp=paintResult;
  paintResult=function(){
    _cmp.apply(this,arguments);
    var box=document.getElementById("compareCard");
    if(box) box.classList.remove("hide");
    var miles=(window.lastTrip&&(lastTrip.oneMiles||lastTrip.miles))||10;
    paintCompare(miles);
  };
}
if(document.getElementById("compareBody")&&!document.getElementById("cmpGo")) paintCompare(10);
window.paintCompare=paintCompare;
