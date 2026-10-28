function seed(){
  return {id:"xc60",nick:"Volvo XC60 D5",name:"Volvo XC60 D5",plate:"SB61LGZ",fuel:"diesel",engine:"2401",mpg:"38",
    mot:"2027-08-16",tax:"2026-10-01",ins:"2026-10-12",oil:"2026-12-31",photo:"",miles:"12000",
    beltDate:"",beltYears:"5",beltMiles:"150000",tyreDate:"",tyreLife:"20000",
    motName:"",motPhone:"",motEmail:"",insWeb:""};
}
function state(){
  try{
    var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
    if(s&&s.cars&&s.cars.length){
      if(typeof s.i!=="number"||s.i<0||s.i>=s.cars.length) s.i=0;
      return s;
    }
  }catch(e){}
  return {i:0,cars:[seed()]};
}
function save(s){
  if(s&&s.cars&&s.cars.length>20) s.cars=s.cars.slice(0,20);
  if(s&&s.i>=s.cars.length) s.i=s.cars.length-1;
  localStorage.setItem("gt.garage",JSON.stringify(s));
}
function car(){
  var s=state();
  if(!s.cars.length) return seed();
  if(s.i<0||s.i>=s.cars.length) s.i=0;
  return s.cars[s.i];
}
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
  if(d<=90)return " cAmber c6";
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
  var who=c.motName?c.motName:"No garage saved yet";
  document.getElementById("cBody").textContent=who+(c.motPhone?" \u00b7 "+c.motPhone:"")+(c.motEmail?" \u00b7 "+c.motEmail:"");
  var html="", em=window.D3Rem?D3Rem.email(c,kind):{href:mail(c,j.subject,j.body)};
  if(c.motEmail) html+="<a class='btn wide' id='emailGarage' href='"+em.href.replace(/'/g,"%27")+"'>Email my garage</a>";
  if(c.motPhone) html+="<a class='btn wide' href='tel:"+String(c.motPhone).replace(/\s/g,"")+"'>Call</a>";
  var form="<div id='gForm' style='"+(c.motEmail?"display:none":"")+"'><p class='left'>"+(c.motEmail?"Edit your garage":"Add your garage first so we can email them")+"</p>"+
    "<input id='gName' placeholder='Garage name' value='"+String(c.motName||"").replace(/'/g,"&#39;")+"'/>"+
    "<input id='gEmail' type='email' placeholder='Garage email' value='"+String(c.motEmail||"").replace(/'/g,"&#39;")+"'/>"+
    "<input id='gPhone' type='tel' placeholder='Phone (optional)' value='"+String(c.motPhone||"").replace(/'/g,"&#39;")+"'/>"+
    "<button class='btn wide' type='button' id='gSave'>Save garage</button></div>";
  if(c.motEmail) html+="<button class='btn wide' type='button' id='gEdit' style='background:transparent;color:#8b8b8b;text-decoration:underline;min-height:0'>Change my garage</button>";
  document.getElementById("cLinks").innerHTML=html+form;
  var ge=document.getElementById("gEdit");
  if(ge) ge.onclick=function(){document.getElementById("gForm").style.display="";ge.style.display="none"};
  document.getElementById("gSave").onclick=function(){
    var em=document.getElementById("gEmail").value.trim();
    if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){alert("Please enter a valid email");return}
    var s=state(),cc=s.cars[s.i];
    cc.motName=document.getElementById("gName").value.trim();cc.motEmail=em;cc.motPhone=document.getElementById("gPhone").value.trim();
    save(s);openBook(kind);
  };
  document.getElementById("contact").className="sheet on";
}
function remindBanner(){
  if(!window.D3Rem) return;
  var box=document.getElementById("remBanner"), dues=document.getElementById("dues");
  if(!box){box=document.createElement("div");box.id="remBanner";var dt=document.getElementById("datesToggle")||dues;dt.parentNode.insertBefore(box,dt);}
  var act=D3Rem.active(state(),D3Rem.load());
  if(!act.length){box.innerHTML="";box.style.display="none";return}
  box.style.display="";
  box.innerHTML=act.map(function(a){
    return "<div class='remB' style='border-left:4px solid "+a.color+"'><div style='flex:1'><b>"+a.icon+" "+a.label+" \u00b7 "+a.plate+"</b><span>"+a.body.replace(/ Tap to email your garage\.$/,"")+"</span></div>"+
      (a.book?"<button type='button' class='btn' data-rjob='"+a.type+"' data-rcar='"+a.carIndex+"'>Book</button>":"<button type='button' class='btn' data-rgo='"+a.type+"' data-rcar='"+a.carIndex+"'>View</button>")+"</div>";
  }).join("")+"<a class='remSet' href='reminders.html?v=15'>Reminder settings</a>";
}
function remindGo(type,ci){
  var s=state(); if(ci!=null&&s.cars[ci]&&s.i!==ci){s.i=ci;save(s);paint();}
  var jobs={mot:"mot",service:"service",belt:"belt"};
  if(jobs[type]) openBook(jobs[type]);
  else{if(document.getElementById("dues").classList.contains("hide")){var tg=document.getElementById("datesToggle");if(tg)tg.click();}var el=document.querySelector("#dues [data-key='"+(type==="insurance"?"insurance":"tax")+"']");if(el){el.scrollIntoView({block:"center"});el.style.outline="2px solid #5aa9ff";setTimeout(function(){el.style.outline=""},2500)}}
}
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-rjob],[data-rgo]"); if(!b) return;
  remindGo(b.getAttribute("data-rjob")||b.getAttribute("data-rgo"),+b.getAttribute("data-rcar"));
});
function remindHash(){
  var L=window.D3Rem&&D3Rem.parseLink(location.hash); if(!L) return;
  var s=state(),ci=-1; s.cars.forEach(function(c,i){if(D3Rem.vrn(c.plate)===L.car)ci=i});
  history.replaceState(null,"",location.pathname+location.search);
  setTimeout(function(){remindGo(L.type,ci>=0?ci:null)},300);
}
window.addEventListener("hashchange",remindHash);
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
  var key = title.toLowerCase().replace(/\s+/g,"");
  var niceName = {"mot":"MOT","tax":"Tax","insurance":"Insurance","fullservice":"Full service","timingbelt":"Timing belt"}[key] || title;
  return "<div class='item"+tone(iso)+"' data-key='"+key+"'><div><h3>"+title+mark(iso)+"</h3><p class='when' data-date='"+key+"' data-name='"+niceName+"' style='cursor:pointer'>"+nice(iso)+"</p><p class='left'>"+leftTxt(iso)+(extra?" \u00b7 "+extra:"")+"</p></div>"+btns(buttons)+"</div>";
}

function carLogoHtml(name){
  return name || "";
}

// Fit the car name between the arrow buttons: place the box in the real gap,
// step the font down until it fits (min 11px), then let CSS ellipsis take over.
function fitName(){
  var cap=document.getElementById("caption"), el=cap&&cap.querySelector(".carName");
  var row=cap&&cap.parentNode, pv=document.getElementById("prev"), nx=document.getElementById("next");
  if(!el||!row) return;
  if(pv&&nx){
    var rr=row.getBoundingClientRect(), pr=pv.getBoundingClientRect(), nr=nx.getBoundingClientRect();
    if(rr.width&&pr.width&&nr.width){
      var inset=Math.ceil(Math.max(pr.right-rr.left, rr.right-nr.left))+6;
      cap.style.left=inset+"px"; cap.style.right=inset+"px";
    }
  }
  var size=18;
  el.style.letterSpacing="0";
  el.style.fontSize=size+"px";
  while(size>11 && el.scrollWidth>el.clientWidth){
    size-=0.5;
    el.style.fontSize=size+"px";
    if(size<15) el.style.letterSpacing="-0.2px";
  }
}
var fitT;
function refit(){ clearTimeout(fitT); fitT=setTimeout(fitName,60); }
window.addEventListener("resize",refit);
window.addEventListener("orientationchange",refit);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fitName).catch(function(){});

function paint(){
  var s=state(),c=car(),hero=document.getElementById("hero");
  if(!s.cars.length){ s.cars=[seed()]; s.i=0; save(s); }
  var hint=c.photo?"":"<span class='hint'>Tap to add photo</span>";
  var img=c.photo?"<img alt='car' src='"+c.photo+"'/>":"";
  hero.style.backgroundImage=c.photo?"none":"";
  hero.innerHTML=img+hint+"<div class='plate'><span class='uk'>UK</span><span class='reg'>"+plate(c.plate)+"</span></div>";
  var sub = "";
  var eng = c.engine;
  if(!eng && c.name){
    var n = String(c.name).toLowerCase();
    if(/xc60|d5/.test(n)) eng = "2401";
    else if(/s4|rs4|a4/.test(n) && /audi/.test(n)) eng = "1984";
  }
  if(eng || c.fuel){
    var bits = [];
    if(eng){
      var litres = (parseInt(eng,10)/1000).toFixed(1);
      bits.push(litres+"L");
    }
    if(c.fuel) bits.push(String(c.fuel).charAt(0).toUpperCase()+String(c.fuel).slice(1));
    sub = "<div class='sub'>"+bits.join(" ")+"</div>";
  }
  var nameText = carLogoHtml(c.nick||c.name||"Car");
  document.getElementById("caption").innerHTML = "<span class='carName'>"+nameText+"</span>"+sub;
  fitName();
  var dots=document.getElementById("dots");
  if(dots) dots.textContent=s.cars.length>1 ? ("Car "+(s.i+1)+" of "+s.cars.length) : "";
  var motUrl=c.plate?("mot.html?plate="+encodeURIComponent(String(c.plate).replace(/\s/g,""))+"#history"):"mot.html#history";
  var bd=beltDue(c), tl=tyreLeft(c);
  document.getElementById("dues").innerHTML=
    row("MOT",c.mot,"",[{lab:"View history",href:motUrl},{lab:"Book MOT",job:"mot"}])+
    row("Tax",c.tax,"",[{lab:"Renew",href:"https://www.gov.uk/vehicle-tax"},{lab:"Check tax",href:"tax.html?plate="+encodeURIComponent(String(c.plate||"").replace(/\s/g,""))}])+
    row("Insurance",c.ins,"",[{lab:"Policy",href:"insurance.html?v=12"},{lab:"Renew",href:"renew.html?v=13"}])+
    row("Full service",c.oil,"",[{lab:"Book service",job:"service"}])+
    row("Timing belt",bd,bd?("fitted "+nice(c.beltDate)+", every "+(c.beltYears||5)+" yrs"):"",[{lab:"Book change",job:"belt"}])+
    "<div class='item"+(tl!=null&&tl<=15?" cFlash":(tl!=null&&tl<=30?" cAmber":""))+"' data-key='tyres'><div><h3>Tyres"+(tl==null?"":(tl<=15?"<span class='mark bad'>\u2715</span>":"<span class='mark ok'>\u2713</span>"))+"</h3><p class='when'>"+(tl==null?"Set in Edit":(tl+"% tread life left"))+"</p><p class='left'>"+(c.tyreDate?("Fitted "+nice(c.tyreDate)):"Add tyre date in Edit")+"</p></div>"+btns([{lab:"Book change",job:"tyre"}])+"</div>"+
    "<a class='btn wide notifSet' href='reminders.html?v=15#notif' data-ico='cal'>Notification settings</a>";
  try{remindBanner()}catch(e){}
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
  var nameEl=document.getElementById("fName");
  if(nameEl && !nameEl.value.trim()) nameEl.value=info.name;
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
function extractPlate(text){
  var raw = String(text||"").toUpperCase();
  var fixes = {"O":"0","I":"1","L":"1","S":"5","B":"8","Z":"2","G":"6","Q":"0"};
  var clean = raw.replace(/[^A-Z0-9]/g,"");
  var patterns = [
    /[A-Z]{2}[0-9]{2}[A-Z]{3}/,
    /[A-Z][0-9]{1,3}[A-Z]{3}/,
    /[A-Z]{1,3}[0-9]{1,4}/,
    /[A-Z0-9]{7}/
  ];
  for(var p of patterns){
    var m = clean.match(p);
    if(m && m[0].length >= 6) return m[0];
  }
  var fixed = "";
  for(var i=0;i<clean.length;i++){
    fixed += fixes[clean[i]] || clean[i];
  }
  for(var p of patterns){
    var m = fixed.match(p);
    if(m && m[0].length >= 6) return m[0];
  }
  var seqs = clean.match(/[A-Z0-9]{6,8}/g);
  return (seqs && seqs[0]) || "";
}
function scanPlate(file){
  var hint=document.getElementById("plateHint");
  if(hint) hint.textContent="Scanning plate\u2026 (this can take a few seconds)";
  if(typeof Tesseract==="undefined"){
    if(hint) hint.textContent="OCR not loaded. Refresh the page.";
    return;
  }
  var opts = {
    logger: function(m){ if(m.status==="recognizing text" && hint) hint.textContent="Reading\u2026 "+Math.round((m.progress||0)*100)+"%"; },
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
    tessedit_pageseg_mode: "7"
  };
  Tesseract.recognize(file, "eng", opts).then(function(r){
    var raw = (r && r.data && r.data.text) || "";
    var found = extractPlate(raw);
    var plateEl = document.getElementById("fPlate");
    if(found && plateEl){
      plateEl.value = found;
      if(hint) hint.textContent = "Plate found: " + found + " (raw: " + raw.replace(/\s+/g," ").slice(0,40) + ")";
      doLookup();
    }else{
      if(hint) hint.textContent = "Could not read a clear plate. Raw text: " + (raw.replace(/\s+/g," ").slice(0,60) || "(none)") + ". Try again or type it.";
    }
  }).catch(function(err){
    console.error(err);
    if(hint) hint.textContent = "Scan failed. Type the plate instead.";
  });
}
function openSheet(mode){
  var c=mode==="add"?{}:car();
  document.getElementById("sheetTitle").textContent=mode==="add"?"Add car":"Edit car";
  document.getElementById("fPlate").value=c.plate||"";
  document.getElementById("fName").value=mode==="add"?"":(c.nick||c.name||"");
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
  var hint=document.getElementById("plateHint");
  if(hint) hint.textContent="Enter plate and tap Lookup, or use the camera.";
}
function step(dir){
  var s=state();
  if(!s.cars.length) return;
  s.i=(s.i+dir+s.cars.length)%s.cars.length;
  save(s);
  paint();
}
function on(id,fn){var el=document.getElementById(id); if(el) el.onclick=fn;}
on("hero",function(){document.getElementById("photoPick").click()});
on("photoPick",null);
var pick=document.getElementById("photoPick");
if(pick) pick.onchange=function(){savePic(this.files&&this.files[0])};
on("prev",function(){step(-1)});
on("next",function(){step(1)});
on("btnAdd",function(){
  var s=state();
  if(s.cars.length>=20){ alert("Maximum 20 cars."); return; }
  openSheet("add");
});
on("btnEdit",function(){openSheet("edit")});
on("btnLookup",doLookup);
on("btnCam",function(){
  var cam=document.getElementById("plateCam");
  if(cam) cam.click();
});
var plateCam=document.getElementById("plateCam");
if(plateCam) plateCam.onchange=function(){
  var f=this.files&&this.files[0];
  if(f) scanPlate(f);
  this.value="";
};
var plateEl=document.getElementById("fPlate");
if(plateEl) plateEl.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();doLookup();}});
var dues=document.getElementById("dues");
if(dues) dues.addEventListener("click",function(e){
  var b=e.target.closest("[data-job]");
  if(b){ openBook(b.getAttribute("data-job")); return; }
  var dateEl = e.target.closest("[data-date]");
  if(dateEl){
    var key = dateEl.getAttribute("data-date");
    var niceName = dateEl.getAttribute("data-name") || key;
    if(!confirm((key==="timingbelt"?"Edit the date the timing belt was fitted":"Edit expiry date for "+niceName)+"?")) return;
    var s=state(), c=s.cars[s.i];
    var current = "";
    if(key==="mot") current=c.mot||"";
    else if(key==="tax") current=c.tax||"";
    else if(key==="insurance") current=c.ins||"";
    else if(key==="fullservice") current=c.oil||"";
    else if(key==="timingbelt") current=c.beltDate||"";
    var sheet=document.createElement("div");
    sheet.className="sheet on";
    sheet.style.zIndex="30";
    var isBelt = key==="timingbelt";
    var lab = isBelt ? "Date the belt was fitted" : "New expiry date";
    var note = isBelt ? '<p class="left" style="margin-top:8px">Next change is worked out as fitted date + '+(c.beltYears||5)+' years (change the years in Edit).</p>' : '';
    sheet.innerHTML='<div class="panel"><h2>Edit '+niceName+'</h2><label>'+lab+'</label><input type="date" id="dateCal" value="'+current+'" style="font-size:18px;padding:12px;width:100%"/>'+note+'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="dateCancel" style="flex:1">Cancel</button><button class="btn" id="dateOk" style="flex:1;background:#14532d;color:#fff">Save</button></div></div>';
    document.body.appendChild(sheet);
    sheet.querySelector("#dateCancel").onclick=function(){ sheet.remove(); };
    sheet.querySelector("#dateOk").onclick=function(){
      var newDate=sheet.querySelector("#dateCal").value;
      if(!newDate){ alert("Please pick a date."); return; }
      if(key==="mot") c.mot=newDate;
      else if(key==="tax") c.tax=newDate;
      else if(key==="insurance") c.ins=newDate;
      else if(key==="fullservice") c.oil=newDate;
      else if(key==="timingbelt") c.beltDate=newDate;
      save(s);
      paint();
      sheet.remove();
    };
    return;
  }
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
  if(s.i>=s.cars.length) s.i=Math.max(0,s.cars.length-1);
  save(s);
  paint();
  document.getElementById("sheet").className="sheet";
});
on("btnSave",function(){
  var s=state(),mode=document.getElementById("sheet").dataset.mode;
  if(mode==="add" && s.cars.length>=20){ alert("Maximum 20 cars."); return; }
  var c=mode==="add"?{id:"c"+Math.random().toString(36).slice(2,8),photo:""}:s.cars[s.i];
  var looked = lastLooked || {};
  var plateNow=document.getElementById("fPlate").value.toUpperCase();
  var plateKey=plateNow.replace(/[^A-Z0-9]/g,"");
  if(looked.plate && looked.plate!==plateKey) looked={};
  var typed=document.getElementById("fName").value.trim();
  c.nick=typed || looked.name || c.nick || plate(plateNow).replace("YOUR REG","") || "Car";
  c.name=c.nick;
  if(looked.engine) c.engine = looked.engine;
  if(looked.plate){ c.motChecked = Date.now(); }
  c.plate=plateNow;
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
var MOT_RECHECK_MS=7*86400000;
function syncDates(){
  var c=car();
  var plate=String(c.plate||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!plate||dateSynced[plate]||!window.fetchMotVehicle) return;
  if(c.motChecked && (Date.now()-c.motChecked) < MOT_RECHECK_MS) return;
  dateSynced[plate]=1;
  function findCar(s){
    for(var k=0;k<s.cars.length;k++){ if(String(s.cars[k].plate||"").toUpperCase().replace(/[^A-Z0-9]/g,"")===plate) return s.cars[k]; }
    return null;
  }
  window.fetchMotVehicle(plate).then(function(info){
    var s=state(), target=findCar(s);
    if(!target) return;
    if(!info||!info.ok){
      // Not found or proxy down: back off for a day instead of retrying every load.
      target.motChecked=Date.now()-MOT_RECHECK_MS+86400000;
      save(s);
      return;
    }
    target.motChecked=Date.now();
    var exp="";
    var tests=(info&&info.tests)||[];
    var i;
    for(i=0;i<tests.length;i++){
      if(tests[i].expiryDate){exp=String(tests[i].expiryDate).slice(0,10);break;}
    }
    if(exp) target.mot=exp;
    save(s);
    if(exp) paint();
  }).catch(function(){});
}
syncDates();
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(function(){});}
remindHash();
