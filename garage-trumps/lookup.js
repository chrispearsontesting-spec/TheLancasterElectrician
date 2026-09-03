(function(){
function el(id){return document.getElementById(id)}
function keyPlate(p){return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function plateYear(p){
  var k=keyPlate(p);
  if(k.length<5) return null;
  var n=parseInt(k.replace(/^[A-Z]+/,"").slice(0,2),10);
  if(!(n>=2&&n<=79)) return null;
  if(n>=50) return 2000+(n-50);
  return 2000+n;
}
var CARS=[
  {n:"Volvo XC60 D5",y0:2008,y1:2017,fuel:"diesel",mpg:"44",tank:"70",mph:"130",s060:"7.8",bhp:"215",nm:"440",boot:"495",cls:"suv"},
  {n:"Volvo XC60 T5",y0:2008,y1:2017,fuel:"petrol",mpg:"35",tank:"70",mph:"130",s060:"8.1",bhp:"240",nm:"350",boot:"495",cls:"suv"},
  {n:"Volvo XC60 B4",y0:2017,y1:2026,fuel:"diesel",mpg:"45",tank:"71",mph:"112",s060:"8.4",bhp:"197",nm:"420",boot:"483",cls:"suv"},
  {n:"Toyota GR Yaris",y0:2020,y1:2026,fuel:"petrol",mpg:"34",tank:"50",mph:"143",s060:"5.5",bhp:"257",nm:"360",boot:"174",cls:"premium"},
  {n:"Toyota Yaris",y0:2011,y1:2020,fuel:"petrol",mpg:"58",tank:"42",mph:"109",s060:"11.8",bhp:"99",nm:"125",boot:"286",cls:"small"},
  {n:"Ford Fiesta",y0:2008,y1:2017,fuel:"petrol",mpg:"54",tank:"42",mph:"109",s060:"11.2",bhp:"99",nm:"170",boot:"276",cls:"small"},
  {n:"Ford Focus",y0:2011,y1:2018,fuel:"petrol",mpg:"47",tank:"55",mph:"122",s060:"10.3",bhp:"123",nm:"200",boot:"316",cls:"family"},
  {n:"VW Golf",y0:2009,y1:2020,fuel:"petrol",mpg:"47",tank:"50",mph:"126",s060:"9.3",bhp:"148",nm:"250",boot:"380",cls:"family"},
  {n:"VW Golf GTI",y0:2009,y1:2020,fuel:"petrol",mpg:"38",tank:"50",mph:"155",s060:"6.5",bhp:"217",nm:"350",boot:"380",cls:"premium"},
  {n:"BMW 320d",y0:2012,y1:2019,fuel:"diesel",mpg:"58",tank:"57",mph:"143",s060:"7.2",bhp:"184",nm:"380",boot:"480",cls:"premium"},
  {n:"BMW 330d",y0:2012,y1:2019,fuel:"diesel",mpg:"50",tank:"57",mph:"155",s060:"5.6",bhp:"258",nm:"560",boot:"480",cls:"premium"},
  {n:"Audi A3",y0:2012,y1:2020,fuel:"petrol",mpg:"47",tank:"50",mph:"137",s060:"8.2",bhp:"148",nm:"250",boot:"365",cls:"family"},
  {n:"Audi A4",y0:2008,y1:2016,fuel:"diesel",mpg:"55",tank:"54",mph:"134",s060:"8.7",bhp:"161",nm:"400",boot:"480",cls:"family"},
  {n:"Mercedes C220d",y0:2014,y1:2021,fuel:"diesel",mpg:"61",tank:"66",mph:"145",s060:"7.5",bhp:"170",nm:"400",boot:"480",cls:"premium"},
  {n:"Vauxhall Corsa",y0:2006,y1:2019,fuel:"petrol",mpg:"52",tank:"45",mph:"109",s060:"12.4",bhp:"89",nm:"130",boot:"285",cls:"small"},
  {n:"Vauxhall Astra",y0:2009,y1:2015,fuel:"petrol",mpg:"47",tank:"56",mph:"118",s060:"10.5",bhp:"113",nm:"175",boot:"351",cls:"family"},
  {n:"Honda Civic",y0:2012,y1:2017,fuel:"petrol",mpg:"48",tank:"50",mph:"126",s060:"8.5",bhp:"140",nm:"220",boot:"477",cls:"family"},
  {n:"Honda Civic Type R",y0:2015,y1:2026,fuel:"petrol",mpg:"36",tank:"46",mph:"169",s060:"5.8",bhp:"316",nm:"400",boot:"420",cls:"premium"},
  {n:"Nissan Qashqai",y0:2014,y1:2021,fuel:"petrol",mpg:"45",tank:"55",mph:"122",s060:"9.9",bhp:"138",nm:"240",boot:"430",cls:"suv"},
  {n:"Land Rover Discovery Sport",y0:2015,y1:2026,fuel:"diesel",mpg:"44",tank:"65",mph:"117",s060:"8.9",bhp:"180",nm:"430",boot:"981",cls:"suv"},
  {n:"Range Rover Evoque",y0:2011,y1:2019,fuel:"diesel",mpg:"49",tank:"54",mph:"121",s060:"8.5",bhp:"180",nm:"430",boot:"575",cls:"suv"},
  {n:"Mini Cooper",y0:2014,y1:2024,fuel:"petrol",mpg:"50",tank:"40",mph:"130",s060:"7.9",bhp:"134",nm:"220",boot:"211",cls:"small"},
  {n:"Tesla Model 3",y0:2019,y1:2026,fuel:"electric",mpg:"",tank:"",mph:"140",s060:"5.8",bhp:"283",nm:"450",boot:"425",cls:"premium"},
  {n:"Skoda Octavia",y0:2013,y1:2020,fuel:"diesel",mpg:"64",tank:"50",mph:"134",s060:"8.5",bhp:"148",nm:"320",boot:"590",cls:"family"}
];
function hits(year,q){
  q=String(q||"").toLowerCase();
  if(/your car details/i.test(q)) q="";
  return CARS.filter(function(c){
    var yr=!year||(year>=c.y0&&year<=c.y1);
    var nm=!q||c.n.toLowerCase().indexOf(q)!==-1;
    return yr&&nm;
  }).slice(0,8);
}
function fill(c){
  if(el("carName")) el("carName").value=c.n;
  ["fuel","mpg","tank","mph","s060","bhp","nm","boot","cls"].forEach(function(k){if(el(k)&&c[k]!=null)el(k).value=c[k]});
}
function draw(){
  var box=el("plateHits"); if(!box) return;
  var year=plateYear(el("plate")&&el("plate").value);
  var q=el("carName")&&el("carName").value;
  var list=hits(year,q);
  if(!year&&!q){box.innerHTML="";return}
  var line=year?("Plate age band around "+year+". This is not the DVLA model — tap the car."):"Tap a match to fill the stats.";
  box.innerHTML="<p class='copy'>"+line+"</p>"+list.map(function(c,i){
    return "<button class='btn ghost' type='button' style='margin-top:6px' data-i='"+CARS.indexOf(c)+"'>"+c.n+" ("+c.y0+"–"+c.y1+")</button>";
  }).join("")+(list.length?"":"<p class='copy'>No shortlist row for that year. Type the name, or use MOT History.</p>");
}
if(el("plate")) el("plate").addEventListener("input",draw);
if(el("plate")) el("plate").addEventListener("blur",draw);
if(el("carName")) el("carName").addEventListener("input",draw);
if(el("plateHits")) el("plateHits").addEventListener("click",function(e){
  var b=e.target.closest("[data-i]"); if(!b) return;
  fill(CARS[+b.getAttribute("data-i")]);
  draw();
});
})();
