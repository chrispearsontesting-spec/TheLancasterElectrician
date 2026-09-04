(function(){
function el(id){return document.getElementById(id)}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars)return s}catch(e){}return {i:0,cars:[{}]}}
function me(){var s=garage();return s.cars[s.i]||{}}
function kit(){try{return Object.assign({body:"suv",colour:"#c0c6ce",wheel:"five",nos:1},JSON.parse(localStorage.getItem("gt.kit")||"{}"))}catch(e){return {body:"suv",colour:"#c0c6ce",wheel:"five",nos:1}}}
function saveKit(k){localStorage.setItem("gt.kit",JSON.stringify(k))}
function career(){try{return Object.assign({lvl:1,wins:0},JSON.parse(localStorage.getItem("gt.career")||"{}"))}catch(e){return {lvl:1,wins:0}}}
function saveCareer(c){localStorage.setItem("gt.career",JSON.stringify(c))}
var BODIES=[
  {id:"hatch",name:"Hatch",clr:1,drag:0.9},
  {id:"hot",name:"Hot hatch",clr:1,drag:0.82},
  {id:"saloon",name:"Saloon",clr:1,drag:0.88},
  {id:"estate",name:"Estate",clr:1,drag:0.92},
  {id:"suv",name:"SUV",clr:3,drag:1.05},
  {id:"off",name:"Off-roader",clr:4,drag:1.12},
  {id:"coupe",name:"Coupe",clr:1,drag:0.84},
  {id:"van",name:"Van",clr:2,drag:1.15}
];
var COLOURS=["#c0c6ce","#1c1c1c","#8b1e1e","#1e3a8a","#f3efe6","#2f4f2f","#c5a44e","#6b7280","#7c2d12","#0f766e"];
var WHEELS=["five","mesh","steel","dish","off","slim"];
var CPU=[
  {name:"Fiesta ST",body:"hot",s060:6.5,bhp:197,nm:290,clr:1},
  {name:"Golf GTI",body:"hot",s060:6.4,bhp:242,nm:370,clr:1},
  {name:"GR Yaris",body:"hot",s060:5.5,bhp:257,nm:360,clr:1},
  {name:"XC60 D5",body:"suv",s060:7.8,bhp:215,nm:440,clr:3},
  {name:"Defender",body:"off",s060:8.0,bhp:247,nm:570,clr:4},
  {name:"Land Cruiser",body:"off",s060:9.0,bhp:201,nm:430,clr:4},
  {name:"M3",body:"coupe",s060:4.2,bhp:473,nm:550,clr:1},
  {name:"Hilux",body:"off",s060:10.5,bhp:148,nm:400,clr:4}
];
function bodyBy(id){return BODIES.filter(function(b){return b.id===id})[0]||BODIES[4]}
function statsOf(c){
  return {
    name:c.nick||c.name||"You",
    s060:parseFloat(c.s060)||8.5,
    bhp:parseFloat(c.bhp)||150,
    nm:parseFloat(c.nm)||280,
    body:(kit().body),
    colour:kit().colour,
    clr:bodyBy(kit().body).clr
  };
}
function power(c){return Math.max(40,(c.bhp||150)*0.55+(c.nm||200)*0.12)}
function accel(c){return 18/Math.max(3.5,c.s060||8)}
var R={on:false,mode:"drag",t:0,gear:1,rpm:0,nos:0,you:{x:0,v:0,alive:1,stuck:0},cpu:{x:0,v:0,alive:1,stuck:0},len:1200,msg:"",end:0};
function cpuFor(){
  var lv=career().lvl;
  var pool=CPU.slice(0,Math.min(CPU.length,2+lv));
  var c=pool[Math.floor(Math.random()*pool.length)];
  return Object.assign({colour:COLOURS[lv%COLOURS.length]},c);
}
function ground(x,mode){
  if(mode!=="dirt") return 0;
  var h=0;
  h+=Math.sin(x/90)*18;
  h+=Math.sin(x/40)*7;
  if(x>420&&x<520) h+=22;
  if(x>700&&x<820) h-=16;
  if(x>980&&x<1080) h+=10;
  return h;
}
function water(x,mode){return mode==="dirt"&&x>700&&x<820}
function drawCar(ctx,x,y,col,body,flip){
  ctx.save(); ctx.translate(x,y); if(flip) ctx.scale(-1,1);
  ctx.fillStyle=col;
  ctx.beginPath();
  if(body==="off"||body==="suv"){
    ctx.moveTo(-46,8);ctx.lineTo(-40,-10);ctx.lineTo(-12,-22);ctx.lineTo(18,-22);ctx.lineTo(40,-8);ctx.lineTo(48,8);
  } else if(body==="estate"||body==="van"){
    ctx.moveTo(-46,10);ctx.lineTo(-38,-8);ctx.lineTo(-8,-20);ctx.lineTo(28,-20);ctx.lineTo(46,-4);ctx.lineTo(48,10);
  } else if(body==="coupe"||body==="hot"){
    ctx.moveTo(-44,10);ctx.lineTo(-30,-6);ctx.lineTo(-6,-18);ctx.lineTo(16,-16);ctx.lineTo(42,-2);ctx.lineTo(46,10);
  } else {
    ctx.moveTo(-44,10);ctx.lineTo(-34,-8);ctx.lineTo(-8,-18);ctx.lineTo(20,-18);ctx.lineTo(42,-4);ctx.lineTo(46,10);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(180,220,255,.35)";
  ctx.fillRect(-8,-18,22,10);
  ctx.fillStyle="#111";
  var wr=body==="off"?9:7;
  ctx.beginPath(); ctx.arc(-24,12,wr,0,7); ctx.arc(24,12,wr,0,7); ctx.fill();
  ctx.fillStyle="#9aa3b0";
  ctx.beginPath(); ctx.arc(-24,12,wr-3,0,7); ctx.arc(24,12,wr-3,0,7); ctx.fill();
  ctx.restore();
}
function paintTrack(ctx,w,h){
  ctx.clearRect(0,0,w,h);
  var mode=R.mode;
  ctx.fillStyle=mode==="dirt"?"#2a2118":"#1a1d24";
  ctx.fillRect(0,0,w,h);
  var cam=Math.max(0,R.you.x-140);
  ctx.save(); ctx.translate(-cam*(w/R.len)*0.85,0);
  var scale=w/R.len;
  for(var i=0;i<R.len;i+=20){
    var g=ground(i,mode);
    ctx.fillStyle=mode==="dirt"?((water(i,mode))?"#1d4e6b":"#5a4630"):"#3a3f48";
    ctx.fillRect(i*scale, h*0.62-g, 22, h);
  }
  ctx.fillStyle="#e4c48a";
  ctx.fillRect(R.len*scale-8, h*0.2, 4, h*0.5);
  var y0=h*0.58-ground(R.you.x,mode);
  var y1=h*0.72-ground(R.cpu.x,mode);
  drawCar(ctx, R.you.x*scale, y0, kit().colour, kit().body, false);
  drawCar(ctx, R.cpu.x*scale, y1, R.opp.colour||"#8b1e1e", R.opp.body||"hot", false);
  ctx.restore();
  ctx.fillStyle="#f3efe6";
  ctx.font="12px sans-serif";
  ctx.fillText(R.you.name+"  G"+R.gear+(R.nos>0?"  NOS":""),10,18);
  ctx.fillText(R.opp.name,10,34);
  if(R.msg){ctx.fillStyle="#e4c48a";ctx.font="bold 18px sans-serif";ctx.fillText(R.msg,w/2-30,h*0.3)}
}
function tick(dt){
  if(!R.on||R.end) return;
  R.t+=dt;
  function step(car,ai){
    if(!car.alive) return;
    var p=power(car.s)* (car===R.you&&R.nos>0?1.35:1);
    var a=accel(car.s);
    var gMul=car===R.you?(0.55+R.gear*0.18):1;
    if(ai){
      car.v+=a*dt*0.9;
    } else {
      car.v+=a*gMul*dt*(R.rpm>0.35&&R.rpm<0.85?1.15:0.75);
      R.rpm+=dt*(0.35+R.gear*0.08);
      if(R.rpm>1){R.rpm=1; car.v*=0.985}
    }
    if(R.mode==="dirt"){
      var need=water(car.x,R.mode)?3: (ground(car.x,R.mode)>16?3:2);
      if(car.s.clr<need){
        car.v*=0.4;
        if(car.v<4){car.stuck+=dt; if(car.stuck>0.8){car.alive=0; car.v=0}}
      }
      if(water(car.x,R.mode)&&car.s.clr<3&&car.v>28){car.alive=0; car.v=0}
      var slope=(ground(car.x+8,R.mode)-ground(car.x-8,R.mode));
      if(slope<-8 && !ai && R.gear>2){car.v+=dt*18; if(car.v>55&&car.s.clr<3){car.alive=0}}
      if(slope>10) car.v*=0.96;
    }
    car.v=Math.max(0,Math.min(car.v, 42+p*0.04));
    car.x+=car.v*dt*6.5;
    if(R.nos>0 && car===R.you) R.nos-=dt;
  }
  R.you.s=statsOf(me()); R.you.name=R.you.s.name;
  step(R.you,false); step(R.cpu,true);
  if(!R.you.alive){R.end=1;R.on=false;R.msg="Stuck / flooded"; showResult(0); return}
  if(R.you.x>=R.len||R.cpu.x>=R.len){
    R.end=1;R.on=false;
    var win=R.you.x>=R.len && R.you.x>=R.cpu.x;
    R.msg=win?"Win":"Lose";
    showResult(win);
  }
}
var last=0;
function loop(ts){
  if(!last) last=ts;
  var dt=Math.min(0.05,(ts-last)/1000); last=ts;
  tick(dt);
  var cv=el("strip"); if(cv){var ctx=cv.getContext("2d"); paintTrack(ctx,cv.width,cv.height)}
  if(R.on) requestAnimationFrame(loop);
}
function showResult(win){
  var box=el("raceOut"); if(!box) return;
  var cr=career();
  if(win){cr.wins++; if(cr.wins%2===0) cr.lvl=Math.min(12,cr.lvl+1); saveCareer(cr)}
  box.innerHTML="<div class='win'><h3>"+(win?"You take the strip":"They got there first")+"</h3><p>"+R.you.name+" vs "+R.opp.name+" · Level "+cr.lvl+" · "+cr.wins+" wins</p><p class='copy'>"+(R.you.alive?"":"Ground clearance or water stopped you. An off-roader laughs at this.")+"</p></div>";
}
function start(mode){
  R={on:false,mode:mode||"drag",t:0,gear:1,rpm:0.2,nos:0,you:{x:8,v:0,alive:1,stuck:0,s:statsOf(me())},cpu:{x:8,v:0,alive:1,stuck:0,s:{}},len:mode==="dirt"?1100:1000,msg:"3",end:0,opp:cpuFor()};
  R.you.name=R.you.s.name;
  R.cpu.s=R.opp; R.cpu.name=R.opp.name;
  el("raceOut").innerHTML="";
  var n=3;
  function cd(){
    R.msg=n?String(n):"GO";
    var cv=el("strip"); if(cv) paintTrack(cv.getContext("2d"),cv.width,cv.height);
    if(n===0){R.on=true;R.msg=""; last=0; requestAnimationFrame(loop); return}
    n--; setTimeout(cd,500);
  }
  cd();
}
function showRace(){
  if(el("garageView")) el("garageView").className="wrap hide";
  if(el("gameView")) el("gameView").className="wrap hide";
  if(el("jobsView")) el("jobsView").className="wrap hide";
  if(el("raceView")) el("raceView").className="wrap";
  drawKit();
  var cv=el("strip"); if(cv){cv.width=cv.clientWidth||320; cv.height=180; R.opp=cpuFor(); R.you={x:40,v:0,alive:1,stuck:0,s:statsOf(me()),name:statsOf(me()).name}; R.cpu={x:40,v:0,alive:1,s:R.opp}; paintTrack(cv.getContext("2d"),cv.width,cv.height)}
}
function hideRace(){
  if(el("raceView")) el("raceView").className="wrap hide";
  if(el("garageView")) el("garageView").className="wrap";
  R.on=false;
}
function drawKit(){
  var k=kit();
  if(el("bodyPick")) el("bodyPick").value=k.body;
  if(el("wheelPick")) el("wheelPick").value=k.wheel;
  if(el("colourPick")) el("colourPick").value=k.colour;
  var cr=career();
  if(el("careerLine")) el("careerLine").textContent="Level "+cr.lvl+" · "+cr.wins+" wins vs the house";
}
function bind(){
  if(!el("raceView")) return;
  if(el("btnRace")) el("btnRace").addEventListener("click",showRace);
  if(el("btnRaceBack")) el("btnRaceBack").addEventListener("click",hideRace);
  if(el("btnDrag")) el("btnDrag").addEventListener("click",function(){start("drag")});
  if(el("btnDirt")) el("btnDirt").addEventListener("click",function(){start("dirt")});
  if(el("btnShift")) el("btnShift").addEventListener("click",function(){
    if(!R.on) return;
    if(R.rpm>0.45&&R.rpm<0.82){R.gear=Math.min(5,R.gear+1); R.rpm=0.28}
    else {R.rpm=Math.max(0.15,R.rpm-0.2); R.you.v*=0.92}
  });
  if(el("btnNos")) el("btnNos").addEventListener("click",function(){ if(R.on&&R.nos<=0) R.nos=1.15; });
  if(el("btnDown")) el("btnDown").addEventListener("click",function(){
    if(!R.on) return; R.gear=Math.max(1,R.gear-1); R.rpm=0.4; R.you.v*=0.88;
  });
  ["bodyPick","wheelPick","colourPick"].forEach(function(id){
    if(!el(id)) return;
    el(id).addEventListener("change",function(){
      var k=kit(); k.body=el("bodyPick").value; k.wheel=el("wheelPick").value; k.colour=el("colourPick").value; saveKit(k); showRace();
    });
  });
}
bind();
})();
