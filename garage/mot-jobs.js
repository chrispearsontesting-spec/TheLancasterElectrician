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
  function defectsOf(tt){return tt.defects||tt.rfrAndComments||tt.rfrAndComment||[]}
  function textOf(d){return d.text||d.comment||d.failureText||""}
  function typeOf(d){return String(d.type||d.dangerous||"").toUpperCase()}
  function dateOf(t){return (t.completedDate||t.completeddate||"").slice(0,10)}
  function isMajor(d){
    var t=typeOf(d);
    if(/ADVISORY|MINOR|PRS/.test(t) && !/DANGEROUS|MAJOR/.test(t)) return false;
    if(/DANGEROUS|MAJOR|FAIL|FAILURE/.test(t)) return true;
    if(d.dangerous===true || d.dangerous==="true") return true;
    return false;
  }
  function isAdvisory(d){
    var t=typeOf(d);
    return /ADVISORY|MINOR/.test(t) && !isMajor(d);
  }
  function matchJob(s){
    var k,m;
    for(k=0;k<window.MOT_JOB_MAP.length;k++){
      m=window.MOT_JOB_MAP[k];
      if(m.keys.test(s)) return m.id;
    }
    return null;
  }
  var rows=(tests||[]).slice().sort(function(a,b){return dateOf(b).localeCompare(dateOf(a))});
  if(!rows.length) return {done:[],check:[]};
  var latest=dateOf(rows[0]);
  var yearAgo=new Date(); yearAgo.setFullYear(yearAgo.getFullYear()-1);
  var yearCut=yearAgo.toISOString().slice(0,10);
  var five=new Date(); five.setFullYear(five.getFullYear()-5);
  var fiveCut=five.toISOString().slice(0,10);
  var byId={};
  rows.forEach(function(t){
    var date=dateOf(t);
    if(!date||date<fiveCut) return;
    defectsOf(t).forEach(function(d){
      var id=matchJob(textOf(d));
      if(!id) return;
      if(!byId[id]) byId[id]={id:id,dates:[],majors:[],advisories:[],texts:{}};
      var row=byId[id];
      row.dates.push(date);
      if(isMajor(d)) row.majors.push(date);
      if(isAdvisory(d)) row.advisories.push(date);
      row.texts[date]=textOf(d);
      row.est=window.motJobEstimate(id);
    });
  });
  var done=[],check=[],id,row,lastMajor,laterPass;
  function laterPassed(afterDate){
    return rows.some(function(t){
      var d=dateOf(t);
      var res=String(t.testResult||t.testresult||"");
      return d>afterDate && /PASS/i.test(res);
    });
  }
  for(id in byId){
    row=byId[id];
    lastMajor=row.majors.sort().slice(-1)[0];
    if(lastMajor && lastMajor<latest && laterPassed(lastMajor)){
      done.push({id:id,date:lastMajor,text:row.texts[lastMajor]||"",est:row.est,kind:"done"});
    } else {
      var lastAdv=row.advisories.sort().slice(-1)[0];
      var recent=lastMajor && lastMajor>=yearCut;
      var recentAdv=lastAdv && lastAdv>=yearCut;
      if(recent || recentAdv || (lastMajor && lastMajor===latest)){
        check.push({
          id:id,
          date:lastMajor||lastAdv,
          text:row.texts[lastMajor||lastAdv]||"",
          est:row.est,
          kind: lastMajor && lastMajor===latest ? "open-major" : "advisory"
        });
      }
    }
  }
  return {done:done,check:check};
};
function jobRow(j,tag,tagClass,note){
  var price=j.est?("Indie estimate £"+j.est.lo+"–£"+j.est.hi):"See Service costs";
  return "<div class='fault'><button type='button' class='faultBtn'><span class='tag "+tagClass+"'>"+tag+"</span>"+(j.est?j.est.name:"Job")+" · "+j.date+"</button><div class='more'><p>"+j.text+"</p><p><b>"+price+"</b></p><p class='muted'>"+note+"</p><a class='btn grey' href='service.html?job="+encodeURIComponent(j.id)+"'>Open estimate</a></div></div>";
}
window.paintMotJobs=function(tests){
  var box=document.getElementById("motJobs");
  var count=document.getElementById("motJobCount");
  if(!box) return;
  var split=window.classifyMotJobs(tests);
  var done=split.done||[], check=split.check||[];
  if(count) count.textContent=String(done.length+check.length);
  if(!done.length && !check.length){
    box.innerHTML="<p class='muted'>No priced MOT items in the last five years.</p>";
    return;
  }
  var html="";
  var totalLo=0,totalHi=0,i;
  if(check.length){
    html+="<p class='muted'><b>Check these</b> — advisory or still open on the latest MOT. Do not assume they have been done.</p>";
    for(i=0;i<check.length;i++){
      html+=jobRow(check[i], check[i].kind==="open-major"?"Still open":"Check", check[i].kind==="open-major"?"high":"med",
        "Ask to see it done, or budget to do it yourself.");
    }
  }
  if(done.length){
    html+="<p class='muted'><b>Likely already done</b> — major / dangerous fail, then a later pass. Still an estimate, not a receipt.</p>";
    for(i=0;i<done.length;i++){
      if(done[i].est){totalLo+=done[i].est.lo;totalHi+=done[i].est.hi}
      html+=jobRow(done[i],"Likely done","low","Needed a pass after this fail.");
    }
    html+="<p><b>Work that looks already paid for, at today’s prices: £"+totalLo+"–£"+totalHi+".</b></p>";
  }
  box.innerHTML=html;
};
