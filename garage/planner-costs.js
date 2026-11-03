/* Driv3 Maintenance planner: likely job costs (jobs-data.js WORK), sized for the selected car.
   DIY = parts × size factor. Garage = (parts + hours × your labour rate) × size factor. Estimates only; receipts stay as actuals.
   On this phone: gt.labourRate (number), gt.sizeCls {VRN:cls}, gt.plan {VRN:[{id,job,added}]}, gt.planMatch {VRN:{type:jobId}} */
(function(root){
  "use strict";
  /* 9 size classes (jobs-data CLASSES ids). MULT only used for jobs without per-class data (legacy plo/phi). */
  var MULT={city:0.75,small:0.85,family:1,exec:1.2,premium:1.35,suv4x4:1.25,pickup:1.2,van:1.15,ev:1.1},
      LAB={city:"City car",small:"Small car",family:"Family car",exec:"Executive car",premium:"Premium car",suv4x4:"SUV / 4x4",pickup:"Pickup",van:"Van",ev:"Electric car"};
  if(root.CLASSES&&root.CLASSES.forEach) root.CLASSES.forEach(function(c){ if(c&&c.id&&MULT[c.id]&&c.label) LAB[c.id]=c.label; });
  var TYPEJOB={mot:"mot",service:"full",belt:"beltwp"};
  function rd(k,d){try{var v=JSON.parse(localStorage.getItem(k)||"null");return v==null?d:v}catch(e){return d}}
  function wr(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function esc(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function car(){var g=rd("gt.garage",null);return g&&g.cars&&(g.cars[g.i]||g.cars[0])||{}}
  function vrn(){return root.D3Car?D3Car.curVrn():String(car().plate||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
  function job(id){return (root.WORK||[]).filter(function(w){return w.id===id})[0]||null}
  /* Guess size class from the saved details */
  function guess(c){
    var n=[c.make,c.model,c.nick,c.name,c.body,c.type,c.engine].join(" ").toLowerCase();
    if(/electric/.test(String(c.fuel||"").toLowerCase())||/tesla|leaf|\bzoe\b|e-golf|id\.3|id\.4|enyaq|ioniq 5|polestar|e-tron|\bmg4\b|\bi3\b/.test(n)) return "ev";
    if(/l200|hilux|ranger|navara|d-max|amarok|pick ?up|pickup/.test(n)) return "pickup";
    if(/transit|vivaro|sprinter|crafter|trafic|transporter|berlingo|partner|caddy|kangoo|doblo|ducato|boxer|relay|movano|master|\bvan\b/.test(n)) return "van";
    if(/range rover|defender|discovery|land cruiser|shogun|pajero|\bx5\b|\bx6\b|\bx7\b|\bq7\b|\bq8\b|\bgle\b|\bgls\b|xc90|touareg|cayenne/.test(n)) return "suv4x4";
    if(/land rover|bmw|mercedes|benz|audi|volvo|lexus|jaguar|porsche|maserati|bentley|rolls|alfa romeo|genesis|infiniti|\bds\b/.test(n)) return "premium";
    if(/aygo|\b107\b|\b108\b|\bc1\b|\bi10\b|picanto|\bup!?\b|citigo|\bmii\b|spark|\b500\b|panda|twingo|celerio|alto|\bka\b|agila/.test(n)) return "city";
    if(/fiesta|corsa|polo|ibiza|fabia|yaris|jazz|swift|i20|clio|\b208\b|\b207\b|\bc3\b|micra|\brio\b|sandero|mini|adam|\bmazda2\b|note/.test(n)) return "small";
    if(/mondeo|passat|insignia|superb|\b508\b|arteon|avensis|accord|stinger|kodiaq|5008/.test(n)) return "exec";
    if(/suv|4x4|qashqai|tiguan|kuga|sportage|tucson|rav4|cr-v|karoq|ateca|outlander|santa fe|sorento|forester|cx-5|x-trail|jimny|duster/.test(n)) return "suv4x4";
    var cc=parseFloat(String(c.engine||"").replace(/[^0-9.]/g,"")); if(cc&&(cc<=1.1||(cc>=600&&cc<=1100))) return "city"; if(cc&&(cc<=1.4||(cc>1100&&cc<=1400))) return "small";
    return "family";
  }
  function size(){var o=rd("gt.sizeCls",{})[vrn()];if(o==="suv")o="suv4x4";return MULT[o]?o:guess(car())}
  function setSize(k){var o=rd("gt.sizeCls",{});if(k===guess(car()))delete o[vrn()];else o[vrn()]=k;wr("gt.sizeCls",o)}
  function rate(){var L=root.LABOUR&&root.LABOUR.indie, d=L&&L.length===2?Math.round((L[0]+L[1])/2):80, r=+rd("gt.labourRate",d);return r>=10&&r<=400?r:d}
  function r5(n){return Math.round(n/5)*5}
  /* {dlo,dhi,glo,ghi} or null when the job doesn't apply to this class. Uses j.cls[class] {p:[lo,hi],h} when present. */
  function est(j){
    if(j.id==="mot")return {dlo:0,dhi:0,glo:55,ghi:55};
    if(j.fixed&&j.fixed.length===2) return {dlo:0,dhi:0,glo:r5(+j.fixed[0]),ghi:r5(+j.fixed[1]),h:null};  /* MOT fee is capped by DVSA (£54.85), not sized or labour-based */
    var k=size(), R=rate(), c=car(), plo,phi,h,m=1;
    if(j.cls&&typeof j.cls==="object"){ var x=j.cls[k]; if(!x||!x.p) return null; plo=+x.p[0]||0; phi=+x.p[1]||plo; h=x.h!=null?+x.h:+j.hrs||0;
      var f=j.fuel&&j.fuel[String(c.fuel||"").toLowerCase()]; if(f&&f.p){ plo=+f.p[0]||plo; phi=+f.p[1]||phi; } if(f&&f.h!=null) h=+f.h; }
    else { m=MULT[k]; plo=(+j.plo||0)*m; phi=(+j.phi||0)*m; h=(+j.hrs||0)*m; }
    return {dlo:r5(plo),dhi:r5(phi),glo:r5(plo+h*R),ghi:r5(phi+h*R),h:j.cls?Math.round(h*10)/10:null};
  }
  function money(n){return "£"+Math.round(n).toLocaleString("en-GB")}
  function rng(a,b){return a===b?money(a):money(a)+"–"+money(b)}
  function line(j){if(j.id==="mot")return "Test fee up to £54.85 (DVSA maximum)";var e=est(j);if(!e)return "Not usually needed on a "+LAB[size()].toLowerCase();return (e.dhi>0?"DIY about "+rng(e.dlo,e.dhi):"DIY: no parts")+" · Garage about "+rng(e.glo,e.ghi)}
  /* Match free text (reminder label / plan name) to a job */
  function match(text){var q=String(text||"").toLowerCase(),best=null,bs=0;(root.WORK||[]).forEach(function(w){var s=0,nm=w.name.toLowerCase();if(nm===q)s=100;else if(q.indexOf(nm)>=0)s=50+nm.length;else{(nm+" "+(w.buy||"")).split(/[^a-z0-9]+/).forEach(function(t){if(t.length>3&&q.indexOf(t)>=0)s+=t.length})}if(s>bs){bs=s;best=w}});return bs>=6?best:null}

  /* ---------- planned work: known recurring costs for the next 12 months (garage estimate only) ---------- */
  function migrate(){ var o=rd("gt.plan",null); if(o){ try{localStorage.setItem("gt.planOld",JSON.stringify(o));localStorage.removeItem("gt.plan")}catch(e){} } }
  function amts(){return rd("gt.renewAmt",{})[vrn()]||{}}
  function setAmt(k,v){var o=rd("gt.renewAmt",{}),r=vrn();o[r]=o[r]||{};if(v>0)o[r][k]=v;else delete o[r][k];wr("gt.renewAmt",o)}
  function whenTxt(d){return d<0?"Overdue by "+(-d)+" day"+(d===-1?"":"s"):d===0?"Due today":"Due in "+(d>60?Math.round(d/30.4)+" months":d+" day"+(d===1?"":"s"))}
  function fmtD(s){var d=new Date(s+"T12:00:00");return isNaN(d)?"":d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
  function iso(t){var d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function tyreDue(c){ if(!c.tyreDate) return null; var life=+c.tyreLife||20000, mi=+c.miles||8000; return iso(new Date(c.tyreDate+"T12:00:00").getTime()+life/mi*365*864e5); }
  var REMJOB={mot:"mot",service:"full",belt:"beltwp"};
  function items(){
    var out=[],g=rd("gt.garage",null),ci=root.D3Car?D3Car.curIndex():(g&&g.i)||0,c=car(),a=amts();
    if(root.D3Rem) D3Rem.dueItems(g).forEach(function(e){ if(e.carIndex!==ci) return; var d=D3Rem.daysUntil(e.due); if(d>365) return;
      if(REMJOB[e.type]){ var j=job(REMJOB[e.type]); out.push({key:e.type,name:e.type==="mot"?"MOT test":e.type==="service"?"Full service":"Timing belt + water pump",due:e.due,d:d,job:j}); }
      else if(e.type==="tax"||e.type==="insurance"){ var k=e.type==="tax"?"tax":"ins"; out.push({key:k,name:e.type==="tax"?"Road tax":"Insurance",due:e.due,d:d,own:k,val:a[k]||0}); } });
    var td=tyreDue(c);
    if(!td) out.push({key:"tyres",name:"Tyres (front pair)",d:9998,ask:true,job:job("tyres2")});
    else { var d=root.D3Rem?D3Rem.daysUntil(td):0; if(d<=365) out.push({key:"tyres",name:"Tyres (front pair)",due:td,d:d,job:job("tyres2"),tyre:true}); }
    return out.sort(function(x,y){return x.d-y.d});
  }
  function drawPlan(){
    var box=document.getElementById("planList"); if(!box) return; var it=items(), tot=0;
    box.innerHTML=it.length?it.map(function(x){
      var right="", sub="";
      if(x.own){ right="<label class='pAmt'>£<input type='number' inputmode='decimal' min='0' step='1' data-amt='"+x.own+"' value='"+(x.val||"")+"' placeholder='Add'/></label>"; tot+=+x.val||0;
        sub=x.val?"Your figure":"Type what you pay to include it"; }
      else if(x.job){ var e=est(x.job); if(e){ if(!x.ask) tot+=(e.glo+e.ghi)/2; right=x.ask?"<span class='pMoney q'>"+rng(e.glo,e.ghi)+"</span>":"<span class='pMoney'>"+(x.key==="mot"?"up to £54.85":rng(e.glo,e.ghi))+"</span>"; } sub=x.key==="mot"?"Test fee (DVSA maximum)":"Garage estimate"+(x.tyre?" · from your tyre details":""); }
      if(x.ask) sub="When were the tyres fitted? <input type='date' class='pDate' data-tyre='1'/>";
      return "<div class='pRow'><div class='pTop'><b>"+esc(x.name)+"</b>"+right+"</div><p class='pEst muted'>"+(x.due?"<span class='pWhen"+(x.d<0?" over":"")+"'>"+fmtD(x.due)+" · "+whenTxt(x.d)+"</span><br>":"")+sub+"</p></div>"; }).join("")
      :"<p class='muted pEmpty'>Nothing due in the next 12 months. Add MOT, service and timing belt dates on your car to see costs here.</p>";
    var h=document.getElementById("planHead"); if(h) h.textContent="Planned work"+(tot?" · about "+money(r5(tot)):"");
    document.getElementById("planTot").innerHTML=tot?"Next 12 months: about <b>"+money(r5(tot))+"</b> <small>garage estimates plus your own figures</small>":"";
    var act=document.getElementById("planAct"); if(act&&root.D3Diy){ var lo=Date.now()-365*864e5, t=0;
      D3Diy.forPlate(car().plate).forEach(function(w){ var d=new Date(w.date+"T12:00").getTime(); if(d>=lo&&d<=Date.now()+864e5) t+=D3Diy.cost?D3Diy.cost(w):0; });
      act.innerHTML=t?"Already spent on DIY work, last 12 months: <b>"+money(t)+"</b> <small>from your receipts</small>":""; }
  }
  function addPlan(){return false}

  /* ---------- expected costs from the latest MOT ---------- */
  var MOTMAP=[
    [/brake pipe/i,"brakepipe"],[/brake hose|flexible brake/i,"hoses"],[/parking brake|handbrake/i,"handbrake"],
    [/exhaust.*corro|corro.*exhaust|exhaust/i,"exhaust"],[/silencer|back box/i,"backbox"],[/catalytic/i,"cat"],[/particulate|\bdpf\b/i,"dpfr"],
    [/corro|rust/i,"inspect"],
    [/tyre/i,"tyres2"],[/brake (pad|lining)s?\b(?!.*disc)/i,"pads"],[/brake disc|brake pad|brake lining/i,"fpads"],[/caliper/i,"caliper"],
    [/coil spring|road spring/i,"spring"],[/shock absorber|damper/i,"damp"],[/anti-roll bar (linkage|link)|drop link/i,"drop"],[/anti-roll bar.*bush/i,"arbbush"],
    [/ball joint/i,"balljoint"],[/track rod/i,"track"],[/wheel bearing|hub bearing/i,"bearing"],[/cv boot|constant velocity|drive ?shaft.*(boot|gaiter)|gaiter/i,"cvboot"],
    [/wishbone|suspension arm|control arm/i,"wishbone"],[/pivot.*bush|bush/i,"bush"],[/subframe/i,"subframe"],
    [/oil leak|leaking oil|engine.*leak/i,"oilleak"],[/windscreen/i,"windscreen"],[/wiper/i,"wipers"],[/washer/i,"washer"],
    [/registration plate|number plate/i,"numberplate"],[/(lamp|light).*(not working|inoperative|missing)|bulb/i,"bulb"],[/horn/i,"horn"],[/seat belt/i,"seatbelt"],[/sill/i,"sill"]
  ];
  var REARJ={tyres2:"tyres2",pads:"rearpads",fpads:"rpads",damp:"rdamp"};
  function mapDef(t){ for(var i=0;i<MOTMAP.length;i++) if(MOTMAP[i][0].test(t)){ var id=MOTMAP[i][1], rear=/\brear\b/i.test(t)&&!/\bfront\b/i.test(t);
      if(rear&&REARJ[id]) id=REARJ[id]; return {id:id,axle:/tyre/i.test(t)?(rear?"rear":"front"):""}; } return {id:null}; }
  function latest(tests){
    tests=(tests||[]).slice().sort(function(a,b){return String(b.completedDate||"")<String(a.completedDate||"")?-1:1}); if(!tests.length) return null;
    var day=String(tests[0].completedDate||"").slice(0,10), same=tests.filter(function(t){return String(t.completedDate||"").slice(0,10)===day}),
        passed=/PASS/i.test(tests[0].testResult||""), seen={}, defs=[];
    same.forEach(function(t){ (t.defects||t.rfrAndComments||[]).forEach(function(d){ var ty=String(d.type||"").toUpperCase(), tx=d.text||d.comment||""; if(!tx||ty==="PRS"||ty==="USER ENTERED") return;
      if(passed&&!/ADVISORY|MINOR/.test(ty)) return; if(seen[tx]) return; seen[tx]=1; defs.push({type:d.dangerous?"DANGEROUS":ty,text:tx}); }); });
    return {day:day,passed:passed,defs:defs};
  }
  function motGroups(L){
    var g={},order=[]; L.defs.forEach(function(d){ var m=mapDef(d.text), k=m.id?m.id+(m.axle?":"+m.axle:""):"q:"+d.text;
      if(!g[k]){ g[k]={m:m,defs:[]}; order.push(k); } g[k].defs.push(d); });
    return order.map(function(k){return g[k]});
  }
  function lbl(t){return {ADVISORY:"Advisory",MINOR:"Minor",MAJOR:"Fail",DANGEROUS:"Dangerous",FAIL:"Fail"}[t]||"Note"}
  function drawMot(){
    var box=document.getElementById("motList"); if(!box) return; var c=rd("gt.motCache",{})[vrn()], h=document.getElementById("motHead");
    if(!vrn()){ box.innerHTML="<p class='muted pEmpty'>Add your number plate to see costs from your last MOT.</p>"; return; }
    if(!c){ box.innerHTML="<p class='muted pEmpty'>Checking your MOT history…</p>"; return; }
    var L=latest(c.tests);
    if(!L){ box.innerHTML="<p class='muted pEmpty'>No MOT history found for this car yet. New cars don't need an MOT until they're 3 years old.</p>"; h.textContent="Expected costs from MOT"; return; }
    if(!L.defs.length){ box.innerHTML="<p class='src'>From MOT on "+fmtD(L.day)+"</p><p class='muted pEmpty'>No advisories on the last MOT. Nothing extra to budget for.</p>"; h.textContent="Expected costs from MOT · none"; return; }
    var lo=0,hi=0,q=0;
    var rows=motGroups(L).map(function(G){ var j=G.m.id&&G.m.id!=="inspect"?job(G.m.id):null, e=j?est(j):null, right, nm;
      if(e){ lo+=e.glo; hi+=e.ghi; right="<span class='pMoney'>"+rng(e.glo,e.ghi)+"</span>"; nm=j.name+(G.m.axle?" ("+G.m.axle+")":""); }
      else if(G.m.id==="inspect"){ right="<span class='pMoney q'>Needs inspection</span>"; nm="Corrosion check"; q++; }
      else { right="<span class='pMoney q'>Get a quote</span>"; nm="Other repair"; q++; }
      return "<div class='pRow'><div class='pTop'><b>"+esc(nm)+"</b>"+right+"</div>"+G.defs.map(function(d){return "<p class='pEst muted'><span class='tg "+d.type.toLowerCase()+"'>"+lbl(d.type)+"</span> "+esc(d.text)+"</p>"}).join("")+"</div>"; });
    box.innerHTML="<p class='src'>From MOT on "+fmtD(L.day)+(L.passed?" (passed)":" (failed)")+"</p>"+rows.join("")+
      "<p class='tot'>Expected from MOT advisories: about <b>"+rng(r5(lo),r5(hi))+"</b> <small>garage estimate"+(q?" · plus "+q+" item"+(q===1?"":"s")+" to price":"")+"</small></p>";
    h.textContent="Expected costs from MOT"+(hi?" · about "+money(r5((lo+hi)/2)):"");
  }
  function loadMot(){
    var r=vrn(); if(!r||!root.fetchMotVehicle) return drawMot(); var all=rd("gt.motCache",{}), c=all[r];
    drawMot(); if(c&&Date.now()-c.at<864e5) return;
    root.fetchMotVehicle(r).then(function(info){ if(!info.ok){ if(!c){ var b=document.getElementById("motList"); if(b) b.innerHTML="<p class='muted pEmpty'>Couldn't check your MOT history right now. It'll try again next time you open this.</p>"; } return; }
      var o=rd("gt.motCache",{}); o[r]={at:Date.now(),tests:(info.tests||[]).slice(0,6).map(function(t){return {completedDate:t.completedDate,testResult:t.testResult,defects:(t.defects||t.rfrAndComments||[]).map(function(d){return {type:d.type,text:d.text||d.comment,dangerous:d.dangerous}})}})};
      wr("gt.motCache",o); drawMot(); });
  }

  /* ---------- cost guide ---------- */
  function drawGuide(){
    var box=document.getElementById("guideList"); if(!box) return; var q=(document.getElementById("guideQ").value||"").toLowerCase().trim(), have={};
    var l=(root.WORK||[]).filter(function(w){return !q||(w.name+" "+(w.buy||"")+" "+(w.note||"")+" "+(w.cat||"")).toLowerCase().indexOf(q)>=0});
    var stars=function(n){n=Math.max(1,Math.min(5,+n||0));return "DIY "+["easy","fairly easy","moderate","hard","expert"][n-1]+" ("+n+"/5)"};
    var rowOf=function(w){ var e=est(w), ex=[]; if(e&&e.h!=null) ex.push(e.h+" hr"+(e.h===1?"":"s")+" labour"); else ex.push(w.hrs+" hr"+(w.hrs===1?"":"s")+" labour");
      if(w.diy) ex.push(stars(typeof w.diy==="object"?w.diy.lvl:w.diy)+(w.diy.ok===false?" · garage job":"")); if(w.interval) ex.push("Every "+esc(w.interval)); if(w.note) ex.push(esc(w.note));
      return "<div class='gRow'><div class='gTxt'><b>"+esc(w.name)+"</b><small>"+line(w)+"</small><small class='gH'>"+ex.join(" · ")+"</small>"+(w.warn?"<small class='gW'>⚠ "+esc(w.warn)+"</small>":"")+(w.tools?"<small class='gH'>Tools: "+esc([].concat(w.tools).join(", "))+"</small>":"")+"</div></div>"; };
    var cats={}, order=[]; l.forEach(function(w){ var c=w.cat||""; if(!cats[c]){cats[c]=[];order.push(c);} cats[c].push(w); });
    box.innerHTML=l.length?(order.length>1||order[0]?order.map(function(c){ return "<p class='gCat'>"+esc(c||"Other")+"</p>"+cats[c].map(rowOf).join(""); }).join(""):l.map(rowOf).join("")):"<p class='muted'>No jobs match “"+esc(q)+"”.</p>";
    document.getElementById("guideCount").textContent=l.length+" of "+(root.WORK||[]).length+" jobs";
  }
  function drawChip(){
    var s=size(), el=document.getElementById("sizeSel"); if(el){ el.innerHTML=Object.keys(MULT).map(function(k){return "<option value='"+k+"'"+(k===s?" selected":"")+">Sized for: "+LAB[k]+(k===guess(car())?" (auto)":"")+"</option>"}).join(""); }
    var r=document.getElementById("rateIn"); if(r&&document.activeElement!==r) r.value=rate();
  }
  function all(){drawChip();drawPlan();drawMot();drawGuide();if(root.plannerRedraw)root.plannerRedraw();}
  function wire(){
    var s=document.getElementById("sizeSel"); if(s) s.onchange=function(){setSize(this.value);all()};
    var r=document.getElementById("rateIn"); if(r) r.oninput=function(){var v=+this.value;if(v>=10&&v<=400){wr("gt.labourRate",v);drawPlan();drawMot();drawGuide();if(root.plannerRedraw)root.plannerRedraw();}};
    migrate();
    document.getElementById("planList").addEventListener("change",function(e){var t=e.target;
      if(t.getAttribute("data-amt")){setAmt(t.getAttribute("data-amt"),+t.value);drawPlan();}
      else if(t.getAttribute("data-tyre")&&t.value){var g=rd("gt.garage",null),i=root.D3Car?D3Car.curIndex():g.i;if(g&&g.cars[i]){g.cars[i].tyreDate=t.value;if(!g.cars[i].tyreLife)g.cars[i].tyreLife="20000";wr("gt.garage",g);}drawPlan();}});
    ["planToggle","motToggle"].forEach(function(id){var b=document.getElementById(id);if(b)b.onclick=function(){var a=b.parentNode;a.classList.toggle("open")}});
    loadMot();
    document.getElementById("guideQ").addEventListener("input",drawGuide);
    var gb=document.getElementById("guideBtn"); if(gb) gb.onclick=function(){openGuide(true)};
    all();
    if(location.hash==="#guide") setTimeout(function(){openGuide(true)},50);
  }
  function openGuide(scroll){var a=document.getElementById("costAcc");a.classList.add("open");drawGuide();if(scroll)a.scrollIntoView({block:"start"})}
  root.D3Cost={MULT:MULT,LAB:LAB,guess:guess,size:size,rate:rate,est:est,line:line,match:match,addPlan:addPlan,mapDef:mapDef,latest:latest,redraw:all};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",wire); else wire();
})(window);
