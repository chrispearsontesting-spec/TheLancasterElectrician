(function(){
function el(id){return document.getElementById(id)}
function show(id){
  ["garageView","gameView","jobsView"].forEach(function(v){
    if(el(v)) el(v).className = v===id ? "wrap" : "wrap hide";
  });
}
function copyHero(){
  if(el("jobsHero")&&el("hero")) el("jobsHero").innerHTML=el("hero").innerHTML;
}
function openJobs(){
  copyHero();
  show("jobsView");
  window.scrollTo(0,0);
}
if(el("btnQuotes")) el("btnQuotes").addEventListener("click",openJobs);
if(el("btnDiyPage")) el("btnDiyPage").addEventListener("click",openJobs);
if(el("btnJobsBack")) el("btnJobsBack").addEventListener("click",function(){show("garageView")});
if(el("btnGame")) el("btnGame").addEventListener("click",function(){show("gameView")});
if(el("btnBack")) el("btnBack").addEventListener("click",function(){show("garageView")});
})();
