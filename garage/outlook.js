/* Reliability & cost outlook for Buying guide / MOT Future costs. Estimate only. */
(function(root){
  var TYPICAL_YEARS=14, TYPICAL_MILES=160000;
  var BASE=[
    {k:["lexus","toyota"],n:12,lab:"This make tends to stay reliable"},
    {k:["honda","mazda","suzuki"],n:10,lab:"This make tends to stay reliable"},
    {k:["hyundai","kia","subaru"],n:7,lab:"This make has a solid reliability record"},
    {k:["volvo","skoda"],n:5,lab:"This make is usually mid-pack for running costs"},
    {k:["ford","volkswagen","vw","nissan","seat","dacia"],n:3,lab:"Typical reliability for a common UK model"},
    {k:["bmw","mercedes","audi","mini"],n:0,lab:"Upkeep on this make can be pricier than average"},
    {k:["vauxhall","opel","peugeot","citroen","citroën","renault","fiat"],n:-3,lab:"This make can be costlier to keep in later life"},
    {k:["land rover","range rover","jaguar","alfa"],n:-8,lab:"This make is often costlier to keep reliable"}
  ];
  var BIG=[
    {id:"belt",name:"Cambelt",re:/timing belt|cambelt|cam belt|toothed belt/i,due:function(a,m){return a>=5||m>=80000},boost:8,miss:-8},
    {id:"chain",name:"Timing chain",re:/timing chain|cam chain/i,due:function(){return false},boost:6,miss:0},
    {id:"clutch",name:"Clutch",re:/\bclutch\b/i,due:function(a,m){return m>=90000},boost:6,miss:-4},
    {id:"brakes",name:"Brakes / discs",re:/brake (pad|disc)|pads worn|discs worn|brake lining/i,due:function(){return false},boost:5,miss:-3},
    {id:"tyres",name:"Tyres",re:/\btyre|\btire|tread/i,due:function(){return false},boost:4,miss:-3},
    {id:"arms",name:"Suspension arms",re:/wishbone|lower arm|suspension arm|control arm/i,due:function(a,m){return a>=8||m>=80000},boost:5,miss:-4},
    {id:"exhaust",name:"Exhaust",re:/exhaust|silencer|back box/i,due:function(a){return a>=8},boost:4,miss:-3},
    {id:"dpf",name:"DPF",re:/particulate filter|\bdpf\b/i,due:function(a,m,fuel){return /diesel/i.test(fuel||"")&&m>=80000},boost:6,miss:-6}
  ];

  function esc(s){return String(s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];});}
  function defects(t){return (t&&(t.defects||t.rfrAndComments||t.rfrAndComment))||[];}
  function textOf(x){return x&&(x.text||x.comment||x.failureText)||"";}
  function typeOf(x){return String((x&&(x.type||x.dangerous))||"").toUpperCase();}
  function isFailResult(t){return /FAIL/i.test(String((t&&(t.testResult||t.testresult))||""));}
  function isMajor(x){var t=typeOf(x);return /DANGEROUS|MAJOR|FAIL|PRS/.test(t)||x&&(x.dangerous===true||x.dangerous==="true");}
  function isAdvisory(x){return /ADVISORY|MINOR/.test(typeOf(x))&&!isMajor(x);}
  function dateOf(t){return String((t&&(t.completedDate||t.testDate||t.completeddate))||"").slice(0,10);}
  function milesOf(t){return parseInt(String((t&&(t.odometerValue||t.odometerReading))||"").replace(/[^0-9]/g,""),10)||0;}
  function unitOf(t){return /km/i.test(String((t&&t.odometerUnit)||"mi"))?"km":"mi";}
  function asMiles(n,u){return u==="km"?Math.round(n*0.621371):n;}
  function chrono(tests){return (tests||[]).slice().sort(function(a,b){return dateOf(a).localeCompare(dateOf(b));});}
  function hay(input){return [input.make,input.model,input.name,input.engine,input.fuel].map(function(x){return String(x||"").toLowerCase();}).join(" ");}
  function blob(t){return defects(t).map(textOf).join(" ").toLowerCase();}

  function baseline(input){
    var h=hay(input), i, j, pack=null, highs=0, lows=0;
    var faults=root.FAULTS||[];
    for(i=0;i<faults.length;i++){
      var k=faults[i].k||[];
      if(!k.length) continue;
      var ok=true;
      for(j=0;j<k.length;j++) if(h.indexOf(String(k[j]).toLowerCase())<0){ok=false;break;}
      if(ok){pack=faults[i];break;}
    }
    if(pack){
      (pack.faults||[]).forEach(function(f){ if(f.s==="high") highs++; else if(f.s==="low") lows++; });
      if(highs) return {n:Math.max(-15,-5*highs),lab:"Known weak points on this model and engine"};
      if(lows && !(pack.faults||[]).some(function(f){return f.s==="med";})) return {n:10,lab:"This model and engine has a light fault list"};
      return {n:4,lab:"Typical known issues for this model, nothing severe on file"};
    }
    if(normBaseline(input)) return null; // DVSA pass rate is used instead of the hand-made make list
    for(i=0;i<BASE.length;i++){
      for(j=0;j<BASE[i].k.length;j++) if(h.indexOf(BASE[i].k[j])>=0) return {n:BASE[i].n,lab:BASE[i].lab};
    }
    return null;
  }

  /* DVSA anonymised MOT data (data/mot-norms.js, OGL v3.0): first-time pass rate for this make/model/fuel/age band vs UK. */
  function normBaseline(input){
    var N=root.T3_MOTNORMS;
    if(!N||!input.make||input.age==null) return null;
    var a=+input.age, b=a<6?"a":a<9?"b":a<12?"c":a<15?"d":a<20?"e":"f";
    var mk=String(input.make).toUpperCase().trim(); if(mk==="MERCEDES"||mk==="MERCEDES BENZ") mk="MERCEDES-BENZ";
    var md=String(input.model||"").toUpperCase().replace(/\s+/g," ").trim(), w=md.split(" "), key=(/^\d+$/.test(w[0])&&w[1])?w[0]+" "+w[1]:w[0];
    var f=String(input.fuel||"").toLowerCase(), fu=/hybrid/.test(f)?"H":/elec/.test(f)?"E":/diesel/.test(f)?"D":/petrol/.test(f)?"P":"O";
    var r=N.model[mk+"|"+md+"|"+fu+"|"+b]||N.model[mk+"|"+key+"|"+fu+"|"+b], who="This model";
    if(!r){ r=N.make[mk+"|"+fu+"|"+b]; who="This make"; }
    var uk=N.uk[b];
    if(!r||!uk) return null;
    var d=r[1]-uk[1], n=Math.max(-10,Math.min(10,Math.round(d*80)));
    var pct=Math.round(r[1]*100)+"% vs "+Math.round(uk[1]*100)+"% UK", line="First-time MOT pass rate, "+who.toLowerCase()+" at this age: "+pct+" · DVSA data";
    if(d>=0.03) return {n:n,line:line,lab:who+" passes its MOT first time more than most at this age ("+pct+")"};
    if(d<=-0.03) return {n:n,line:line,lab:who+" fails its MOT more than most at this age ("+pct+")"};
    return {n:n,line:line,lab:who+" passes its MOT about as often as most at this age ("+pct+")"};
  }

  function life(age, miles){
    var bits=[];
    if(age!=null){
      if(age<=4) bits.push({n:10,lab:"Still early in its life",dir:1,gen:1});
      else if(age<=8) bits.push({n:5,lab:"Mid-life age",dir:1,gen:1});
      else if(age<=12) bits.push({n:0,lab:"Typical used-car age",dir:0,gen:1});
      else if(age<=16) bits.push({n:-8,lab:"Late in a typical 14-year life",dir:-1,gen:1});
      else bits.push({n:-14,lab:"Older than a typical UK car life",dir:-1,gen:1});
    }
    if(miles){
      if(miles<40000) bits.push({n:8,lab:"Low mileage for a used car",dir:1,gen:1});
      else if(miles<80000) bits.push({n:4,lab:"Modest mileage",dir:1,gen:1});
      else if(miles<120000) bits.push({n:0,lab:"Average mileage",dir:0,gen:1});
      else if(miles<160000) bits.push({n:-6,lab:"Higher than typical mileage",dir:-1,gen:1});
      else if(miles<200000) bits.push({n:-12,lab:"High mileage versus a typical life",dir:-1,gen:1});
      else bits.push({n:-16,lab:"Very high mileage",dir:-1,gen:1});
    }
    if(age>=3 && miles && miles/age>18000) bits.push({n:-4,lab:"Covered more miles per year than most",dir:-1,gen:1});
    return bits.filter(function(b){return b.dir;});
  }

  function motTrend(tests){
    var bits=[], rows=chrono(tests), now=new Date().getFullYear();
    if(!rows.length) return bits;
    var latest=rows[rows.length-1];
    if(isFailResult(latest)) bits.push({n:-12,lab:"Latest test was a fail",dir:-1});
    var fails=0, rust=0, clean=0, stems={}, danger=0, prsTests=0;
    rows.forEach(function(t){
      var y=+(dateOf(t).slice(0,4)||0);
      if(y && y<now-5) return;
      if(isFailResult(t)) fails++;
      var defs=defects(t), major=0, adv=0, prs=0;
      defs.forEach(function(d){
        var tx=textOf(d).toLowerCase();
        if(/corrosion|corroded|\brust\b|sill corroded|prescribed area|chassis corroded/.test(tx)) rust++;
        if(isMajor(d)) major++;
        if(d && (d.dangerous===true || d.dangerous==="true" || /DANGEROUS/.test(typeOf(d)))) danger++;
        if(/PRS/.test(typeOf(d))) prs++;
        if(isAdvisory(d)){
          adv++;
          var stem=tx.replace(/[^a-z]+/g," ").trim().split(" ").slice(0,4).join(" ");
          if(stem) stems[stem]=(stems[stem]||0)+1;
        }
      });
      if(prs && !isFailResult(t)) prsTests++;
      if(!isFailResult(t) && major===0 && adv<=1) clean++;
    });
    if(fails>=3) bits.push({n:-12,lab:"Several MOT fails in the last five years",dir:-1});
    else if(fails===2) bits.push({n:-8,lab:"More than one MOT fail in recent years",dir:-1});
    else if(fails===1 && !isFailResult(latest)) bits.push({n:-4,lab:"A recent fail, later passed",dir:-1});
    var rec=0, k;
    for(k in stems) if(stems[k]>=2) rec++;
    if(rec) bits.push({n:-8,lab:"The same advisory keeps coming back",dir:-1});
    if(danger>=2) bits.push({n:-10,lab:"Dangerous defects recorded more than once",dir:-1});
    else if(danger===1) bits.push({n:-6,lab:"A dangerous defect was recorded",dir:-1});
    if(prsTests>=2) bits.push({n:-3,lab:"Needed fixes on the day at more than one MOT",dir:-1});
    if(rust>=2) bits.push({n:-10,lab:"Corrosion keeps being advised",dir:-1});
    else if(rust===1) bits.push({n:-4,lab:"Corrosion has been advised",dir:-1});
    if(clean>=2 && fails===0 && !rec && !rust) bits.push({n:8,lab:"Recent tests have been clean",dir:1});
    else if(fails===0 && rows.length>=2 && !isFailResult(latest)) bits.push({n:4,lab:"Current MOT is a pass",dir:1});
    return bits;
  }

  function mileageFlags(tests){
    var bits=[], rows=chrono(tests), i;
    for(i=1;i<rows.length;i++){
      var a=asMiles(milesOf(rows[i-1]),unitOf(rows[i-1]));
      var b=asMiles(milesOf(rows[i]),unitOf(rows[i]));
      if(!a||!b) continue;
      if(b<a-500){ bits.push({n:-20,lab:"Mileage went down between tests",dir:-1}); break; }
      var da=dateOf(rows[i-1]), db=dateOf(rows[i]);
      if(da && db){
        var days=(new Date(db)-new Date(da))/864e5;
        if(days>60 && (b-a)>Math.max(25000, days/365*30000)) bits.push({n:-6,lab:"A sharp mileage jump on the record",dir:-1});
        if(days>540 && (b-a)<800) bits.push({n:-6,lab:"A long gap with almost no miles added",dir:-1});
      }
    }
    if(!bits.length && rows.length>=3) bits.push({n:4,lab:"Mileage record looks consistent",dir:1});
    var seen={};
    return bits.filter(function(x){ if(seen[x.lab]) return false; seen[x.lab]=1; return true; });
  }

  function jobEvidence(tests, input){
    var rows=chrono(tests), done=[], due=[], extra=String(input.doneText||"");
    var ticks=input.doneTicks||{};
    var latestPass=rows.length && !isFailResult(rows[rows.length-1]);
    BIG.forEach(function(job){
      var seenMajor=false, replaced=false, i, t, d, tx;
      for(i=0;i<rows.length;i++){
        t=rows[i];
        for(d=0;d<defects(t).length;d++){
          tx=textOf(defects(t)[d]);
          if(!job.re.test(tx)) continue;
          if(isMajor(defects(t)[d])) seenMajor=true;
          if(/replac|renew|renewed|fitted new|new (tyre|tire|disc|pad|belt|clutch|exhaust|filter)/i.test(tx)) replaced=true;
        }
      }
      if(ticks[job.id] || ticks[job.name] || job.re.test(extra)) replaced=true;
      if((seenMajor && latestPass) || replaced){
        done.push({id:job.id,name:job.name,n:job.boost,lab:job.name+" already done",dir:1});
        return;
      }
      if(job.due(input.age||0, input.miles||0, input.fuel) && job.miss){
        due.push({id:job.id,name:job.name,n:job.miss,lab:job.name+" may still be due",dir:-1});
      }
    });
    return {done:done,due:due};
  }

  function threeYearCost(input, jobs){
    var lo=150, hi=300; // a service
    var age=input.age||0, miles=input.miles||0, done={};
    (jobs.done||[]).forEach(function(j){ done[j.id]=1; });
    if(!done.tyres && (age>=6 || miles>=25000)){ lo+=250; hi+=500; }
    if(!done.brakes){ lo+=150; hi+=350; }
    if(!done.arms && (age>=8 || miles>=80000)){ lo+=150; hi+=400; }
    if(!done.exhaust && age>=8){ lo+=150; hi+=400; }
    if(!done.belt && (age>=5 || miles>=80000)){ lo+=400; hi+=900; }
    if(!done.clutch && miles>=90000){ lo+=400; hi+=900; }
    if(!done.dpf && /diesel/i.test(input.fuel||"") && miles>=80000){ lo+=400; hi+=1200; }
    return {lo:lo,hi:hi};
  }

  function lifePlace(age, miles){
    if(age==null && !miles) return "We don't have enough age or mileage to place this car in its life.";
    if(age!=null && age<=4) return "This is still early in its life"+(miles?(" with "+miles.toLocaleString("en-GB")+" miles"):"")+".";
    if(age!=null && age<=8) return "This is a mid-life car"+(miles?(" on "+miles.toLocaleString("en-GB")+" miles"):"")+".";
    if(age!=null && age<=14) return "This car is into the later part of a typical life"+(miles?(", with "+miles.toLocaleString("en-GB")+" miles"):"")+".";
    return "This is a late-life car"+(miles?(" with "+miles.toLocaleString("en-GB")+" miles"):"")+".";
  }

  function summary(input, score, cost, jobs){
    var place=lifePlace(input.age, input.miles);
    var money="Budget about £"+cost.lo.toLocaleString("en-GB")+" to £"+cost.hi.toLocaleString("en-GB")+" over the next three years for typical wear, not including surprises.";
    var tone;
    if(score>=75) tone="It looks a reliable bet, especially if the big jobs already done stay proven with invoices.";
    else if(score>=55) tone="Reliability looks average from here: some work is in its favour, but a few costs still sit ahead.";
    else tone="Reliability and running costs look less appealing from here, so check invoices and budget for more work.";
    if(jobs.done && jobs.done.length) tone=tone;
    return place+" "+tone+" "+money;
  }

  function score(input){
    input=input||{};
    var tests=input.tests||[];
    var latest=chrono(tests).slice(-1)[0];
    input.miles=input.miles||(latest?asMiles(milesOf(latest),unitOf(latest)):0);
    if(input.year && !input.age) input.age=new Date().getFullYear()-(+input.year);
    var factors=[], b=baseline(input);
    if(b) factors.push({n:b.n,lab:b.lab,dir:b.n>=0?1:-1});
    var nb=normBaseline(input); input._norm=nb;
    if(nb && nb.n) factors.push({n:nb.n,lab:nb.lab,dir:nb.n>0?1:-1});
    factors=factors.concat(life(input.age, input.miles), motTrend(tests), mileageFlags(tests));
    var jobs=jobEvidence(tests, input);
    factors=factors.concat(jobs.done, jobs.due);
    var total=70, i;
    for(i=0;i<factors.length;i++) total+=factors[i].n||0;
    if(total<0) total=0;
    if(total>100) total=100;
    var recentFail=(tests||[]).some(function(tt){
      var y=+(dateOf(tt).slice(0,4)||0), nowY=new Date().getFullYear();
      return isFailResult(tt) && (!y || y>=nowY-5);
    });
    if(recentFail && total>92) total=92;
    if(tests.length && isFailResult(chrono(tests).slice(-1)[0]) && total>55) total=55;
    function pick(dir,n){
      var spec=[],gen=[],i,f;
      for(i=0;i<factors.length;i++){
        f=factors[i];
        if(f.dir!==dir) continue;
        (f.gen?gen:spec).push(f);
      }
      spec.sort(function(a,b){return dir>0?b.n-a.n:a.n-b.n;});
      gen.sort(function(a,b){return dir>0?b.n-a.n:a.n-b.n;});
      return spec.concat(gen).slice(0,n);
    }
    var up=pick(1,3), down=pick(-1,3);
    var cost=threeYearCost(input, jobs);
    return {
      score:total,
      summary:summary(input,total,cost,jobs),
      up:up,
      down:down,
      done:jobs.done,
      costLo:cost.lo,
      costHi:cost.hi,
      age:input.age||0,
      miles:input.miles||0,
      norm:input._norm?input._norm.line:""
    };
  }

  function ringColor(n){ return n>=75?"#34d399":n>=55?"#fbbf24":"#f87171"; }

  function cardHtml(r){
    r=r||score({});
    var up=(r.up||[]).map(function(f){return "<div class='outFact up'>↑ "+esc(f.lab)+"</div>";}).join("");
    var down=(r.down||[]).map(function(f){return "<div class='outFact down'>↓ "+esc(f.lab)+"</div>";}).join("");
    var done="";
    if(r.done && r.done.length){
      done="<ul class='outDone'><b>Work already done</b>"+r.done.map(function(j){return "<li>"+esc(j.name)+"</li>";}).join("")+"</ul>";
    }else{
      done="<ul class='outDone'><b>Work already done</b><li>None shown in the MOT history yet.</li></ul>";
    }
    return "<div class='outlook' id='outlookCard'>"+
      "<div class='outHead'><div class='outRing' style='--p:"+r.score+";--c:"+ringColor(r.score)+"' role='img' aria-label='Outlook "+r.score+" out of 100'><b>"+r.score+"</b></div>"+
      "<div><p class='outTitle'>Reliability &amp; cost outlook</p><p class='estLab'>Estimate · out of 100</p></div></div>"+
      "<p class='outSum'>"+esc(r.summary)+"</p>"+
      "<div class='outFacts'>"+(up||"")+(down||"")+"</div>"+
      (r.norm?"<p class='outNorm' style='font-size:12px;line-height:1.35;color:#9aa3b0;margin:8px 0 10px'>"+esc(r.norm)+"</p>":"")+
      done+"</div>";
  }

  function historyHtml(tests){
    tests=tests||[];
    if(!tests.length) return "<p class='muted'>No tests returned.</p>";
    return tests.slice(0,16).map(function(t){
      var fail=isFailResult(t);
      var date=dateOf(t);
      var p=date.split("-");
      var nice=p.length>=3?p[2]+"/"+p[1]+"/"+p[0]:date;
      var mi=milesOf(t);
      var milesTxt=mi?(" · "+String(mi).replace(/\B(?=(\d{3})+(?!\d))/g,",")+" "+(unitOf(t)==="km"?"km":"mi")):"";
      var list=defects(t).map(function(x){
        var ty=typeOf(x), cls=isMajor(x)?"motBad":"muted";
        var label=ty && ty!=="ADVISORY"?ty+": ":"";
        return "<p class='"+cls+"' style='margin:2px 0'>"+esc(label+textOf(x))+"</p>";
      }).join("");
      return "<div class='motRow'><div><b>"+esc(nice)+milesTxt+"</b>"+(list||"<p class='muted'>No defects listed.</p>")+"</div><span class='motMark "+(fail?"fail":"pass")+"'>"+(fail?"Fail":"Pass")+"</span></div>";
    }).join("");
  }

  root.T3Outlook={score:score,cardHtml:cardHtml,historyHtml:historyHtml,esc:esc};
})(typeof window!=="undefined"?window:globalThis);
