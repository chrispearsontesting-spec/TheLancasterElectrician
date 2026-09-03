(function(){
function el(id){return document.getElementById(id)}
function show(id){
  ["garageView","gameView","jobsView"].forEach(function(v){
    if(el(v)) el(v).className = v===id ? "wrap" : "wrap hide";
  });
}
function openJobs(anchor){
  show("jobsView");
  setTimeout(function(){
    var n=el(anchor); if(n) n.scrollIntoView({behavior:"smooth",block:"start"});
    if(typeof drawQuote==="function") try{drawQuote()}catch(e){}
  },40);
}
if(el("btnQuotes")) el("btnQuotes").addEventListener("click",function(){openJobs("quoteSec")});
if(el("btnDiyPage")) el("btnDiyPage").addEventListener("click",function(){openJobs("diySec")});
if(el("btnJobsBack")) el("btnJobsBack").addEventListener("click",function(){show("garageView")});
if(el("btnGame")) el("btnGame").addEventListener("click",function(){show("gameView")});
if(el("btnBack")) el("btnBack").addEventListener("click",function(){show("garageView")});
})();
