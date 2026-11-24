/* Trac3 Drive diary: every entry opens its own page (event.html, see ev-url.js).
   - Day sheet cards (journeys, runs, work, mechanic uploads, notes, saved routes, reminders): tap the card. Buttons, links,
     photos and the MPG editor inside a card keep doing what they did.
   - Calendar day icons: tap the icons under a day. One entry opens straight away; more than one shows that day's list.
   - Recent / Maintenance / Journeys lists: handled in cal-lists.js (rows carry data-ev). */
(function(){
  var list=document.getElementById("list"), grid=document.getElementById("grid");
  function chev(){ return "<span class='evChev' aria-hidden='true'></span>"; }
  function decorate(){
    list.querySelectorAll("[data-ev]").forEach(function(c){ if(!c.getAttribute("data-ev")) return; c.classList.add("evCard");
      var t=c.querySelector("b.title"); if(t&&!t.querySelector(".evChev")) t.insertAdjacentHTML("beforeend",chev());
      if(!c.hasAttribute("tabindex")){ c.setAttribute("tabindex","0"); c.setAttribute("role","link"); c.setAttribute("aria-label",(t?t.textContent.trim():"Entry")+": open details"); } });
  }
  /* Day icons instead of dots (t265u): what happened that day at a glance. Up to 3 kinds; more than 3 shows 2 + "+N". */
  var GI=function(){ return window.T3_GRID_ICONS||{}; };
  function svgFor(k){ var g=GI(); return g[k]||(window.dipstickIcon&&window.dipstickIcon(k))||""; }
  // kind: [icon key, colour class, label]; order = priority on the day
  var KIND={over:["warning","over","Overdue"],mot:["check","due","MOT due"],tax:["gbp","due","Tax due"],insurance:["shield","due","Insurance due"],service:["wrench","due","Service due"],belt:["settings","due","Timing belt due"],tyres:["tyre","due","Tyres due"],
    dash:["dashcam","jour","Dashcam journey"],bt:["btc","jour","Bluetooth journey"],jour:["loc","jour","Journey"],run:["flag","jour","Performance run"],work:["wrench","done","Work done"],mech:["handyman","done","Mechanic upload"],note:["note","done","Note"],route:["map","jour","Saved route"]};
  var ORDER=["over","mot","tax","insurance","service","belt","tyres","dash","bt","jour","run","work","mech","note","route"];
  function dayKinds(){ var out={}, add=function(d,k){ (out[d]=out[d]||{})[k]=((out[d]||{})[k]||0)+1; };
    var today=(function(t){ return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0"); })(new Date());
    try{ var rm=remByDay(); Object.keys(rm).forEach(function(d){ rm[d].forEach(function(e){ add(d,d<today?"over":(KIND[e.type]?e.type:"service")); }); }); }catch(e){}
    try{ var wm=diyByDay(); Object.keys(wm).forEach(function(d){ wm[d].forEach(function(){ add(d,"work"); }); }); }catch(e){}
    try{ var jm=byDay(); Object.keys(jm).forEach(function(d){ jm[d].forEach(function(t){ add(d,t.type==="run"?"run":t.auto?"bt":(t.hasClip||t.trackOnly===false)?"dash":"jour"); }); }); }catch(e){}
    try{ tripStore().forEach(function(t){ add(key(new Date(t.when||0)),"route"); }); }catch(e){}
    var M=window.CalMedia; if(M&&M.byDay) Object.keys(M.byDay).forEach(function(d){ M.byDay[d].forEach(function(e){ if(e.k==="run"){ if(!(out[d]&&out[d].run)) add(d,"run"); } else add(d,e.k==="mech"?"mech":"note"); }); });
    return out; }
  function icons(){ var all=dayKinds();
    grid.querySelectorAll(".day[data-k]").forEach(function(b){ var row=b.querySelector(".dots"); if(!row) return; var ks=all[b.getAttribute("data-k")];
      var kinds=ks?ORDER.filter(function(k){ return ks[k]; }):[]; if(!kinds.length){ row.innerHTML=""; row.classList.remove("evIcons"); return; }
      var show=kinds.length>3?kinds.slice(0,2):kinds, more=kinds.length-show.length;
      row.classList.add("evIcons");
      row.innerHTML=show.map(function(k){ var K=KIND[k]; return "<i class='evi "+K[1]+"' data-kind='"+k+"' title='"+K[2]+"'>"+svgFor(K[0])+"</i>"; }).join("")+(more?"<i class='evi more' title='"+more+" more'>+"+more+"</i>":"");
      b.setAttribute("aria-label",b.querySelector(".n").textContent+": "+kinds.map(function(k){ return KIND[k][2]; }).join(", ")); });
    var lg=document.querySelector(".legMore .legend"); if(lg&&!lg.querySelector(".evi")){ var sum=document.querySelector(".legMore>summary"); if(sum) sum.textContent="What the icons mean";
      lg.setAttribute("aria-label","Day icons"); lg.innerHTML=["over","mot","dash","jour","bt","run","work","mech","note","route"].map(function(k){ var K=KIND[k]; return "<span><i class='evi "+K[1]+"'>"+svgFor(K[0])+"</i>"+(k==="mot"?"MOT, tax and other due dates":K[2])+"</span>"; }).join(""); } }
  var orig=window.render; window.render=function(){ orig.apply(this,arguments); try{ icons(); decorate(); }catch(e){ console.warn(e); } };
  icons(); window.addEventListener("load",icons);
  decorate();
  function go(u){ if(u) location.href=u; }
  list.addEventListener("click",function(e){ var c=e.target.closest("[data-ev]"); if(!c||!list.contains(c)) return;
    var inner=e.target.closest("button,a,input,textarea,select,label,img,video,.edit"); if(inner&&c.contains(inner)&&inner!==c) return;
    go(c.getAttribute("data-ev")); });
  list.addEventListener("keydown",function(e){ if(e.key!=="Enter"&&e.key!==" ") return; var c=e.target.closest&&e.target.closest("[data-ev]"); if(c&&c===e.target){ e.preventDefault(); go(c.getAttribute("data-ev")); } });
  grid.addEventListener("click",function(e){ var d=e.target.closest(".dots"); if(!d||!d.querySelector(".evi,.dot")) return;
    setTimeout(function(){ var ev=[].slice.call(list.querySelectorAll("[data-ev]")).map(function(c){ return c.getAttribute("data-ev"); }).filter(Boolean);
      if(ev.length===1) go(ev[0]); else if(ev.length) list.scrollIntoView({behavior:"smooth",block:"start"}); },0); });
})();
