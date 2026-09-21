function paintPrices(){
  var k=car&&car.kind?car.kind:"diesel";
  if(document.getElementById("pDiesel")) document.getElementById("pDiesel").textContent=(+PRICE.diesel).toFixed(1)+"p";
  if(document.getElementById("pPetrol")) document.getElementById("pPetrol").textContent=(+PRICE.petrol).toFixed(1)+"p";
  var grid=document.getElementById("priceGrid");
  if(grid){
    var ev=document.getElementById("pElectric");
    if(k==="electric"||k==="phev"){
      if(!ev){
        ev=document.createElement("div");
        ev.className="pcell";
        ev.id="pElectricWrap";
        ev.innerHTML="<span>Electric</span><b id='pElectric'></b><em>per kWh</em>";
        grid.appendChild(ev);
      }
      grid.className="pgrid three";
      document.getElementById("pElectric").textContent=(+PRICE.electric).toFixed(1)+"p";
    }else{
      grid.className="pgrid";
      if(document.getElementById("pElectricWrap")) document.getElementById("pElectricWrap").remove();
    }
  }
  if(document.getElementById("priceWhen")) document.getElementById("priceWhen").textContent=(PRICE.date||"")+" \u00b7 UK national average";
}
