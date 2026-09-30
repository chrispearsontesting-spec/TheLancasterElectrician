var trackOnly=/track=1/.test(location.search);
if(trackOnly) document.body.classList.add("track");
function garage(){
  try{
    var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
    return s&&s.cars&&(s.cars[s.i]||s.cars[0])||{};
  }catch(e){return {}}
}
function hav(a,b){
  var R=3958.8,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180;
  var x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
}
function idb(){
  return new Promise(function(res,rej){
    var r=indexedDB.open("dipstick",2);
    r.onupgradeneeded=function(){
      var d=r.result;
      if(!d.objectStoreNames.contains("files")) d.createObjectStore("files");
      if(!d.objectStoreNames.contains("clips")) d.createObjectStore("clips");
    };
    r.onsuccess=function(){res(r.result)};
    r.onerror=function(){rej(r.error)};
  });
}
async function putClip(id,blob){
  var d=await idb();
  return new Promise(function(res,rej){
    var t=d.transaction("clips","readwrite").objectStore("clips").put({blob:blob,when:Date.now()},id);
    t.onsuccess=function(){res()}; t.onerror=function(){rej(t.error)};
  });
}
async function purgeClips(){
  try{
    var d=await idb(), cut=Date.now()-24*60*60*1000;
    var store=d.transaction("clips","readwrite").objectStore("clips");
    store.openCursor().onsuccess=function(e){
      var c=e.target.result; if(!c)return;
      var v=c.value||{};
      if((v.when||0)<cut) c.delete();
      c.continue();
    };
    var list=[];
    try{list=JSON.parse(localStorage.getItem("gt.driveLog")||"[]")}catch(err){}
    localStorage.setItem("gt.driveLog",JSON.stringify(list.filter(function(t){return (t.end||t.when||0)>cut})));
  }catch(e){}
}
async function placeName(pos){
  if(!pos) return "";
  try{
    var u="https://photon.komoot.io/reverse?lat="+pos.lat+"&lon="+pos.lon+"&lang=en";
    var j=await fetch(u).then(function(r){return r.json()});
    var p=j.features&&j.features[0]&&j.features[0].properties||{};
    return [p.name,p.street,p.city||p.town||p.village].filter(Boolean).slice(0,2).join(", ")||(pos.lat.toFixed(3)+", "+pos.lon.toFixed(3));
  }catch(e){return pos.lat.toFixed(3)+", "+pos.lon.toFixed(3)}
}
var watch=null,last=null,miles=0,wake=null,streams=[],rec=null,chunks=[],started=0,startPos=null;
var mpg=38,ppl=197.1,rearRot=180,frontRot=0,on=false;
document.getElementById("rear").style.transform="rotate("+rearRot+"deg)";
function tick(spd){
  var litres=miles/Math.max(mpg,1)*4.54609;
  document.getElementById("miles").textContent=miles.toFixed(2);
  document.getElementById("cost").textContent="\u00a3"+(litres*(ppl/100)).toFixed(2);
  if(spd!=null) document.getElementById("speed").textContent=Math.round(spd);
}
function costNow(){return miles/Math.max(mpg,1)*4.54609*(ppl/100)}
function nightNow(){
  var h=new Date().getHours();
  return h>=19 || h<7;
}
async function dashSettings(track){
  if(!track) return;
  var cap=track.getCapabilities?track.getCapabilities():{};
  var adv={};
  if(cap.zoom){ adv.zoom=cap.zoom.min!=null?cap.zoom.min:0; }
  if(cap.focusMode&&cap.focusMode.indexOf("continuous")>=0) adv.focusMode="continuous";
  if(cap.exposureMode&&cap.exposureMode.indexOf("continuous")>=0) adv.exposureMode="continuous";
  if(cap.whiteBalanceMode&&cap.whiteBalanceMode.indexOf("continuous")>=0) adv.whiteBalanceMode="continuous";
  if(cap.exposureCompensation){
    var mid=(cap.exposureCompensation.min+cap.exposureCompensation.max)/2;
    adv.exposureCompensation=nightNow()?Math.min(cap.exposureCompensation.max, mid+0.7):mid;
  }
  var want={width:{ideal:1920,min:1280},height:{ideal:1080,min:720},aspectRatio:{ideal:16/9},frameRate:{ideal:30,max:30}};
  if(Object.keys(adv).length) want.advanced=[adv];
  try{ await track.applyConstraints(want); }catch(e){
    try{ await track.applyConstraints({advanced:Object.keys(adv).length?[adv]:undefined}); }catch(e2){}
  }
}
function camScore(d, wantUser){
  var l=String(d.label||"").toLowerCase();
  var n=0;
  if(/ultra|uw\b|wide|0\.6|0\.5/.test(l)) n+=80;
  if(/back|rear|environment/.test(l)) n+=25;
  if(/tele|zoom|2x|3x/.test(l)) n-=50;
  if(wantUser){
    if(/front|face|user|selfie/.test(l)) n+=60;
    if(/back|rear/.test(l)) n-=40;
  }else if(/front|face|user|selfie/.test(l)) n-=60;
  return n;
}
async function pickDevice(wantUser){
  try{
    var list=await navigator.mediaDevices.enumerateDevices();
    var cams=list.filter(function(d){return d.kind==="videoinput"});
    if(!cams.length) return "";
    cams.sort(function(a,b){return camScore(b,wantUser)-camScore(a,wantUser)});
    return cams[0]&&cams[0].deviceId||"";
  }catch(e){return ""}
}
async function oneCam(mode,el){
  var wantUser=mode==="user";
  var base={facingMode:{ideal:wantUser?"user":"environment"},width:{ideal:1920},height:{ideal:1080},aspectRatio:{ideal:16/9},frameRate:{ideal:30}};
  async function open(video){
    var s=await navigator.mediaDevices.getUserMedia({video:video,audio:false});
    el.srcObject=s;streams.push(s);
    await dashSettings(s.getVideoTracks()[0]);
    return s;
  }
  try{
    var first=await open(base);
    var id=await pickDevice(wantUser);
    if(id){
      var cur=first.getVideoTracks()[0];
      var set=cur.getSettings?cur.getSettings():{};
      if(set.deviceId!==id){
        try{
          first.getTracks().forEach(function(t){t.stop()});
          streams=streams.filter(function(x){return x!==first});
          return await open({deviceId:{exact:id},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}});
        }catch(e){ return first; }
      }
    }
    return first;
  }catch(e){
    try{ return await open({facingMode:{ideal:mode}}); }
    catch(e2){ return null; }
  }
}
function mime(){
  var opts=["video/webm;codecs=vp8","video/webm","video/mp4"];
  for(var i=0;i<opts.length;i++) if(window.MediaRecorder&&MediaRecorder.isTypeSupported(opts[i])) return opts[i];
  return "";
}
function startRec(stream){
  chunks=[];
  var type=mime();
  var opts=type?{mimeType:type,videoBitsPerSecond:8000000}:{videoBitsPerSecond:8000000};
  try{rec=new MediaRecorder(stream,opts)}
  catch(e){
    try{rec=type?new MediaRecorder(stream,{mimeType:type}):new MediaRecorder(stream)}
    catch(e2){document.getElementById("err").textContent="This browser cannot record video.";rec=null;return}
  }
  rec.ondataavailable=function(e){if(e.data&&e.data.size) chunks.push(e.data)};
  rec.start(1000);
}
function startGps(){
  if(!navigator.geolocation){document.getElementById("err").textContent="No GPS.";return}
  var prev=null;
  watch=navigator.geolocation.watchPosition(function(p){
    var here={lat:p.coords.latitude,lon:p.coords.longitude};
    if(!startPos) startPos=here;
    var mph=p.coords.speed!=null&&p.coords.speed>=0?p.coords.speed*2.23694:null;
    if(prev && p.coords.accuracy<=45){
      var d=hav(prev,here);
      if(d>0.002 && d<2) miles+=d;
    }
    prev=here;last=here;tick(mph);
  },function(e){document.getElementById("err").textContent=e.message||"Location blocked";},{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
}
async function start(){
  document.getElementById("err").textContent="";
  await purgeClips();
  miles=0;last=null;startPos=null;chunks=[];started=Date.now();
  var g=garage();mpg=+g.mpg||38;
  try{
    var pr=await fetch("prices.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.json()});
    var fuel=String(g.fuel||"diesel").toLowerCase();
    ppl=fuel.indexOf("petrol")>=0?+pr.petrol_ppl:+pr.diesel_ppl;
  }catch(e){}
  if(navigator.wakeLock){try{wake=await navigator.wakeLock.request("screen")}catch(e){}}
  if(!trackOnly){
    var rear=await oneCam("environment",document.getElementById("rear"));
    var front=await oneCam("user",document.getElementById("front"));
    if(!rear) document.getElementById("err").textContent="Road camera not available.";
    else if(!front) document.getElementById("err").textContent="Cabin camera not available together. Recording the road camera.";
    if(rear) startRec(rear);
  }
  startGps();
  on=true;
  document.getElementById("go").textContent="Stop";
  document.getElementById("rec").textContent=trackOnly?"TRACKING":"REC";
}
async function saveTrip(blob){
  var id="d"+started;
  var fromName=await placeName(startPos);
  var toName=await placeName(last);
  var trip={id:id,when:started,end:Date.now(),miles:+miles.toFixed(2),cost:+costNow().toFixed(2),mpg:mpg,ppl:ppl,from:fromName,to:toName,hasClip:!!(blob&&blob.size),trackOnly:trackOnly};
  var list=[];
  try{list=JSON.parse(localStorage.getItem("gt.driveLog")||"[]")}catch(e){}
  list.unshift(trip);
  localStorage.setItem("gt.driveLog",JSON.stringify(list.slice(0,200)));
  if(blob&&blob.size){
    var name="dipstick-"+new Date(started).toISOString().slice(0,16).replace(/[:T]/g,"-")+".webm";
    var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
    putClip(id,blob).catch(function(){});
  }
}
function stop(){
  on=false;
  if(watch!=null) navigator.geolocation.clearWatch(watch);
  watch=null;
  function finish(blob){
    saveTrip(blob).then(function(){
      streams.forEach(function(s){s.getTracks().forEach(function(t){t.stop()})});
      streams=[];
      if(wake){try{wake.release()}catch(e){}}
      document.getElementById("go").textContent="Start";
      document.getElementById("rec").textContent="Saved";
    });
  }
  if(rec&&rec.state!=="inactive"){
    rec.onstop=function(){ finish(new Blob(chunks,{type:rec.mimeType||"video/webm"})); rec=null; };
    try{rec.stop()}catch(e){finish(null)}
  }else finish(null);
}
document.getElementById("go").onclick=function(){on?stop():start()};
document.getElementById("flip").onclick=function(){
  rearRot=(rearRot+180)%360;
  document.getElementById("rear").style.transform="rotate("+rearRot+"deg)";
};
document.getElementById("front").onclick=function(){
  frontRot=(frontRot+180)%360;
  this.style.transform="rotate("+frontRot+"deg)";
};
if(trackOnly) document.getElementById("rec").textContent="Track ready";
purgeClips();
