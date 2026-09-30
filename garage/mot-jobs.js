window.MOT_JOB_MAP=[
  {id:"tyres4",keys:/\btyre|\btire|tread|tyres\b/i},
  {id:"fpads",keys:/brake (pad|disc)|pads worn|discs worn|brake lining/i},
  {id:"caliper",keys:/caliper|seized brake/i},
  {id:"damp",keys:/shock absorber|damper|suspension unit leaking/i},
  {id:"spring",keys:/coil spring|broken spring/i},
  {id:"wishbone",keys:/wishbone|lower arm|suspension arm/i},
  {id:"bush",keys:/bush worn|bushes worn|control arm bush|subframe mount/i},
  {id:"balljoint",keys:/ball joint/i},
  {id:"drop",keys:/anti-roll|drop link|anti roll/i},
  {id:"track",keys:/track rod|tie rod|track-rod/i},
  {id:"bearing",keys:/wheel bearing|hub bearing/i},
  {id:"cvboot",keys:/cv boot|gaiter|constant velocity/i},
  {id:"shaft",keys:/drive shaft|driveshaft/i},
  {id:"exhaust",keys:/exhaust (system|pipe)|silencer|back box|corroded exhaust/i},
  {id:"cat",keys:/catalytic converter|catalyst/i},
  {id:"dpfr",keys:/particulate filter|\bdpf\b/i},
  {id:"windscreen",keys:/windscreen|windshield damaged|zone a/i},
  {id:"headlight",keys:/headlamp|headlight aim|headlamp insecure/i},
  {id:"sill",keys:/sill corroded|prescribed area.*sill|chassis corroded/i},
  {id:"seatbelt",keys:/seat belt|seatbelt/i}
];
window.motJobEstimate=function(id){
  var list=window.WORK||[],i,j=null;
  for(i=0;i<list.length;i++) if(list[i].id===id) j=list[i];
  if(!j) return null;
  var lo=Math.round(j.hrs*70+j.plo);
  var hi=Math.round(j.hrs*70+j.phi);
  return {name:j.name,lo:lo,hi:hi,hrs:j.hrs};
};
window.classifyMotJobs=function(tests){
  var cut=new Date(); cut.setFullYear(cut.getFullYear()-5);
  var seen={},out=[],i,t,list,x,text,date,typ;
  function defectsOf(tt){return tt.defects||tt.rfrAndComments||tt.rfrAndComment||[]}
  function textOf(d){return d.text||d.comment||d.failureText||""}
  function typeOf(d){return String(d.type||"").toUpperCase()}
  function isSerious(d,result){
    var t=typeOf(d);
    if(/DANGEROUS|MAJOR|FAIL|PRS/.test(t)) return true;
    if(d.dangerous===true) return true;
    if(/FAIL/i.test(result||"")) return true;
    return false;
  }
  function matchJob(s){
    var k,m;
    for(k=0;k<window.MOT_JOB_MAP.length;k++){
      m=window.MOT_JOB_MAP[k];
      if(m.keys.test(s)) return m.id;
    }
    return null;
  }
  for(i=0;i<(tests||[]).length;i++){
    t=tests[i];
    date=(t.completedDate||t.completeddate||"").slice(0,10);
    if(date && new Date(date+"T12:00:00")<cut) continue;
    list=defectsOf(t);
    for(var n=0;n<list.length;n++){
      x=list[n];
      if(!isSerious(x,t.testResult||t.testresult)) continue;
      text=textOf(x);
      var id=matchJob(text);
      if(!id||seen[id]) continue;
      seen[id]=true;
      typ=typeOf(x)||"FAIL";
      var est=window.motJobEstimate(id);
      out.push({id:id,date:date,text:text,type:typ,est:est});
    }
  }
  return out;
};
window.paintMotJobs=function(tests){
  var box=document.getElementById("motJobs");
  var count=document.getElementById("motJobCount");
  if(!box) return;
  var jobs=window.classifyMotJobs(tests);
  if(count) count.textContent=jobs.length?String(jobs.length):"0";
  if(!jobs.length){
    box.innerHTML="<p class='muted'>No costly fail items in the last five years that we can match to tyres, brakes, suspension and similar.</p>";
    return;
  }
  var totalLo=0,totalHi=0;
  box.innerHTML="<p class='muted'>Items that failed or were marked major / dangerous in the last five years. They are usually put right to pass the retest. Figures are today’s independent-garage estimates, not what was paid then.</p>"+jobs.map(function(j){
    var price=j.est?("Indie estimate now £"+j.est.lo+"–£"+j.est.hi):"See Service costs";
    if(j.est){totalLo+=j.est.lo;totalHi+=j.est.hi}
    return "<div class='fault'><button type='button' class='faultBtn'><span class='tag med'>"+(j.est?j.est.name:"Job")+"</span>"+j.date+"</button><div class='more'><p>"+j.text+"</p><p><b>"+price+"</b></p><p class='muted'>Not proof of a receipt — proof it had to be dealt with to pass.</p><a class='btn grey' href='service.html?job="+encodeURIComponent(j.id)+"'>Open estimate</a></div></div>";
  }).join("")+"<p class='muted'>If all of these were done at a local garage today, ballpark £"+totalLo+"–£"+totalHi+".</p>";
};
