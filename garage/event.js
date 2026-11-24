/* Trac3 Drive diary entry page. event.html?t=<type>&id=<id>&d=<day>. Read only: nothing is changed or deleted here;
   edits stay where they were (Drive diary sheet, Performance, Route costs). Types are listed in ev-url.js. */
(function(){
  var P=new URLSearchParams(location.search), T=P.get("t")||"", ID=P.get("id")||"", DAY=P.get("d")||"", urls=[];
  var $=function(id){ return document.getElementById(id); };
  function esc(x){ return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]}); }
  function rd(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)||"null"); return v==null?d:v; }catch(e){ return d; } }
  function gbp(n){ return "£"+(+n||0).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function num(v){ var n=parseFloat(String(v==null?"":v).replace(/[^0-9.\-]/g,"")); return isFinite(n)?n:0; }
  function key(t){ var d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function noon(day){ var p=String(day).split("-"); return new Date(+p[0],+p[1]-1,+p[2],12).getTime(); }
  function niceDay(day){ return new Date(noon(day)).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
  function hm(t){ return new Date(t).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); }
  function when(t){ return niceDay(key(t))+" · "+hm(t); }
  function dur(ms){ var m=Math.round(ms/60000); if(!(m>0)) return ""; return m>=60?Math.floor(m/60)+" h "+(m%60)+" min":m+" min"; }
  function url(b){ var u=URL.createObjectURL(b); urls.push(u); return u; }
  function car(){ var g=rd("gt.garage",null); return g&&g.cars&&(g.cars[g.i]||g.cars[0])||null; }
  function plateTxt(p){ p=String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); return p.length>=7?p.slice(0,4)+" "+p.slice(4):p; }

  /* ---- building blocks ---- */
  function hero(k,title,sub,tags,over){ return "<section class='card hero' id='evHero'><span class='ring"+(over?" over":"")+"' data-k='"+k+"' aria-hidden='true'></span><span class='t'><b>"+esc(title)+"</b><small>"+esc(sub)+"</small>"+(tags||[]).map(function(t){ return "<span class='tag"+(t[1]?" "+t[1]:"")+"'>"+esc(t[0])+"</span> "; }).join("")+"</span></section>"; }
  function stats(rows,id){ rows=rows.filter(function(r){ return r&&r[1]!=null&&r[1]!==""&&r[1]!=="-"; }); if(!rows.length) return "";
    return "<section class='card' id='"+(id||"evStats")+"'><div class='stats'>"+rows.map(function(r){ return "<div class='st"+(r[2]?" wide":"")+"'><span>"+esc(r[0])+"</span><b>"+esc(r[1])+"</b></div>"; }).join("")+"</div></section>"; }
  function lines(title,rows,total,id){ if(!rows.length&&total==null) return "";
    return "<section class='card lines' id='"+(id||"evCost")+"'><h2>"+esc(title)+"</h2>"+rows.map(function(r){ return "<div class='ln"+(r[2]?" "+r[2]:"")+"'><span>"+esc(r[0])+"</span><b>"+esc(r[1])+"</b></div>"; }).join("")+
      (total!=null?"<div class='ln tot'><span>Total</span><b>"+esc(total)+"</b></div>":"")+"</section>"; }
  function card(title,inner,id){ return "<section class='card'"+(id?" id='"+id+"'":"")+">"+(title?"<h2>"+esc(title)+"</h2>":"")+inner+"</section>"; }
  function acts(list){ list=list.filter(Boolean); if(!list.length) return ""; return "<section class='acts' id='evActs'>"+list.map(function(a,i){ return "<a class='btn"+(i===0?" pri":"")+"' href='"+esc(a[1])+"'"+(a[2]?" data-iconed='1'":"")+(/^https?:/.test(a[1])?" target='_blank' rel='noopener'":"")+">"+(a[2]?"<span class='ico' data-k='"+a[2]+"'></span>":"")+esc(a[0])+"</a>"; }).join("")+"</section>"; }
  // Google Maps link: directions when both ends are known (opens the Maps app on Android), otherwise just the one place.
  function mapUrl(from,to){ var G="https://www.google.com/maps/"; if(from&&to) return G+"dir/?api=1&origin="+encodeURIComponent(from)+"&destination="+encodeURIComponent(to)+"&travelmode=driving"; return G+"search/?api=1&query="+encodeURIComponent(from||to); }
  function placeLink(id,lab,name,u){ return "<a class='plink' id='"+id+"' href='"+esc(u)+"' target='_blank' rel='noopener' aria-label='"+esc(lab+" "+name+": open the route in Maps")+"'><span>"+lab+"</span><b>"+esc(name)+"</b><i class='mapIco' data-k='map' aria-hidden='true'></i></a>"; }
  function places(from,to,roads){ if(!from&&!to) return ""; var u=mapUrl(from,to);
    return card("Route","<div class='place'><div class='rail'><i></i><u></u><i class='e'></i></div><div class='pl'>"+(from?placeLink("evFrom","From",from,u):"<div><span>From</span><b>Start</b></div>")+(to?placeLink("evTo","To",to,u):"<div><span>To</span><b>Finish</b></div>")+"</div></div>"+(roads&&roads.length?"<p class='roads'>"+esc(roads.join(" · "))+"</p>":""),"evRoute"); }
  // media: {video:{src,cap}, pics:[{src,cap}]}; nothing shown when there is nothing to show.
  var PICS=[];
  function media(m){ var h="", n=(m.pics||[]).length; if(!m.video&&!n) return "";
    if(m.video) h+="<video id='evVideo' src='"+m.video.src+"' controls playsinline preload='metadata'></video>"+(m.video.cap?"<p class='cap'>"+esc(m.video.cap)+"</p>":"");
    if(n){ var base=PICS.length; PICS=PICS.concat(m.pics); h+="<div class='pics"+(n===1?" one":"")+"' id='evPics'>"+m.pics.map(function(p,i){ return "<button type='button' data-pv='"+(base+i)+"' aria-label='Open photo "+(i+1)+"'><img alt='' src='"+p.src+"'/></button>"; }).join("")+"</div>"; }
    return card(m.title||"",h,"evMedia").replace("class='card'","class='card media'"); }
  function files(list){ if(!list.length) return ""; return card("Documents",list.map(function(f){ return "<a href='"+f.src+"' target='_blank' rel='noopener'"+(f.dl?" download='"+esc(f.dl)+"'":"")+"><span class='ico' data-k='doc'></span>"+esc(f.title)+(f.note?"<small>"+esc(f.note)+"</small>":"")+"</a>"; }).join(""),"evFiles").replace("class='card'","class='card files'"); }

  /* ---- data ---- */
  function idb(name,ver,up){ return new Promise(function(ok,no){ var r=indexedDB.open(name,ver); if(up) r.onupgradeneeded=function(){ up(r.result); }; r.onsuccess=function(){ ok(r.result); }; r.onerror=function(){ no(r.error); }; }); }
  async function clip(id){ try{ var d=await idb("dipstick",2,function(db){ if(!db.objectStoreNames.contains("files")) db.createObjectStore("files"); if(!db.objectStoreNames.contains("clips")) db.createObjectStore("clips"); });
      if(!d.objectStoreNames.contains("clips")) return null;
      return await new Promise(function(ok){ var q=d.transaction("clips").objectStore("clips").get(id); q.onsuccess=function(){ ok(q.result&&q.result.blob||null); }; q.onerror=function(){ ok(null); }; }); }catch(e){ return null; } }
  function driveLog(){ var l=rd("gt.driveLog",[]); return Array.isArray(l)?l:[]; }

  /* ---- one renderer per type ---- */
  var R={};
  R.j=async function(){ var t=driveLog().filter(function(x){ return x&&String(x.id)===ID; })[0]; if(!t) return null;
    if(t.type==="run"){ T="run"; return R.run(); }
    var how=t.auto?"Bluetooth journey":(t.hasClip||t.trackOnly===false)?"Dashcam journey":"Journey";
    var title=(t.from||t.to)?(t.from||"Start")+" → "+(t.to||"Finish"):how, ms=(t.end||0)-(t.when||0), hrs=ms/36e5, miles=+t.miles||0;
    var elec=t.mikwh!=null&&t.mpg==null, eff=elec?t.mikwh:t.mpg, used=eff?(elec?miles/eff:miles/eff*4.54609):0;
    var v=await clip(t.id), h=hero("loc",title,when(t.when)+(t.end?" – "+hm(t.end):""),[[how]]);
    if(v) h+=media({title:"Dashcam clip",video:{src:url(v),cap:(window.D3DashKeep?D3DashKeep.label():"Loop · last 24 hours")+"."}});
    h+="<section class='card' id='evBig'><div class='big'><b>"+esc(gbp(t.cost))+"</b><span>for "+miles.toFixed(1)+" miles</span></div></section>";
    h+=stats([["Distance",miles.toFixed(1)+" mi"],["Time",dur(ms)],["Average speed",hrs>0.01&&miles?Math.round(miles/hrs)+" mph":""],[elec?"Economy":"MPG",eff?(elec?(+eff).toFixed(1)+" mi/kWh":(+eff).toFixed(1)):""]]);
    h+=lines("Cost",[[elec?"Energy used":"Fuel used",used?used.toFixed(elec?1:2)+(elec?" kWh":" L"):""],[elec?"Price":"Fuel price",t.ppl?(+t.ppl).toFixed(1)+(elec?"p per kWh":"p per litre"):""]].filter(function(r){return r[1]}),gbp(t.cost));
    h+=places(t.from,t.to);
    var day=key(t.when);
    h+=acts([["Edit MPG or delete in Drive diary","calendar.html?v=8&d="+day,"edit"],(t.from&&t.to)?["Check this route's cost","route.html","map"]:null]);
    return {bar:"Journey",html:h,day:day}; };
  R.run=async function(){ var r=null, log=driveLog();
    if(window.PerfG){ try{ r=await PerfG.get(ID); }catch(e){} } if(r&&!r.id) r=null; // PerfG.get hands back the request when nothing matches
    var plain=log.filter(function(x){ return x&&x.type==="run"&&String(x.id)===ID; })[0];
    if(!r&&window.PerfG){ var at=plain?+plain.when:+(/(\d{12,})/.exec(ID)||[])[1]; if(at){ try{ r=(await PerfG.list()).filter(function(x){ return Math.abs(x.when-at)<120000; })[0]||null; }catch(e){} } }
    if(!r&&!plain) return null;
    var label=(r&&r.label)||(plain&&plain.from)||"Performance run", time=(r&&r.time)||(plain&&String(plain.time||"").replace(/s$/,"")), at2=(r&&r.when)||plain.when, st=(r&&r.stats)||{}, s=(r&&r.samples)||[];
    var top=s.reduce(function(a,p){ return Math.max(a,+p.speed||0); },0);
    function reach(v){ if(!s.length||(+s[0].speed||0)>3) return ""; for(var i=0;i<s.length;i++) if((+s[i].speed||0)>=v) return (+s[i].t).toFixed(2)+"s"; return ""; }
    var h=hero("flag",label,when(at2),[["Performance"],r&&r.video?["Video","ok"]:null].filter(Boolean));
    var m={title:"",pics:[]}; if(r&&r.video) m.video={src:url(r.video),cap:label+" · "+time+"s"}; if(r&&r.chart) m.pics.push({src:url(r.chart),cap:"G chart"});
    if(m.video||m.pics.length) m.title=m.video?"Video and G chart":"G chart";
    h+="<section class='card' id='evBig'><div class='big'><b>"+esc(time?(+time).toFixed(2)+"s":"-")+"</b><span>"+esc(label)+"</span></div></section>";
    h+=media(m);
    h+=stats([["Top speed",top?top.toFixed(0)+" mph":""],["Reaction",r&&r.reactMs?r.reactMs+" ms":""],["0–30 mph",reach(30)],["0–60 mph",/60|100|quarter|half|¼|½/i.test(label)?reach(60):""],
      ["Peak G",st.maxComb!=null?(+st.maxComb).toFixed(2)+" G":""],["Max accel",st.maxAcc!=null?(+st.maxAcc).toFixed(2)+" G":""],["Max brake",st.maxBrk!=null?(+st.maxBrk).toFixed(2)+" G":""],["Max lateral",st.maxLat!=null?(+st.maxLat).toFixed(2)+" G":""]]);
    if(!r) h+="<p class='muted' id='evNoVideo'>Only the time was saved for this run.</p>";
    h+="<p class='muted'>Phone sensor estimate. Closed roads or tracks only.</p>";
    var day=key(at2); h+=acts([["Open in Performance","performance.html?v=5&run="+encodeURIComponent((r&&r.id)||ID),"flag"]]);
    return {bar:"Performance run",html:h,day:day}; };
  R.diy=async function(){ var w=window.D3Diy&&D3Diy.get(ID); if(!w) return null;
    var fl=w.files||[], ph=fl.filter(function(f){return f.kind==="photo"}), inv=fl.filter(function(f){return f.kind!=="photo"}), pics=[], docs=[];
    for(var i=0;i<ph.length;i++){ try{ var b=await D3Diy.getBlob(ph[i].id); if(b) pics.push({src:url(b),cap:w.title||"Work done"}); }catch(e){} }
    for(var j=0;j<inv.length;j++){ try{ var b2=await D3Diy.getBlob(inv[j].id); if(b2) docs.push({src:url(b2),title:inv[j].title||inv[j].name||"Invoice",note:inv[j].price?"£"+String(inv[j].price).replace(/^£/,""):""}); }catch(e){} }
    var h=hero("wrench",w.title||"Work done",niceDay(w.date),[[w.auto?"Logged from your car's dates":"DIY work"]]);
    h+=media({title:pics.length>1?"Photos":"Photo",pics:pics});
    if(w.desc) h+=card("What was done","<p class='desc'>"+esc(w.desc)+"</p>","evDesc");
    var priced=inv.filter(function(f){ return num(f.price); }), parts=0, lab=0, rows=priced.map(function(f){ var n=num(f.price), isLab=/labou?r|fitting|work/i.test((f.title||"")+" "+(f.name||"")); if(!f.skip){ if(isLab) lab+=n; else parts+=n; } var nm=f.title||f.name||"Item"; return [nm+(isLab&&!/labou?r/i.test(nm)?" (labour)":""),gbp(n),f.skip?"skip":""]; });
    if(priced.length){ if(lab&&parts) rows.push(["Parts",gbp(parts),"sub"],["Labour",gbp(lab),"sub"]); h+=lines("Cost breakdown",rows,gbp(D3Diy.cost?D3Diy.cost(w):parts+lab)); }
    h+=files(docs);
    if(!pics.length&&!w.desc&&!priced.length) h+="<p class='muted' id='evEmptyHint'>Add photos, notes or a receipt with Edit work.</p>";
    h+=acts([["Edit work","calendar.html?v=8&d="+w.date+"&openw="+encodeURIComponent(w.id),"edit"]]);
    return {bar:"Work done",html:h,day:w.date}; };
  R.mech=async function(){ var U=window.DipUploads, j=null; if(U&&U.allJobs){ try{ j=(await U.allJobs()).filter(function(x){ return x.id===ID; })[0]; }catch(e){} } if(!j) return null;
    var at=j.created||j.received||Date.now(), pics=[], docs=[], fl=j.files||[];
    for(var i=0;i<fl.length;i++){ var f=fl[i], rec=null; try{ rec=await U.getFile(j.id,f.key); }catch(e){} if(!rec||!rec.blob) continue;
      if(/^image\//.test(f.type)) pics.push({src:url(rec.blob),cap:U.fileTitle(f)}); else docs.push({src:url(rec.blob),title:U.fileTitle(f)}); }
    var who=[j.garage,j.mechanic].filter(Boolean).join(" · ");
    var h=hero("handyman",j.note||"Work from your mechanic",when(at),[["Mechanic"],j.seen?null:["New","ok"]].filter(Boolean));
    h+=media({title:pics.length>1?"Photos":"Photo",pics:pics});
    h+=stats([["Garage",j.garage||""],["Mechanic",j.mechanic||""],["Mileage",j.mileage!=null?Number(j.mileage).toLocaleString("en-GB")+" mi":""],["Files",fl.length?String(fl.length):""]]);
    if(j.note&&j.note.length>40) h+=card("Their note","<p class='desc'>"+esc(j.note)+"</p>","evDesc");
    h+=files(docs);
    h+=acts([["Mechanic QR","mechanic.html","qr"]]);
    return {bar:"Mechanic upload",html:h,day:key(at)}; };
  R.note=async function(){ var l=rd("dipstick-history",[]), it=l[+ID]; if(!it) return null;
    var t=it.ts?+it.ts:(function(m){ return m?new Date(+m[3],+m[2]-1,+m[1],12).getTime():0; })(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(it.date||"")); if(!t) return null;
    var img=/^image\//.test(it.type||""), h=hero("note",it.note||"Note",niceDay(key(t)),[["Your note"]]);
    if(img) h+=media({title:"Photo",pics:[{src:it.data,cap:it.note||""}]});
    if(it.note&&it.note.length>40) h+=card("Note","<p class='desc'>"+esc(it.note)+"</p>","evDesc");
    if(!img&&it.data) h+=files([{src:it.data,title:"Invoice (PDF)",dl:"invoice.pdf"}]);
    return {bar:"Note",html:h,day:key(t)}; };
  R.route=async function(){ var l=typeof tripStore==="function"?tripStore():rd("gt.loggedTrips",[]), t=l.filter(function(x){ return String(x.when)===ID; })[0]; if(!t) return null;
    var mins=t.mins||Math.round((+t.oneSecs||0)/60), kind=t.isYear?"Yearly commute":(t.isReturn?"Return":"One way");
    var head=t.isYear&&t.yearGBP!=null?t.yearGBP:(t.isReturn&&t.retGBP!=null?t.retGBP:(t.oneGBP!=null?t.oneGBP:(typeof scoreTrip==="function"?scoreTrip(t).gbp:0)));
    var h=hero("map",t.title||((t.from||"")+" → "+(t.to||"")),"Saved "+when(t.when),[["Saved route"],[kind]]);
    h+="<section class='card' id='evBig'><div class='big'><b>"+esc(gbp(head))+"</b><span>"+esc(kind.toLowerCase())+"</span></div></section>";
    h+=places(t.from,t.to,t.roads);
    h+=stats([["Distance",(+t.miles||0).toFixed(1)+" mi one way"],["Time",mins?mins+" min one way":""],["MPG used",t.rated?(+t.rated).toFixed(1):""],["Fuel price",t.ppl?(+t.ppl).toFixed(1)+"p":""]]);
    h+=lines("Cost",[["One way",t.oneGBP!=null?gbp(t.oneGBP):""],["Return",t.retGBP!=null?gbp(t.retGBP):""],t.isYear?["Year ("+(t.days||5)+" days × "+(t.weeks||46)+" weeks)",gbp(t.yearGBP)]:null].filter(function(r){ return r&&r[1]; }),null);
    h+=acts([["Check route costs again","route.html","map"]]);
    return {bar:"Saved route",html:h,day:key(t.when)}; };
  R.rem=async function(){ if(!window.D3Rem) return null; var g=rd("gt.garage",null), ci=+(P.get("c")||0);
    var e=D3Rem.dueItems(g).filter(function(x){ return x.type===ID&&x.carIndex===ci; })[0]; if(!e) return null;
    var d=D3Rem.daysUntil(e.due), left=d<0?(-d)+" days overdue":d===0?"Due today":d+" days left";
    var ik={mot:"check",tax:"gbp",insurance:"shield",service:"wrench",belt:"settings",tyres:"tyre"}[e.type]||"cal";
    var h=hero(ik,e.label+" due",niceDay(e.due),[[left,d<0?"warn":(d<=14?"":"ok")]],d<0);
    h+=stats([["Car",e.name],["Reg",e.plate],["Due",new Date(noon(e.due)).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})],["Status",left]]);
    if(d<0) h+="<p class='muted'>Already done? Update the date in Edit car on Home.</p>";
    var a=[];
    if(e.type==="mot") a.push(["View MOT history","mot.html?plate="+e.vrn+"#history","hist"]);
    if(e.book) a.push(["Book with my garage",e.bookLink,"cal"]);
    if(e.type==="tax") a.push(["Renew tax on GOV.UK","https://www.gov.uk/vehicle-tax","gbp"],["Check tax","tax.html?plate="+e.vrn,"search"]);
    if(e.type==="insurance") a.push(["Policy","insurance.html?v=19","shield"],["Renew","renew.html?v=13","edit"]);
    a.push(["Edit dates on Home","home.html","edit"]);
    h+=acts(a);
    return {bar:e.label,html:h,day:e.due}; };

  /* ---- paint ---- */
  function paint(){ var GI=window.T3_GRID_ICONS||{}; document.querySelectorAll("[data-k]").forEach(function(el){ if(el.firstChild) return; var k=el.getAttribute("data-k"); var v=GI[k]||(window.dipstickIcon&&window.dipstickIcon(k))||""; if(v) el.innerHTML=v; }); }
  function viewer(i){ var v=document.createElement("div"); v.className="pv"; v.setAttribute("role","dialog"); v.setAttribute("aria-label","Photos"); v.id="evViewer";
    v.innerHTML="<div class='top'><span id='pvN'>"+(i+1)+" / "+PICS.length+"</span><button type='button' class='x' aria-label='Close'>✕</button></div><div class='strip'>"+PICS.map(function(p){ return "<figure><img alt='' src='"+p.src+"'/>"+(p.cap?"<figcaption>"+esc(p.cap)+"</figcaption>":"")+"</figure>"; }).join("")+"</div>";
    document.body.appendChild(v); var s=v.querySelector(".strip"); s.scrollLeft=i*s.clientWidth;
    s.addEventListener("scroll",function(){ v.querySelector("#pvN").textContent=(Math.round(s.scrollLeft/s.clientWidth)+1)+" / "+PICS.length; },{passive:true});
    function close(){ v.remove(); document.removeEventListener("keydown",k); } function k(e){ if(e.key==="Escape") close(); }
    v.querySelector(".x").onclick=close; document.addEventListener("keydown",k); }
  document.addEventListener("click",function(e){ var b=e.target.closest("[data-pv]"); if(b) viewer(+b.getAttribute("data-pv")); });
  function back(day){ var a=$("evBack"); a.href="calendar.html?v=8"+(day?"&d="+day:""); }
  back(DAY);
  (async function(){ var out=null; try{ out=R[T]?await R[T]():null; }catch(e){ console.warn(e); out=null; }
    if(!out){ $("evTitle").textContent="Diary entry"; $("ev").innerHTML="<section class='card gone' id='evGone'><b>This entry isn’t on this phone any more</b><p class='muted'>It may have been deleted, or it belongs to another car.</p></section>"; paint(); return; }
    $("evTitle").textContent=out.bar; document.title=out.bar+" · Trac3"; $("ev").innerHTML=out.html; document.body.setAttribute("data-type",T);
    back(DAY||out.day); paint(); })();
  window.addEventListener("load",paint);
  window.addEventListener("pagehide",function(){ urls.forEach(function(u){ URL.revokeObjectURL(u); }); });
})();
