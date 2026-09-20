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
  function rating(){
    var c=car(), year=plateYear(c&&c.plate);
    return window.ncapFor?window.ncapFor(c&&(c.nick||c.name),year):{none:true};
  }
  function openNcap(e){
    if(e){e.preventDefault();e.stopPropagation()}
    var r=rating();
    var sheet=document.getElementById("ncapSheet");
    var body=document.getElementById("ncapBody");
    var links=document.getElementById("ncapLinks");
    if(!sheet||!body){
      alert((window.ncapExplain?window.ncapExplain(r):"Euro NCAP")+"\n\n"+(window.ncapUrl?window.ncapUrl(r):"https://www.euroncap.com/en"));
      return;
    }
    document.getElementById("ncapTitle").textContent=r.none?"Euro NCAP":"Euro NCAP "+(window.ncapStars?window.ncapStars(r.stars):"");
    body.textContent=window.ncapExplain?window.ncapExplain(r):"Euro NCAP crash test rating.";
    var model=window.ncapUrl?window.ncapUrl(r):"https://www.euroncap.com/en";
    var all=window.ncapAllUrl||"https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/";
    links.innerHTML="<a class='btn wide' href='"+model+"' target='_blank' rel='noopener'>Official rating for this car</a>"+
      "<a class='btn wide' href='"+all+"' target='_blank' rel='noopener'>All Euro NCAP models</a>";
    sheet.className="sheet on";
  }
  function decorate(){
    var c=car(), hero=document.getElementById("hero");
    if(!c||!hero)return;
    var n=rating();
    var badge=hero.querySelector(".ncapBadge");
    if(!badge){
      badge=document.createElement("button");
      badge.type="button";
      badge.className="ncapBadge";
      badge.setAttribute("aria-label","Euro NCAP rating");
      hero.appendChild(badge);
      badge.addEventListener("click",openNcap);
    }
    badge.textContent=n.none?"NCAP":""+(window.ncapStars?window.ncapStars(n.stars):"NCAP");
  }
  document.addEventListener("click",function(e){
    if(e.target&&e.target.id==="ncapClose"){
      var s=document.getElementById("ncapSheet");
      if(s)s.className="sheet";
    }
  });
  setInterval(decorate,400);
  if(document.readyState==="complete")decorate(); else window.addEventListener("load",decorate);
})();
