/* Driv3 Maintenance planner: likely job costs (jobs-data.js WORK), sized for the selected car.
   DIY = parts × size factor. Garage = (parts + hours × your labour rate) × size factor. Estimates only; receipts stay as actuals.
   On this phone: gt.labourRate (number), gt.sizeCls {VRN:cls}, gt.plan {VRN:[{id,job,added}]}, gt.planMatch {VRN:{type:jobId}} */
(function(root){
  "use strict";
  var MULT={small:0.85,family:1,suv:1.15,premium:1.35}, LAB={small:"Small car",family:"Family car",suv:"SUV / pickup",premium:"Premium car"};
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
    if(/l200|hilux|ranger|navara|d-max|amarok|pick ?up|transit|vivaro|sprinter|crafter|trafic|transporter|\bvan\b/.test(n)) return "suv";
    if(/range rover|land rover|defender|discovery|bmw|mercedes|benz|audi|volvo|lexus|jaguar|porsche|tesla|maserati|bentley|rolls|alfa romeo|genesis|infiniti|polestar|\bds\b/.test(n)) return "premium";
    if(/suv|4x4|qashqai|tiguan|kuga|sportage|tucson|rav4|cr-v|karoq|kodiaq|ateca|outlander|santa fe|sorento|forester|cx-5|x-trail|juke|captur|2008|3008|5008|puma|t-roc|duster|jimny|land cruiser|shogun|pajero/.test(n)) return "suv";
    if(/fiesta|corsa|polo|ibiza|fabia|yaris|jazz|swift|i10|i20|clio|208|207|107|108|c1|c3|micra|aygo|picanto|rio|up!|\bup\b|citigo|spark|\b500\b|panda|mini|sandero|ka\b|agila|adam|mii|celerio|alto|city car|hatch.*small/.test(n)) return "small";
    var cc=parseFloat(String(c.engine||"").replace(/[^0-9.]/g,"")); if(cc&&(cc<=1.2||(cc>=600&&cc<=1250))) return "small";
    return "family";
  }
  function size(){var o=rd("gt.sizeCls",{})[vrn()];return MULT[o]?o:guess(car())}
  function setSize(k){var o=rd("gt.sizeCls",{});if(k===guess(car()))delete o[vrn()];else o[vrn()]=k;wr("gt.sizeCls",o)}
  function rate(){var r=+rd("gt.labourRate",80);return r>=10&&r<=400?r:80}
  function r5(n){return Math.round(n/5)*5}
  function est(j){if(j.id==="mot")return {dlo:0,dhi:0,glo:55,ghi:55};  /* MOT fee is capped by DVSA (£54.85), not sized or labour-based */
    var m=MULT[size()],R=rate();return {dlo:r5(j.plo*m),dhi:r5(j.phi*m),glo:r5((j.plo+j.hrs*R)*m),ghi:r5((j.phi+j.hrs*R)*m)}}
  function money(n){return "£"+Math.round(n).toLocaleString("en-GB")}
  function rng(a,b){return a===b?money(a):money(a)+"–"+money(b)}
  function line(j){if(j.id==="mot")return "Test fee up to £54.85 (DVSA maximum)";var e=est(j);return (e.dhi>0?"DIY about "+rng(e.dlo,e.dhi):"DIY: no parts")+" · Garage about "+rng(e.glo,e.ghi)}
  /* Match free text (reminder label / plan name) to a job */
  function match(text){var q=String(text||"").toLowerCase(),best=null,bs=0;(root.WORK||[]).forEach(function(w){var s=0,nm=w.name.toLowerCase();if(nm===q)s=100;else if(q.indexOf(nm)>=0)s=50+nm.length;else{(nm+" "+(w.buy||"")).split(/[^a-z0-9]+/).forEach(function(t){if(t.length>3&&q.indexOf(t)>=0)s+=t.length})}if(s>bs){bs=s;best=w}});return bs>=6?best:null}

  /* ---------- planned / upcoming work for the selected car ---------- */
  function plan(){return (rd("gt.plan",{})[vrn()]||[])}
  function setPlan(l){var o=rd("gt.plan",{});o[vrn()]=l;wr("gt.plan",o)}
  function matchOf(key,fallback){var m=(rd("gt.planMatch",{})[vrn()]||{})[key];return m==="none"?null:job(m)||fallback}
  function setMatch(key,id){var o=rd("gt.planMatch",{}),v=vrn();o[v]=o[v]||{};o[v][key]=id;wr("gt.planMatch",o)}
  function items(){
    var out=[],g=rd("gt.garage",null),ci=root.D3Car?D3Car.curIndex():(g&&g.i)||0;
    if(root.D3Rem) D3Rem.dueItems(g).forEach(function(e){ if(e.carIndex!==ci||!TYPEJOB[e.type]) return; var d=D3Rem.daysUntil(e.due); if(d>365) return;
      out.push({key:"rem:"+e.type,name:e.label,when:d<0?"Overdue by "+(-d)+" day"+(d===-1?"":"s"):d===0?"Due today":"Due in "+(d>60?Math.round(d/30.4)+" months":d+" day"+(d===1?"":"s")),job:matchOf("rem:"+e.type,job(TYPEJOB[e.type])||match(e.label)),d:d}); });
    plan().forEach(function(p){ var j=job(p.job); out.push({key:"plan:"+p.id,name:j?j.name:p.name||"Planned job",when:"Planned",job:matchOf("plan:"+p.id,j),pid:p.id,d:9999}); });
    return out.sort(function(a,b){return a.d-b.d});
  }
  function opts(sel){return "<option value='none'>No estimate</option>"+(root.WORK||[]).slice().sort(function(a,b){return a.name<b.name?-1:1}).map(function(w){return "<option value='"+w.id+"'"+(sel===w.id?" selected":"")+">"+esc(w.name)+"</option>"}).join("")}
  function drawPlan(){
    var box=document.getElementById("planList"); if(!box) return; var it=items(), dl=0,dh=0,gl=0,gh=0;
    box.innerHTML=it.length?it.map(function(x){ var e=x.job?est(x.job):null; if(e){dl+=e.dlo;dh+=e.dhi;gl+=e.glo;gh+=e.ghi;}
      return "<div class='pRow'><div class='pTop'><b>"+esc(x.name)+"</b><span class='pWhen"+(x.d<0?" over":"")+"'>"+esc(x.when)+"</span>"+(x.pid?"<button type='button' class='pX' data-rm='"+x.pid+"' aria-label='Remove'>✕</button>":"")+"</div>"+
        (x.job?"<p class='pEst'>"+line(x.job)+"</p>":"<p class='pEst muted'>No estimate yet — pick the matching job</p>")+
        "<label class='pPick'>"+(x.job?"Estimate based on":"Matching job")+" <select data-k='"+esc(x.key)+"'>"+opts(x.job&&x.job.id)+"</select></label></div>"; }).join("")
      :"<p class='muted pEmpty'>Nothing planned. Add a job from the search above or the cost guide below, or set MOT / service dates on your car.</p>";
    var mid=function(a,b){return money(r5((a+b)/2))};
    document.getElementById("planTot").innerHTML=it.length?"Planned work: about <b>"+mid(dl,dh)+"</b> DIY / <b>"+mid(gl,gh)+"</b> garage <small>estimate</small>":"";
    // actual spend from receipts / typed prices (DIY work in the Drive diary) — not an estimate
    var act=document.getElementById("planAct"); if(act&&root.D3Diy){ var lo=Date.now()-365*864e5, t=0;
      D3Diy.forPlate(car().plate).forEach(function(w){ var d=new Date(w.date+"T12:00").getTime(); if(d>=lo&&d<=Date.now()+864e5) t+=D3Diy.cost?D3Diy.cost(w):0; });
      act.innerHTML="Spent on DIY work, last 12 months: <b>"+money(t)+"</b> <small>actual, from your receipts</small>"; }
  }
  function addPlan(id){ var l=plan(); if(l.some(function(p){return p.job===id})) return false; l.push({id:Date.now().toString(36),job:id,added:Date.now()}); setPlan(l); drawPlan(); return true; }

  /* ---------- cost guide ---------- */
  function drawGuide(){
    var box=document.getElementById("guideList"); if(!box) return; var q=(document.getElementById("guideQ").value||"").toLowerCase().trim(), have={};
    plan().forEach(function(p){have[p.job]=1});
    var l=(root.WORK||[]).filter(function(w){return !q||(w.name+" "+(w.buy||"")+" "+(w.note||"")).toLowerCase().indexOf(q)>=0});
    box.innerHTML=l.length?l.map(function(w){ return "<div class='gRow'><div class='gTxt'><b>"+esc(w.name)+"</b><small>"+line(w)+"</small><small class='gH'>"+w.hrs+" hr"+(w.hrs===1?"":"s")+" labour"+(w.note?" · "+esc(w.note):"")+"</small></div>"+
      "<button type='button' class='gAdd' data-add='"+w.id+"'"+(have[w.id]?" disabled":"")+">"+(have[w.id]?"Planned":"+ Plan")+"</button></div>"; }).join(""):"<p class='muted'>No jobs match “"+esc(q)+"”.</p>";
    document.getElementById("guideCount").textContent=l.length+" of "+(root.WORK||[]).length+" jobs";
  }
  function drawChip(){
    var s=size(), el=document.getElementById("sizeSel"); if(el){ el.innerHTML=Object.keys(MULT).map(function(k){return "<option value='"+k+"'"+(k===s?" selected":"")+">Sized for: "+LAB[k]+(k===guess(car())?" (auto)":"")+"</option>"}).join(""); }
    var r=document.getElementById("rateIn"); if(r&&document.activeElement!==r) r.value=rate();
  }
  function all(){drawChip();drawPlan();drawGuide();if(root.plannerRedraw)root.plannerRedraw();}
  function wire(){
    var s=document.getElementById("sizeSel"); if(s) s.onchange=function(){setSize(this.value);all()};
    var r=document.getElementById("rateIn"); if(r) r.oninput=function(){var v=+this.value;if(v>=10&&v<=400){wr("gt.labourRate",v);drawPlan();drawGuide();if(root.plannerRedraw)root.plannerRedraw();}};
    document.getElementById("planList").addEventListener("change",function(e){var k=e.target.getAttribute("data-k");if(!k)return;setMatch(k,e.target.value);drawPlan()});
    document.getElementById("planList").addEventListener("click",function(e){var b=e.target.closest("[data-rm]");if(!b)return;setPlan(plan().filter(function(p){return p.id!==b.getAttribute("data-rm")}));drawPlan();drawGuide()});
    document.getElementById("guideQ").addEventListener("input",drawGuide);
    document.getElementById("guideList").addEventListener("click",function(e){var b=e.target.closest("[data-add]");if(!b)return;addPlan(b.getAttribute("data-add"));drawGuide()});
    var gb=document.getElementById("guideBtn"); if(gb) gb.onclick=function(){openGuide(true)};
    all();
    if(location.hash==="#guide") setTimeout(function(){openGuide(true)},50);
  }
  function openGuide(scroll){var a=document.getElementById("costAcc");a.classList.add("open");drawGuide();if(scroll)a.scrollIntoView({block:"start"})}
  root.D3Cost={MULT:MULT,LAB:LAB,guess:guess,size:size,rate:rate,est:est,line:line,match:match,addPlan:addPlan,redraw:all};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",wire); else wire();
})(window);
