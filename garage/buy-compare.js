/* Trac3 Buying guide: side-by-side car comparison (T3Compare). Estimate only, same rules for every car.
   Weights: reliability 40 (MOT 25 + beyond MOT 15), running cost 25, age/miles/wear 20 (15 when performance counts),
   asking price 10 (only when both typed), safety 5 (Euro NCAP, when both match), performance 5 (only when both have data).
   Missing parts drop out and the rest are rescaled to 100.
   Data (all on the phone, no accounts): DVSA MOT history (live lookup) incl. hasOutstandingRecall; data/mot-norms.js
   (DVSA anonymised MOT data, OGL v3.0); data/recalls-uk.js (DVSA recalls CSV, OGL v3.0); data/specs-uk.js (cardata.wiki, CC BY 4.0);
   Performance mode runs (IndexedDB driv3-runs); work done (gt.diy).
   New keys: gt.buyCompare.v1 {miles, cars:{VRN:{price,ins,bhp,s060,kg}}}, gt.faultLog.v1 [{id,plate,name,cat,date,miles,cost,note,fixed,added}].
   Anonymous fault sharing is OFF (not approved). */
(function(root){
  "use strict";
  var W={mot:25,beyond:15,run:25,wear:20,price:10,safety:5,perf:5};
  var CATS=["Engine","Gearbox","Electrics","Battery / EV","Software","Turbo","DPF","Timing chain","Other"];
  var BANDS=[[6,"a","3–5"],[9,"b","6–8"],[12,"c","9–11"],[15,"d","12–14"],[20,"e","15–19"],[999,"f","20+"]];
  var KEY="gt.buyCompare.v1", LOG="gt.faultLog.v1";

  function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n));}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function vrn(p){return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"");}
  function gbp(n){return "£"+Math.round(n).toLocaleString("en-GB");}
  function kmiles(n){return n>=1000?Math.round(n/1000)+"k":String(n||0);}
  function ukDate(s){var d=new Date(String(s)+"T12:00:00");return isNaN(d)?String(s||""):d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
  function up(s){return String(s||"").toUpperCase().replace(/\s+/g," ").trim();}
  function title(s){return String(s||"").toLowerCase().replace(/(^|[\s\-\/])([a-z])/g,function(m,a,b){return a+b.toUpperCase();});}
  function rd(k,d){try{var v=JSON.parse(root.localStorage.getItem(k)||"null");return v==null?d:v;}catch(e){return d;}}
  function wr(k,v){try{root.localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

  var MAKEFIX={"MERCEDES":"MERCEDES-BENZ","MERCEDES BENZ":"MERCEDES-BENZ","VW":"VOLKSWAGEN","CITROËN":"CITROEN","SKODA AUTO":"SKODA"};
  function normMake(m){m=up(m);return MAKEFIX[m]||m;}
  function fuelCode(f){f=String(f||"").toLowerCase();if(/hybrid|phev/.test(f))return "H";if(/elec/.test(f))return "E";if(/diesel/.test(f))return "D";if(/petrol|gasoline/.test(f))return "P";return "O";}
  function modelKey(model){var t=up(model).split(" ");if(/^\d+$/.test(t[0])&&t[1])return t[0]+" "+t[1];return t[0]||"";}
  function band(age){var i;if(age==null)return null;for(i=0;i<BANDS.length;i++)if(age<BANDS[i][0])return BANDS[i];return BANDS[BANDS.length-1];}

  /* ---------- MOT pass-rate norms (DVSA anonymised MOT data) ---------- */
  function normFor(make,model,fuel,age){
    var N=root.T3_MOTNORMS, b=band(age);
    if(!N||!b) return null;
    var mk=normMake(make), md=up(model), fu=fuelCode(fuel), uk=N.uk[b[1]], r, lvl;
    if((r=N.model[mk+"|"+md+"|"+fu+"|"+b[1]])) lvl="model";
    else if((r=N.model[mk+"|"+modelKey(model)+"|"+fu+"|"+b[1]])) lvl="model";
    else if((r=N.make[mk+"|"+fu+"|"+b[1]])) lvl="make";
    if(!r) return uk?{level:"uk",n:uk[0],rate:uk[1],uk:uk[1],band:b[2],year:N.year}:null;
    return {level:lvl,n:r[0],rate:r[1],prs:r[2],uk:uk?uk[1]:r[1],band:b[2],year:N.year};
  }
  function faultAreas(make,model){
    var N=root.T3_MOTNORMS; if(!N||!N.faults) return [];
    var l=N.faults[normMake(make)+"|"+up(model)]||N.faults[normMake(make)+"|"+modelKey(model)]||[];
    return l.map(function(x){return {name:x[0],share:x[1],uk:(N.ukFaults||{})[x[0]]||null};});
  }

  /* ---------- UK recalls (DVSA campaigns: which models, not whether this car was fixed) ---------- */
  /* Recall model names start with the model word; some suffixes are a different car (Yaris Cross, Focus C-Max). */
  var OTHER=/^(CROSS|VERSO|GR|C MAX|CMAX|PLUS|SV|CC|GT|GRAN|ACTIVE|SPORTSVAN|COUNTRYMAN|CLUBMAN|PACEMAN|COUPE|CABRIO\w*|CONVERTIBLE|ROADSTER)\b/;
  function recallsFor(make,model,year,fuel){
    var R=root.T3_RECALLS; if(!R||!year) return [];
    var mk=normMake(make), key=modelKey(model), mine=" "+up(model).replace(/[^A-Z0-9 ]/g," ")+" ", fu=fuelCode(fuel), seen={}, out=[];
    if(key.length<2) return [];
    R.forEach(function(r){
      if(r[0]!==mk||seen[r[4]]) return;
      var rm=r[1].replace(/[^A-Z0-9 ]/g," ").replace(/\s+/g," ").trim();
      if(rm!==key&&rm.indexOf(key+" ")!==0) return;
      var rest=rm.slice(key.length).trim(), m=rest.match(OTHER);
      if(m&&mine.indexOf(" "+m[0]+" ")<0) return;
      if(fuel&&/\b(ELECTRIC|EV|E)\b/.test(rest)&&fu!=="E") return;
      if(fuel&&/\b(PHEV|HEV|HV|HYBRID)\b/.test(rest)&&fu!=="H") return;
      if(year<r[2]||year>r[3]+1) return;
      seen[r[4]]=1; out.push({no:r[4],year:r[5],group:r[6],concern:r[7]});
    });
    return out.sort(function(a,b){return b.year-a.year;});
  }
  function recallStatus(raw){
    var s=String(raw&&raw.hasOutstandingRecall||"").trim().toLowerCase();
    if(s==="yes") return "Yes"; if(s==="no") return "No"; if(s==="unknown") return "Unknown"; if(s==="unavailable") return "Unavailable"; return "";
  }

  /* ---------- specs (cardata.wiki, CC BY 4.0) ---------- */
  function specsFor(make,model,year,fuel,cc){
    var S=root.T3_SPECS; if(!S||!year) return null;
    var mk=normMake(make), md=up(model), key=modelKey(model), fu=fuelCode(fuel), rows;
    function pick(eq){return S.filter(function(r){
      if(r[0]!==mk) return false;
      if(eq?(r[1]!==md&&r[1]!==key):(r[1].indexOf(key+" ")!==0)) return false;
      if(!r[3]) return false;
      var end=r[4]||r[3]+7; if(year<r[3]||year>end+1) return false;
      if(fu!=="O"&&r[5]&&r[5]!==fu&&!(fu==="H"&&r[5]==="P")) return false;
      if(cc&&r[6]&&Math.abs(r[6]-cc)>60) return false;
      return true;});}
    rows=pick(true); if(!rows.length) rows=pick(false);
    if(!rows.length) return null;
    var b=rows.map(function(r){return r[7];}).sort(function(x,y){return x-y;});
    var lo=b[0], hi=b[b.length-1], one=hi<=lo*1.1;
    function med(i){var v=rows.map(function(r){return r[i];}).filter(Boolean).sort(function(x,y){return x-y;});return v.length?v[Math.floor(v.length/2)]:null;}
    return {n:rows.length,bhpLo:lo,bhpHi:hi,bhp:one?Math.round((lo+hi)/2):null,
      nm:one?med(8):null,s060:one?med(9):null,mph:one?med(10):null,variant:rows.length===1?rows[0][2]:""};
  }

  /* ---------- owner data on this phone ---------- */
  function store(){var s=rd(KEY,{});s.miles=+s.miles||10000;s.cars=s.cars||{};return s;}
  function userFor(plate){return store().cars[vrn(plate)]||{};}
  function setUser(plate,field,val){var s=store(),k=vrn(plate);s.cars[k]=s.cars[k]||{};if(val>0)s.cars[k][field]=val;else delete s.cars[k][field];wr(KEY,s);}
  function setMiles(m){var s=store();s.miles=m>0?m:10000;wr(KEY,s);}
  function logsFor(plate){var k=vrn(plate);return (rd(LOG,[])||[]).filter(function(x){return vrn(x.plate)===k;});}
  function addLog(e){var l=rd(LOG,[])||[];e.id=e.id||("f"+Date.now().toString(36));e.added=e.added||Date.now();e.plate=vrn(e.plate);l.unshift(e);wr(LOG,l);return e;}
  function removeLog(id){wr(LOG,(rd(LOG,[])||[]).filter(function(x){return x.id!==id;}));}
  function diyTextFor(plate){var k=vrn(plate),t="";(rd("gt.diy",[])||[]).forEach(function(x){if(vrn(x.plate)===k)t+=" "+(x.text||x.title||x.job||x.name||"");});return t;}
  function measured060(plate){
    var k=vrn(plate);
    return new Promise(function(ok){
      if(!root.indexedDB||!k) return ok(null);
      var r; try{r=root.indexedDB.open("driv3-runs",1);}catch(e){return ok(null);}
      r.onupgradeneeded=function(){r.result.createObjectStore("runs",{keyPath:"id"});};
      r.onerror=function(){ok(null);};
      r.onsuccess=function(){
        try{var g=r.result.transaction("runs","readonly").objectStore("runs").getAll();
          g.onsuccess=function(){var best=null;(g.result||[]).forEach(function(x){var t=parseFloat(x.time);if(vrn(x.plate)===k&&/^0.60 mph$/.test(x.label||"")&&t>0&&(!best||t<best))best=t;});ok(best);};
          g.onerror=function(){ok(null);};
        }catch(e){ok(null);}
      };
    });
  }

  /* ---------- one car, ready to score ---------- */
  function prep(c,ctx){
    ctx=ctx||{}; var info=c.info||{}, raw=info.raw||{}, user=c.user||{};
    var year=info.year||c.year||null;
    var fu=raw.firstUsedDate||raw.registrationDate||"";
    var now=ctx.now||new Date();
    var age=fu&&/^\d{4}-\d\d/.test(fu)?(now-new Date(fu.slice(0,10)))/3.15576e10:(year?now.getFullYear()-year:null);
    if(age!=null) age=Math.max(0,Math.round(age*10)/10);
    var O=root.T3Outlook, out=O?O.score({tests:info.tests||[],year:year,age:age!=null?Math.round(age):null,make:info.make,model:info.model,name:info.name||c.name,fuel:info.fuel,engine:info.engine,doneText:diyTextFor(c.plate)}):{score:60,costLo:300,costHi:700,miles:0,up:[],down:[]};
    var norm=normFor(info.make,info.model,info.fuel,age!=null?age:0);
    var mot=out.score, ns=null;
    if(norm&&norm.level!=="uk"){ns=clamp(Math.round(50+(norm.rate-norm.uk)*250),0,100);mot=Math.round(out.score*0.7+ns*0.3);}
    var status=recallStatus(raw), recalls=recallsFor(info.make,info.model,year,info.fuel);
    var pack=ctx.matchFault?ctx.matchFault(info.name||c.name,year):(root.matchFault?root.matchFault(info.name||c.name,year):null);
    var highs=((pack&&pack.faults)||[]).filter(function(f){return f.s==="high";});
    var logs=logsFor(c.plate);
    var b=70, notes=[];
    if(status==="Yes"){b-=20;notes.push({bad:1,t:"Open recall on record",d:"DVSA says a recall on this car has not been done yet. Ask for it to be fixed before you buy (free at a dealer)."});}
    else if(status==="No"){b+=5;notes.push({good:1,t:"No open recalls",d:"DVSA shows no outstanding recall on this car."});}
    if(recalls.length&&status!=="No"){b-=Math.min(12,3*recalls.length);}
    if(highs.length){b-=Math.min(12,4*highs.length);}
    var open=logs.filter(function(x){return !x.fixed;}), fixedBig=logs.filter(function(x){return x.fixed&&(+x.cost||0)>=300;});
    b-=Math.min(24,8*open.length); b+=Math.min(8,4*fixedBig.length);
    var beyond=clamp(b,0,100);
    var conf=(status==="Yes"||status==="No"||logs.length)?"High":(recalls.length||highs.length||status)?"Medium":"Low";
    var fuelKey=c.fuel||(fuelCode(info.fuel)==="E"?"electric":fuelCode(info.fuel)==="D"?"diesel":"petrol");
    var ved=root.vedAnnual?root.vedAnnual({year:year,fuel:info.fuel||fuelKey,co2:raw.co2Emissions!=null?raw.co2Emissions:null,plate:c.plate}):null;
    var nc=root.ncapFor?root.ncapFor(info.name||c.name,year):null;
    var spec=specsFor(info.make,info.model,year,info.fuel,info.engine);
    var m060=ctx.measured&&ctx.measured[vrn(c.plate)];
    var perf={bhp:null,bhpSrc:"",bhpTxt:"",nm:null,s060:null,s060Src:"",mph:null,kg:user.kg||null};
    if(user.bhp){perf.bhp=user.bhp;perf.bhpSrc="you";}
    else if(spec&&spec.bhp){perf.bhp=spec.bhp;perf.bhpSrc="off";}
    else if(spec){perf.bhpTxt=spec.bhpLo+"–"+spec.bhpHi;perf.bhpSrc="off";}
    if(spec){perf.nm=spec.nm;perf.mph=spec.mph;}
    if(m060){perf.s060=m060;perf.s060Src="meas";}
    else if(user.s060){perf.s060=user.s060;perf.s060Src="you";}
    else if(spec&&spec.s060){perf.s060=spec.s060;perf.s060Src="off";}
    var model=title(info.model||"")||String(c.name||"Car").split(" ").slice(1,2).join(" ")||"Car";
    return {plate:vrn(c.plate),name:info.name||c.name||"Car",short:model.split(" ")[0],year:year,age:age,miles:out.miles||0,
      fuelKey:fuelKey,mpg:c.mpg||null,unit:c.unit||"mpg",out:out,mot:mot,normScore:ns,norm:norm,areas:faultAreas(info.make,info.model),
      status:status,recalls:recalls,highs:highs,logs:logs,openLogs:open,beyond:beyond,conf:conf,notes:notes,
      ved:ved&&ved.ok?ved.amount:null,ins:user.ins||null,price:user.price||null,ncap:nc&&!nc.none?nc:null,spec:spec,perf:perf};
  }

  /* ---------- the comparison ---------- */
  function compare(A,B,opt){
    opt=opt||{}; var miles=opt.miles||10000, mc=opt.monthCost||function(){return null;};
    var parts=[], k;
    function rel(a,b,lowerBetter){if(lowerBetter){var m=Math.min(a,b);return [m>0?100*m/a:100,m>0?100*m/b:100];}var x=Math.max(a,b);return [x>0?100*a/x:0,x>0?100*b/x:0];}
    function add(id,w,sa,sb,row){parts.push({id:id,w:w,a:Math.round(clamp(sa,0,100)),b:Math.round(clamp(sb,0,100)),row:row});}
    add("mot",W.mot,A.mot,B.mot);
    add("beyond",W.beyond,A.beyond,B.beyond);
    var runA=null, runB=null;
    if(A.mpg&&B.mpg){
      runA=mc(A.mpg,A.fuelKey)*miles/1000; runB=mc(B.mpg,B.fuelKey)*miles/1000;
      if(A.ved!=null&&B.ved!=null){runA+=A.ved;runB+=B.ved;}
      if(A.ins&&B.ins){runA+=A.ins;runB+=B.ins;}
      var rr=rel(runA,runB,true); add("run",W.run,rr[0],rr[1]);
    }
    var perfOn=!!((A.perf.bhp&&B.perf.bhp)||(A.perf.s060&&B.perf.s060));
    var wA=(A.out.costLo+A.out.costHi)/2, wB=(B.out.costLo+B.out.costHi)/2, wr2=rel(wA,wB,true);
    function wear(c,r){return ((c.age!=null?clamp(100-c.age*5,0,100):60)+clamp(100-(c.miles||0)/2000,0,100)+r)/3;}
    add("wear",perfOn?15:W.wear,wear(A,wr2[0]),wear(B,wr2[1]));
    if(A.price&&B.price){var pr=rel(A.price,B.price,true);add("price",W.price,pr[0],pr[1]);}
    if(A.ncap&&B.ncap&&A.ncap.stars&&B.ncap.stars){
      var sf=function(n){var s=n.stars*20;if(n.old)s-=20;else if(n.tested&&n.tested<2018)s-=10;return s;};
      add("safety",W.safety,sf(A.ncap),sf(B.ncap));
    }
    if(perfOn){
      var sa=[],sb=[],t;
      if(A.perf.bhp&&B.perf.bhp){t=rel(A.perf.bhp,B.perf.bhp,false);sa.push(t[0]);sb.push(t[1]);}
      if(A.perf.s060&&B.perf.s060){t=rel(A.perf.s060,B.perf.s060,true);sa.push(t[0]);sb.push(t[1]);}
      add("perf",W.perf,sa.reduce(function(x,y){return x+y;},0)/sa.length,sb.reduce(function(x,y){return x+y;},0)/sb.length);
    }
    var tw=0,ta=0,tb=0;
    parts.forEach(function(p){tw+=p.w;ta+=p.w*p.a;tb+=p.w*p.b;});
    var sA=Math.round(ta/tw), sB=Math.round(tb/tw);
    var res={a:A,b:B,parts:parts,weightTotal:tw,scoreA:sA,scoreB:sB,runA:runA,runB:runB,miles:miles,perfOn:perfOn,wearA:wA,wearB:wB};
    res.pros={a:prosCons(A,B,res,"a",1),b:prosCons(B,A,res,"b",1)};
    res.cons={a:prosCons(A,B,res,"a",-1),b:prosCons(B,A,res,"b",-1)};
    res.verdict=verdict(res);
    return res;
  }
  function part(res,id){for(var i=0;i<res.parts.length;i++)if(res.parts[i].id===id)return res.parts[i];return null;}

  function prosCons(X,Y,res,side,dir){
    var L=[], o=side==="a"?"b":"a";
    function push(w,t){L.push({w:w,t:t});}
    function d(id){var p=part(res,id);return p?p[side]-p[o]:0;}
    var runX=side==="a"?res.runA:res.runB, runY=side==="a"?res.runB:res.runA;
    if(dir>0){
      if(X.status==="No") push(5,"No open recalls");
      if(X.norm&&X.norm.level==="model"&&X.norm.rate-X.norm.uk>=0.03) push(6,"Passes its MOT more often than most");
      if(d("mot")>=8) push(7,(X.out.up&&X.out.up[0]&&!X.out.up[0].gen)?X.out.up[0].lab:"Stronger MOT history");
      if(runX!=null&&runY-runX>=100) push(8,"About "+gbp(runY-runX)+" a year cheaper to run");
      if(Y.miles-X.miles>=15000) push(5,"Fewer miles ("+kmiles(X.miles)+" vs "+kmiles(Y.miles)+")");
      if(Y.age!=null&&X.age!=null&&Y.age-X.age>=2) push(4,"Newer, "+Math.round(X.age)+" years old");
      var wX=side==="a"?res.wearA:res.wearB, wY=side==="a"?res.wearB:res.wearA;
      if(wY-wX>=300) push(4,"Less wear and tear ahead");
      if(X.price&&Y.price&&Y.price-X.price>=250) push(6,gbp(Y.price-X.price)+" cheaper to buy");
      if(d("perf")>=8) push(3,(X.perf.s060&&Y.perf.s060&&X.perf.s060<Y.perf.s060)?"Quicker, 0–60 in "+X.perf.s060+" s":"More power");
      if(d("safety")>=10) push(3,"Better crash rating");
    }else{
      if(X.status==="Yes") push(10,"Open recall on this car");
      if(X.openLogs.length) push(9,"Open fault you logged: "+X.openLogs[0].cat);
      if(X.norm&&X.norm.level==="model"&&X.norm.uk-X.norm.rate>=0.03) push(6,"Fails its MOT more than most");
      if(d("mot")<=-8) push(7,(X.out.down&&X.out.down[0])?X.out.down[0].lab:"Weaker MOT history");
      if(X.highs.length) push(5,"Known check: "+shortFault(X.highs[0].t));
      if(X.recalls.length>=3&&X.status!=="No") push(4,X.recalls.length+" UK recall campaigns for this model");
      if(runX!=null&&runX-runY>=100) push(6,"Costs "+gbp(runX-runY)+" a year more to run");
      if(X.price&&Y.price&&X.price-Y.price>=250) push(5,"Higher asking price");
      if(X.miles-Y.miles>=25000) push(4,"Higher miles");
    }
    var seen={};
    return L.sort(function(a,b){return b.w-a.w;}).filter(function(x){if(seen[x.t])return false;seen[x.t]=1;return true;}).slice(0,3).map(function(x){return x.t;});
  }
  function shortFault(t){t=String(t||"").replace(/\s*\(.*?\)\s*/g," ").trim();var s=t.split(/[.,;:–—-]\s/)[0];return s.length>42?s.slice(0,40).replace(/\s+\S*$/,"")+"…":s;}

  var PLAIN={mot:"MOT history",beyond:"reliability beyond the MOT",run:"running cost",wear:"age, miles and wear",price:"price",safety:"safety",perf:"performance"};
  function verdict(res){
    var A=res.a,B=res.b, gap=Math.abs(res.scoreA-res.scoreB);
    var w=res.scoreA>=res.scoreB?"a":"b", l=w==="a"?"b":"a", W2=res[w], L2=res[l];
    function leads(side){var o=side==="a"?"b":"a";return res.parts.filter(function(p){return p[side]-p[o]>=6;}).sort(function(x,y){return (y[side]-y[o])*y.w-(x[side]-x[o])*x.w;}).map(function(p){return PLAIN[p.id];});}
    function list(a){return a.length>1?a.slice(0,-1).join(", ")+" and "+a[a.length-1]:a[0]||"";}
    var lw=leads(w).slice(0,2), ll=leads(l).slice(0,2);
    var run=(res.runA!=null&&Math.abs(res.runA-res.runB)>=50)?" The "+(res.runA<res.runB?A.short:B.short)+" is about "+gbp(Math.abs(res.runA-res.runB))+" a year cheaper to run.":"";
    var t;
    if(gap<=5) t="Too close to call. "+(lw.length?"The "+W2.short+" edges "+list(lw)+(ll.length?"; the "+L2.short+" is better on "+list(ll):"")+".":"They score much the same.")+run;
    else t="The "+W2.short+" looks the safer buy"+(lw.length?", mainly on "+list(lw):"")+"."+(ll.length?" The "+L2.short+" does better on "+list(ll)+".":"")+run;
    if(res[w].status==="Yes"||res[l].status==="Yes") t+=" Get any open recall done before you buy.";
    return t;
  }

  /* ---------- rendering ---------- */
  var BADGE={off:"<span class='t3b off'>Official</span>",meas:"<span class='t3b meas'>Measured</span>",you:"<span class='t3b you'>You typed</span>"};
  function cell(v,sub,win,extra){return "<div class='t3cell"+(win?" win":"")+"'><b>"+v+"</b>"+(sub?"<span>"+sub+"</span>":"")+(extra||"")+"</div>";}
  function row(lab,a,b){return "<div class='t3lab'>"+lab+"</div>"+a+b;}
  function confB(c){return "<span class='t3conf "+(c==="High"?"hi":c==="Medium"?"mid":"lo")+"'>"+c+"</span>";}
  function winOf(res,id){var p=part(res,id);if(!p||p.a===p.b)return "";return p.a>p.b?"a":"b";}

  function tableHtml(res){
    var A=res.a,B=res.b,h="", w;
    function both(id,fa,fb){w=winOf(res,id);return [fa(w==="a"),fb(w==="b")];}
    var r=both("mot",function(x){return cell(A.mot,"This car",x);},function(x){return cell(B.mot,"This car",x);});
    h+=row("MOT reliability",r[0],r[1]);
    r=both("beyond",function(x){return cell(A.beyond,"",x,confB(A.conf));},function(x){return cell(B.beyond,"",x,confB(B.conf));});
    h+=row("Beyond MOT",r[0],r[1]);
    function pr(c){return c.norm?cell(Math.round(c.norm.rate*100)+"%",c.norm.level==="model"?"First time · this age":c.norm.level==="make"?"Make average":"UK average",false):cell("—","No data");}
    var na=A.norm&&B.norm&&A.norm.level!=="uk"&&B.norm.level!=="uk"?(A.norm.rate>B.norm.rate?"a":A.norm.rate<B.norm.rate?"b":""):"";
    h+=row("Model pass rate",pr(A).replace("t3cell'","t3cell"+(na==="a"?" win":"")+"'"),pr(B).replace("t3cell'","t3cell"+(na==="b"?" win":"")+"'"));
    w=winOf(res,"run");
    var sub=res.miles.toLocaleString("en-GB")+" miles";
    h+=row("Yearly running",res.runA!=null?cell(gbp(res.runA),sub,w==="a"):cell("—","Needs mpg"),res.runB!=null?cell(gbp(res.runB),sub,w==="b"):cell("—","Needs mpg"));
    var wa=res.wearA<res.wearB?"a":res.wearA>res.wearB?"b":"";
    h+=row("3-year wear",cell(gbp(A.out.costLo)+"–"+gbp(A.out.costHi).slice(1),"Typical jobs ahead",wa==="a"),cell(gbp(B.out.costLo)+"–"+gbp(B.out.costHi).slice(1),"Typical jobs ahead",wa==="b"));
    w=winOf(res,"wear");
    function am(c){return (c.age!=null?Math.round(c.age)+"y":"?")+" · "+kmiles(c.miles);}
    h+=row("Age &amp; miles",cell(am(A),"From the MOT",w==="a"),cell(am(B),"From the MOT",w==="b"));
    w=winOf(res,"price");
    h+=row("Asking price",A.price?cell(gbp(A.price),"You typed",w==="a"):cell("—","Type below"),B.price?cell(gbp(B.price),"You typed",w==="b"):cell("—","Type below"));
    w=winOf(res,"safety");
    function sf(c,x){return c.ncap&&c.ncap.stars?cell(c.ncap.stars+"★","NCAP"+(c.ncap.tested?" "+c.ncap.tested:""),x):cell("—","No match");}
    h+=row("Safety",sf(A,w==="a"),sf(B,w==="b"));
    return "<div class='t3card' id='t3Table'><div class='t3head'><h3>Side by side</h3><span class='muted'>Winner highlighted</span></div><div class='t3grid'><div class='t3h'></div><div class='t3h'>"+esc(A.short)+"</div><div class='t3h'>"+esc(B.short)+"</div>"+h+"</div></div>";
  }
  function perfHtml(res){
    var A=res.a,B=res.b;
    if(!A.perf.bhp&&!A.perf.bhpTxt&&!A.perf.s060&&!B.perf.bhp&&!B.perf.bhpTxt&&!B.perf.s060&&!A.perf.kg&&!B.perf.kg) return "";
    function better(x,y,low){if(!x||!y||x===y)return [false,false];return low?[x<y,y<x]:[x>y,y>x];}
    function v(c,val,unit,src){return val?cell(val+unit,"",false,src?BADGE[src]:""):cell("—","");}
    var h="", b;
    b=better(A.perf.bhp,B.perf.bhp);
    function pw(c){return c.perf.bhp?c.perf.bhp+" bhp":c.perf.bhpTxt?c.perf.bhpTxt+" bhp":"";}
    h+=row("Power",v(A,pw(A),"",A.perf.bhpSrc).replace("t3cell'","t3cell"+(b[0]?" win":"")+"'"),v(B,pw(B),"",B.perf.bhpSrc).replace("t3cell'","t3cell"+(b[1]?" win":"")+"'"));
    b=better(A.perf.nm,B.perf.nm);
    h+=row("Torque",v(A,A.perf.nm," Nm",A.perf.nm?"off":"").replace("t3cell'","t3cell"+(b[0]?" win":"")+"'"),v(B,B.perf.nm," Nm",B.perf.nm?"off":"").replace("t3cell'","t3cell"+(b[1]?" win":"")+"'"));
    b=better(A.perf.s060,B.perf.s060,true);
    h+=row("0–60",v(A,A.perf.s060," s",A.perf.s060Src).replace("t3cell'","t3cell"+(b[0]?" win":"")+"'"),v(B,B.perf.s060," s",B.perf.s060Src).replace("t3cell'","t3cell"+(b[1]?" win":"")+"'"));
    function ptw(c){return c.perf.bhp&&c.perf.kg?Math.round(c.perf.bhp/(c.perf.kg/1000)):null;}
    var pa=ptw(A),pb=ptw(B); b=better(pa,pb);
    h+=row("Power / weight",pa?cell(pa+" bhp/t",A.perf.kg.toLocaleString("en-GB")+" kg",b[0]):cell("—","Type weight"),pb?cell(pb+" bhp/t",B.perf.kg.toLocaleString("en-GB")+" kg",b[1]):cell("—","Type weight"));
    b=better(A.perf.mph,B.perf.mph);
    h+=row("Top speed",v(A,A.perf.mph," mph",A.perf.mph?"off":"").replace("t3cell'","t3cell"+(b[0]?" win":"")+"'"),v(B,B.perf.mph," mph",B.perf.mph?"off":"").replace("t3cell'","t3cell"+(b[1]?" win":"")+"'"));
    var note=res.perfOn?"Counts · both have data":"Not counted · needs both";
    var range=(A.perf.bhpTxt||B.perf.bhpTxt)?"<p class='t3note'>A range means more than one engine fits. Type the power below to pick yours.</p>":"";
    return "<div class='t3card' id='t3Perf'><div class='t3head'><h3>Performance</h3><span class='muted'>"+note+"</span></div><div class='t3grid'><div class='t3h'></div><div class='t3h'>"+esc(A.short)+"</div><div class='t3h'>"+esc(B.short)+"</div>"+h+"</div>"+range+"</div>";
  }
  function pcHtml(res){
    function col(c,pros,cons){
      var li=pros.map(function(t){return "<li class='pro'>"+esc(t)+"</li>";}).join("")+cons.map(function(t){return "<li class='con'>"+esc(t)+"</li>";}).join("");
      return "<div class='t3pc'><h4>"+esc(c.short)+"</h4><ul>"+(li||"<li class='muted'>Nothing stands out.</li>")+"</ul></div>";
    }
    return "<div class='t3pcs'>"+col(res.a,res.pros.a,res.cons.a)+col(res.b,res.pros.b,res.cons.b)+"</div>";
  }
  function beyondHtml(c){
    var h="";
    var st={Yes:"Open recall: not done yet",No:"No open recall",Unknown:"Recall status unknown",Unavailable:"Recall status unavailable"}[c.status]||"Recall status not returned";
    h+="<p class='t3line"+(c.status==="Yes"?" bad":c.status==="No"?" good":"")+"'><b>"+st+"</b><span>From the DVSA record for this car</span></p>";
    if(c.recalls.length){
      h+="<p class='t3line'><b>"+c.recalls.length+" UK recall campaign"+(c.recalls.length===1?"":"s")+" for this model and year</b><span>"+(c.status==="No"?"None open on this car.":"Ask if each was done. Free at a dealer.")+"</span></p><ul class='t3recalls'>"+
        c.recalls.slice(0,2).map(function(r){return "<li><b>"+esc(title(r.group))+"</b> · "+esc(r.concern)+" <span class='muted'>"+esc(r.no)+"</span></li>";}).join("")+(c.recalls.length>2?"<li class='muted'>+"+(c.recalls.length-2)+" more on the DVSA recall checker</li>":"")+"</ul>";
    }
    if(c.areas.length){
      h+="<p class='t3line'><b>Most common MOT fails, this model</b><span>"+c.areas.map(function(a){var pct=Math.round(a.share*100), u=a.uk!=null?Math.round(a.uk*100):null;return esc(a.name.replace(/, reflectors and electrical equipment/i," and electrics"))+" "+pct+"%"+(u!=null?(pct>u+1?" (UK "+u+"%)":pct<u-1?" (UK "+u+"%)":""):"");}).join(" · ")+"</span></p>";
    }
    if(c.highs.length) h+="<p class='t3line'><b>Known checks</b><span>"+c.highs.slice(0,3).map(function(f){return esc(shortFault(f.t));}).join(" · ")+"</span></p>";
    c.logs.forEach(function(l){
      h+="<p class='t3line"+(l.fixed?"":" bad")+"'><b>"+esc(l.cat)+(l.fixed?" · fixed":" · open")+"</b><span>"+[l.date?esc(ukDate(l.date)):"",l.miles?Number(l.miles).toLocaleString("en-GB")+" miles":"",l.cost?gbp(l.cost):"",esc(l.note||"")].filter(Boolean).join(" · ")+"</span><button type='button' class='t3x' data-del='"+esc(l.id)+"'>Remove</button></p>";
    });
    h+="<button type='button' class='btn grey t3log' data-plate='"+esc(c.plate)+"'>Log a fault</button>";
    return "<div class='t3bm'><h4>"+esc(c.short)+" "+confB(c.conf)+"</h4>"+h+"</div>";
  }
  function inputsHtml(res){
    function f(c){var u=userFor(c.plate);function i(k,lab,ph){return "<label>"+lab+"</label><input type='number' inputmode='decimal' class='t3in' data-plate='"+esc(c.plate)+"' data-k='"+k+"' value='"+(u[k]||"")+"' placeholder='"+ph+"'/>";}
      return "<div><b class='t3sm'>"+esc(c.short)+"</b>"+i("price","Asking price £","9495")+i("ins","Insurance £ a year","Quote")+i("bhp","Power bhp",c.spec&&c.spec.bhpLo?String(c.spec.bhpLo):"")+i("s060","0–60 s","")+i("kg","Weight kg","")+"</div>";}
    return "<details class='t3card t3you'><summary>Your figures <span class='muted'>price, insurance, power</span></summary><label>Miles a year</label><input type='number' inputmode='numeric' class='t3in' data-k='miles' value='"+store().miles+"'/><div class='t3two'>"+f(res.a)+f(res.b)+"</div><p class='t3note'>Saved on this phone. A Performance mode 0–60 for your own car is used first.</p></details>";
  }
  function verdictHtml(res){
    var wa=res.scoreA>=res.scoreB, wb=res.scoreB>=res.scoreA;
    return "<div class='t3verdict'><div class='t3head'><h3>Verdict</h3><button type='button' class='t3how'>How we score</button></div><div class='t3scores'>"+
      "<div class='t3score"+(wa?" best":"")+"'><span class='n'>"+res.scoreA+"</span><span class='l'>"+esc(res.a.short)+"</span><span class='e'>Estimate · out of 100</span></div>"+
      "<div class='t3score"+(wb?" best":"")+"'><span class='n'>"+res.scoreB+"</span><span class='l'>"+esc(res.b.short)+"</span><span class='e'>Estimate · out of 100</span></div></div><p>"+esc(res.verdict)+"</p></div>";
  }
  function credits(){return "<p class='t3credit'>MOT, recalls and pass rates: DVSA, contains public sector information licensed under the Open Government Licence v3.0. Specs: data sourced from cardata.wiki, available under CC BY 4.0. Not official advice.</p>";}
  function html(res){
    return "<div class='t3c'>"+verdictHtml(res)+pcHtml(res)+tableHtml(res)+perfHtml(res)+inputsHtml(res)+
      "<div class='t3card' id='t3Beyond'><div class='t3head'><h3>Beyond MOT</h3><span class='muted'>Confidence shown</span></div><div class='t3two'>"+beyondHtml(res.a)+beyondHtml(res.b)+"</div><p class='t3note'>Fault logs stay on this phone. Anonymous sharing is off.</p></div>"+credits()+"</div>";
  }

  function howHtml(res){
    var on={};(res?res.parts:[]).forEach(function(p){on[p.id]=p.w;});
    var tw=res?res.weightTotal:100;
    function r(id,lab,txt,w){var pct=res?(on[id]?Math.round(on[id]*100/tw):0):w;return "<div class='t3w"+(res&&!on[id]?" off":"")+"'><div><b>"+lab+"</b><span>"+txt+"</span><div class='t3bar'><i style='width:"+pct+"%'></i></div></div><span class='pct'>"+(res&&!on[id]?"Off":pct+"%")+"</span></div>";}
    return "<div class='t3handle'></div><h3>How we score</h3><p class='muted'>Same rules for every car. Estimate only."+(res?" Shares shown for this pair.":"")+"</p>"+
      r("mot","MOT history","This car's MOT record, plus how often this model passes first time at this age (DVSA, "+((root.T3_MOTNORMS||{}).year||2025)+" tests).",25)+
      r("beyond","Beyond MOT","Open recall on this car, UK recall campaigns, known checks, and faults you log.",15)+
      r("run","Running cost","Fuel at your yearly miles, road tax, and an insurance quote if you type both.",25)+
      r("wear","Age, miles and wear","How far through a typical life it is, and typical jobs ahead. 15% when performance counts.",20)+
      r("price","Asking price","Only when you type both prices.",10)+
      r("safety","Safety","Euro NCAP stars when both match. Older tests count for less.",5)+
      r("perf","Performance","Only when both cars have power or 0–60. Badged Official, Measured or You typed.",5)+
      "<p class='t3note'><b>Confidence.</b> High: DVSA gave this car's recall status, or you logged faults. Medium: model campaigns or known checks only. Low: little to go on. The MOT misses engines, gearboxes, most electrics, batteries, software, turbos, DPFs and timing chains, so these come from recalls, known checks and your logs.</p>"+
      "<p class='t3note'>Missing parts drop out and the rest scale to 100. No Which? or What Car survey data.</p>"+credits()+
      "<button type='button' class='btn grey t3close'>Done</button>";
  }
  function logHtml(plate,name){
    return "<div class='t3handle'></div><h3>Log a fault</h3><p class='muted'>"+esc(title(name))+" · "+esc(plate)+" · stays on this phone</p>"+
      "<label>What was it?</label><div class='t3chips'>"+CATS.map(function(c,i){return "<button type='button' class='t3chip"+(i===0?" on":"")+"' data-cat='"+esc(c)+"'>"+esc(c)+"</button>";}).join("")+"</div>"+
      "<div class='t3two'><div><label>Date</label><input type='date' id='t3lDate' value='"+new Date().toISOString().slice(0,10)+"'/></div><div><label>Miles</label><input type='number' inputmode='numeric' id='t3lMiles' placeholder='89200'/></div></div>"+
      "<div class='t3two'><div><label>What you paid £</label><input type='number' inputmode='decimal' id='t3lCost' placeholder='0'/></div><div><label>Status</label><div class='t3seg'><button type='button' class='on' data-fixed='0'>Still open</button><button type='button' data-fixed='1'>Fixed</button></div></div></div>"+
      "<label>Note</label><input type='text' id='t3lNote' placeholder='What happened, who fixed it'/>"+
      "<div class='t3share'><div><b>Share anonymously</b><span>Off. Needs your approval first, with a privacy note. Nothing leaves the phone.</span></div><span class='t3tog' aria-disabled='true'></span></div>"+
      "<button type='button' class='btn t3save' data-ico='save' data-plate='"+esc(plate)+"'>Save on this phone</button><button type='button' class='btn grey t3close'>Cancel</button>"+
      "<p class='t3note'>An open fault lowers this car's beyond MOT score. A fixed big job (£300 or more) raises it. Your logs are not official recall data.</p>";
  }

  /* ---------- page wiring (buy.html Compare cars) ---------- */
  var loading={};
  function loadScript(src){
    if(loading[src]) return loading[src];
    loading[src]=new Promise(function(ok){var s=document.createElement("script");s.src=src;s.onload=function(){ok(true);};s.onerror=function(){ok(false);};document.head.appendChild(s);});
    return loading[src];
  }
  function sheet(inner){
    var bg=document.getElementById("t3Sheet");
    if(!bg){bg=document.createElement("div");bg.id="t3Sheet";bg.className="t3sheetBg";document.body.appendChild(bg);
      bg.addEventListener("click",function(e){if(e.target===bg||e.target.closest(".t3close"))close();});}
    bg.innerHTML="<div class='t3sheet' role='dialog' aria-modal='true'>"+inner+"</div>";
    bg.classList.add("open"); document.documentElement.classList.add("t3lock");
    return bg;
  }
  function close(){var bg=document.getElementById("t3Sheet");if(bg){bg.classList.remove("open");bg.innerHTML="";}document.documentElement.classList.remove("t3lock");}

  var last=null;
  function render(el,cars,helpers){
    if(!el) return Promise.resolve(null);
    helpers=helpers||{};
    var box=document.getElementById("t3Full");
    if(!box){box=document.createElement("div");box.id="t3Full";el.appendChild(box);}
    box.innerHTML="<p class='muted'>Working out the scores…</p>";
    return Promise.all([loadScript("data/recalls-uk.js?v=1"),loadScript("data/specs-uk.js?v=1"),measured060(cars.a.plate),measured060(cars.b.plate)]).then(function(r){
      var meas={}; if(r[2]) meas[vrn(cars.a.plate)]=r[2]; if(r[3]) meas[vrn(cars.b.plate)]=r[3];
      function go(){
        var ctx={measured:meas};
        var A=prep(Object.assign({},cars.a,{user:userFor(cars.a.plate)}),ctx), B=prep(Object.assign({},cars.b,{user:userFor(cars.b.plate)}),ctx);
        last=compare(A,B,{miles:store().miles,monthCost:helpers.monthCost||root.monthCost});
        box.innerHTML=html(last);
        wire(box,go);
      }
      go();
      return last;
    });
  }
  function wire(box,again){
    box.querySelectorAll(".t3in").forEach(function(i){
      i.onchange=function(){var v=parseFloat(i.value)||0;if(i.getAttribute("data-k")==="miles")setMiles(v);else setUser(i.getAttribute("data-plate"),i.getAttribute("data-k"),v);
        var open=box.querySelector(".t3you")&&box.querySelector(".t3you").open;again();if(open&&box.querySelector(".t3you"))box.querySelector(".t3you").open=true;};
    });
    var how=box.querySelector(".t3how"); if(how) how.onclick=function(){sheet(howHtml(last));};
    box.querySelectorAll(".t3x").forEach(function(b){b.onclick=function(){removeLog(b.getAttribute("data-del"));again();};});
    box.querySelectorAll(".t3log").forEach(function(b){b.onclick=function(){
      var p=b.getAttribute("data-plate"), c=last&&(last.a.plate===p?last.a:last.b);
      var bg=sheet(logHtml(p,c?c.name:"")), cat=CATS[0], fixed=false;
      bg.querySelectorAll(".t3chip").forEach(function(ch){ch.onclick=function(){bg.querySelectorAll(".t3chip").forEach(function(x){x.classList.remove("on");});ch.classList.add("on");cat=ch.getAttribute("data-cat");};});
      bg.querySelectorAll(".t3seg button").forEach(function(s){s.onclick=function(){bg.querySelectorAll(".t3seg button").forEach(function(x){x.classList.remove("on");});s.classList.add("on");fixed=s.getAttribute("data-fixed")==="1";};});
      bg.querySelector(".t3save").onclick=function(){
        addLog({plate:p,name:c?c.name:"",cat:cat,date:bg.querySelector("#t3lDate").value,miles:+bg.querySelector("#t3lMiles").value||0,cost:+bg.querySelector("#t3lCost").value||0,note:bg.querySelector("#t3lNote").value.trim().slice(0,200),fixed:fixed});
        close();again();
      };
    };});
  }

  root.T3Compare={W:W,CATS:CATS,normFor:normFor,faultAreas:faultAreas,recallsFor:recallsFor,recallStatus:recallStatus,specsFor:specsFor,
    prep:prep,compare:compare,verdict:verdict,html:html,howHtml:howHtml,logHtml:logHtml,render:render,
    addLog:addLog,logsFor:logsFor,removeLog:removeLog,userFor:userFor,setUser:setUser,setMiles:setMiles,diyTextFor:diyTextFor,showHow:function(){sheet(howHtml(last));}};
})(typeof window!=="undefined"?window:globalThis);
