/* Driv3 Drive diary: three dropdowns under the calendar (Recent, Maintenance, Journeys), one open at a time, each with a search box.
   Tapping an item opens that day's sheet above. Journeys come from localStorage gt.driveLog (Record + auto journeys share it). */
(function(){
  function esc(x){ return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]}); }
  function k(t){ var d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function nice(day){ var p=day.split("-"); return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }
  function noon(day){ var p=day.split("-"); return new Date(+p[0],+p[1]-1,+p[2],12).getTime(); }
  function car(){ try{ var g=JSON.parse(localStorage.getItem("gt.garage")||"null"); return g&&g.cars&&(g.cars[g.i]||g.cars[0])||null; }catch(e){ return null; } }
  function gbp(n){ return "£"+(+n||0).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function price(f){ var n=parseFloat(String(f&&f.price||"").replace(/[^0-9.]/g,"")); return isFinite(n)?n:0; }
  var DAY=864e5;
  function journeys(){ var l=[]; try{ l=JSON.parse(localStorage.getItem("gt.driveLog")||"[]")||[]; }catch(e){} return l.filter(function(t){ return t&&t.type!=="run"&&(!window.D3Car||D3Car.owns(t.plate)); }); }
  function diy(){ return window.D3Diy?D3Diy.forPlate((car()||{}).plate):[]; }
  function media(){ var M=window.CalMedia, out=[]; if(!M) return out; Object.keys(M.byDay).forEach(function(d){ M.byDay[d].forEach(function(e){ out.push(e); }); }); return out; }

  function row(it){ return "<button type='button' class='clItem' data-day='"+it.day+"' data-q='"+esc((it.title+" "+(it.sub||"")+" "+nice(it.day)).toLowerCase())+"'><span class='clIco'>"+it.ico+"</span><span class='clTxt'><b>"+esc(it.title)+"</b><small>"+esc(nice(it.day)+(it.sub?" · "+it.sub:""))+"</small></span>"+(it.right?"<span class='clR'>"+esc(it.right)+"</span>":"")+"</button>"; }
  function empty(t){ return "<p class='muted clEmpty'>"+t+"</p>"; }

  function recent(){
    var now=Date.now(), lo=now-30*DAY, it=[];
    diy().forEach(function(w){ var t=noon(w.date); if(t>=lo&&t<=now+DAY){ var cost=(w.files||[]).reduce(function(a,f){return a+price(f)},0), ph=(w.files||[]).filter(function(f){return f.kind==="photo"}).length; it.push({t:t,day:w.date,ico:"🔧",title:w.title||"Work done",sub:"DIY"+(ph?" · "+ph+" photo"+(ph>1?"s":""):""),right:cost?gbp(cost):""}); } });
    media().forEach(function(e){ if(e.t<lo) return; var d=k(e.t);
      if(e.k==="run") it.push({t:e.t,day:d,ico:"🏁",title:(e.r.label||"Performance run")+" · "+e.r.time+"s",sub:"Performance"+(e.r.video?" · video":"")});
      else if(e.k==="mech") it.push({t:e.t,day:d,ico:"🛠",title:e.j.note||"Work from your mechanic",sub:"Mechanic"+(e.j.garage?" · "+e.j.garage:"")});
      else it.push({t:e.t,day:d,ico:"📝",title:e.it.note||"Note",sub:"Your note"}); });
    journeys().forEach(function(j){ var t=+j.when||0; if(t>=lo) it.push({t:t,day:k(t),ico:"📍",title:(j.from||"Start")+" → "+(j.to||"Finish"),sub:(+j.miles||0).toFixed(1)+" mi",right:gbp(j.cost)}); });
    it.sort(function(a,b){return b.t-a.t});
    return it.length?it.map(row).join(""):empty("Nothing in the last 30 days.");
  }
  function maint(){
    var now=Date.now(), html="", g=null; try{ g=JSON.parse(localStorage.getItem("gt.garage")||"null"); }catch(e){}
    var ci=window.D3Car?D3Car.curIndex():0, mine=window.D3Rem?D3Rem.dueItems(g).filter(function(e){ return e.carIndex===ci; }):[];
    var over=mine.filter(function(e){ return D3Rem.daysUntil(e.due)<0; }), up=mine.filter(function(e){ var d=D3Rem.daysUntil(e.due); return d>=0&&d<=60; });
    function ago(d){ return d>=730?Math.floor(d/365)+" years":d>=60?Math.floor(d/30.4)+" months":d+" day"+(d===1?"":"s"); }
    if(over.length) html+="<p class='clHead clOver'>Overdue</p>"+over.map(function(e){ var d=-D3Rem.daysUntil(e.due); return row({day:e.due,ico:"⚠️",title:e.label+" · "+e.plate,sub:(e.type==="insurance"?"expired ":"was due ")+ago(d)+" ago — update the date if it’s been done"}); }).join("");
    html+="<p class='clHead'>Coming up · next 60 days</p>"+(up.length?up.map(function(e){ var d=D3Rem.daysUntil(e.due); return row({day:e.due,ico:e.icon,title:e.label+" · "+e.plate,sub:d===0?"due today":d+" day"+(d===1?"":"s")+" left"}); }).join(""):empty("Nothing due in the next 60 days."));
    var lo=now-365*DAY, done=[], total=0;
    diy().forEach(function(w){ var t=noon(w.date); if(t<lo||t>now+DAY) return; var cost=(w.files||[]).reduce(function(a,f){return a+price(f)},0); total+=cost; done.push({t:t,day:w.date,ico:"🔧",title:w.title||"Work done",sub:"DIY",right:cost?gbp(cost):""}); });
    media().forEach(function(e){ if(e.k!=="run"&&e.t>=lo) done.push({t:e.t,day:k(e.t),ico:e.k==="mech"?"🛠":"📝",title:e.k==="mech"?(e.j.note||"Work from your mechanic"):(e.it.note||"Note"),sub:e.k==="mech"?"Mechanic":"Your note"}); });
    done.sort(function(a,b){return b.t-a.t});
    html+="<p class='clHead'>Done · last 12 months <span class='clTot'>"+gbp(total)+" on DIY invoices</span></p>"+(done.length?done.map(row).join(""):empty("No work logged in the last 12 months."));
    return html;
  }
  function journ(){
    var now=Date.now(), lo=now-365*DAY, l=journeys().filter(function(j){return (+j.when||0)>=lo}).sort(function(a,b){return b.when-a.when});
    var miles=l.reduce(function(a,j){return a+(+j.miles||0)},0), cost=l.reduce(function(a,j){return a+(+j.cost||0)},0);
    return "<p class='clHead'>Last 12 months <span class='clTot'>"+l.length+" journey"+(l.length===1?"":"s")+" · "+miles.toFixed(0)+" mi · "+gbp(cost)+"</span></p>"+
      (l.length?l.map(function(j){ var t=+j.when; return row({day:k(t),ico:j.auto?"🔵":"📍",title:(j.from||"Start")+" → "+(j.to||"Finish"),sub:(+j.miles||0).toFixed(1)+" mi · "+new Date(t).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),right:gbp(j.cost)}); }).join(""):empty("No journeys yet. Use Record, or Let’s drive below."));
  }
  var FN={recent:recent,maint:maint,journ:journ};
  var G=[["clRecent","recent"],["clMaint","maint"],["clJourn","journ"]];
  function fill(key){ var box=document.getElementById("cl_"+key+"_list"); if(box){ box.innerHTML=FN[key](); filter(key); } }
  function filter(key){ var q=(document.getElementById("cl_"+key+"_q").value||"").trim().toLowerCase(), n=0, box=document.getElementById("cl_"+key+"_list");
    box.querySelectorAll(".clItem").forEach(function(b){ var on=!q||b.getAttribute("data-q").indexOf(q)>=0; b.style.display=on?"":"none"; if(on) n++; });
    var none=box.querySelector(".clNone"); if(q&&!n){ if(!none){ none=document.createElement("p"); none.className="muted clNone"; box.appendChild(none); } none.textContent="No matches for “"+q+"”."; } else if(none) none.remove(); }
  function setOpen(key){
    G.forEach(function(g){ var b=document.getElementById(g[0]), m=document.getElementById(g[0]+"Menu"), on=g[1]===key; m.classList.toggle("hide",!on); b.setAttribute("aria-expanded",on?"true":"false"); if(on) fill(g[1]); });
    try{ sessionStorage.setItem("gt.calOpen",key||""); }catch(e){}
  }
  G.forEach(function(g){ var b=document.getElementById(g[0]), m=document.getElementById(g[0]+"Menu"); if(!b) return;
    b.onclick=function(){ setOpen(m.classList.contains("hide")?g[1]:""); };
    document.getElementById("cl_"+g[1]+"_q").addEventListener("input",function(){ filter(g[1]); });
    m.addEventListener("click",function(e){ var it=e.target.closest(".clItem"); if(!it) return; var d=it.getAttribute("data-day");
      window.selected=d; window.view=new Date(+d.slice(0,4),+d.slice(5,7)-1,1); window.render(d);
      var l=document.getElementById("list"); if(l) l.scrollIntoView({behavior:"smooth",block:"start"}); });
  });
  // Keep the open list fresh after anything redraws the calendar (edits, uploads, media loaded).
  var orig=window.render; window.render=function(){ orig.apply(this,arguments); var k2=""; G.forEach(function(g){ if(!document.getElementById(g[0]+"Menu").classList.contains("hide")) k2=g[1]; }); if(k2) fill(k2); };
  var start=""; try{ start=sessionStorage.getItem("gt.calOpen")||""; }catch(e){}
  if(location.hash==="#routes"||location.hash==="#journeys"){ start="journ"; if(location.hash==="#routes") document.getElementById("routes").open=true; setTimeout(function(){ document.getElementById("clJourn").scrollIntoView({block:"start"}); },50); }
  setOpen(start);
})();
