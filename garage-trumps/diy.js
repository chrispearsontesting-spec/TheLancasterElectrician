(function(){
function el(id){return document.getElementById(id)}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars&&s.cars.length)return s}catch(e){}return null}
function car(){var s=garage();return s?(s.cars[s.i]||s.cars[0]):{fuel:"petrol",cls:"family",nick:"car"}}
function oilLitres(c){if(+c.oilL)return +c.oilL;return {small:3.8,family:5.2,suv:6.5,premium:6}[c.cls||"family"]||5.2}
function shop(term){var q=encodeURIComponent(term);return{ecp:"https://www.eurocarparts.com/search?q="+q,ebay:"https://www.ebay.co.uk/sch/i.html?_nkw="+q,gsf:"https://www.gsfcarparts.com/catalogsearch/result/?q="+q}}
function bits(c){
  var f=c.fuel||"petrol", L=oilLitres(c).toFixed(1), name=(c.nick||c.name||"car");
  var map={
    petrol:[{n:"Engine oil ~"+L+" litres",p:"22-40"},{n:"Oil filter + drain washer",p:"6-15"},{n:"Air filter",p:"8-20"},{n:"Spark plugs (often every other service)",p:"20-60"},{n:"Cabin / pollen filter",p:"8-25"}],
    diesel:[{n:"Engine oil ~"+L+" litres",p:"25-45"},{n:"Oil filter + drain washer",p:"6-15"},{n:"Air filter",p:"8-20"},{n:"Fuel filter",p:"12-30"},{n:"Cabin / pollen filter",p:"8-25"}],
    hybrid:[{n:"Engine oil ~"+L+" litres",p:"22-45"},{n:"Oil filter + drain washer",p:"6-18"},{n:"Air filter",p:"8-20"},{n:"Spark plugs if it is a petrol hybrid",p:"20-60"},{n:"Cabin filter",p:"10-28"}],
    electric:[{n:"No engine oil",p:"0"},{n:"Cabin / pollen filter",p:"10-28"},{n:"Brake fluid if the book is due",p:"8-18"},{n:"Reduction-gear oil only if specified",p:"15-40"},{n:"Screenwash",p:"3-6"}]
  };
  var items=map[f]||map.petrol, lo=0, hi=0;
  items.forEach(function(it){var p=String(it.p).split("-"); if(p.length===2){lo+=+p[0];hi+=+p[1]}});
  return {items:items,lo:lo,hi:hi,f:f,L:L,name:name,kit:shop(name+" "+f+" service kit"),oil:shop(f==="electric"?name+" cabin pollen filter":name+" engine oil "+L+"L")};
}
function drawDiy(){
  var box=el("diyOut"); if(!box) return;
  var d=bits(car());
  box.innerHTML=d.items.map(function(it){return "<div class='r'><span>"+it.n+"</span><b>GBP "+it.p+"</b></div>"}).join("")+
    "<div class='r'><span>DIY parts ballpark</span><b>GBP "+d.lo+"-"+d.hi+"</b></div>"+
    "<p class='hint' style='text-transform:none;letter-spacing:0;margin:8px 0'>Opens a search with this car's name. Confirm the engine before you buy.</p>"+
    "<a class='btn gold' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.kit.ecp+"'>Euro Car Parts kit search</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.kit.ebay+"'>eBay service kit search</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.kit.gsf+"'>GSF kit search</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.oil.ecp+"'>Oil / filter search</a>";
}
function persistOil(){
  var s=garage(); if(!s||!el("oilL")) return;
  s.cars[s.i].oilL=el("oilL").value;
  if(el("fuel")) s.cars[s.i].fuel=el("fuel").value;
  localStorage.setItem("gt.garage",JSON.stringify(s));
}
if(el("btnSave")) el("btnSave").addEventListener("click",function(){setTimeout(function(){persistOil();drawDiy()},80)});
if(el("fuel")) el("fuel").addEventListener("change",function(){persistOil();drawDiy()});
setTimeout(drawDiy,60);
setInterval(drawDiy,2500);
})();
