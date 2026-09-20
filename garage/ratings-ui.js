window.ratingsHtml=function(name,year,fuel,plate,co2){
  var tax=window.vedAnnual?window.vedAnnual({year:year,fuel:fuel,plate:plate,co2:co2}):{label:"Tax",note:""};
  var n=window.ncapFor?window.ncapFor(name,year):{none:true};
  var stars=n.none?"Not rated":(window.ncapStars?window.ncapStars(n.stars):"");
  var co2Label=co2!=null? (co2+" g/km") : "With DVLA";
  var co2Note=co2!=null
    ? ("This car is recorded at "+co2+" g/km. That figure sets the pre-2017 tax band and is used for clean-air rules.")
    : "DVLA Vehicle Enquiry returns official CO\u2082 for the plate. Until that key is live we only know the year from the registration.";
  var ncapBody=(window.ncapExplain?window.ncapExplain(n):"")+
    " <a class='btn grey' href='"+(window.ncapUrl?window.ncapUrl(n):"https://www.euroncap.com/en")+"' target='_blank' rel='noopener'>Official rating page</a>"+
    " <a class='btn grey' href='https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/' target='_blank' rel='noopener'>All Euro NCAP models</a>";
  function row(title,value,cls,body){
    return "<div class='fault'><button type='button' class='faultBtn'><span class='tag "+cls+"'>"+value+"</span>"+title+"</button><div class='more'><p>"+body+"</p></div></div>";
  }
  return row("Annual tax", tax.label||"Tax", tax.ok?"low":"med", tax.note||"")
    + row("CO\u2082", co2Label, co2!=null?"low":"med", co2Note)
    + row("Euro NCAP", stars, n.none?"med":"low", ncapBody);
};
if(!window._ratingsTap){
  window._ratingsTap=true;
  document.addEventListener("click",function(e){
    var b=e.target.closest("#ratings .faultBtn");
    if(!b)return;
    var box=b.parentNode;
    box.className=box.className.indexOf("open")>=0?"fault":"fault open";
  });
}
