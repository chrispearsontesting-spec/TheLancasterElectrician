(function(){
  var SUFFIX={A:1983,B:1984,C:1985,D:1986,E:1987,F:1988,G:1989,H:1990,J:1991,K:1992,L:1993,M:1994,N:1995,P:1996,R:1997,S:1998,T:1999,V:1999,W:2000,X:2000,Y:2001};
  function plateYear(p){
    var k=String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(k.length<4)return null;
    if(/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(k)){
      var n=parseInt(k.slice(2,4),10);
      if(n>=1&&n<=49)return 2000+n;
      if(n>=50&&n<=99)return 2000+(n-50);
    }
    if(/^[A-Z]\d{1,3}[A-Z]{3}$/.test(k)&&SUFFIX[k.charAt(0)])return SUFFIX[k.charAt(0)];
    if(/^[A-Z]{1,3}\d{1,3}[A-Z]$/.test(k)&&SUFFIX[k.slice(-1)])return SUFFIX[k.slice(-1)];
    return null;
  }
  function car(){
    try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");return s&&s.cars&&s.cars.length?(s.cars[s.i]||s.cars[0]):null;}catch(e){return null}
  }
  function decorate(){
    var c=car(), hero=document.getElementById("hero");
    if(!c||!hero)return;
    var year=plateYear(c.plate);
    var n=window.ncapFor?window.ncapFor(c.nick||c.name,year):{none:true};
    var tax=window.vedAnnual?window.vedAnnual({year:year,fuel:c.fuel,plate:c.plate}):null;
    var badge=hero.querySelector(".ncapBadge");
    if(!badge){
      badge=document.createElement("button");
      badge.type="button";
      badge.className="ncapBadge";
      badge.style.cssText="position:absolute;left:8px;bottom:8px;z-index:3;background:rgba(0,0,0,.78);color:#f5d76e;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:6px 8px;font-size:12px;font-weight:800";
      hero.appendChild(badge);
      badge.addEventListener("click",function(e){
        e.preventDefault();e.stopPropagation();
        var now=car();
        var y=plateYear(now&&now.plate);
        var r=window.ncapFor(now&&(now.nick||now.name),y);
        alert(window.ncapExplain?window.ncapExplain(r):"Euro NCAP");
      });
    }
    badge.textContent=n.none?"NCAP":"NCAP "+(window.ncapStars?window.ncapStars(n.stars):"");
    var lefts=document.querySelectorAll("#dues .left");
    if(tax&&lefts&&lefts[1]&&lefts[1].dataset.ved!=="1"){
      lefts[1].dataset.ved="1";
      lefts[1].textContent=lefts[1].textContent+" \u00b7 "+tax.label;
    }
  }
  setInterval(decorate,400);
  if(document.readyState==="complete")decorate(); else window.addEventListener("load",decorate);
})();
