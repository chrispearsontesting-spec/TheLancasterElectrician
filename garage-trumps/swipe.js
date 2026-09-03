(function(){
function el(id){return document.getElementById(id)}
function S(){try{return JSON.parse(localStorage.getItem("gt.garage")||"null")}catch(e){return null}}
function save(s){localStorage.setItem("gt.garage",JSON.stringify(s))}
function bind(node,left,right){
  if(!node) return;
  var x0=0,y0=0,t0=0;
  node.addEventListener("touchstart",function(e){
    if(el("sheet")&&/\bon\b/.test(el("sheet").className)) return;
    if(el("contact")&&/\bon\b/.test(el("contact").className)) return;
    var t=e.changedTouches[0];
    x0=t.clientX; y0=t.clientY; t0=Date.now();
  },{passive:true});
  node.addEventListener("touchend",function(e){
    if(el("sheet")&&/\bon\b/.test(el("sheet").className)) return;
    var t=e.changedTouches[0];
    var dx=t.clientX-x0, dy=t.clientY-y0;
    if(Math.abs(dx)<56 || Math.abs(dx)<Math.abs(dy)*1.3) return;
    if(Date.now()-t0>900) return;
    if(x0<20 && dx>0) return;
    if(dx<0){ if(left) left(); }
    else { if(right) right(); }
  },{passive:true});
}
function nextCar(){
  var s=S(); if(!s||!s.cars||s.cars.length<2) return;
  s.i=(s.i+1)%s.cars.length;
  save(s);
  location.reload();
}
function prevOrGame(){
  var s=S();
  if(s&&s.i>0){ s.i--; save(s); location.reload(); return; }
  if(el("btnGame")) el("btnGame").click();
}
function back(){
  if(el("btnBack")&&el("gameView")&&el("gameView").className.indexOf("hide")<0){ el("btnBack").click(); return; }
  if(el("btnJobsBack")) el("btnJobsBack").click();
}
bind(el("garageView"), nextCar, prevOrGame);
bind(el("gameView"), back, back);
bind(el("jobsView"), back, back);
if(el("dots")) el("dots").addEventListener("click", nextCar);
})();
