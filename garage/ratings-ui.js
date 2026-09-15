window.ratingsHtml=function(name,year,fuel,plate){
  var tax=window.vedAnnual?window.vedAnnual({year:year,fuel:fuel,plate:plate}):{label:"Tax",note:""};
  var n=window.ncapFor?window.ncapFor(name,year):{none:true};
  var stars=n.none?"Not rated":(window.ncapStars?window.ncapStars(n.stars):"");
  var ncapNote=window.ncapExplain?window.ncapExplain(n):"";
  var taxNote=tax.note||"";
  return "<div class='rateGrid'><div class='rate'><b>Annual tax</b><span>"+tax.label+"</span><p>"+taxNote+"</p></div><div class='rate ncapTap' data-ncap='1'><b>Euro NCAP</b><span class='stars'>"+stars+"</span><p>"+ncapNote+"</p></div></div>";
};
