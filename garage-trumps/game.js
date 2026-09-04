(function(){
function el(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function kn(c){return (c&&(c.nick||c.name))||"Car"}
function num(v){var n=parseFloat(v);return isFinite(n)?n:0}
function garage(){try{var s=JSON.parse(localStorage.getItem("gt.garage")||"null");if(s&&s.cars&&s.cars.length)return s}catch(e){}return {i:0,cars:[{}]}}
function me(){var s=garage();return s.cars[s.i]||s.cars[0]||{}}
function storedRival(){try{var r=JSON.parse(localStorage.getItem("gt.rival")||"null");if(r&&r.name&&!/friend's car details/i.test(r.name))return r}catch(e){}return null}
var HOUSE=[
  {name:"House GR Yaris",s060:"5.5",bhp:"257",nm:"360",boot:"174",mpg:"34",mph:"143",tank:"50"},
  {name:"House Golf GTI",s060:"6.4",bhp:"242",nm:"370",boot:"380",mpg:"38",mph:"155",tank:"50"},
  {name:"House XC60 D5",s060:"7.8",bhp:"215",nm:"440",boot:"495",mpg:"44",mph:"130",tank:"70"},
  {name:"House Fiesta ST",s060:"6.5",bhp:"197",nm:"290",boot:"292",mpg:"40",mph:"144",tank:"42"}
];
function hash(s){var h=0;s=String(s);for(var i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i)|0;return h}
function them(){return storedRival()||HOUSE[Math.abs(hash(kn(me())))%HOUSE.length]}
function plateBox(p){p=String(p||"").toUpperCase().replace(/\s+/g," ").trim();return "<div class='platebox"+(p?"":" empty")+"'><span class='gb'>UK</span><span class='reg'>"+esc(p||"YOUR REG")+"</span></div>"}
function shot(c){return c.photo?("<img src='"+c.photo+"' alt=''/>"):"<div class='addshot'>No photo</div>"}
var STATS=[
  {k:"s060",label:"0-60",unit:"s",low:1},
  {k:"bhp",label:"BHP",unit:"",low:0},
  {k:"nm",label:"Torque",unit:"Nm",low:0},
  {k:"mph",label:"Top speed",unit:"mph",low:0},
  {k:"mpg",label:"UK MPG",unit:"",low:0},
  {k:"boot",label:"Boot",unit:"L",low:0},
  {k:"tank",label:"Tank",unit:"L",low:0}
];
function val(c,k){return num(c[k])}
function flavour(name){
  var n=String(name||"").toLowerCase();
  if(/volvo/.test(n)) return "Volvo invented the three-point belt. Safety takes a lap of honour.";
  if(/gr yaris|yaris gr/.test(n)) return "Toyota built a rally car and parked it next to the shopping trolley.";
  if(/yaris|aygo/.test(n)) return "Toyota reliability. The car will outlive the argument.";
  if(/bmw/.test(n)) return "BMW. The indicator is folklore. The car is not.";
  if(/audi/.test(n)) return "Audi. Quietly judging the outside lane.";
  if(/mercedes|merc /.test(n)) return "Mercedes. Late, still in charge.";
  if(/skoda/.test(n)) return "Skoda. The punchline that started winning.";
  if(/vauxhall|corsa|astra/.test(n)) return "Vauxhall. Britain default setting.";
  if(/ford|fiesta|focus/.test(n)) return "Ford. Has seen things.";
  if(/vw|volkswagen|golf/.test(n)) return "VW. Sensible until somebody ticked GTI.";
  if(/honda|civic|integra/.test(n)) return "Honda. Engine wants a track. Owner wants Tesco.";
  if(/nissan|skyline|gtr|qashqai/.test(n)) return "Nissan. Family taxi or a rumour with wheels.";
  if(/land rover|range rover|defender/.test(n)) return "Land Rover. Built for a farm. Lives on a school run.";
  if(/mini/.test(n)) return "Mini. Small car, large personality.";
  if(/tesla/.test(n)) return "Tesla. Silent until the software update.";
  if(/toyota/.test(n)) return "Toyota. Still starting in 2041.";
  return "A car with opinions. Some of them mechanical.";
}
var TWISTS=[
  {t:"M6 at 07:12. Rain, spray, lorries doing 58 forever.",k:"mpg",low:0,w:"just keeps sipping and humming.",l:"is already planning the next services like a pilgrimage."},
  {t:"Last orders. Pub car park. Lights going off.",k:"s060",low:1,w:"is first to the door and somehow still legal.",l:"is still finding first while the bolts are sliding."},
  {t:"German services. No cameras. A rumour of no limit.",k:"mph",low:0,w:"settles at a number that would scare a parish council.",l:"has already peaked and is now a moving speed bump."},
  {t:"Ikea Saturday. Two Billy bookcases and a child.",k:"boot",low:0,w:"does it in one smug trip.",l:"needs a second run and a silent argument."},
  {t:"Flooded lane. Water over the sills. Pride on the line.",k:"nm",low:0,w:"wades through like it was designed by a farmer.",l:"is now a very expensive island."},
  {t:"Empty tank light. Next garage is 18 miles of nothing.",k:"mpg",low:0,w:"treats 18 miles as a warm-up.",l:"starts doing maths out loud."},
  {t:"Short slip road. A van has ideas.",k:"bhp",low:0,w:"arrives in a gap that did not exist.",l:"becomes scenery."},
  {t:"Four lads, wet weekend, Wales, one cool box.",k:"boot",low:0,w:"is basically a pub with number plates.",l:"makes someone sit with the tent poles."},
  {t:"Height barrier and a slightly too-bold exit.",k:"boot",low:1,w:"ducks under like it lives there.",l:"leaves a souvenir stripe on the roof."},
  {t:"B-road, crest, blind, a tractor in folklore.",k:"nm",low:0,w:"pulls past and never mentions it.",l:"joins the tractor as emotional support."},
  {t:"Tesco at 21:50. One space left and it is tight.",k:"boot",low:1,w:"slots in first time, radio still on.",l:"does the seven-point turn everyone pretends not to watch."},
  {t:"The brief is simple: do not be embarrassing.",k:"mpg",low:0,w:"looks like it has a pension and a plan.",l:"looks like a decision made at midnight on AutoTrader."},
  {t:"Snow on the tops. Gritters have given up.",k:"nm",low:0,w:"digs in and keeps the lights pointing forward.",l:"is now a very stylish sledge."},
  {t:"Drag to the next lights. Nobody asked for this.",k:"s060",low:1,w:"has already left. The lights are still thinking.",l:"hears a noise that might be its own dignity."},
  {t:"Cross-country. 200 miles, four people, one charger of goodwill.",k:"mpg",low:0,w:"arrives with fuel and friendships intact.",l:"arrives second, poorer, and slightly quieter."},
  {t:"Car-boot Sunday. You said you would only look.",k:"boot",low:0,w:"swallows a Welsh dresser without comment.",l:"can take the vase or the pride, not both."},
  {t:"Overnight ferry queue. Wind off the Irish Sea.",k:"mpg",low:0,w:"idles like it is meditating.",l:"is costing a pound a minute in vibes alone."},
  {t:"Single-track Highland road. A coach is coming.",k:"boot",low:1,w:"reverses into a passing place like a local.",l:"becomes a tourist attraction, unhelpfully."},
  {t:"Ring road, three lanes, everyone late.",k:"bhp",low:0,w:"owns the merge.",l:"collects indicators it will never use."},
  {t:"Camping. Roof box was a lie.",k:"boot",low:0,w:"fits the tent, the dog and the quiet sense of victory.",l:"is now a very expensive trailer, minus the trailer."},
  {t:"Black ice. The roundabout is a suggestion.",k:"nm",low:0,w:"puts the power down like it has done this.",l:"writes a small circle in the frost."},
  {t:"Airport run. 04:40. One suitcase that multiplied.",k:"boot",low:0,w:"closes the lid on the first try.",l:"is doing Tetris with a passport."},
  {t:"Coast road. Hairpins and a view you should not look at.",k:"nm",low:0,w:"pulls out of corners like it is on rails.",l:"apologises to the hedge."},
  {t:"Retail park. The space is technically a space.",k:"boot",low:1,w:"parks as if it trained.",l:"will be there a while."},
  {t:"Track day fantasy. One hot lap in the head.",k:"s060",low:1,w:"has already bragged in the pits.",l:"is still finding the right YouTube guide."},
  {t:"School run diplomacy. Space, patience, dignity.",k:"boot",low:0,w:"swallows book bags and still looks calm.",l:"has a flute case on the dashboard."},
  {t:"Motorway roadworks. Fifty for nine miles.",k:"mpg",low:0,w:"turns it into a saving.",l:"turns it into a mood."},
  {t:"Wet grass field after a festival.",k:"nm",low:0,w:"walks out like it paid for a ticket to leave.",l:"is accepting help from a man in a hi-vis."},
  {t:"A-road overtakes. Safe, clean, done.",k:"bhp",low:0,w:"is past before the thought has finished.",l:"waits for a longer straight that never comes."},
  {t:"Icy supermarket. Trolleys have unionised.",k:"boot",low:1,w:"slips into a gap and pretends it was easy.",l:"takes a trolley to the door, emotionally."}
];
var st={n:5,i:0,a:0,b:0,log:[],house:null};
function cards(){return {a:me(),b:st.house||them()}}
function compare(stat,a,b){
  var va=val(a,stat.k), vb=val(b,stat.k), aw, bw;
  if(stat.low){aw=va>0&&(vb<=0||va<vb);bw=vb>0&&(va<=0||vb<va)}
  else {aw=va>vb;bw=vb>va}
  return {va:va,vb:vb,aw:aw,bw:bw,draw:!aw&&!bw};
}
function roast(winCar,loseCar,w,l){
  return "<b>"+esc(kn(winCar))+" "+esc(w)+"</b><p>"+esc(kn(loseCar))+" "+esc(l)+"</p><p class='flv'>"+esc(flavour(kn(winCar)))+"</p>";
}
function tcard(c,mine){
  var rows=STATS.map(function(s){
    var v=c[s.k];
    var show=(v===""||v==null)?"-":(v+(s.unit?(" "+s.unit):""));
    return "<button type='button' class='srow' data-stat='"+s.k+"'><span>"+s.label+"</span><b>"+esc(show)+"</b></button>";
  }).join("");
  return "<article class='tcard"+(mine?" mine":"")+"'><div class='thero'>"+shot(c)+plateBox(c.plate)+"</div><header><small>"+(mine?"You":"Rival")+"</small><h3>"+esc(kn(c))+"</h3></header><div class='srows'>"+rows+"</div></article>";
}
function board(){
  var c=cards();
  return "<div class='scoreline'><span>"+esc(kn(c.a))+" <b>"+st.a+"</b></span><i>Rd "+Math.min(st.i+1,st.n)+" / "+st.n+"</i><span><b>"+st.b+"</b> "+esc(kn(c.b))+"</span></div>";
}
function renderIdle(msg){
  var box=el("arena"); if(!box) return;
  var c=cards();
  box.innerHTML=board()+"<div class='duel'>"+tcard(c.a,true)+"<div class='vs'>VS</div>"+tcard(c.b,false)+"</div>"+(msg?("<div class='roast'>"+msg+"</div>"):"<p class='copy'>Tap a stat on your card. Or Twist for a random UK scenario.</p>");
}
function finish(){
  var c=cards();
  var winner=st.a>st.b?c.a:st.b>st.a?c.b:null;
  var title=winner?kn(winner)+" takes the table":"Honours even.";
  var trip=st.log.length?("<ol class='trip'>"+st.log.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+"</ol>"):"";
  el("arena").innerHTML=board()+"<div class='roast winend'><h3>"+esc(title)+"</h3><p>"+st.a+" — "+st.b+"</p>"+trip+(winner?("<p class='flv'>"+esc(flavour(kn(winner)))+"</p>"):"")+"</div>";
}
function playStat(key,twist){
  if(st.i>=st.n){finish();return}
  var base=STATS.filter(function(s){return s.k===key})[0]||STATS[1];
  var stat={k:key,label:base.label,low:twist&&typeof twist.low==="number"?twist.low:base.low};
  var c=cards();
  var r=compare(stat,c.a,c.b);
  var line=(twist&&twist.t)||(stat.label+" called");
  var ww=(twist&&twist.w)||"takes it clean.";
  var ll=(twist&&twist.l)||"can sit this one out.";
  var html;
  if(r.draw){
    html="<div class='hint'>Round "+(st.i+1)+"</div><h3>"+esc(line)+"</h3><p>"+esc(stat.label)+": "+r.va+" vs "+r.vb+". Dead heat.</p>";
    st.log.push(line+" — draw");
  }else if(r.aw){
    st.a+=3;st.b+=1;
    html="<div class='hint'>Round "+(st.i+1)+" · "+esc(stat.label)+" "+r.va+" beats "+r.vb+"</div><h3>"+esc(line)+"</h3>"+roast(c.a,c.b,ww,ll);
    st.log.push(line+" — "+kn(c.a));
  }else{
    st.b+=3;st.a+=1;
    html="<div class='hint'>Round "+(st.i+1)+" · "+esc(stat.label)+" "+r.vb+" beats "+r.va+"</div><h3>"+esc(line)+"</h3>"+roast(c.b,c.a,ww,ll);
    st.log.push(line+" — "+kn(c.b));
  }
  st.i++;
  renderIdle("<div class='win'>"+html+"</div>");
  if(st.i>=st.n) setTimeout(finish,800);
}
function twist(){
  var job=TWISTS[Math.floor(Math.random()*TWISTS.length)];
  playStat(job.k,job);
}
function reset(){
  st={n:+((el("rounds")&&el("rounds").value)||5),i:0,a:0,b:0,log:[],house:storedRival()?null:HOUSE[Math.floor(Math.random()*HOUSE.length)]};
  renderIdle("");
}
function fresh(id,fn){
  var n=el(id); if(!n||!n.parentNode) return;
  var x=n.cloneNode(true); n.parentNode.replaceChild(x,n); x.addEventListener("click",fn);
}
function bind(){
  var arena=el("arena"); if(!arena) return;
  arena.addEventListener("click",function(e){
    var b=e.target.closest("[data-stat]");
    if(!b||!b.closest(".mine")) return;
    if(st.i>=st.n){reset();return}
    playStat(b.getAttribute("data-stat"));
  });
  fresh("btnDeal",function(){ if(st.i>=st.n) reset(); else twist(); });
  fresh("btnRecap",function(){ finish(); });
  if(el("btnGame")) el("btnGame").addEventListener("click",function(){setTimeout(reset,40)});
  if(el("rounds")) el("rounds").addEventListener("change",reset);
}
bind();
})();
