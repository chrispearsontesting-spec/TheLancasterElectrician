/* Driv3 Record hub: auto (Bluetooth, Android app) + manual journey tracking, dashcam link, recent journeys.
   Journeys are saved to localStorage "gt.driveLog" (same store as the Drive diary). Settings: "gt.trackCfg". */
(function(){
  var C=window.Capacitor, NATIVE=!!(C&&C.isNativePlatform&&C.isNativePlatform()), T=NATIVE&&C.Plugins&&C.Plugins.Driv3Track;
  var $=function(id){return document.getElementById(id)};
  var L_PER_GAL=4.54609;
  function car(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");return s&&s.cars&&(s.cars[s.i]||s.cars[0])||{}}catch(e){return {}}}
  function cfg(){try{return JSON.parse(localStorage.getItem("gt.trackCfg")||"null")||{}}catch(e){return {}}}
  function setCfg(o){var c=Object.assign(cfg(),o);localStorage.setItem("gt.trackCfg",JSON.stringify(c));return c}
  function logs(){try{return JSON.parse(localStorage.getItem("gt.driveLog")||"[]")}catch(e){return []}}
  function cost(miles,mpg,ppl){return miles/Math.max(+mpg||1,1)*L_PER_GAL*((+ppl||0)/100)}
  function money(x){return "£"+(+x||0).toFixed(2)}
  function esc(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function dur(ms){var m=Math.max(0,Math.round(ms/60000));return m>=60?Math.floor(m/60)+"h "+(m%60)+"m":m+" min"}

  // --- mpg + price ---
  var c0=cfg(), g=car();
  $("mpg").value=c0.mpg||g.mpg||38;
  $("ppl").value=c0.ppl||"";
  function costLine(){ var mpg=+$("mpg").value||38, ppl=+$("ppl").value||0;
    $("costLine").textContent=ppl?("About "+money(cost(1,mpg,ppl))+" per mile at "+mpg+" mpg and "+ppl.toFixed(1)+"p/litre."):"Enter your fuel price to see costs."; }
  function pushNative(){ if(T) T.configure({mpg:+$("mpg").value||38, ppl:+$("ppl").value||140}).catch(function(){}); }
  ["mpg","ppl"].forEach(function(id){ $(id).addEventListener("change",function(){ var o={}; o[id]=+this.value||null; if(id==="ppl") o.pplSet=true; setCfg(o); costLine(); pushNative(); }); });
  if(!c0.pplSet){
    fetch("prices.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.json()}).then(function(pr){
      var fuel=String(g.fuel||"diesel").toLowerCase(), p=fuel.indexOf("petrol")>=0?+pr.petrol_ppl:+pr.diesel_ppl;
      if(p&&!cfg().pplSet){ $("ppl").value=p.toFixed(1); setCfg({ppl:p}); costLine(); pushNative(); }
    }).catch(function(){ if(!$("ppl").value){ $("ppl").value="140.0"; costLine(); } });
  }
  costLine();

  // --- recent journeys ---
  function renderList(){
    var list=logs().slice().sort(function(a,b){return (b.when||0)-(a.when||0)}).slice(0,12);
    $("jList").innerHTML=list.length?list.map(function(t){
      var d=new Date(t.when||0), when=d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})+" "+d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
      var how=t.auto?"🔵 Bluetooth":(t.hasClip||(!t.trackOnly&&t.trackOnly!==undefined)?"🎥 Dashcam":"📍 Manual");
      var route=(t.from||t.to)?esc((t.from||"Start")+" → "+(t.to||"Finish")):"";
      return "<div class='j'><div><div class='w'>"+esc(when)+"</div><div class='s'>"+how+" · "+(+t.miles||0).toFixed(1)+" mi · "+dur((t.end||t.when)-(t.when||0))+(route?" · "+route:"")+"</div></div><div class='c'>"+money(t.cost)+"</div></div>";
    }).join(""):"<p class='muted'>No journeys yet.</p>";
    var all=logs(), m=all.reduce(function(s,t){return s+(+t.miles||0)},0), c=all.reduce(function(s,t){return s+(+t.cost||0)},0);
    $("jTotal").textContent=all.length?(all.length+" journey"+(all.length>1?"s":"")+" · "+m.toFixed(1)+" mi · "+money(c)+" in total"):"";
  }
  function saveJourney(t){ var l=logs().filter(function(x){return x.id!==t.id}); l.unshift(t); localStorage.setItem("gt.driveLog",JSON.stringify(l.slice(0,500))); renderList(); }
  renderList();

  // --- manual journey (browser GPS, or native service in the app) ---
  var on=false, watch=null, prev=null, miles=0, started=0, timer=null, wake=null;
  function hav(a,b){var R=3958.8,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180;var x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(x)))}
  function showLive(m){ $("lvMiles").textContent=(+m||0).toFixed(2); $("lvCost").textContent=money(cost(m,$("mpg").value,$("ppl").value));
    var s=Math.round((Date.now()-started)/1000); $("lvTime").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
  function uiOn(v){ on=v; $("jBtn").textContent=v?"Stop journey":"Start journey"; $("jBtn").className="btn "+(v?"stop":"go"); $("live").classList.toggle("hide",!v); }
  async function startWeb(){
    if(!navigator.geolocation){ $("jErr").textContent="This browser has no GPS."; return; }
    miles=0; prev=null; started=Date.now(); uiOn(true); $("jErr").textContent="";
    if(navigator.wakeLock){ try{ wake=await navigator.wakeLock.request("screen"); }catch(e){} }
    watch=navigator.geolocation.watchPosition(function(p){
      var here={lat:p.coords.latitude,lon:p.coords.longitude};
      if(prev&&p.coords.accuracy<=45){ var d=hav(prev,here); if(d>0.002&&d<2) miles+=d; }
      prev=here; showLive(miles);
    },function(e){ if(on&&e.code===1) $("jErr").textContent="Location is blocked for this site — allow it in browser settings."; },{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
    timer=setInterval(function(){ showLive(miles); },1000);
  }
  function stopWeb(){
    if(watch!=null) navigator.geolocation.clearWatch(watch); watch=null; clearInterval(timer);
    if(wake){ try{ wake.release(); }catch(e){} wake=null; }
    var mpg=+$("mpg").value||38, ppl=+$("ppl").value||140;
    saveJourney({id:"m"+started,when:started,end:Date.now(),miles:+miles.toFixed(2),cost:+cost(miles,mpg,ppl).toFixed(2),mpg:mpg,ppl:ppl,from:"",to:"",trackOnly:true,source:"manual"});
    uiOn(false);
  }
  async function ensureLoc(){ var s=await T.status(); if(!s.location) s=await T.ask({what:"location"}); if(!s.notifications) await T.ask({what:"notifications"}); return s.location; }
  $("jBtn").onclick=async function(){
    if(T){
      try{
        if(on){ await T.stopJourney(); clearInterval(timer); uiOn(false); setTimeout(pull,1200); return; }
        if(!(await ensureLoc())){ $("jErr").textContent="Location permission is needed to measure the journey."; return; }
        pushNative(); await T.startJourney(); started=Date.now(); uiOn(true); timer=setInterval(nativeLive,2000);
      }catch(e){ $("jErr").textContent=String(e&&e.message||e); }
      return;
    }
    on?stopWeb():startWeb();
  };

  // --- automatic (Android app only) ---
  if(!T){
    $("webNote").classList.remove("hide");
    $("autoOn").checked=false;
    $("autoOn").onchange=function(){ this.checked=false; $("webNote").scrollIntoView({block:"nearest"}); $("webNote").style.outline="2px solid #f59e0b"; setTimeout(function(){ $("webNote").style.outline=""; },1500); };
    $("manNote").textContent="Start and stop a journey by hand. Keep this page open while you drive (GPS stops if the browser is closed).";
    return;
  }
  $("nativeBox").classList.remove("hide");
  $("manNote").textContent="Start and stop a journey by hand. It keeps recording with the screen off.";
  function permLine(s){
    var rows=[["location","Location",s.location],["background","Location “Allow all the time”",s.background],["bluetooth","Nearby devices (Bluetooth)",s.bluetooth],["notifications","Notifications",s.notifications],["battery","Battery: unrestricted",s.batteryOk]];
    $("perms").innerHTML=rows.map(function(r){ return "<div>"+(r[2]?"<span class='ok'>✓</span> ":"<span class='warn'>•</span> ")+r[1]+(r[2]?"":"<button type='button' data-ask='"+r[0]+"'>Allow</button>")+"</div>"; }).join("");
  }
  $("perms").onclick=async function(e){ var b=e.target.closest("[data-ask]"); if(!b) return;
    var w=b.getAttribute("data-ask"); if(w==="background"){ var s=await T.status(); if(!s.location){ await T.ask({what:"location"}); } alert("On the next screen choose “Allow all the time” so Driv3 can record when your car connects."); }
    await T.ask({what:w}).catch(function(){}); setTimeout(refresh,600); };
  async function loadDevices(sel){
    try{ var r=await T.devices(); var d=r.devices||[];
      $("dev").innerHTML="<option value=''>"+(d.length?"Choose your car…":"No paired devices — pair your car in Bluetooth settings")+"</option>"+d.map(function(x){ return "<option value='"+esc(x.mac)+"'"+(x.mac===sel?" selected":"")+">"+esc(x.name)+"</option>"; }).join("");
    }catch(e){ $("dev").innerHTML="<option value=''>Allow Nearby devices to list your car</option>"; }
  }
  async function refresh(){
    var s=await T.status(); $("autoOn").checked=!!s.on; permLine(s); await loadDevices(s.mac);
    if(s.running&&!on){ started=s.liveStart||Date.now(); uiOn(true); clearInterval(timer); timer=setInterval(nativeLive,2000); nativeLive(); }
    if(!s.running&&on){ clearInterval(timer); uiOn(false); }
  }
  async function nativeLive(){ try{ var s=await T.status(); if(!s.running){ clearInterval(timer); uiOn(false); pull(); return; } showLive(s.liveMiles); }catch(e){} }
  async function pull(){ if(window.driv3PullJourneys) await window.driv3PullJourneys(); renderList(); }
  $("dev").onchange=function(){ var o=this.options[this.selectedIndex]; T.configure({mac:this.value,name:this.value?o.textContent:""}).then(refresh); setCfg({mac:this.value,name:this.value?o.textContent:""}); };
  $("autoOn").onchange=async function(){
    var want=this.checked;
    if(want){
      var s=await T.status();
      if(!s.location) s=await T.ask({what:"location"});
      if(!s.bluetooth) s=await T.ask({what:"bluetooth"});
      if(!s.notifications) s=await T.ask({what:"notifications"});
      if(!s.location||!s.bluetooth){ this.checked=false; alert("Driv3 needs Location and Nearby devices permission to track journeys automatically."); permLine(s); return; }
      if(!$("dev").value){ await loadDevices(""); alert("Now choose your car’s Bluetooth from the list."); }
      if(!s.background) alert("Tip: tap Allow next to “Allow all the time” and “Battery: unrestricted” so journeys start even when Driv3 is closed.");
    }
    await T.configure({on:want,mpg:+$("mpg").value||38,ppl:+$("ppl").value||140}); setCfg({on:want}); refresh();
  };
  pushNative(); refresh(); pull();
  document.addEventListener("visibilitychange",function(){ if(!document.hidden){ refresh(); pull(); } });
})();
