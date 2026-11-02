/* Driv3 Performance: G-force tracking (moved from g-meter.html), the run G chart, and saved runs in IndexedDB (db "driv3-runs"). */
(function(){
  var G={};
  // Live readings. Same maths as the old G-meter: device x = lateral, y = longitudinal, gravity removed by zeroing at the start.
  var offX=0, offY=0, lat=0, lon=0, raw=[], peak={acc:0,brk:0,lat:0,comb:0};
  G.read=function(e){
    var a=e.accelerationIncludingGravity||e.acceleration; if(!a||a.x==null) return null;
    var rx=(a.x||0)/9.81, ry=(a.y||0)/9.81;
    raw.push([rx,ry]); if(raw.length>40) raw.shift();
    var k=0.28; lat=lat*(1-k)+(rx-offX)*k; lon=lon*(1-k)+(ry-offY)*k;
    var c=Math.sqrt(lat*lat+lon*lon);
    peak.acc=Math.max(peak.acc,lon); peak.brk=Math.max(peak.brk,-lon); peak.lat=Math.max(peak.lat,Math.abs(lat)); peak.comb=Math.max(peak.comb,c);
    return {lat:lat,lon:lon,comb:c};
  };
  G.zero=function(){ if(raw.length){ var sx=0,sy=0; raw.forEach(function(r){sx+=r[0];sy+=r[1]}); offX=sx/raw.length; offY=sy/raw.length; } lat=lon=0; G.resetPeaks(); };
  G.resetPeaks=function(){ peak={acc:0,brk:0,lat:0,comb:0}; };
  G.peaks=function(){ return peak; };
  G.ask=async function(){ if(typeof DeviceMotionEvent!=="undefined"&&typeof DeviceMotionEvent.requestPermission==="function"){ try{ await DeviceMotionEvent.requestPermission(); }catch(e){} } };

  G.stats=function(s){
    var r={maxAcc:0,maxBrk:0,maxLat:0,maxComb:0,avg:0,tAcc:0,tBrk:0,tLat:0,n:s.length};
    if(!s.length) return r; var sum=0;
    s.forEach(function(p){ var c=Math.sqrt(p.lat*p.lat+p.lon*p.lon); sum+=c;
      if(p.lon>r.maxAcc){r.maxAcc=p.lon;r.tAcc=p.t} if(-p.lon>r.maxBrk){r.maxBrk=-p.lon;r.tBrk=p.t} if(Math.abs(p.lat)>r.maxLat){r.maxLat=Math.abs(p.lat);r.tLat=p.t} if(c>r.maxComb) r.maxComb=c; });
    r.avg=sum/s.length; return r;
  };

  // Full report chart: header, stat tiles, G over time (with speed), friction circle.
  G.draw=function(cv, run){
    var W=720,H=1110; cv.width=W; cv.height=H; var x=cv.getContext("2d"), s=run.samples||[], st=run.stats||G.stats(s);
    x.fillStyle="#0b0c0e"; x.fillRect(0,0,W,H);
    x.fillStyle="#f2f2f2"; x.font="700 34px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText("Driv3 · "+(run.label||"Run"),28,52);
    x.fillStyle="#9a9aa0"; x.font="500 22px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText((run.time?run.time+"s · ":"")+new Date(run.when||Date.now()).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),28,86);
    var tiles=[["Max accel",st.maxAcc,"#3dd68c"],["Max brake",st.maxBrk,"#ff6b6b"],["Max lateral",st.maxLat,"#73BDE0"],["Average",st.avg,"#f5c518"]];
    tiles.forEach(function(t,i){ var tx=28+i*168; x.fillStyle="#141416"; rr(x,tx,110,156,96,14); x.fill(); x.fillStyle=t[2]; x.font="800 36px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText(t[1].toFixed(2)+" G",tx+14,160); x.fillStyle="#9a9aa0"; x.font="500 19px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText(t[0],tx+14,190); });
    // Time plot
    var L=70,T=250,PW=W-L-30,PH=330; x.fillStyle="#141416"; rr(x,20,T-30,W-40,PH+80,16); x.fill();
    x.fillStyle="#f2f2f2"; x.font="700 22px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText("G over time",36,T-4);
    var tMax=s.length?Math.max(s[s.length-1].t,0.1):1, gM=Math.max(1,Math.ceil(Math.max(st.maxAcc,st.maxBrk,st.maxLat)*2)/2), top=T+16, ph=PH-36;
    function X(t){return L+t/tMax*PW} function Y(g){return top+ph/2-g/gM*(ph/2)}
    x.strokeStyle="#2a2a2e"; x.lineWidth=1; x.font="500 16px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillStyle="#7a7a80";
    for(var g=-gM;g<=gM+1e-9;g+=0.5){ x.beginPath(); x.moveTo(L,Y(g)); x.lineTo(L+PW,Y(g)); x.stroke(); x.fillText((g>0?"+":"")+g.toFixed(1),L-52,Y(g)+5); }
    for(var k=0;k<=4;k++){ var tt=tMax*k/4; x.fillText(tt.toFixed(1)+"s",X(tt)-16,top+ph+24); }
    var vMax=Math.max.apply(null,s.map(function(p){return p.speed||0}).concat([1]));
    if(vMax>1){ x.strokeStyle="rgba(255,255,255,.28)"; x.lineWidth=2; x.setLineDash([6,6]); x.beginPath(); s.forEach(function(p,i){ var yy=top+ph-(p.speed||0)/vMax*ph; i?x.lineTo(X(p.t),yy):x.moveTo(X(p.t),yy) }); x.stroke(); x.setLineDash([]); x.fillStyle="#9a9aa0"; x.fillText("- - speed (max "+Math.round(vMax)+" mph)",L+PW-230,top+14); }
    function line(key,col){ x.strokeStyle=col; x.lineWidth=3; x.beginPath(); s.forEach(function(p,i){ i?x.lineTo(X(p.t),Y(p[key])):x.moveTo(X(p.t),Y(p[key])) }); x.stroke(); }
    if(s.length>1){ line("lat","#73BDE0"); line("lon","#3dd68c"); }
    function mark(t,g,col,txt){ if(!g) return; var px=X(t),py=Y(g); x.fillStyle=col; x.beginPath(); x.arc(px,py,8,0,7); x.fill(); x.strokeStyle="#0b0c0e"; x.lineWidth=2; x.stroke(); x.font="700 17px -apple-system,Segoe UI,Roboto,sans-serif"; var tw=x.measureText(txt).width; x.fillStyle=col; x.fillText(txt,Math.min(Math.max(px-tw/2,L),L+PW-tw),py+(g>0?-14:26)); }
    var latAt=s.filter(function(p){return p.t===st.tLat})[0];
    mark(st.tAcc,st.maxAcc,"#3dd68c","Accel "+st.maxAcc.toFixed(2)); mark(st.tBrk,-st.maxBrk,"#ff6b6b","Brake "+st.maxBrk.toFixed(2)); if(latAt) mark(st.tLat,latAt.lat,"#73BDE0","Corner "+st.maxLat.toFixed(2));
    x.font="600 18px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillStyle="#3dd68c"; x.fillText("● Longitudinal (+ accel / − brake)",L,T+PH+44); x.fillStyle="#73BDE0"; x.fillText("● Lateral",L+340,T+PH+44);
    // Friction circle
    var CT=T+PH+80, CS=360, cx=W/2-120, cy=CT+CS/2+50, R=CS/2-10; x.fillStyle="#141416"; rr(x,20,CT,W-40,CS+110,16); x.fill();
    x.fillStyle="#f2f2f2"; x.font="700 22px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText("Friction circle",36,CT+30);
    x.strokeStyle="#2a2a2e"; x.lineWidth=1.5; [0.5,1].forEach(function(r){ x.beginPath(); x.arc(cx,cy,R*r/gM,0,7); x.stroke(); }); x.beginPath(); x.moveTo(cx-R,cy); x.lineTo(cx+R,cy); x.moveTo(cx,cy-R); x.lineTo(cx,cy+R); x.stroke();
    x.fillStyle="#7a7a80"; x.font="500 15px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText("0.5G",cx+R*0.5/gM+4,cy-4); x.fillText("1G",cx+R/gM+4,cy-4); x.fillText("accel",cx+6,cy-R+14); x.fillText("brake",cx+6,cy+R-4);
    s.forEach(function(p){ var c=Math.sqrt(p.lat*p.lat+p.lon*p.lon); x.fillStyle=c>0.8?"rgba(255,107,107,.75)":c>0.4?"rgba(245,197,24,.7)":"rgba(115,189,224,.6)"; x.beginPath(); x.arc(cx+p.lat/gM*R,cy-p.lon/gM*R,3.2,0,7); x.fill(); });
    var lx=cx+R+40; x.font="600 19px -apple-system,Segoe UI,Roboto,sans-serif";
    [["Peak combined",st.maxComb.toFixed(2)+" G","#f2f2f2"],["Max accel",st.maxAcc.toFixed(2)+" G","#3dd68c"],["Max brake",st.maxBrk.toFixed(2)+" G","#ff6b6b"],["Max lateral",st.maxLat.toFixed(2)+" G","#73BDE0"],["Average",st.avg.toFixed(2)+" G","#f5c518"],["Samples",String(st.n),"#9a9aa0"]].forEach(function(r,i){ x.fillStyle="#9a9aa0"; x.fillText(r[0],lx,CT+80+i*52); x.fillStyle=r[2]; x.fillText(r[1],lx,CT+102+i*52); });
    x.fillStyle="#6a6a70"; x.font="500 16px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillText("Phone sensor estimate. Closed roads or tracks only.",28,H-18);
  };
  function rr(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }

  // IndexedDB: runs kept on this phone only.
  function db(){ return new Promise(function(ok,no){ var r=indexedDB.open("driv3-runs",1); r.onupgradeneeded=function(){ r.result.createObjectStore("runs",{keyPath:"id"}); }; r.onsuccess=function(){ok(r.result)}; r.onerror=function(){no(r.error)}; }); }
  function tx(mode,fn){ return db().then(function(d){ return new Promise(function(ok,no){ var t=d.transaction("runs",mode), st=t.objectStore("runs"), out=fn(st); t.oncomplete=function(){ ok(out&&out.result!==undefined?out.result:out) }; t.onerror=function(){no(t.error)}; }); }); }
  G.save=function(run){ return tx("readwrite",function(s){ s.put(run); }); };
  G.get=function(id){ return tx("readonly",function(s){ return s.get(id); }); };
  G.list=function(){ return tx("readonly",function(s){ return s.getAll(); }).then(function(a){ return (a||[]).sort(function(p,q){return q.when-p.when}); }); };
  G.remove=function(id){ return tx("readwrite",function(s){ s.delete(id); }); };
  window.PerfG=G;
})();
