(function(){
function el(id){return document.getElementById(id)}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars)return s}catch(e){}return {i:0,cars:[{}]}}
function me(){var s=garage();return s.cars[s.i]||{}}
function kit(){try{return Object.assign({body:"suv",colour:"#c0c6ce",wheel:"five"},JSON.parse(localStorage.getItem("gt.kit")||"{}"))}catch(e){return {body:"suv",colour:"#c0c6ce",wheel:"five"}}}
function saveKit(k){localStorage.setItem("gt.kit",JSON.stringify(k))}
function career(){try{return Object.assign({lvl:1,wins:0},JSON.parse(localStorage.getItem("gt.career")||"{}"))}catch(e){return {lvl:1,wins:0}}}
function saveCareer(c){localStorage.setItem("gt.career",JSON.stringify(c))}
function shade(hex,n){
  hex=String(hex||"#888").replace("#",""); if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  r=Math.max(0,Math.min(255,r+n)); g=Math.max(0,Math.min(255,g+n)); b=Math.max(0,Math.min(255,b+n));
  return "rgb("+r+","+g+","+b+")";
}
var BODIES={hatch:{clr:1},hot:{clr:1},saloon:{clr:1},estate:{clr:1},suv:{clr:3},off:{clr:4},coupe:{clr:1},van:{clr:2}};
var COLOURS=["#c0c6ce","#1c1c1c","#8b1e1e","#1e3a8a","#f3efe6","#2f4f2f","#c5a44e","#6b7280","#7c2d12","#0f766e"];
var CPU=[
  {name:"Fiesta ST",body:"hot",s060:6.5,bhp:197,nm:290,clr:1,colour:"#8b1e1e"},
  {name:"Golf GTI",body:"hot",s060:6.4,bhp:242,nm:370,clr:1,colour:"#c0c6ce"},
  {name:"GR Yaris",body:"hot",s060:5.5,bhp:257,nm:360,clr:1,colour:"#f3efe6"},
  {name:"XC60 D5",body:"suv",s060:7.8,bhp:215,nm:440,clr:3,colour:"#1e3a8a"},
  {name:"Defender",body:"off",s060:8.0,bhp:247,nm:570,clr:4,colour:"#2f4f2f"},
  {name:"Land Cruiser",body:"off",s060:9.0,bhp:201,nm:430,clr:4,colour:"#6b7280"},
  {name:"M3",body:"coupe",s060:4.2,bhp:473,nm:550,clr:1,colour:"#1c1c1c"},
  {name:"Hilux",body:"off",s060:10.5,bhp:148,nm:400,clr:4,colour:"#7c2d12"}
];
function statsOf(c){
  var k=kit();
  return {name:c.nick||c.name||"You",s060:parseFloat(c.s060)||8.5,bhp:parseFloat(c.bhp)||150,nm:parseFloat(c.nm)||280,body:k.body,colour:k.colour,wheel:k.wheel,clr:(BODIES[k.body]||BODIES.suv).clr};
}
function cpuFor(){
  var lv=career().lvl, pool=CPU.slice(0,Math.min(CPU.length,1+lv));
  return Object.assign({}, pool[Math.floor(Math.random()*pool.length)]);
}
function ground(x,mode){
  if(mode!=="dirt") return 0;
  return Math.sin(x/110)*16 + Math.sin(x/38)*6 + (x>620&&x<740?24:0) + (x>1180&&x<1320?-18:0) + (x>1700&&x<1820?12:0);
}
function waterAt(x,mode){return mode==="dirt"&&x>1180&&x<1320}
var R={on:false,mode:"drag",t:0,gear:1,rpm:0.15,nos:0,nosLeft:1,you:{x:0,v:0,alive:1,stuck:0},cpu:{x:0,v:0,alive:1,stuck:0,gear:1,rpm:0.2},len:2600,msg:"",flash:"",end:0,opp:CPU[0]};
function drawWheel(ctx,x,y,r,style,rot){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle="#0a0a0a"; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
  ctx.strokeStyle="#2a2a2a"; ctx.lineWidth=r*0.22; ctx.beginPath(); ctx.arc(0,0,r-1,0,7); ctx.stroke();
  ctx.save(); ctx.rotate(rot||0);
  ctx.strokeStyle=style==="steel"?"#8a8a8a":"#d5d5d5";
  ctx.fillStyle=style==="steel"?"#7a7a7a":"#cfcfcf";
  ctx.lineWidth=1.4;
  var n=style==="mesh"?10:style==="slim"?3:style==="off"?5:5;
  for(var i=0;i<n;i++){
    ctx.save(); ctx.rotate(i*Math.PI*2/n);
    if(style==="dish"){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-r+3);ctx.stroke()}
    else {ctx.fillRect(-1.1,2,2.2,r-4)}
    ctx.restore();
  }
  ctx.fillStyle="#444"; ctx.beginPath(); ctx.arc(0,0,r*0.28,0,7); ctx.fill();
  ctx.restore(); ctx.restore();
}
function drawCar(ctx,x,y,spec,rot){
  var body=spec.body||"suv", col=spec.colour||"#c0c6ce", dark=shade(col,-40), lite=shade(col,28);
  var tall=body==="suv"||body==="off"||body==="van";
  var long=body==="estate"||body==="van"||body==="saloon";
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle="rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(0,16,52,6,0,0,7); ctx.fill();
  ctx.fillStyle=col;
  ctx.beginPath();
  if(body==="off"){
    ctx.moveTo(-54,10);ctx.lineTo(-48,-6);ctx.lineTo(-22,-20);ctx.lineTo(10,-22);ctx.lineTo(36,-16);ctx.lineTo(52,-2);ctx.lineTo(56,10);
  } else if(body==="suv"){
    ctx.moveTo(-52,10);ctx.lineTo(-46,-8);ctx.lineTo(-18,-24);ctx.lineTo(16,-24);ctx.lineTo(42,-10);ctx.lineTo(54,4);ctx.lineTo(56,10);
  } else if(body==="van"){
    ctx.moveTo(-52,10);ctx.lineTo(-48,-8);ctx.lineTo(-20,-26);ctx.lineTo(28,-26);ctx.lineTo(50,-6);ctx.lineTo(54,10);
  } else if(body==="estate"){
    ctx.moveTo(-52,10);ctx.lineTo(-44,-6);ctx.lineTo(-16,-22);ctx.lineTo(24,-22);ctx.lineTo(48,-6);ctx.lineTo(54,10);
  } else if(body==="coupe"||body==="hot"){
    ctx.moveTo(-50,10);ctx.lineTo(-36,-4);ctx.lineTo(-10,-20);ctx.lineTo(14,-18);ctx.lineTo(44,0);ctx.lineTo(52,10);
  } else {
    ctx.moveTo(-50,10);ctx.lineTo(-40,-6);ctx.lineTo(-14,-20);ctx.lineTo(18,-20);ctx.lineTo(44,-4);ctx.lineTo(52,10);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle=dark; ctx.fillRect(-50,6,104,5);
  ctx.fillStyle="rgba(160,210,255,.45)";
  ctx.beginPath();
  if(tall){ctx.moveTo(-16,-22);ctx.lineTo(14,-22);ctx.lineTo(18,-10);ctx.lineTo(-20,-10)}
  else {ctx.moveTo(-12,-18);ctx.lineTo(12,-17);ctx.lineTo(16,-6);ctx.lineTo(-16,-6)}
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle=dark; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-6,-8); ctx.lineTo(-6,8); ctx.stroke();
  ctx.fillStyle="#f4e27a"; ctx.fillRect(48,-2,6,4);
  ctx.fillStyle="#c23b2a"; ctx.fillRect(-54,0,5,4);
  if(body==="hot"||body==="coupe"){ctx.fillStyle=dark; ctx.fillRect(8,-20,18,3)}
  if(body==="off"){ctx.fillStyle=lite; ctx.fillRect(-8,-26,4,8)}
  var wr=body==="off"?10:body==="suv"?8.5:7.2;
  drawWheel(ctx,-26,12,wr,spec.wheel||"five",rot);
  drawWheel(ctx,26,12,wr,spec.wheel||"five",rot);
  ctx.restore();
}
function sizeCanvas(cv){
  var w=cv.clientWidth||320, h=240, d=Math.min(2,window.devicePixelRatio||1);
  cv.width=Math.floor(w*d); cv.height=Math.floor(h*d); cv.style.height=h+"px";
  var ctx=cv.getContext("2d"); ctx.setTransform(d,0,0,d,0,0); return {ctx:ctx,w:w,h:h};
}
function paint(){
  var cv=el("strip"); if(!cv) return;
  var s=sizeCanvas(cv), ctx=s.ctx, w=s.w, h=s.h, mode=R.mode||"drag";
  var sky=ctx.createLinearGradient(0,0,0,h*0.55);
  if(mode==="dirt"){sky.addColorStop(0,"#6b8cae");sky.addColorStop(1,"#c4b49a")}
  else {sky.addColorStop(0,"#1b2a44");sky.addColorStop(1,"#6a7d9a")}
  ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
  var cam=Math.max(0,R.you.x-180);
  var world=w/420;
  ctx.save(); ctx.translate(-cam*world*0.25,0);
  ctx.fillStyle=mode==="dirt"?"#7a6a52":"#3d4a3f";
  for(var b=0;b<40;b++){ctx.fillRect(b*90,h*0.38-(b%3)*12,70,h*0.2)}
  ctx.restore();
  ctx.save(); ctx.translate(-cam*world,0);
  var base=h*0.68;
  for(var i=0;i<R.len+200;i+=16){
    var g=ground(i,mode);
    ctx.fillStyle=mode==="dirt"?(waterAt(i,mode)?"#24556e":"#6a5136"):((Math.floor(i/16)%2)?"#2b2e33":"#32363c");
    ctx.fillRect(i*world, base-g, 18, h);
  }
  if(mode!=="dirt"){
    ctx.strokeStyle="#d7c48a"; ctx.setLineDash([18,16]); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,base+8); ctx.lineTo(R.len*world,base+8); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#e4c48a"; ctx.fillRect((R.len-12)*world, base-70, 6, 70);
    ctx.fillStyle="#fff"; ctx.fillRect(20*world,base-36,8,36); ctx.fillRect(36*world,base-36,8,36);
  } else {
    ctx.fillStyle="#c9a56a"; ctx.fillRect((R.len-12)*world, base-60, 6, 60);
  }
  var yYou=base-8-ground(R.you.x,mode);
  var yCpu=base+22-ground(R.cpu.x,mode);
  var rot=(R.you.x/18);
  drawCar(ctx, R.you.x*world, yYou, R.you.s||statsOf(me()), rot);
  drawCar(ctx, R.cpu.x*world, yCpu, R.opp, rot*0.9);
  if(R.nos>0){
    ctx.fillStyle="rgba(120,180,255,.45)";
    ctx.beginPath(); ctx.ellipse(R.you.x*world-58,yYou+4,16,5,0,0,7); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle="rgba(0,0,0,.45)"; ctx.fillRect(0,0,w,44);
  ctx.fillStyle="#f3efe6"; ctx.font="12px sans-serif";
  ctx.fillText((R.you.name||"You")+"  "+Math.round(R.you.v)+" mph",10,18);
  ctx.fillText((R.opp&&R.opp.name)||"Rival",10,34);
  drawTacho(ctx,w-86,78,R.rpm,R.gear);
  if(R.flash){ctx.fillStyle="#e4c48a";ctx.font="bold 16px sans-serif";ctx.fillText(R.flash,w/2-40,56)}
  if(R.msg){ctx.fillStyle="#fff";ctx.font="bold 36px sans-serif";ctx.fillText(R.msg,w/2-28,h*0.4)}
}
function drawTacho(ctx,x,y,rpm,gear){
  ctx.save(); ctx.translate(x,y);
  ctx.strokeStyle="#e4c48a"; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(0,0,28,-Math.PI*0.8,Math.PI*0.8); ctx.stroke();
  ctx.strokeStyle="#3a7a3a"; ctx.beginPath(); ctx.arc(0,0,28,-Math.PI*0.15,Math.PI*0.28); ctx.stroke();
  ctx.strokeStyle="#a33"; ctx.beginPath(); ctx.arc(0,0,28,Math.PI*0.28,Math.PI*0.8); ctx.stroke();
  var ang=-Math.PI*0.8+Math.min(1,rpm)*Math.PI*1.6;
  ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ang)*24,Math.sin(ang)*24); ctx.stroke();
  ctx.fillStyle="#e4c48a"; ctx.font="bold 13px sans-serif"; ctx.fillText(String(gear),-4,5);
  ctx.restore();
}
function tick(dt){
  if(!R.on||R.end) return;
  R.t+=dt; if(R.flashT){R.flashT-=dt; if(R.flashT<=0) R.flash=""}
  function drive(car,ai){
    if(!car.alive) return;
    var s060=Math.max(3.6,car.s.s060||8), bhp=car.s.bhp||150;
    var pull=(22/s060)*(0.55+bhp/400);
    if(ai){
      car.rpm=(car.rpm||0.3)+dt*0.42;
      if(car.rpm>0.72 && (car.gear||1)<5){car.gear=(car.gear||1)+1; car.rpm=0.3}
      car.v+=pull*dt*(0.88+career().lvl*0.03);
    } else {
      var zone=R.rpm>0.55&&R.rpm<0.78;
      var red=R.rpm>=0.92;
      R.rpm+=dt*(0.22+R.gear*0.045);
      if(R.rpm>1) R.rpm=1;
      var mul=red?0.35:(zone?1.18:(R.rpm<0.35?0.7:0.9));
      if(R.nos>0) mul*=1.32;
      car.v+=pull*mul*dt*(0.7+R.gear*0.12);
    }
    if(R.mode==="dirt"){
      var need=waterAt(car.x,R.mode)?3:(ground(car.x,R.mode)>18?3:2);
      if((car.s.clr||1)<need){car.v*=0.55; car.stuck+=dt; if(car.stuck>1.1){car.alive=0;car.v=0}}
      if(waterAt(car.x,R.mode)&&(car.s.clr||1)<3&&car.v>32){car.alive=0;car.v=0}
      var sl=ground(car.x+10,R.mode)-ground(car.x-10,R.mode);
      if(sl<-10 && !ai && R.gear>3){car.v+=dt*14; if(car.v>48&&(car.s.clr||1)<3){car.alive=0}}
      if(sl>12) car.v*=0.97;
    }
    car.v=Math.max(0,Math.min(car.v, ai?78:92));
    car.x+=car.v*dt*9.2;
  }
  if(R.nos>0) R.nos-=dt;
  drive(R.you,false); drive(R.cpu,true);
  if(!R.you.alive){R.end=1;R.on=false;R.msg="DNF"; showResult(0);return}
  if(R.you.x>=R.len||R.cpu.x>=R.len){
    R.end=1;R.on=false; var win=R.you.x>=R.cpu.x; R.msg=win?"WIN":"LOSS"; showResult(win);
  }
}
var last=0;
function loop(ts){
  if(!last) last=ts;
  var dt=Math.min(0.04,(ts-last)/1000); last=ts;
  tick(dt); paint();
  if(R.on) requestAnimationFrame(loop);
}
function showResult(win){
  var cr=career();
  if(win){cr.wins++; if(cr.wins%2===0) cr.lvl=Math.min(12,cr.lvl+1); saveCareer(cr)}
  if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins";
  if(el("raceOut")) el("raceOut").innerHTML="<div class='win'><h3>"+(win?"You take the strip":"They got there first")+"</h3><p>"+(R.you.name||"You")+" vs "+((R.opp&&R.opp.name)||"Rival")+" · "+R.t.toFixed(2)+"s · gear "+R.gear+"</p><p class='copy'>Green on the tacho is the shift. Miss it and you bog or bounce off the limiter.</p></div>";
}
function start(mode){
  var you=statsOf(me()), opp=cpuFor();
  R={on:false,mode:mode||"drag",t:0,gear:1,rpm:0.18,nos:0,nosLeft:1,flash:"",flashT:0,end:0,msg:"3",len:mode==="dirt"?2400:2800,
    you:{x:30,v:0,alive:1,stuck:0,s:you,name:you.name}, cpu:{x:30,v:0,alive:1,stuck:0,s:opp,gear:1,rpm:0.25}, opp:opp};
  if(el("raceOut")) el("raceOut").innerHTML="";
  var n=3;
  function cd(){
    R.msg=n?String(n):"GO"; paint();
    if(n===0){R.on=true;R.msg=""; last=0; requestAnimationFrame(loop); return}
    n--; setTimeout(cd,620);
  }
  cd();
}
function shift(dir){
  if(!R.on) return;
  if(dir<0){R.gear=Math.max(1,R.gear-1); R.rpm=Math.min(0.7,R.rpm+0.12); R.you.v*=0.9; R.flash="DOWN"; R.flashT=0.35; return}
  if(R.gear>=5){R.flash="TOP"; R.flashT=0.3; return}
  if(R.rpm>=0.55&&R.rpm<=0.78){R.gear++; R.rpm=0.28; R.you.v*=1.04; R.flash="PERFECT"; R.flashT=0.45}
  else if(R.rpm<0.55){R.rpm=Math.max(0.18,R.rpm-0.08); R.you.v*=0.9; R.flash="EARLY"; R.flashT=0.4}
  else {R.rpm=0.42; R.you.v*=0.93; R.flash="LATE"; R.flashT=0.4; R.gear++}
}
function showRace(){
  ["garageView","gameView","jobsView"].forEach(function(id){if(el(id)) el(id).className="wrap hide"});
  if(el("raceView")) el("raceView").className="wrap";
  var k=kit(); if(el("bodyPick")) el("bodyPick").value=k.body; if(el("wheelPick")) el("wheelPick").value=k.wheel; if(el("colourPick")) el("colourPick").value=k.colour;
  var cr=career(); if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins vs the house";
  R.opp=cpuFor(); R.you={x:80,v:0,alive:1,s:statsOf(me()),name:statsOf(me()).name}; R.cpu={x:40,v:0,s:R.opp}; R.mode="drag"; R.len=800; paint();
}
function hideRace(){R.on=false; if(el("raceView")) el("raceView").className="wrap hide"; if(el("garageView")) el("garageView").className="wrap"}
function bind(){
  if(!el("raceView")) return;
  if(el("btnRace")) el("btnRace").addEventListener("click",showRace);
  if(el("btnRaceBack")) el("btnRaceBack").addEventListener("click",hideRace);
  if(el("btnDrag")) el("btnDrag").addEventListener("click",function(){start("drag")});
  if(el("btnDirt")) el("btnDirt").addEventListener("click",function(){start("dirt")});
  if(el("btnShift")) el("btnShift").addEventListener("click",function(){shift(1)});
  if(el("btnDown")) el("btnDown").addEventListener("click",function(){shift(-1)});
  if(el("btnNos")) el("btnNos").addEventListener("click",function(){if(R.on&&R.nos<=0&&R.nosLeft){R.nos=1.35;R.nosLeft=0;R.flash="NOS";R.flashT=0.4}});
  ["bodyPick","wheelPick","colourPick"].forEach(function(id){
    if(!el(id)) return;
    el(id).addEventListener("change",function(){
      var k=kit(); k.body=el("bodyPick").value; k.wheel=el("wheelPick").value; k.colour=el("colourPick").value; saveKit(k); showRace();
    });
  });
}
bind();
})();
