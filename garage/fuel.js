/* Cheapest fuel nearby. Mounts in #cheapFuel (Record journey). Asks the dipstick-mot /fuel proxy. */
(function(){
  "use strict";
  var root=document.getElementById("cheapFuel");
  if(!root) return;

  var state={fuel:"petrol",miles:5,electric:false,known:false};
  var last=null, cheapest=null, others=[];

  function carFuel(){
    if(window.D3Fuel&&D3Fuel.fuelOf) return D3Fuel.fuelOf();
    try{
      var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
      var c=s&&s.cars&&(s.cars[s.i]||s.cars[0])||{};
      var f=String(c.fuel||"").toLowerCase();
      if(/diesel/.test(f)) return {fuel:"diesel",known:true};
      if(/electric/.test(f)&&!/hybrid/.test(f)) return {fuel:"electric",known:true};
      if(/petrol|hybrid/.test(f)) return {fuel:"petrol",known:true};
    }catch(e){}
    return {fuel:"petrol",known:false};
  }
  function loadPref(){ try{return JSON.parse(localStorage.getItem("gt.fuelPref")||"null")||{};}catch(e){return{};} }
  function savePref(extra){
    var p=Object.assign(loadPref(),{fuel:state.fuel,miles:state.miles},extra||{});
    try{localStorage.setItem("gt.fuelPref",JSON.stringify(p));}catch(e){}
  }
  function fuelLabel(){ return state.fuel==="e5"?"premium petrol":state.fuel; }
  function mapsUrl(s){ return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(s.lat+","+s.lng)+"&travelmode=driving"; }
  function fmtDist(n){ if(n<0.1) return "Nearby"; if(Math.abs(n-1)<0.05) return "1 mile"; return Number(n).toFixed(1).replace(/\.0$/,"")+" miles"; }
  function fmtPrice(n){ return (Math.round(Number(n)*10)/10).toFixed(1); }
  function fmtWhen(s,stale){
    if(!s) return stale?"Update time unknown — may be out of date":"";
    var m=String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    var d=m?new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0)):new Date(s);
    if(isNaN(+d)) return "Updated "+s+(stale?" — may be out of date":"");
    var now=new Date(), t=(m&&m[4])?(String(m[4]).padStart(2,"0")+":"+m[5]):"";
    var base;
    if(d.toDateString()===now.toDateString()) base="Updated today"+(t?", "+t:"");
    else if(new Date(now.getTime()-864e5).toDateString()===d.toDateString()) base="Updated yesterday";
    else base="Updated "+d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:d.getFullYear()===now.getFullYear()&&!stale?undefined:"numeric"});
    if(stale) base+=" — may be out of date";
    return base;
  }
  function esc(s){ return String(s||"").replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];}); }
  function $(id){ return root.querySelector("#"+id); }
  function say(t,cls){ var el=$("cfStatus"); if(!el) return; el.textContent=t||""; el.className="cf-status"+(cls?" "+cls:""); }

  function markChips(){
    root.querySelectorAll(".cf-chip").forEach(function(b){
      var on=+b.getAttribute("data-miles")===state.miles;
      b.classList.toggle("on",on);
      b.setAttribute("aria-pressed",on?"true":"false");
    });
  }

  function renderResult(label){
    if(!cheapest){
      $("cfPrice").innerHTML="—";
      $("cfMeta").textContent="No stations with "+fuelLabel()+" within "+state.miles+" miles. Try a wider search.";
      $("cfMore").hidden=true;
      $("cfGo").disabled=true;
      return;
    }
    var where=[cheapest.address,cheapest.postcode].filter(Boolean).join(", ");
    $("cfPrice").innerHTML=fmtPrice(cheapest.price)+"<small>p</small>";
    $("cfMeta").innerHTML=esc(cheapest.brand)+" · "+esc(fmtDist(cheapest.distance))+(where?" · "+esc(where):"")+
      (cheapest.updated?("<span class='"+(cheapest.stale?" cf-stale":"")+"'> · "+esc(fmtWhen(cheapest.updated,cheapest.stale))+"</span>"):"");
    $("cfGo").disabled=false;
    if(others.length){
      $("cfMore").hidden=false;
      $("cfMoreSum").textContent=others.length+" more nearby";
      $("cfList").innerHTML=others.map(function(s){
        var w=[s.address,s.postcode].filter(Boolean).join(", ");
        return "<div class='cf-row'><div><b>"+esc(s.brand)+"</b> "+fmtPrice(s.price)+"p<span class='cf-sub'>"+esc(fmtDist(s.distance))+(w?" · "+esc(w):"")+
          (s.stale?" · "+esc(fmtWhen(s.updated,true)):"")+"</span></div>"+
          "<a class='cf-dir' href='"+mapsUrl(s)+"' target='_blank' rel='noopener'>Directions</a></div>";
      }).join("");
    }else{
      $("cfMore").hidden=true;
    }
    say((label?label+" · ":"")+others.length+" other station"+(others.length===1?"":"s")+" within "+state.miles+" miles.");
  }

  function proxy(){ return String(window.MOT_PROXY||"").replace(/\/$/,""); }

  function search(lat,lng,label){
    var url=proxy();
    if(!url){ say("Fuel lookup isn't pointed yet.","bad"); return Promise.resolve(); }
    last={lat:lat,lng:lng,label:label};
    say("Finding stations…");
    cheapest=null; others=[];
    $("cfGo").disabled=true;
    var q=url+"/fuel?lat="+encodeURIComponent(lat)+"&lng="+encodeURIComponent(lng)+
      "&miles="+encodeURIComponent(state.miles)+"&fuel="+encodeURIComponent(state.fuel);
    return fetch(q).then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
      .then(function(res){
        if(!res.ok) throw new Error((res.j&&res.j.error)||"Couldn't load prices.");
        var list=(res.j&&res.j.stations)||[];
        cheapest=list[0]||null;
        others=list.slice(1);
        renderResult(label);
      })
      .catch(function(){ say("Can't load prices just now. Check your connection and try again.","bad"); });
  }

  function locate(){
    return new Promise(function(resolve,reject){
      if(!navigator.geolocation){ reject(new Error("no geo")); return; }
      navigator.geolocation.getCurrentPosition(function(p){
        resolve({lat:p.coords.latitude,lng:p.coords.longitude,label:"near you"});
      },function(e){ reject(e); },{enableHighAccuracy:false,timeout:8000,maximumAge:60000});
    });
  }

  function lookupPostcode(pc){
    return fetch("https://api.postcodes.io/postcodes/"+encodeURIComponent(pc))
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(j.status!==200||!j.result) throw new Error("not found");
        $("cfPc").value=j.result.postcode;
        savePref({pc:j.result.postcode});
        return {lat:j.result.latitude,lng:j.result.longitude,label:j.result.postcode};
      });
  }

  function useLocation(){
    say("Getting your location…");
    return locate().then(function(p){ savePref(); return search(p.lat,p.lng,p.label); })
      .catch(function(e){
        if(e&&e.code===1) say("Location is off for Driv3. Allow it, or type a postcode.","bad");
        else say("Couldn't get your location. Try a postcode.","bad");
      });
  }

  function usePostcode(){
    var pc=($("cfPc").value||"").trim().toUpperCase();
    if(!pc){ say("Type a UK postcode first.","bad"); return Promise.resolve(); }
    say("Finding that postcode…");
    return lookupPostcode(pc).then(function(p){ return search(p.lat,p.lng,p.label); })
      .catch(function(){ say("That postcode wasn't found.","bad"); });
  }

  function ensurePlace(){
    if(last) return Promise.resolve(last);
    var pc=($("cfPc").value||"").trim();
    if(pc) return lookupPostcode(pc);
    return locate().then(function(p){ savePref(); return p; });
  }

  function takeMe(){
    function go(s){ window.open(mapsUrl(s),"_blank","noopener"); }
    if(cheapest){ go(cheapest); return; }
    say("Finding the cheapest station…");
    ensurePlace().then(function(p){ return search(p.lat,p.lng,p.label); })
      .then(function(){ if(cheapest) go(cheapest); else say("No stations with that fuel within "+state.miles+" miles. Try a wider search."); })
      .catch(function(e){
        if(e&&e.code===1) say("Location is off for Driv3. Allow it, or type a postcode.","bad");
        else say("Allow location or type a postcode first.","bad");
      });
  }

  function boot(){
    var fo=carFuel(), pref=loadPref();
    state.electric=fo.fuel==="electric";
    state.known=!!fo.known;
    state.fuel=state.electric?"petrol":(fo.fuel==="diesel"?"diesel":"petrol");
    if(pref.fuel==="e5"||pref.fuel==="diesel"||pref.fuel==="petrol") state.fuel=pref.fuel;
    if(state.electric) state.fuel="petrol";
    state.miles=+pref.miles||5;
    if(state.miles!==3&&state.miles!==5&&state.miles!==10&&state.miles!==20) state.miles=5;

    var style=document.createElement("style");
    style.textContent=
      "#cheapFuel{margin:0 0 2px}"+
      "#cheapFuel .cf-card{background:#141416;border:1px solid #2a2a2e;border-radius:18px;padding:14px}"+
      "#cheapFuel .cf-kicker{margin:0;font-size:12px;color:#8b8b8b;letter-spacing:.06em;text-transform:uppercase}"+
      "#cheapFuel .cf-price{margin:4px 0 2px;font-size:32px;font-weight:700;letter-spacing:-.03em;line-height:1}"+
      "#cheapFuel .cf-price small{font-size:14px;font-weight:650;margin-left:2px;color:#8b8b8b}"+
      "#cheapFuel .cf-meta{margin:0 0 10px;font-size:13px;color:#cfcfcf;line-height:1.4}"+
      "#cheapFuel .cf-stale{color:#f5c66a}"+
      "#cheapFuel .cf-chips{display:flex;gap:6px;margin:0 0 10px}"+
      "#cheapFuel .cf-chip{flex:1;background:#101012;border:1px solid #2a2a2e;color:#f2f2f2;border-radius:12px;padding:8px 4px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}"+
      "#cheapFuel .cf-chip.on{border-color:#9fd8ff;background:#1a2733}"+
      "#cheapFuel .cf-go{display:block;width:100%;box-sizing:border-box;border:0;border-radius:16px;padding:14px;font:inherit;font-size:16px;font-weight:650;background:#14532d;color:#fff;cursor:pointer}"+
      "#cheapFuel .cf-go:disabled{opacity:.55}"+
      "#cheapFuel .cf-find{margin-top:10px}"+
      "#cheapFuel .cf-loc{background:none;border:0;color:#8ab4ff;font:inherit;font-size:14px;font-weight:600;padding:0;cursor:pointer}"+
      "#cheapFuel .cf-pcrow{display:flex;gap:8px;margin-top:8px}"+
      "#cheapFuel .cf-pcrow input{flex:1;min-width:0;background:#161618;border:1px solid #2a2a2e;color:#f2f2f2;border-radius:12px;padding:10px;font-size:16px}"+
      "#cheapFuel .cf-pcrow button{background:#1c1c1e;border:1px solid #2a2a2e;color:#f2f2f2;border-radius:12px;padding:10px 14px;font:inherit;font-weight:650;cursor:pointer}"+
      "#cheapFuel .cf-status{min-height:16px;margin:8px 0 0;font-size:12px;color:#8b8b8b;line-height:1.4}"+
      "#cheapFuel .cf-status.bad{color:#ff6b6b}"+
      "#cheapFuel .cf-more{margin-top:8px}"+
      "#cheapFuel .cf-more summary{cursor:pointer;color:#8ab4ff;font-size:14px;font-weight:600}"+
      "#cheapFuel .cf-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid #222226}"+
      "#cheapFuel .cf-row:first-child{border-top:0;margin-top:8px}"+
      "#cheapFuel .cf-row b{display:block;font-size:14px}"+
      "#cheapFuel .cf-sub{display:block;color:#8b8b8b;font-size:12px;margin-top:2px}"+
      "#cheapFuel .cf-dir{color:#8ab4ff;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;margin-top:2px}";
    document.head.appendChild(style);

    var hint=state.electric?"This car is electric, so nearby pump prices aren't listed.":
      (state.known?"For this car's "+fuelLabel()+".":"Using "+fuelLabel()+" — set the fuel type in Edit car if that's wrong.");

    root.innerHTML=
      "<section class='cf-card'>"+
        "<p class='cf-kicker'>Cheapest <span id='cfFuelLab'>"+esc(fuelLabel())+"</span> nearby</p>"+
        "<p class='cf-price' id='cfPrice'>—</p>"+
        "<p class='cf-meta' id='cfMeta'>"+esc(hint)+"</p>"+
        (state.electric?"":
        "<div class='cf-chips' id='cfRadii'>"+
          [3,5,10,20].map(function(n){ return "<button type='button' class='cf-chip' data-miles='"+n+"' aria-pressed='false'>"+n+" miles</button>"; }).join("")+
        "</div>"+
        "<button class='cf-go' type='button' id='cfGo'>Take me to the cheapest</button>"+
        "<div class='cf-find'>"+
          "<button class='cf-loc' type='button' id='cfLoc'>Use my location</button>"+
          "<div class='cf-pcrow'><input id='cfPc' type='text' autocomplete='postal-code' autocapitalize='characters' spellcheck='false' placeholder='Or postcode, e.g. LA1 1AA'/><button type='button' id='cfPcBtn'>Find</button></div>"+
        "</div>"+
        "<p class='cf-status' id='cfStatus' role='status'></p>"+
        "<details class='cf-more' id='cfMore' hidden><summary id='cfMoreSum'>More nearby</summary><div id='cfList'></div></details>")+
      "</section>";

    if(state.electric) return;
    if(pref.pc) $("cfPc").value=pref.pc;
    markChips();
    $("cfGo").disabled=true;
    root.querySelectorAll(".cf-chip").forEach(function(b){
      b.addEventListener("click",function(){
        state.miles=+b.getAttribute("data-miles"); savePref(); markChips();
        if(last) search(last.lat,last.lng,last.label);
      });
    });
    $("cfGo").addEventListener("click",takeMe);
    $("cfLoc").addEventListener("click",useLocation);
    $("cfPcBtn").addEventListener("click",usePostcode);
    $("cfPc").addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); usePostcode(); } });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
