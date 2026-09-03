(function(){
function el(id){return document.getElementById(id)}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars&&s.cars.length)return s}catch(e){}return null}
function car(){var s=garage();return s?(s.cars[s.i]||s.cars[0]):{fuel:"petrol",cls:"family",nick:"car"}}
function carQuery(c){
  var n=String(c.nick||c.name||"").trim();
  if(!n||/your car details/i.test(n)) n="";
  var p=String(c.plate||"").replace(/\s+/g,"").toUpperCase();
  return n||p||"car";
}
function shop(term){var q=encodeURIComponent(term);return{
  ecp:"https://www.eurocarparts.com/search?q="+q,
  ebay:"https://www.ebay.co.uk/sch/i.html?_nkw="+q,
  gsf:"https://www.gsfcarparts.com/catalogsearch/result/?q="+q
}}
function bits(c){
  var f=c.fuel||"petrol", name=carQuery(c), hasOil=+c.oilL>0, L=hasOil?(+c.oilL).toFixed(1):"";
  var oilLine=f==="electric"?{n:"No engine oil on a full EV",p:"-"}:(hasOil?{n:"Engine oil — "+L+" litres (from your handbook)",p:"see book"}:{n:"Engine oil — add the handbook figure in Edit. We will not guess.",p:"-"});
  var map={
    petrol:[oilLine,{n:"Oil filter + sump washer",p:"£6-£15"},{n:"Air filter",p:"£8-£20"},{n:"Spark plugs (often every other service)",p:"£20-£60"},{n:"Pollen / cabin filter",p:"£8-£25"}],
    diesel:[oilLine,{n:"Oil filter + sump washer",p:"£6-£15"},{n:"Air filter",p:"£8-£20"},{n:"Fuel filter",p:"£12-£30"},{n:"Pollen / cabin filter",p:"£8-£25"}],
    hybrid:[oilLine,{n:"Oil filter + sump washer",p:"£6-£18"},{n:"Air filter",p:"£8-£20"},{n:"Spark plugs if it is a petrol hybrid",p:"£20-£60"},{n:"Pollen / cabin filter",p:"£10-£28"}],
    electric:[{n:"No engine oil",p:"-"},{n:"Pollen / cabin filter",p:"£10-£28"},{n:"Brake fluid if the handbook is due",p:"£8-£18"},{n:"Reduction-gear oil only if the handbook says so",p:"£15-£40"},{n:"Screenwash",p:"£3-£6"}]
  };
  var oilQ=hasOil?name+" "+L+"L engine oil":name+" engine oil capacity handbook";
  var q=encodeURIComponent(name);
  return {
    items:map[f]||map.petrol,f:f,name:name,hasOil:hasOil,
    kit:shop(name+" "+f+" service kit"),
    oil:shop(f==="electric"?name+" pollen cabin filter":oilQ),
    haynes:"https://uk.haynes.com/search?q="+q,
    yt:"https://www.youtube.com/results?search_query="+encodeURIComponent(name+" oil change service UK"),
    autodoc:"https://www.autodoc.co.uk/search?keyword="+q,
    tyres:"https://www.blackcircles.com/tyres?q="+q
  };
}
function drawDiy(){
  var box=el("diyOut"); if(!box) return;
  var d=bits(car());
  box.innerHTML=d.items.map(function(it){return "<div class='r'><span>"+it.n+"</span><b>"+it.p+"</b></div>"}).join("")+
    "<p class='hint' style='text-transform:none;letter-spacing:0;margin:8px 0'>These buttons open a search for "+d.name+". They do not open the exact kit. Check the engine code against the handbook before you buy.</p>"+
    "<a class='btn gold' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.kit.ecp+"'>Search Euro Car Parts</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.kit.ebay+"'>Search eBay</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.kit.gsf+"'>Search GSF Car Parts</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.oil.ecp+"'>Search oil / filters</a>";
  var how=el("howtoLinks");
  if(how) how.innerHTML=
    "<a class='btn ghost' target='_blank' rel='noopener' href='"+d.haynes+"'>Haynes manual for "+d.name+"</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.yt+"'>YouTube: "+d.name+" service</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.autodoc+"'>AutoDoc: "+d.name+"</a>"+
    "<a class='btn ghost' style='margin-top:8px' target='_blank' rel='noopener' href='"+d.tyres+"'>Blackcircles: "+d.name+" tyres</a>";
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
