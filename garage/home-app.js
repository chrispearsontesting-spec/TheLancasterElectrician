function seed(){
  return {id:"xc60",nick:"Volvo XC60 D5",name:"Volvo XC60 D5",plate:"SB61LGZ",fuel:"diesel",mpg:"38",
    mot:"2027-08-16",tax:"2026-10-01",ins:"2026-10-12",oil:"2026-12-31",photo:"",miles:"12000",
    beltDate:"",beltYears:"5",beltMiles:"150000",tyreDate:"",tyreLife:"20000",
    motName:"",motPhone:"",motEmail:"",insWeb:""};
}
function state(){
  try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars&&s.cars.length)return s}catch(e){}
  return {i:0,cars:[seed()]};
}
function save(s){localStorage.setItem("gt.garage",JSON.stringify(s))}
function plateYear(p){
  var k=String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(k)){
    var n=parseInt(k.slice(2,4),10);
    if(n>=1&&n<=49)return 2000+n;
    if(n>=50&&n<=99)return 2000+(n-50);
  }
  return null;
}
function openNcap(){
  var c=car();
  var r=window.ncapFor?window.ncapFor(c.nick||c.name,plateYear(c.plate)):{none:true};
  document.getElementById("ncapTitle").textContent=r.none?"Euro NCAP":("Euro NCAP "+(window.ncapStars?window.ncapStars(r.stars):""));
  document.getElementById("ncapBody").textContent=window.ncapExplain?window.ncapExplain(r):"Euro NCAP crash test rating for this generation.";
  var model=window.ncapUrl?window.ncapUrl(r):"https://www.euroncap.com/en";
  var all=window.ncapAllUrl||"https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/";
  document.getElementById("ncapLinks").innerHTML="<a class='btn wide' href='"+model+"' target='_blank' rel='noopener'>Official rating for this car</a><a class='btn wide' href='"+all+"' target='_blank' rel='noopener'>All Euro NCAP models</a>";
  document.getElementById("ncapSheet").className="sheet on";
}
function car(){var s=state();return s.cars[s.i]||s.cars[0]}
function nice(iso){if(!iso)return "Set date";var d=new Date(iso+"T12:00:00");return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
function daysLeft(iso){
  if(!iso)return null;
  var end=new Date(iso+"T12:00:00"),now=new Date();now.setHours(12,0,0,0);
  return Math.round((end-now)/86400000);
}
function leftTxt(iso){
  var days=daysLeft(iso);
  if(days==null)return "Set in Edit";
  if(days===0)return "Due today";
  if(days<0)return Math.abs(days)+" days overdue";
  var m=Math.floor(days/30),d=days-m*30;
  return (m?m+(m===1?" month ":" months "):"")+d+(d===1?" day":" days")+" left";
}
function tone(iso){
  var d=daysLeft(iso);
  if(d==null)return "";
  if(d<0)return " cOver";
  if(d<=31)return " cFlash";
  if(d<=60)return " c6";
  if(d<=120)return " c5";
  if(d<=180)return " c4";
  if(d<=240)return " c3";
  if(d<=300)return " c2";
  return " c1";
}
function beltDue(c){
  if(!c.beltDate)return "";
  var d=new Date(c.beltDate+"T12:00:00");
  d.setFullYear(d.getFullYear()+(+(c.beltYears||5)));
  return d.toISOString().slice(0,10);
}
function tyreLeft(c){
  if(!c.tyreDate||!c.tyreLife||!c.miles)return null;
  var used=(new Date()-new Date(c.tyreDate+"T12:00:00"))/86400000/365*(+c.miles);
  return Math.max(0,Math.round(100*(1-used/+c.tyreLife)));
}
function plate(p){p=String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"");if(p.length>=7)return p.slice(0,4)+" "+p.slice(4);return p||"YOUR REG"}
function esc(s){return encodeURIComponent(s||"")}
function mail(c,subject,body){
  if(!c.motEmail)return "#book";
  return "mailto:"+c.motEmail+"?subject="+esc(subject)+"&body="+esc(body);
}
function jobCopy(c,kind){
  var name=c.nick||c.name||"car";
  var pl=plate(c.plate);
  var garage=c.motName||"the garage";
  var map={
    mot:{title:"Book MOT",subject:"MOT booking — "+pl,body:"Hi "+garage+",\n\nPlease could I book an MOT for my "+name+" ("+pl+").\n\nThanks"},
    service:{title:"Book full service",subject:"Full service booking — "+pl,body:"Hi "+garage+",\n\nPlease could I book a full service for my "+name+" ("+pl+").\n\nThanks"},
    belt:{title:"Book timing belt change",subject:"Timing belt change — "+pl,body:"Hi "+garage+",\n\nPlease could I book a timing belt change for my "+name+" ("+pl+").\n\nThanks"},
    tyre:{title:"Book tyre change",subject:"Tyre change — "+pl,body:"Hi "+garage+",\n\nPlease could I book new tyres / a tyre change for my "+name+" ("+pl+").\n\nThanks"}
  };
  return map[kind]||map.service;
}
function openBook(kind){
  var c=car(), j=jobCopy(c,kind);
  document.getElementById("cTitle").textContent=j.title;
  var who=c.motName?c.motName:"Add your garage in Edit";
  document.getElementById("cBody").textContent=who+(c.motPhone?" \u00b7 "+c.motPhone:"");
  var html="";
  if(c.motPhone) html+="<a class='btn wide' href='tel:"+String(c.motPhone).replace(/\s/g,"")+"'>Call</a>";
  if(c.motEmail) html+="<a class='btn wide' href='"+mail(c,j.subject,j.body)+"'>Email</a>";
  if(!html) html="<button class='btn wide' type='button' id='needGarage'>Add garage details</button>";
  document.getElementById("cLinks").innerHTML=html;
  var ng=document.getElementById("needGarage");
  if(ng) ng.onclick=function(){document.getElementById("contact").className="sheet";openSheet("edit")};
  document.getElementById("contact").className="sheet on";
}
function btns(list){
  return "<div class='acts'>"+list.map(function(b){
    if(b.job) return "<button class='btn' type='button' data-job='"+b.job+"'>"+b.lab+"</button>";
    return "<a class='btn' href='"+b.href+"'>"+b.lab+"</a>";
  }).join("")+"</div>";
}
function row(title,iso,extra,buttons){
  return "<div class='item"+tone(iso)+"'><div><h3>"+title+"</h3><p class='when'>"+nice(iso)+"</p><p class='left'>"+leftTxt(iso)+(extra?" \u00b7 "+extra:"")+"</p></div>"+btns(buttons)+"</div>";
}
function paint(){
  var s=state(),c=car(),hero=document.getElementById("hero");
  var hint=c.photo?"":"<span class='hint'>Tap to add photo</span>";
  var img=c.photo?"<img alt='car' src='"+c.photo+"'/>":"";
  hero.style.backgroundImage=c.photo?"none":"";
  hero.innerHTML=img+hint+"<div class='plate'><span class='uk'>UK</span><span class='reg'>"+plate(c.plate)+"</span></div>";
  document.getElementById("caption").textContent=c.nick||c.name||"Car";
  document.getElementById("dots").textContent="Car "+(s.i+1)+" of "+s.cars.length;
  var motUrl=c.plate?"https://www.check-mot.service.gov.uk/results?registration="+encodeURIComponent(String(c.plate).replace(/\s/g,"")):"https://www.gov.uk/check-mot-history";
  var bd=beltDue(c), tl=tyreLeft(c);
  var taxUrl="https://www.gov.uk/vehicle-tax";
  document.getElementById("dues").innerHTML=
    row("MOT",c.mot,"",[{lab:"View history",href:motUrl},{lab:"Book MOT",job:"mot"}])+
    row("Tax",c.tax,"",[{lab:"Renew",href:taxUrl}])+
    row("Insurance",c.ins,"",[{lab:"Policy",href:"insurance.html"}])+
    row("Full service",c.oil,"",[{lab:"Book service",job:"service"}])+
    row("Timing belt",bd,bd?"":"",[{lab:"Book change",job:"belt"}])+
    "<div class='item'><div><h3>Tyres</h3><p class='when'>"+(tl==null?"Set in Edit":(tl+"% tread life left"))+"</p><p class='left'>"+(c.tyreDate?("Fitted "+nice(c.tyreDate)):"Add tyre date in Edit")+"</p></div>"+btns([{lab:"Book change",job:"tyre"}])+"</div>";
}
function savePic(f){
  if(!f)return;
  var gif=/gif/i.test(f.type)||/\.gif$/i.test(f.name);
  var r=new FileReader();
  r.onload=function(){
    if(gif){var s=state();s.cars[s.i].photo=r.result;save(s);paint();return}
    var img=new Image();
    img.onload=function(){
      var cv=document.createElement("canvas"),w=720,h=Math.round(img.height/img.width*720);
      cv.width=w;cv.height=h;cv.getContext("2d").drawImage(img,0,0,w,h);
      var s=state();s.cars[s.i].photo=cv.toDataURL("image/jpeg",0.72);save(s);paint();
    };
    img.src=r.result;
  };
  r.readAsDataURL(f);
}
function openSheet(mode){
  var c=mode==="add"?{}:car();
  document.getElementById("sheetTitle").textContent=mode==="add"?"Add car":"Edit car";
  document.getElementById("fName").value=c.nick||c.name||"";
  document.getElementById("fPlate").value=c.plate||"";
  document.getElementById("fMot").value=c.mot||"";
  document.getElementById("fTax").value=c.tax||"";
  document.getElementById("fIns").value=c.ins||"";
  document.getElementById("fOil").value=c.oil||"";
  document.getElementById("fBeltDate").value=c.beltDate||"";
  document.getElementById("fBeltYears").value=c.beltYears||"5";
  document.getElementById("fBeltMiles").value=c.beltMiles||"60000";
  document.getElementById("fTyreDate").value=c.tyreDate||"";
  document.getElementById("fTyreLife").value=c.tyreLife||"20000";
  document.getElementById("fMiles").value=c.miles||"12000";
  document.getElementById("fMpg").value=c.mpg||"";
  document.getElementById("fFuel").value=c.fuel||"petrol";
  document.getElementById("fGarage").value=c.motName||"";
  document.getElementById("fPhone").value=c.motPhone||"";
  document.getElementById("fEmail").value=c.motEmail||"";
  document.getElementById("fInsWeb").value=c.insWeb||"";
  document.getElementById("sheet").dataset.mode=mode;
  document.getElementById("sheet").className="sheet on";
}
document.getElementById("hero").onclick=function(){document.getElementById("photoPick").click()};
document.getElementById("ncapClose").onclick=function(){document.getElementById("ncapSheet").className="sheet"};
document.getElementById("photoPick").onchange=function(){savePic(this.files&&this.files[0])};
document.getElementById("prev").onclick=function(){var s=state();s.i=(s.i-1+s.cars.length)%s.cars.length;save(s);paint()};
document.getElementById("next").onclick=function(){var s=state();s.i=(s.i+1)%s.cars.length;save(s);paint()};
document.getElementById("btnAdd").onclick=function(){openSheet("add")};
document.getElementById("btnEdit").onclick=function(){openSheet("edit")};
document.getElementById("dues").addEventListener("click",function(e){
  var b=e.target.closest("[data-job]");
  if(!b)return;
  openBook(b.getAttribute("data-job"));
});
document.getElementById("btnClose").onclick=function(){document.getElementById("sheet").className="sheet"};
document.getElementById("btnCClose").onclick=function(){document.getElementById("contact").className="sheet"};
document.getElementById("btnSave").onclick=function(){
  var s=state(),mode=document.getElementById("sheet").dataset.mode;
  var c=mode==="add"?{id:"c"+Math.random().toString(36).slice(2,8),photo:""}:s.cars[s.i];
  c.nick=document.getElementById("fName").value||"Car";
  c.name=c.nick;c.plate=document.getElementById("fPlate").value.toUpperCase();
  c.mot=document.getElementById("fMot").value;c.tax=document.getElementById("fTax").value;
  c.ins=document.getElementById("fIns").value;c.oil=document.getElementById("fOil").value;
  c.beltDate=document.getElementById("fBeltDate").value;
  c.beltYears=document.getElementById("fBeltYears").value||"5";
  c.beltMiles=document.getElementById("fBeltMiles").value||"60000";
  c.tyreDate=document.getElementById("fTyreDate").value;
  c.tyreLife=document.getElementById("fTyreLife").value||"20000";
  c.miles=document.getElementById("fMiles").value||"12000";
  c.mpg=document.getElementById("fMpg").value;c.fuel=document.getElementById("fFuel").value;
  c.motName=document.getElementById("fGarage").value;
  c.motPhone=document.getElementById("fPhone").value;
  c.motEmail=document.getElementById("fEmail").value;
  c.insWeb=document.getElementById("fInsWeb").value;
  if(mode==="add"){s.cars.push(c);s.i=s.cars.length-1}
  save(s);paint();document.getElementById("sheet").className="sheet";
};
if(!localStorage.getItem("gt.garage")) save({i:0,cars:[seed()]});
paint();
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js");}
