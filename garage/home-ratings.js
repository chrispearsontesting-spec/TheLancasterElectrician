(function(){
  function hide(){
    var hero=document.getElementById("hero");
    if(!hero)return;
    var badge=hero.querySelector(".ncapBadge");
    if(badge) badge.parentNode.removeChild(badge);
  }
  document.addEventListener("click",function(e){
    if(e.target&&e.target.id==="ncapClose"){
      var s=document.getElementById("ncapSheet");
      if(s)s.className="sheet";
    }
  });
  hide();
  setInterval(hide,800);
})();
