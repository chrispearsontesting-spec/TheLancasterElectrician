(function(){
function el(id){return document.getElementById(id)}
function S(){try{return JSON.parse(localStorage.getItem("gt.garage")||"null")}catch(e){return null}}
function save(s){localStorage.setItem("gt.garage",JSON.stringify(s))}
function nextCar(){
  var s=S(); if(!s||!s.cars||s.cars.length<2) return;
  s.i=(s.i+1)%s.cars.length; save(s); location.reload();
}
function prevCar(){
  var s=S(); if(!s||!s.cars||s.cars.length<2) return;
  s.i=(s.i-1+s.cars.length)%s.cars.length; save(s); location.reload();
}
function back(){
  if(el("btnBack") && el("gameView") && el("gameView").className.indexOf("hide")<0){ el("btnBack").click(); return; }
  if(el("btnJobsBack")) el("btnJobsBack").click();
}
function onGarage(){ return el("garageView") && el("garageView").className.indexOf("hide")<0; }
function blocked(){
  return (el("sheet")&&/\bon\b/.test(el("sheet").className)) || (el("contact")&&/\bon\b/.test(el("contact").className));
}
var x0=0,y0=0,t0=0,down=false;
function start(x,y){ if(blocked()) return; x0=x; y0=y; t0=Date.now(); down=true; }
function end(x,y){
  if(!down||blocked()){ down=false; return; }
  down=false;
  var dx=x-x0, dy=y-y0;
  if(Math.abs(dx)<40 || Math.abs(dx)<Math.abs(dy)) return;
  if(Date.now()-t0>1200) return;
  if(onGarage()){
    if(dx<0) nextCar();
    else prevCar();
    return;
  }
  back();
}
document.addEventListener("touchstart",function(e){ var t=e.changedTouches[0]; start(t.clientX,t.clientY); },{passive:true});
document.addEventListener("touchend",function(e){ var t=e.changedTouches[0]; end(t.clientX,t.clientY); },{passive:true});
document.addEventListener("mousedown",function(e){ if(e.button) return; start(e.clientX,e.clientY); });
document.addEventListener("mouseup",function(e){ end(e.clientX,e.clientY); });
var row=el("dots");
if(row && !el("swipeBtns")){
  var bar=document.createElement("div");
  bar.id="swipeBtns";
  bar.className="row2";
  bar.style.marginTop="10px";
  bar.innerHTML="<button class='btn ghost' type='button' id='btnPrevCar'>Previous</button><button class='btn ghost' type='button' id='btnNextCar'>Next</button>";
  row.parentNode.insertBefore(bar,row.nextSibling);
  el("btnPrevCar").onclick=prevCar;
  el("btnNextCar").onclick=nextCar;
}
if(el("dots")) el("dots").addEventListener("click", nextCar);
})();
