(function(){
function el(id){return document.getElementById(id)}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars)return s}catch(e){}return {i:0,cars:[{}]}}
function me(){var s=garage();return s.cars[s.i]||{}}
function kit(){try{return Object.assign({body:"xc60",colour:"#c0c6ce",wheel:"five"},JSON.parse(localStorage.getItem("gt.kit")||"{}"))}catch(e){return {body:"xc60",colour:"#c0c6ce",wheel:"five"}}}
function saveKit(k){localStorage.setItem("gt.kit",JSON.stringify(k))}
function career(){try{return Object.assign({lvl:1,wins:0},JSON.parse(localStorage.getItem("gt.career")||"{}"))}catch(e){return {lvl:1,wins:0}}}
function saveCareer(c){localStorage.setItem("gt.career",JSON.stringify(c))}
var VOLVO={xc90:{name:"Volvo XC90",clr:4,key:"xc90"},xc60:{name:"Volvo XC60",clr:3,key:"xc60"},v70:{name:"Volvo V70",clr:2,key:"v70"},s60:{name:"Volvo S60",clr:1,key:"s60"},c30:{name:"Volvo C30",clr:1,key:"c30"}};
var GEARS=6, REDLINE=8000, SHIFT_LO=6400, SHIFT_HI=7300;
var RATIO=[0,3.4,2.2,1.55,1.15,0.9,0.74];
var IM={}, CUT={};
function bootArt(){
  ["strip","xc90","xc60","v70","s60","c30","mph","rpm"].forEach(function(k){
    var img=new Image();
    img.onload=function(){ IM[k]=img; if(k!=="strip"&&k!=="mph"&&k!=="rpm") CUT[k]=knock(img); };
    img.src=(window.GTART&&window.GTART[k])||("art/"+k+".jpg");
    IM[k]=img;
  });
}
function knock(img){
  try{
    var c=document.createElement("canvas");
    c.width=img.naturalWidth; c.height=img.naturalHeight;
    var g=c.getContext("2d"); g.drawImage(img,0,0);
    var d=g.getImageData(0,0,c.width,c.height), p=d.data;
    for(var i=0;i<p.length;i+=4){
      var r=p[i], gv=p[i+1], b=p[i+2];
      var mx=Math.max(r,gv,b), mn=Math.min(r,gv,b);
      if(mx<42) p[i+3]=0;
      else if(mx<78 && (mx-mn)<22) p[i+3]=Math.round(p[i+3]*((mx-42)/36));
    }
    g.putImageData(d,0,0);
    return c;
  }catch(e){ return img; }
}
bootArt();
var CPU=[{name:"House C30",body:"c30",s060:7.2,bhp:220,nm:320,clr:1},{name:"House S60",body:"s60",s060:7.0,bhp:240,nm:350,clr:1},{name:"House V70",body:"v70",s060:8.2,bhp:200,nm:400,clr:2},{name:"House XC60",body:"xc60",s060:7.8,bhp:215,nm:440,clr:3},{name:"House XC90",body:"xc90",s060:8.4,bhp:235,nm:480,clr:4}];
function statsOf(c){var k=kit(), spec=VOLVO[k.body]||VOLVO.xc60;return {name:c.nick||c.name||spec.name,s060:parseFloat(c.s060)||8.2,bhp:parseFloat(c.bhp)||180,nm:parseFloat(c.nm)||350,body:k.body,colour:k.colour,wheel:k.wheel,clr:spec.clr,key:spec.key}}
function cpuFor(){var lv=career().lvl; return Object.assign({}, CPU[Math.min(CPU.length-1, lv%CPU.length)]);}
var R={on:false,mode:"drag",t:0,gear:1,rpm:900,nos:0,nosLeft:1,tree:0,you:{x:0,v:0,alive:1},cpu:{x:0,v:0,alive:1,gear:1,rpm:900},len:4200,msg:"",flash:"",end:0,opp:CPU[3]};
function land(){return window.matchMedia && window.matchMedia("(orientation: landscape)").matches}
function sizeCanvas(cv){
  var w=cv.clientWidth||320;
  var h=land()? Math.max(240, window.innerHeight-8) : 300;
  var d=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.floor(w*d); cv.height=Math.floor(h*d); cv.style.height=h+"px";
  var ctx=cv.getContext("2d"); ctx.setTransform(d,0,0,d,0,0); return {ctx:ctx,w:w,h:h};
}
function drawSprite(ctx,key,x,y,w,h){
  var src=CUT[key]||IM[key];
  if(!src) return false;
  var ok=(src.naturalWidth||src.width);
  if(!ok) return false;
  ctx.drawImage(src, x-w/2, y-h, w, h);
  return true;
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
  var x=w/2, y=46;
  ctx.fillStyle="rgba(0,0,0,.7)"; ctx.fillRect(x-13,y-40,26,68);
  var on=["#4a1010","#4a1010","#4a1010","#0d3a18"];
  if(phase>=1) on[0]="#ff2a2a"; if(phase>=2) on[1]="#ff2a2a"; if(phase>=3) on[2]="#ff2a2a"; if(phase>=4) on[3]="#39ff6a";
  for(var i=0;i<3;i++){ctx.fillStyle=on[i]; ctx.beginPath(); ctx.arc(x,y-28+i*13,5,0,7); ctx.fill()}
  ctx.fillStyle=on[3]; ctx.beginPath(); ctx.arc(x,y+18,6,0,7); ctx.fill();
}
function paint(){
  var cv=el("strip"); if(!cv) return;
  var s=sizeCanvas(cv), ctx=s.ctx, w=s.w, h=s.h;
  var cam=Math.max(0,R.you.x-40);
  if(IM.strip&&IM.strip.complete&&IM.strip.naturalWidth){
    var iw=IM.strip.naturalWidth, ih=IM.strip.naturalHeight;
    var scale=Math.max(w/iw, h/ih);
    var dw=iw*scale, dh=ih*scale;
    ctx.drawImage(IM.strip, (w-dw)/2-(cam%280)*0.22, (h-dh)/2, dw, dh);
  } else { ctx.fillStyle="#1a1520"; ctx.fillRect(0,0,w,h); }
  var you=R.you.s||statsOf(me()); var opp=R.opp||{};
  var laneY=h*0.58;
  var lead=(R.cpu.x-R.you.x)*0.045;
  drawSprite(ctx, you.key||"xc60", w*0.38, laneY, Math.min(200,w*0.46), Math.min(78,h*0.24));
  drawSprite(ctx, opp.body||"s60", w*0.38+lead, laneY+36, Math.min(176,w*0.4), Math.min(66,h*0.2));
  ctx.fillStyle="rgba(0,0,0,.42)"; ctx.fillRect(0,h-88,w,88);
  face(ctx,"mph", 54, h-44, 38, R.you.v||0, 140);
  face(ctx,"rpm", 136, h-44, 38, R.rpm||0, REDLINE);
  ctx.fillStyle="#e4c48a"; ctx.font="bold 18px sans-serif"; ctx.fillText("G"+R.gear, w-48, h-26);
  if(R.nos>0){ctx.fillStyle="#7ecbff"; ctx.fillText("NOS", w-54, h-48)}
  tree(ctx,w,R.tree||0);
  ctx.fillStyle="#fff"; ctx.font="12px sans-serif";
  ctx.fillText((you.name||"You")+" vs "+(opp.name||"Rival"), 10, 16);
  ctx.fillText((R.t||0).toFixed(1)+"s  "+Math.round(R.you.v||0)+" mph", 10, 32);
  if(R.flash){ctx.fillStyle="#e4c48a"; ctx.font="bold 20px sans-serif"; ctx.fillText(R.flash, w/2-40, 32)}
  if(R.msg){ctx.fillStyle="#fff"; ctx.font="bold 34px sans-serif"; ctx.fillText(R.msg, w/2-40, h*0.36)}
}
function pullOf(car){
  var s=car.s||{};
  return 52/Math.max(3.6,s.s060||8)*(0.72+(s.bhp||180)/420);
}
function driveYou(dt){
  var car=R.you; if(!car.alive) return;
  var climb=(8-R.gear)*920;
  if(R.nos>0) climb*=1.35;
  R.rpm+=climb*dt;
  if(R.rpm>REDLINE) R.rpm=REDLINE;
  var band=1;
  if(R.rpm<2200) band=0.42;
  else if(R.rpm>=SHIFT_LO&&R.rpm<=SHIFT_HI) band=1.18;
  else if(R.rpm>7600) band=0.22;
  else band=0.92;
  if(R.nos>0) band*=1.32;
  var accel=pullOf(car)*band*RATIO[R.gear];
  car.v+=accel*dt;
  car.v=Math.max(0,Math.min(car.v, 138));
  if(R.mode==="dirt" && (car.s.clr||1)<3 && car.x>1600&&car.x<2100){ car.v*=0.55; if(car.v<8) car.alive=0; }
  car.x+=car.v*dt*4.4;
}
function driveCpu(dt){
  var car=R.cpu; if(!car.alive) return;
  car.gear=car.gear||1; car.rpm=car.rpm||1100;
  car.rpm+=(7.2-car.gear)*880*dt;
  if(car.rpm>7100 && car.gear<GEARS){ car.gear++; car.rpm=2400+car.gear*80; }
  if(car.rpm>REDLINE) car.rpm=REDLINE;
  var band=(car.rpm>7600)?0.3:1;
  car.v+=pullOf(car)*0.9*band*RATIO[car.gear]*dt;
  car.v=Math.max(0,Math.min(car.v, 124));
  if(R.mode==="dirt" && (car.s.clr||1)<3 && car.x>1600&&car.x<2100){ car.v*=0.55; if(car.v<8) car.alive=0; }
  car.x+=car.v*dt*4.4;
}
function tick(dt){
  if(!R.on||R.end) return;
  R.t+=dt; if(R.flashT){R.flashT-=dt; if(R.flashT<=0) R.flash=""}
  if(R.nos>0) R.nos-=dt;
  driveYou(dt); driveCpu(dt);
  if(!R.you.alive){R.end=1;R.on=false;R.msg="DNF"; showResult(0);return}
  if(R.you.x>=R.len||R.cpu.x>=R.len||R.t>=22){ R.end=1;R.on=false; showResult(R.you.x>=R.cpu.x && R.you.alive); }
}
var last=0;
function loop(ts){ if(!last) last=ts; var dt=Math.min(0.04,(ts-last)/1000); last=ts; tick(dt); paint(); if(R.on||R.tree) requestAnimationFrame(loop); }
function showResult(win){
  var cr=career(); if(win){cr.wins++; if(cr.wins%2===0) cr.lvl=Math.min(12,cr.lvl+1); saveCareer(cr)}
  if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins";
  if(el("raceOut")) el("raceOut").innerHTML="<div class='win'><h3>"+(win?"You take the strip":"They got there first")+"</h3><p>"+R.t.toFixed(2)+"s · gear "+R.gear+" · "+Math.round(R.you.v)+" mph</p></div>";
  if(el("raceView")) el("raceView").classList.remove("playon");
  paint();
}
function start(mode){
  var you=statsOf(me()), opp=cpuFor();
  R={on:false,mode:mode||"drag",t:0,gear:1,rpm:1100,nos:0,nosLeft:1,tree:0,flash:"",flashT:0,end:0,msg:"",len:4200,you:{x:20,v:0,alive:1,s:you,name:you.name},cpu:{x:20,v:0,alive:1,s:opp,gear:1,rpm:1100},opp:opp};
  if(el("raceOut")) el("raceOut").innerHTML="";
  if(el("raceView")) el("raceView").classList.add("playon");
  var step=0;
  function lights(){ step++; R.tree=step; paint(); if(step<4){ setTimeout(lights,650); return;} R.on=true; last=0; requestAnimationFrame(loop); }
  lights();
}
function shift(dir){
  if(!R.on||R.end) return;
  if(dir<0){
    if(R.gear<=1){R.flash="1st"; R.flashT=0.25; return;}
    R.gear--; R.rpm=Math.min(REDLINE-200, R.rpm+1600); R.you.v*=0.92; R.flash="DOWN"; R.flashT=0.28; return;
  }
  if(R.gear>=GEARS){ R.flash="TOP"; R.flashT=0.25; return; }
  if(R.rpm>=SHIFT_LO && R.rpm<=SHIFT_HI){
    R.gear++; R.rpm=Math.max(1800, R.rpm*0.42); R.you.v*=1.06; R.flash="PERFECT"; R.flashT=0.4;
  } else if(R.rpm<SHIFT_LO){
    R.you.v*=0.82; R.rpm=Math.max(1400, R.rpm-900); R.flash="EARLY"; R.flashT=0.4;
  } else {
    R.gear++; R.rpm=Math.max(2600, R.rpm*0.55); R.you.v*=0.9; R.flash="LATE"; R.flashT=0.4;
  }
}
function showRace(){
  ["garageView","gameView","jobsView"].forEach(function(id){if(el(id)) el(id).className="wrap hide"});
  if(el("raceView")) el("raceView").className="wrap";
  var k=kit(); if(el("bodyPick")) el("bodyPick").value=VOLVO[k.body]?k.body:"xc60";
  if(el("colourPick")) el("colourPick").value=k.colour||"#c0c6ce";
  var cr=career(); if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins";
  R.opp=cpuFor(); R.you={x:80,v:0,alive:1,s:statsOf(me()),name:statsOf(me()).name}; R.cpu={x:40,v:0,s:R.opp,gear:1,rpm:900}; paint();
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
  if(el("btnNos")) el("btnNos").addEventListener("click",function(){if(R.on&&R.nos<=0&&R.nosLeft){R.nos=1.4;R.nosLeft=0;R.flash="NOS";R.flashT=0.35}});
  if(el("bodyPick")) el("bodyPick").addEventListener("change",function(){var k=kit(); k.body=el("bodyPick").value; saveKit(k); showRace()});
  if(el("colourPick")) el("colourPick").addEventListener("change",function(){var k=kit(); k.colour=el("colourPick").value; saveKit(k);});
  window.addEventListener("resize",function(){ if(el("raceView")&&!el("raceView").classList.contains("hide")) paint(); });
  window.addEventListener("orientationchange",function(){ setTimeout(paint,250); });
}
bind();
})();
