(function(){
function el(id){return document.getElementById(id)}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars)return s}catch(e){}return {i:0,cars:[{}]}}
function me(){var s=garage();return s.cars[s.i]||{}}
function kit(){try{return Object.assign({body:"xc60",colour:"#1e3a8a",wheel:"five"},JSON.parse(localStorage.getItem("gt.kit")||"{}"))}catch(e){return {body:"xc60",colour:"#1e3a8a",wheel:"five"}}}
function saveKit(k){localStorage.setItem("gt.kit",JSON.stringify(k))}
function career(){try{return Object.assign({lvl:1,wins:0},JSON.parse(localStorage.getItem("gt.career")||"{}"))}catch(e){return {lvl:1,wins:0}}}
function saveCareer(c){localStorage.setItem("gt.career",JSON.stringify(c))}
var VOLVO={xc90:{name:"Volvo XC90",clr:4,key:"xc90"},xc60:{name:"Volvo XC60",clr:3,key:"xc60"},v70:{name:"Volvo V70",clr:2,key:"v70"},s60:{name:"Volvo S60",clr:1,key:"s60"},c30:{name:"Volvo C30",clr:1,key:"c30"}};
var IM={};
function bootArt(){
  var A=window.GTART||{};
  ["strip","xc90","xc60","v70","s60","c30","mph","rpm"].forEach(function(k){
    var img=new Image();
    img.onload=function(){ IM[k]=img; };
    img.src=A[k]||("art/"+k+".jpg");
    IM[k]=img;
  });
}
bootArt();
var CPU=[{name:"House C30",body:"c30",s060:7.2,bhp:220,nm:320,clr:1},{name:"House S60",body:"s60",s060:7.0,bhp:240,nm:350,clr:1},{name:"House V70",body:"v70",s060:8.2,bhp:200,nm:400,clr:2},{name:"House XC60",body:"xc60",s060:7.8,bhp:215,nm:440,clr:3},{name:"House XC90",body:"xc90",s060:8.4,bhp:235,nm:480,clr:4}];
function statsOf(c){var k=kit(), spec=VOLVO[k.body]||VOLVO.xc60;return {name:c.nick||c.name||spec.name,s060:parseFloat(c.s060)||8.2,bhp:parseFloat(c.bhp)||180,nm:parseFloat(c.nm)||350,body:k.body,colour:k.colour,wheel:k.wheel,clr:spec.clr,key:spec.key}}
function cpuFor(){var lv=career().lvl; return Object.assign({}, CPU[Math.min(CPU.length-1, lv%CPU.length)]);}
var R={on:false,mode:"drag",t:0,gear:1,rpm:0.12,nos:0,nosLeft:1,tree:0,you:{x:0,v:0,alive:1},cpu:{x:0,v:0,alive:1},len:5400,msg:"",flash:"",end:0,opp:CPU[3]};
function land(){return window.matchMedia && window.matchMedia("(orientation: landscape)").matches}
function sizeCanvas(cv){
  var w=cv.clientWidth||320;
  var h=land()? Math.max(220, window.innerHeight) : 280;
  var d=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.floor(w*d); cv.height=Math.floor(h*d); cv.style.height=h+"px";
  var ctx=cv.getContext("2d"); ctx.setTransform(d,0,0,d,0,0); return {ctx:ctx,w:w,h:h};
}
function drawSprite(ctx,key,x,y,w,h){
  var img=IM[key];
  if(img&&img.complete&&img.naturalWidth){ ctx.drawImage(img,x-w/2,y-h+6,w,h); return true; }
  return false;
}
function face(ctx,key,x,y,r,val,max){
  var img=IM[key];
  if(img&&img.complete&&img.naturalWidth) ctx.drawImage(img,x-r,y-r,r*2,r*2);
  else { ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
  var t=Math.max(0,Math.min(1,val/max));
  var a=-Math.PI*0.78+t*Math.PI*1.56;
  ctx.save(); ctx.translate(x,y);
  ctx.strokeStyle="#ff2a2a"; ctx.lineWidth=3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(Math.cos(a)*-6,Math.sin(a)*-6); ctx.lineTo(Math.cos(a)*(r*0.68),Math.sin(a)*(r*0.68)); ctx.stroke();
  ctx.fillStyle="#222"; ctx.beginPath(); ctx.arc(0,0,5,0,7); ctx.fill();
  ctx.restore();
}
function tree(ctx,w,phase){
  var x=w/2, y=52;
  ctx.fillStyle="rgba(0,0,0,.65)"; ctx.fillRect(x-14,y-44,28,72);
  var on=["#4a1010","#4a1010","#4a1010","#0d3a18"];
  if(phase>=1) on[0]="#ff2a2a"; if(phase>=2) on[1]="#ff2a2a"; if(phase>=3) on[2]="#ff2a2a"; if(phase>=4) on[3]="#39ff6a";
  for(var i=0;i<3;i++){ctx.fillStyle=on[i]; ctx.beginPath(); ctx.arc(x,y-32+i*13,5,0,7); ctx.fill()}
  ctx.fillStyle=on[3]; ctx.beginPath(); ctx.arc(x,y+16,6,0,7); ctx.fill();
}
function paint(){
  var cv=el("strip"); if(!cv) return;
  var s=sizeCanvas(cv), ctx=s.ctx, w=s.w, h=s.h;
  var cam=Math.max(0,R.you.x-80);
  if(IM.strip&&IM.strip.complete&&IM.strip.naturalWidth){
    var iw=IM.strip.naturalWidth, ih=IM.strip.naturalHeight;
    var scale=Math.max(w/iw, h/ih);
    var dw=iw*scale, dh=ih*scale;
    ctx.drawImage(IM.strip, (w-dw)/2-(cam%400)*0.15, (h-dh)/2, dw, dh);
  } else { ctx.fillStyle="#1a1520"; ctx.fillRect(0,0,w,h); }
  var you=R.you.s||statsOf(me()); var opp=R.opp||{};
  drawSprite(ctx, you.key||"xc60", w*0.34, h*0.72, Math.min(220,w*0.42), Math.min(96,h*0.28));
  drawSprite(ctx, opp.body||"s60", w*0.34+(R.cpu.x-R.you.x)*0.06, h*0.86, Math.min(200,w*0.38), Math.min(86,h*0.24));
  ctx.fillStyle="rgba(0,0,0,.35)"; ctx.fillRect(0,h-96,w,96);
  face(ctx,"mph", 58, h-48, 42, R.you.v||0, 140);
  face(ctx,"rpm", 148, h-48, 42, (R.rpm||0)*8, 8);
  ctx.fillStyle="#e4c48a"; ctx.font="bold 18px sans-serif"; ctx.fillText("G"+R.gear, w-52, h-28);
  if(R.nos>0){ctx.fillStyle="#7ecbff"; ctx.fillText("NOS", w-58, h-50)}
  tree(ctx,w,R.tree||0);
  ctx.fillStyle="#fff"; ctx.font="12px sans-serif";
  ctx.fillText((you.name||"You")+" vs "+(opp.name||"Rival"), 10, 18);
  ctx.fillText((R.t||0).toFixed(1)+"s", 10, 34);
  if(R.flash){ctx.fillStyle="#e4c48a"; ctx.font="bold 20px sans-serif"; ctx.fillText(R.flash, w/2-46, 34)}
  if(R.msg){ctx.fillStyle="#fff"; ctx.font="bold 36px sans-serif"; ctx.fillText(R.msg, w/2-36, h*0.4)}
}
function tick(dt){
  if(!R.on||R.end) return;
  R.t+=dt; if(R.flashT){R.flashT-=dt; if(R.flashT<=0) R.flash=""}
  function drive(car,ai){
    if(!car.alive) return;
    var pull=18/Math.max(3.8,car.s.s060||8)*(0.6+(car.s.bhp||180)/500);
    if(ai){ car.rpm=(car.rpm||0.3)+dt*0.28; if(car.rpm>0.73&&(car.gear||1)<5){car.gear++; car.rpm=0.32} car.v+=pull*dt*0.92; }
    else {
      R.rpm+=dt*(0.16+R.gear*0.028); if(R.rpm>1) R.rpm=1;
      var perfect=R.rpm>=0.69&&R.rpm<=0.75, red=R.rpm>=0.93;
      var mul=red?0.28:(perfect?1.2:(R.rpm<0.4?0.62:0.82));
      if(R.nos>0) mul*=1.28;
      car.v+=pull*mul*dt*(0.62+R.gear*0.1);
    }
    if(R.mode==="dirt" && (car.s.clr||1)<3 && car.x>2200&&car.x<2800){car.v*=0.6; if(car.v<6) car.alive=0}
    car.v=Math.max(0,Math.min(car.v, ai?96:110));
    car.x+=car.v*dt*3.15;
  }
  if(R.nos>0) R.nos-=dt;
  drive(R.you,false); drive(R.cpu,true);
  if(!R.you.alive){R.end=1;R.on=false;R.msg="DNF"; showResult(0);return}
  if(R.you.x>=R.len||R.cpu.x>=R.len||R.t>=32){ R.end=1;R.on=false; showResult(R.you.x>=R.cpu.x && R.you.alive); }
}
var last=0;
function loop(ts){ if(!last) last=ts; var dt=Math.min(0.04,(ts-last)/1000); last=ts; tick(dt); paint(); if(R.on||R.tree) requestAnimationFrame(loop); }
function showResult(win){
  var cr=career(); if(win){cr.wins++; if(cr.wins%2===0) cr.lvl=Math.min(12,cr.lvl+1); saveCareer(cr)}
  if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins";
  if(el("raceOut")) el("raceOut").innerHTML="<div class='win'><h3>"+(win?"You take the strip":"They got there first")+"</h3><p>"+R.t.toFixed(2)+"s · gear "+R.gear+"</p></div>";
  if(el("raceView")) el("raceView").classList.remove("playon");
}
function start(mode){
  var you=statsOf(me()), opp=cpuFor();
  R={on:false,mode:mode||"drag",t:0,gear:1,rpm:0.14,nos:0,nosLeft:1,tree:0,flash:"",flashT:0,end:0,msg:"",len:5400,you:{x:20,v:0,alive:1,s:you,name:you.name},cpu:{x:20,v:0,alive:1,s:opp,gear:1,rpm:0.25},opp:opp};
  if(el("raceOut")) el("raceOut").innerHTML="";
  if(el("raceView")) el("raceView").classList.add("playon");
  var step=0;
  function lights(){ step++; R.tree=step; paint(); if(step<4){ setTimeout(lights,700); return;} R.on=true; last=0; requestAnimationFrame(loop); }
  lights();
}
function shift(dir){
  if(!R.on) return;
  if(dir<0){R.gear=Math.max(1,R.gear-1); R.rpm=Math.min(0.72,R.rpm+0.1); R.you.v*=0.9; R.flash="DOWN"; R.flashT=0.3; return}
  if(R.gear>=5){R.flash="TOP"; R.flashT=0.25; return}
  if(R.rpm>=0.69&&R.rpm<=0.75){R.gear++; R.rpm=0.26; R.you.v*=1.05; R.flash="PERFECT"; R.flashT=0.4}
  else if(R.rpm<0.69){R.you.v*=0.88; R.rpm=Math.max(0.16,R.rpm-0.06); R.flash="EARLY"; R.flashT=0.4}
  else {R.gear++; R.rpm=0.4; R.you.v*=0.9; R.flash="LATE"; R.flashT=0.4}
}
function showRace(){
  ["garageView","gameView","jobsView"].forEach(function(id){if(el(id)) el(id).className="wrap hide"});
  if(el("raceView")) el("raceView").className="wrap";
  var k=kit(); if(el("bodyPick")) el("bodyPick").value=VOLVO[k.body]?k.body:"xc60";
  var cr=career(); if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins";
  R.opp=cpuFor(); R.you={x:80,v:0,alive:1,s:statsOf(me()),name:statsOf(me()).name}; R.cpu={x:40,v:0,s:R.opp}; paint();
}
function hideRace(){ R.on=false; if(el("raceView")){ el("raceView").className="wrap hide"; el("raceView").classList.remove("playon"); } if(el("garageView")) el("garageView").className="wrap"; }
function bind(){
  if(!el("raceView")) return;
  if(el("btnRace")) el("btnRace").addEventListener("click",showRace);
  if(el("btnRaceBack")) el("btnRaceBack").addEventListener("click",hideRace);
  if(el("btnDrag")) el("btnDrag").addEventListener("click",function(){start("drag")});
  if(el("btnDirt")) el("btnDirt").addEventListener("click",function(){start("dirt")});
  if(el("btnShift")) el("btnShift").addEventListener("click",function(){shift(1)});
  if(el("btnDown")) el("btnDown").addEventListener("click",function(){shift(-1)});
  if(el("btnNos")) el("btnNos").addEventListener("click",function(){if(R.on&&R.nos<=0&&R.nosLeft){R.nos=1.3;R.nosLeft=0;R.flash="NOS";R.flashT=0.35}});
  if(el("bodyPick")) el("bodyPick").addEventListener("change",function(){var k=kit(); k.body=el("bodyPick").value; saveKit(k); showRace()});
  window.addEventListener("resize",function(){ if(el("raceView")&&!el("raceView").classList.contains("hide")) paint(); });
  window.addEventListener("orientationchange",function(){ setTimeout(paint,250); });
}
bind();
})();
