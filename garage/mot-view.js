window.paintMotView=function(tests, year){
  tests=tests||[];
  function $(id){return document.getElementById(id)}
  function defects(t){return t.defects||t.rfrAndComments||t.rfrAndComment||[]}
  function textOf(x){return x.text||x.comment||""}
  function typeOf(x){return String(x.type||"").toUpperCase()}
  function isMajor(x){return /DANGEROUS|MAJOR|FAIL|PRS/.test(typeOf(x))}
  function yearOf(t){return (t.completedDate||"").slice(0,4)}
  function ukDate(s){var p=String(s||"").slice(0,10).split("-");return p.length<3?s:p[2]+"/"+p[1]+"/"+p[0]}
  function miles(n){var x=String(n||"").replace(/[^0-9]/g,"");return x?x.replace(/\B(?=(\d{3})+(?!\d))/g,","):""}
  var hist=$("hist")||$("motBox");
  if(!hist) return;
  if(!tests.length){hist.innerHTML="<p class='muted'>No tests returned.</p>";if($("work"))$("work").innerHTML="";if($("future"))$("future").innerHTML="";return}
  hist.innerHTML=tests.slice(0,16).map(function(t){
    var result=t.testResult||"", date=ukDate(t.completedDate);
    var milesTxt=t.odometerValue?(" · "+miles(t.odometerValue)+" mi"):"";
    var list=defects(t).map(function(x){return "<p class='muted'>"+textOf(x)+"</p>"}).join("");
    return "<div class='row'><div><b>"+date+milesTxt+"</b>"+(list||"<p class='muted'>No defects listed.</p>")+"</div><span class='tag "+(/FAIL/i.test(result)?"fail":"pass")+"'>"+(/FAIL/i.test(result)?"Fail":"Pass")+"</span></div>";
  }).join("");
  var cut=new Date().getFullYear()-5, jobs=[];
  tests.forEach(function(t){
    if(+yearOf(t)<cut) return;
    defects(t).forEach(function(x){ if(isMajor(x)) jobs.push({date:ukDate(t.completedDate), text:textOf(x)}); });
  });
  if($("work")) $("work").innerHTML=jobs.length?jobs.map(function(j){return "<div class='row'><div><b>"+j.date+"</b><p class='muted'>"+j.text+"</p></div><span class='tag fail'>Had to be fixed</span></div>"}).join("")+"<p class='muted'>A current MOT means these fails were put right.</p>":"<p class='muted'>No major fails in the last five years.</p>";
  var latest=tests[0]||{}, milesNow=parseInt(String(latest.odometerValue||"").replace(/[^0-9]/g,""),10)||0;
  var firstYear=+(tests[tests.length-1].completedDate||"").slice(0,4)||new Date().getFullYear();
  var age=year?new Date().getFullYear()-year:new Date().getFullYear()-firstYear;
  function lastHit(re){
    var i,j,list;
    for(i=0;i<tests.length;i++){
      list=defects(tests[i]);
      for(j=0;j<list.length;j++) if(re.test(textOf(list[j]).toLowerCase())) return {date:ukDate(tests[i].completedDate), major:isMajor(list[j]), text:textOf(list[j])};
    }
    return null;
  }
  function line(title, life, cost, hit, soon){
    var state=soon?"Due soon":"Plan for", note=life;
    if(hit&&hit.major){state="Seen in a fail";note="Last recorded "+hit.date+". A fail usually means it was put right. "+life}
    else if(hit){state="Advised";note="MOT said: "+hit.text+". "+life}
    return "<div class='row'><div><b>"+title+"</b><p class='muted'>"+state+". "+note+" Guide "+cost+".</p></div></div>";
  }
  if($("future")){
    var tyre=lastHit(/tyre/), brake=lastHit(/brake/), sus=lastHit(/suspension|spring|arm|bush/), exh=lastHit(/exhaust|corrosion/);
    $("future").innerHTML=[
      line("Tyres","A set often lasts 20,000 to 30,000 miles, or about five years.","£250 to £500",tyre,!!(tyre&&!tyre.major)||age>=6),
      line("Brakes","Pads are often 25,000 to 40,000 miles. Discs last longer.","£150 to £350 an axle",brake,!!(brake&&!brake.major)),
      line("Suspension","Bushes, arms and springs commonly need attention after 60,000 miles or eight to ten years.","£150 to £400 a corner",sus,age>=8||!!(sus&&!sus.major)),
      line("Exhaust","A section often lasts eight to twelve years.","£150 to £400",exh,age>=8||!!(exh&&!exh.major)),
      line("Service","Due every year, or 10,000 to 12,000 miles.","£150 to £300",null,true),
      line("Timing belt","Many belts are five years or 60,000 to 100,000 miles. A chain has no set date.","£400 to £900 if it is a belt",null,age>=5||milesNow>80000)
    ].join("")+"<p class='muted'>"+(milesNow?miles(milesNow)+" miles on the latest test. ":"")+"About "+age+" years on record. Typical life, not a quote.</p>";
  }
  var n=$("motHistCount"); if(n) n.textContent=String(tests.length||"");
};
window.showMotTab=function(which){
  ["hist","work","future"].forEach(function(id){var el=document.getElementById(id); if(el) el.className=id===which?"":"hide"});
  ["tabHist","tabWork","tabFuture"].forEach(function(id,i){var el=document.getElementById(id); if(el) el.className=(["hist","work","future"][i]===which?"on":"")});
};
