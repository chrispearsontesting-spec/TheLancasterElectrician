function paintPrices(){
  if(document.getElementById("pDiesel")) document.getElementById("pDiesel").textContent=(+PRICE.diesel).toFixed(1)+"p";
  if(document.getElementById("pPetrol")) document.getElementById("pPetrol").textContent=(+PRICE.petrol).toFixed(1)+"p";
  if(document.getElementById("pOff")) document.getElementById("pOff").textContent=(+(PRICE.offpeak||14)).toFixed(1)+"p";
  if(document.getElementById("pPeak")) document.getElementById("pPeak").textContent=(+(PRICE.electric||26.3)).toFixed(1)+"p";
  if(document.getElementById("priceWhen")) document.getElementById("priceWhen").textContent=(PRICE.date||"")+" \u00b7 fuel daily \u00b7 electric is the Ofgem cap";
  if(document.getElementById("priceLine")) document.getElementById("priceLine").textContent="Diesel "+PRICE.diesel+"p \u00b7 Petrol "+PRICE.petrol+"p \u00b7 off-peak "+(PRICE.offpeak||14)+"p";
}
function loadLivePrices(){
  fetch("prices.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.json()}).then(function(p){
    if(+p.petrol_ppl) PRICE.petrol=+p.petrol_ppl;
    if(+p.diesel_ppl) PRICE.diesel=+p.diesel_ppl;
    if(+p.electric_pkwh) PRICE.electric=+p.electric_pkwh;
    if(+p.offpeak_pkwh) PRICE.offpeak=+p.offpeak_pkwh;
    if(p.date) PRICE.date=p.date;
    if(p.source) PRICE.source=p.source;
    paintPrices();
    if(typeof lastTrip!=="undefined"&&lastTrip&&typeof paintResult==="function"){
      paintResult(lastTrip.title,lastTrip.oneMiles||lastTrip.miles,lastTrip.oneSecs||lastTrip.secs,lastTrip.roads);
    }
  }).catch(function(){paintPrices()});
}
loadLivePrices();
