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
    mot:{title:"Book MOT",subject:"MOT booking \u2014 "+pl,body:"Hi "+garage+",\n\nPlease could I book an MOT for my "+name+" ("+pl+").\n\nThanks"},
    service:{title:"Book full service",subject:"Full service booking \u2014 "+pl,body:"Hi "+garage+",\n\nPlease could I book a full service for my "+name+" ("+pl+").\n\nThanks"},
    belt:{title:"Book timing belt change",subject:"Timing belt change \u2014 "+pl,body:"Hi "+garage+",\n\nPlease could I book a timing belt change for my "+name+" ("+pl+").\n\nThanks"},
    tyre:{title:"Book tyre change",subject:"Tyre change \u2014 "+pl,body:"Hi "+garage+",\n\nPlease could I book new tyres for my "+name+" ("+pl+").\n\nThanks"}
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
    if(b.job) return "<button class='btn' type='button' data-iconed='1' data-job='"+b.job+"'>"+b.lab+"</button>";
    return "<a class='btn' href='"+b.href+"' data-iconed='1'>"+b.lab+"</a>";
  }).join("")+"</div>";
}
function mark(iso){
  var d=daysLeft(iso);
  if(d==null) return "";
  if(d<=31) return "<span class='mark bad'>\u2715</span>";
  return "<span class='mark ok'>\u2713</span>";
}
function row(title,iso,extra,buttons){
  return "<div class='item"+tone(iso)+"'><div><h3>"+title+mark(iso)+"</h3><p class='when'>"+nice(iso)+"</p><p class='left'>"+leftTxt(iso)+(extra?" \u00b7 "+extra:"")+"</p></div>"+btns(buttons)+"</div>";
}



var DARK_LOGOS = ["BMW","MERCEDES-BENZ","MERCEDES","VOLKSWAGEN","VW"];


var MODEL_BADGES = {
  "S3":"badges/audi-s3.svg","S4":"badges/audi-s4.svg","RS3":"badges/audi-rs3.svg","RS4":"badges/audi-rs4.svg","RS6":"badges/audi-rs6.svg",
  "M2":"badges/bmw-m2.svg","M3":"badges/bmw-m3.svg","M4":"badges/bmw-m4.svg","M5":"badges/bmw-m5.svg","M6":"badges/bmw-m6.svg",
  "AMG":"badges/mercedes-amg.svg","GTI":"badges/vw-gti.svg","R":"badges/vw-r.svg",
  "ST":"badges/ford-st.svg","RS":"badges/ford-rs.svg"
};

var BADGE_STYLES = {
  "VOLVO":"volvo","AUDI":"audi","BMW":"bmw","MERCEDES-BENZ":"mercedes","MERCEDES":"mercedes",
  "VOLKSWAGEN":"vw","VW":"vw","FORD":"ford","VAUXHALL":"vauxhall","TOYOTA":"toyota",
  "NISSAN":"nissan","HONDA":"honda","HYUNDAI":"hyundai","KIA":"kia","LAND ROVER":"landrover",
  "JAGUAR":"jaguar","MINI":"mini","PORSCHE":"porsche","TESLA":"tesla","SKODA":"skoda",
  "PEUGEOT":"peugeot","RENAULT":"renault","MAZDA":"mazda","LEXUS":"lexus"
};

var MAKE_LOGOS = {
  "VOLVO":"volvo-logo.svg","AUDI":"audi-silver.svg","BMW":"bmw-logo.svg","FORD":"ford-logo.svg",
  "VAUXHALL":"vauxhall-logo.svg","VOLKSWAGEN":"volkswagen-logo.svg","VW":"volkswagen-logo.svg",
  "TOYOTA":"toyota-logo.svg","MERCEDES-BENZ":"mercedes-benz-logo.svg","MERCEDES":"mercedes-benz-logo.svg",
  "NISSAN":"nissan-logo.svg","HONDA":"honda-logo.svg","HYUNDAI":"hyundai-logo.svg","KIA":"kia-logo.svg",
  "PEUGEOT":"peugeot-logo.svg","RENAULT":"renault-logo.svg","SKODA":"skoda-logo.svg","SEAT":"seat-logo.svg",
  "CITROEN":"citroen-logo.svg","MINI":"mini-logo.svg","LAND ROVER":"land-rover-logo.svg","JAGUAR":"jaguar-logo.svg",
  "MAZDA":"mazda-logo.svg","MITSUBISHI":"mitsubishi-logo.svg","SUZUKI":"suzuki-logo.svg","FIAT":"fiat-logo.svg",
  "ALFA ROMEO":"alfa-romeo-logo.svg","PORSCHE":"porsche-logo.svg","TESLA":"tesla-logo.svg","LEXUS":"lexus-logo.svg",
  "INFINITI":"infiniti-logo.svg","SUBARU":"subaru-logo.svg","DACIA":"dacia-logo.svg","MG":"mg-logo.svg",
  "CUPRA":"cupra-logo.svg","POLESTAR":"polestar-logo.svg","GENESIS":"genesis-logo.svg","BENTLEY":"bentley-logo.svg",
  "ASTON MARTIN":"aston-martin-logo.svg","ROLLS-ROYCE":"rolls-royce-logo.svg","FERRARI":"ferrari-logo.svg",
  "LAMBORGHINI":"lamborghini-logo.svg","MASERATI":"maserati-logo.svg","JEEP":"jeep-logo.svg","CHRYSLER":"chrysler-logo.svg"
};
function carLogoHtml(name){
  if(!name) return "";
  var up = String(name).toUpperCase();
  var make = "", model = up;
  var keys = Object.keys(MAKE_LOGOS).sort(function(a,b){return b.length-a.length});
  for(var i=0;i<keys.length;i++){
    if(up.indexOf(keys[i])===0){ make=keys[i]; model=up.slice(keys[i].length).trim(); break; }
  }
  var dark = make && DARK_LOGOS.indexOf(make)>=0 ? " dark" : "";
  var file = MAKE_LOGOS[make];
  var src = (file.indexOf("http")===0 || file.indexOf("/")===0) ? file : (file==="audi-silver.svg" ? file : "https://cdn.jsdelivr.net/gh/vehiclespecs/brand-logos@main/"+file);
  var logo = make && file ? '<img class="makeLogo'+dark+'" src="'+src+'" alt="'+make+'">' : "";
  var style = make && BADGE_STYLES[make] ? BADGE_STYLES[make] : "";
  var badgeFile = model && MODEL_BADGES[model];
  var badge = badgeFile ? '<img class="modelBadgeImg" src="'+badgeFile+'" alt="'+model+'">' : (model ? '<span class="modelBadge'+(style?" "+style:"")+'">'+model+'</span>' : "");
  return logo + badge || name;
}

function paint(){
  var s=state(),c=car(),hero=document.getElementById("hero");
  var hint=c.photo?"":"<span class='hint'>Tap to add photo</span>";
  var img=c.photo?"<img alt='car' src='"+c.photo+"'/>":"";
  hero.style.backgroundImage=c.photo?"none":"";
  hero.innerHTML=img+hint+"<div class='plate'><span class='uk'>UK</span><span class='reg'>"+plate(c.plate)+"</span></div>";
  document.getElementById("caption").innerHTML=carLogoHtml(c.nick||c.name||"Car");
  document.getElementById("dots").textContent="Car "+(s.i+1)+" of "+s.cars.length;
  var motUrl=c.plate?("mot.html?plate="+encodeURIComponent(String(c.plate).replace(/\s/g,""))+"#history"):"mot.html#history";
  var bd=beltDue(c), tl=tyreLeft(c);
  document.getElementById("dues").innerHTML=
    row("MOT",c.mot,"",[{lab:"View history",href:motUrl},{lab:"Book MOT",job:"mot"}])+
    row("Tax",c.tax,"",[{lab:"Renew",href:"https://www.gov.uk/vehicle-tax"},{lab:"Check tax",href:"tax.html?plate="+encodeURIComponent(String(c.plate||"").replace(/\s/g,""))}])+
    row("Insurance",c.ins,"",[{lab:"Policy",href:"insurance.html"},{lab:"Renew",href:c.insWeb||"https://www.gov.uk/vehicle-insurance"}])+
    row("Full service",c.oil,"",[{lab:"Book service",job:"service"}])+
    row("Timing belt",bd,bd?"":"",[{lab:"Book change",job:"belt"}])+
    "<div class='item"+(tl!=null&&tl<=15?" cFlash":"")+"'><div><h3>Tyres"+(tl==null?"":(tl<=15?"<span class='mark bad'>\u2715</span>":"<span class='mark ok'>\u2713</span>"))+"</h3><p class='when'>"+(tl==null?"Set in Edit":(tl+"% tread life left"))+"</p><p class='left'>"+(c.tyreDate?("Fitted "+nice(c.tyreDate)):"Add tyre date in Edit")+"</p></div>"+btns([{lab:"Book change",job:"tyre"}])+"</div>";
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
var lastLooked = null;
function showFound(info){
  var found=document.getElementById("foundDetails");
  var hint=document.getElementById("plateHint");
  if(!info||!info.name){
    if(found){found.style.display="none";found.innerHTML="";}
    if(hint) hint.textContent="No details found for that plate.";
    lastLooked=null;
    return;
  }
  lastLooked=info;
  var bits=["<b>"+info.name+"</b>"];
  if(info.year) bits.push("Year: "+info.year);
  if(info.fuel) bits.push("Fuel: "+info.fuel);
  if(info.engine) bits.push("Engine: "+info.engine+" cc");
  if(info.mot) bits.push("MOT expires: "+info.mot);
  if(found){found.innerHTML=bits.join("<br>");found.style.display="block";}
  if(hint) hint.textContent="Details found from MOT.";
  window.applyPlateFields(info,{fuel:"fFuel",mot:"fMot"});
}
function doLookup(){
  var plate=document.getElementById("fPlate").value;
  var hint=document.getElementById("plateHint");
  if(hint) hint.textContent="Looking up\u2026";
  if(!window.fillFromPlate){ if(hint) hint.textContent="Lookup not ready."; return; }
  window.fillFromPlate(plate,showFound);
}
function openSheet(mode){
  var c=mode==="add"?{}:car();
  document.getElementById("sheetTitle").textContent=mode==="add"?"Add car":"Edit car";
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
  var found=document.getElementById("foundDetails");
  if(found){ found.style.display="none"; found.innerHTML=""; }
  var del=document.getElementById("btnDelete");
  if(del) del.style.display=mode==="add"?"none":"block";
  lastLooked=null;
  if(c.plate) doLookup();
}
function step(dir){
  var s=state();
  if(!s.cars.length) return;
  s.i=(s.i+dir+s.cars.length)%s.cars.length;
  save(s);paint();
}
function on(id,fn){var el=document.getElementById(id); if(el) el.onclick=fn;}
on("hero",function(){document.getElementById("photoPick").click()});
on("photoPick",null);
var pick=document.getElementById("photoPick");
if(pick) pick.onchange=function(){savePic(this.files&&this.files[0])};
on("prev",function(){step(-1)});
on("next",function(){step(1)});
on("btnAdd",function(){openSheet("add")});
on("btnEdit",function(){openSheet("edit")});
on("btnLookup",doLookup);
var plateEl=document.getElementById("fPlate");
if(plateEl) plateEl.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();doLookup();}});
var dues=document.getElementById("dues");
if(dues) dues.addEventListener("click",function(e){
  var b=e.target.closest("[data-job]");
  if(b) openBook(b.getAttribute("data-job"));
});
on("btnClose",function(){document.getElementById("sheet").className="sheet"});
on("btnCClose",function(){document.getElementById("contact").className="sheet"});
on("btnDelete",function(){
  var s=state();
  if(s.cars.length<=1){
    alert("You need at least one car in the garage.");
    return;
  }
  var c=car();
  var name=c.nick||c.name||c.plate||"this car";
  if(!confirm("Are you sure you want to delete "+name+" from your garage?")) return;
  s.cars.splice(s.i,1);
  if(s.i>=s.cars.length) s.i=s.cars.length-1;
  save(s);
  paint();
  document.getElementById("sheet").className="sheet";
});
on("btnSave",function(){
  var s=state(),mode=document.getElementById("sheet").dataset.mode;
  var c=mode==="add"?{id:"c"+Math.random().toString(36).slice(2,8),photo:""}:s.cars[s.i];
  var looked = lastLooked || {};
  c.nick=looked.name || c.nick || "Car";
  c.name=c.nick;
  c.plate=document.getElementById("fPlate").value.toUpperCase();
  c.mot=document.getElementById("fMot").value;
  c.tax=document.getElementById("fTax").value;
  c.ins=document.getElementById("fIns").value;
  c.oil=document.getElementById("fOil").value;
  c.beltDate=document.getElementById("fBeltDate").value;
  c.beltYears=document.getElementById("fBeltYears").value||"5";
  c.beltMiles=document.getElementById("fBeltMiles").value||"60000";
  c.tyreDate=document.getElementById("fTyreDate").value;
  c.tyreLife=document.getElementById("fTyreLife").value||"20000";
  c.miles=document.getElementById("fMiles").value||"12000";
  c.mpg=document.getElementById("fMpg").value;
  c.fuel=document.getElementById("fFuel").value;
  c.motName=document.getElementById("fGarage").value;
  c.motPhone=document.getElementById("fPhone").value;
  c.motEmail=document.getElementById("fEmail").value;
  c.insWeb=document.getElementById("fInsWeb").value;
  if(mode==="add"){s.cars.push(c);s.i=s.cars.length-1}
  save(s);paint();document.getElementById("sheet").className="sheet";
});
var swipeAt=0;
function swipeStart(e){swipeAt=e.changedTouches?e.changedTouches[0].clientX:e.clientX}
function swipeEnd(e){
  var x=e.changedTouches?e.changedTouches[0].clientX:e.clientX;
  var d=x-swipeAt;
  if(Math.abs(d)<40) return;
  step(d<0?1:-1);
}
["hero","caption"].forEach(function(id){
  var el=document.getElementById(id);
  if(!el) return;
  el.addEventListener("touchstart",swipeStart,{passive:true});
  el.addEventListener("touchend",swipeEnd);
});
if(!localStorage.getItem("gt.garage")) save({i:0,cars:[seed()]});
paint();
var dateSynced={};
function syncDates(){
  var c=car();
  var plate=String(c.plate||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!plate||dateSynced[plate]||!window.fetchMotVehicle) return;
  dateSynced[plate]=1;
  window.fetchMotVehicle(plate).then(function(info){
    var exp="";
    var tests=(info&&info.tests)||[];
    var i;
    for(i=0;i<tests.length;i++){
      if(tests[i].expiryDate){exp=String(tests[i].expiryDate).slice(0,10);break;}
    }
    if(!exp) return;
    var s=state();
    if(s.cars[s.i]&&s.cars[s.i].mot!==exp){
      s.cars[s.i].mot=exp;
      save(s);
      paint();
    }
  }).catch(function(){});
}
syncDates();
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(function(){});}
