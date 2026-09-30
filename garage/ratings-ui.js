window.ratingsHtml=function(name,year,fuel,plate,co2){
  var f=String(fuel||name||"").toLowerCase();
  var ev=/electric|electricity|bev|\bev\b|tesla/.test(f);
  if((co2==null||co2==="") && ev) co2=0;
  var tax=window.vedAnnual?window.vedAnnual({year:year,fuel:ev?"electric":fuel,plate:plate,co2:co2}):{label:"Tax",note:""};
  var n=window.ncapFor?window.ncapFor(name,year):{none:true};
  var stars=n.none?"Not rated":(window.ncapStars?window.ncapStars(n.stars):"");
  var co2Label=co2!=null? (co2+" g/km") : "With DVLA";
  var co2Note=co2===0
    ? "Battery-electric cars are recorded as 0 g/km tailpipe CO\u2082. That is official for tax and clean-air rules. Grid electricity is separate."
    : (co2!=null
      ? ("This car is recorded at "+co2+" g/km. That figure sets the pre-2017 tax band and is used for clean-air rules.")
      : "MOT history does not include CO\u2082. The official gram figure comes from DVLA Vehicle Enquiry. Until that key is live we only infer 0 g/km for pure electrics.");
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
