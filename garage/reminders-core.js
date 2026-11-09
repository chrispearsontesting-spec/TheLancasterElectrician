/* Driv3 reminders core — pure, no DOM. Used by home.html, calendar.html, reminders.html
   and the native (Capacitor) build to schedule local notifications.
   Browser: window.D3Rem.  CommonJS: module.exports. */
(function(root){
  var KEY="gt.reminders";
  var TYPES=[
    {type:"mot",label:"MOT",icon:"🛠",color:"#5aa9ff",field:"mot",book:true,job:"mot"},
    {type:"tax",label:"Tax",icon:"£",color:"#ffd166",field:"tax"},
    {type:"insurance",label:"Insurance",icon:"🛡",color:"#7ee0a1",field:"ins"},
    {type:"service",label:"Full service",icon:"🔧",color:"#ff9f68",field:"oil",book:true,job:"service"},
    {type:"belt",label:"Timing belt",icon:"⚙",color:"#c792ea",book:true,job:"belt"},
    {type:"tyres",label:"Tyres",icon:"◉",color:"#80cbc4",book:true,job:"tyre"}
  ];
  var DEFAULTS={version:2,hour:9,types:{
    mot:{on:true,lead:21,every:1},tax:{on:true,lead:7,every:1},insurance:{on:true,lead:7,every:1},
    service:{on:true,lead:14,every:1},belt:{on:true,lead:30,every:0},tyres:{on:true,lead:21,every:7}}};
  /* every: repeat interval in days counted from lead start (1 daily, 2 every other day, 3, 7 weekly, 0 once at start). Due day always fires. */
  var EVERY=[1,2,3,7,0];
  function clone(o){return JSON.parse(JSON.stringify(o))}
  function settings(raw){
    var s=clone(DEFAULTS),r=raw;
    if(typeof r==="string"){try{r=JSON.parse(r)}catch(e){r=null}}
    if(r&&typeof r==="object"){
      if(r.hour>=0&&r.hour<=23)s.hour=+r.hour;
      for(var k in s.types)if(r.types&&r.types[k]){var t=r.types[k];
        if(typeof t.on==="boolean")s.types[k].on=t.on;
        if(typeInfo(k).book)s.types[k].book=t.book===true;
        if(t.lead>=0&&t.lead<=365)s.types[k].lead=Math.round(+t.lead);
        if(typeof t.daily==="boolean")s.types[k].every=t.daily?1:0; /* legacy */
        if(t.every!=null&&EVERY.indexOf(+t.every)>=0)s.types[k].every=+t.every;
      }
    }
    for(var q in s.types){s.types[q].daily=s.types[q].every===1;if(typeInfo(q).book)s.types[q].book=s.types[q].book===true;}
    return s;
  }
  function load(ls){ls=ls||(typeof localStorage!=="undefined"?localStorage:null);return settings(ls&&ls.getItem(KEY))}
  function save(s,ls){ls=ls||localStorage;ls.setItem(KEY,JSON.stringify(settings(s)))}
  function vrn(p){return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
  function plate(p){p=vrn(p);return p.length>=7?p.slice(0,4)+" "+p.slice(4):p}
  function beltDue(c){if(!c.beltDate)return "";var d=new Date(c.beltDate+"T12:00:00");if(isNaN(d))return "";d.setFullYear(d.getFullYear()+(+(c.beltYears||5)));return iso(d)}
  function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function day(s){var m=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(s||"");if(!m)return null;var d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null}
  /* Same estimate as the home tread-life gauge: fitted date + expected life / annual miles. */
  function tyreDue(c){var d=day(c.tyreDate);if(!d||!(+c.tyreLife>0)||!(+c.miles>0))return "";d.setDate(d.getDate()+Math.round(+c.tyreLife/+c.miles*365));return isNaN(d)?"":iso(d)}
  function dueOf(c,type){type=type==="tyre"?"tyres":type;var t=typeInfo(type);return type==="belt"?beltDue(c):type==="tyres"?tyreDue(c):t?c[t.field]||"":""}
  function bookLink(c,type){return "book.html?car="+encodeURIComponent(c.id||vrn(c.plate)).replace(/'/g,"%27")+"&job="+(type==="tyre"?"tyres":type)}
  function phone(c){return String(c.motPhone||"").replace(/[^+0-9]/g,"")}
  function opened(c,type){var due=dueOf(c,type),b=c.garageBookings&&c.garageBookings[type];return !!(due&&b&&b.due===due)}
  function niceDate(s){var d=day(s);return d?d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}):""}
  function garageOf(g){if(typeof g==="string"){try{g=JSON.parse(g)}catch(e){g=null}}return g&&g.cars?g:{i:0,cars:[]}}
  function typeInfo(t){for(var i=0;i<TYPES.length;i++)if(TYPES[i].type===t)return TYPES[i];return null}
  /* All due dates: [{type,label,icon,color,due:"YYYY-MM-DD",carIndex,plate,vrn,name,book}] */
  function dueItems(garage){
    var g=garageOf(garage),out=[];
    g.cars.forEach(function(c,ci){TYPES.forEach(function(t){
      var due=dueOf(c,t.type);
      if(!day(due))return;
      out.push({type:t.type,label:t.label,icon:t.icon,color:t.color,due:String(due).slice(0,10),carIndex:ci,plate:plate(c.plate),vrn:vrn(c.plate),name:c.nick||c.name||"Car",book:!!t.book,bookLink:bookLink(c,t.type),phone:phone(c),emailOpened:opened(c,t.type),estimated:t.type==="tyres"});
    })});
    return out.sort(function(a,b){return a.due<b.due?-1:1});
  }
  function fireDays(start,due,every){
    var out=[],d=new Date(start);
    if(every>0){for(;d<due;d.setDate(d.getDate()+every))out.push(new Date(d))}else if(start<due)out.push(new Date(start));
    out.push(new Date(due));return out;
  }
  function daysUntil(due,now){var d=day(due),n=new Date(now||Date.now());n=new Date(n.getFullYear(),n.getMonth(),n.getDate());return Math.round((d-n)/86400000)}
  function phrase(type,days){
    var noun={mot:"MOT",tax:"road tax",insurance:"insurance",service:"full service",belt:"timing belt change",tyres:"tyre check / change"}[type];
    var v=type==="insurance"?"expires":"is due",v2=type==="insurance"?"expired":"was due";
    return {noun:noun,tail:days<0?v2+" "+(-days)+" day"+(days===-1?"":"s")+" ago":days===0?(type==="insurance"?"expires today":"is due today"):v+" in "+days+" day"+(days===1?"":"s")};
  }
  function text(it,days,offer){
    var t=typeInfo(it.type),p=phrase(it.type,days);
    return {title:t.label+" reminder — "+it.plate,body:"Your "+p.noun+" for "+it.plate+" "+p.tail+"."+(it.estimated?" Estimated date; check your tread.":"")+(offer?" Would you like to book it in? Tap to email your garage.":"")};
  }
  function link(it){return it.book?it.bookLink:"home.html#remind="+it.type+"&car="+it.vrn}
  function offer(it,s){return !!(it.book&&s.types[it.type].book&&!it.emailOpened)}
  function actions(it,s){return offer(it,s)?[{action:"book",title:"Book by email"}].concat(it.phone?[{action:"call",title:"Call garage"}]:[]):[]}
  function nid(s){var h=7;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%2000000000}
  /* Items whose reminder window is open today (incl. overdue up to 30 days). */
  function active(garage,setts,now,includeOff){
    var s=settings(setts);
    return dueItems(garage).filter(function(it){var t=s.types[it.type];if(!t||(!t.on&&!includeOff))return false;var d=daysUntil(it.due,now);return d<=t.lead&&d>=-30})
      .map(function(it){var d=daysUntil(it.due,now),bk=offer(it,s),x=text(it,d,bk);it.days=d;it.title=x.title;it.body=x.body;it.link=link(it);it.offer=bk;it.actions=actions(it,s);it.action=bk?"email-garage":"open";return it});
  }
  /* Notifications to schedule for the next `horizon` days (default 60).
     Each: {id,type,carIndex,plate,vrn,due,fireAt:Date(local hour),fireAtISO,title,body,action,link,extra} */
  function upcoming(garage,setts,now,horizon){
    var s=settings(setts),n=new Date(now||Date.now()),H=horizon||60,out=[];
    var today=new Date(n.getFullYear(),n.getMonth(),n.getDate());
    dueItems(garage).forEach(function(it){
      var t=s.types[it.type];if(!t||!t.on)return;
      var due=day(it.due),start=new Date(due);start.setDate(start.getDate()-t.lead);
      var dates=[];
      dates=fireDays(start,due,t.every);
      dates.forEach(function(d){
        var f=new Date(d.getFullYear(),d.getMonth(),d.getDate(),s.hour,0,0);
        if(f<=n||(f-today)/86400000>H)return;
        var left=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(due.getFullYear(),due.getMonth(),due.getDate()))/-86400000);
        var bk=offer(it,s),x=text(it,left,bk);
        out.push({id:nid(it.type+"|"+it.vrn+"|"+iso(d)),type:it.type,carIndex:it.carIndex,plate:it.plate,vrn:it.vrn,due:it.due,daysLeft:left,
          fireAt:f,fireAtISO:f.toISOString(),title:x.title,body:x.body,offer:bk,actions:actions(it,s),action:bk?"email-garage":"open",link:link(it),
          extra:{type:it.type,car:it.vrn,link:link(it),bookLink:it.bookLink,phone:it.phone,due:it.due}});
      });
    });
    return out.sort(function(a,b){return a.fireAt-b.fireAt});
  }
  /* Friendly booking email (no mileage). Returns {to,subject,body,href} (href "" when no garage email). */
  function email(car,type,opts){
    var c=car||{},o=opts||{};type=type==="tyre"?"tyres":type;
    var pl=plate(c.plate),model=[c.make,c.model].filter(Boolean).join(" ")||c.name||c.nick||"car";
    var due=dueOf(c,type),job={mot:"an MOT",service:"a full service",belt:"a timing belt change",tyres:"a tyre check"}[type]||"a service";
    var subj={mot:"MOT",service:"Full service",belt:"Timing belt change",tyres:"Tyre check"}[type]||"Booking";
    var when=day(o.preferredDate)?" on "+niceDate(o.preferredDate):"",fuel=type==="service"&&c.fuel?String(c.fuel).trim().toLowerCase():"",tag=[pl,fuel].filter(Boolean).join(", "),car2="my "+model+(tag?" ("+tag+")":"");
    var lines=["Hi "+(String(c.motName||"").trim()||"there")+",","","Could I book "+car2+" in for "+job+when+"?"],info=[];
    function d(v){return day(v)?niceDate(v):""}
    if(type==="mot"&&d(due))info.push("The current MOT runs out on "+d(due)+".");
    if(type==="service"){var last=d(c.lastService||o.lastService);if(d(due))info.push("It's due on "+d(due)+(last?" and the last one was on "+last:"")+".");else if(last)info.push("The last one was on "+last+".");}
    if(type==="belt"){var was=d(c.beltDate);if(was)info.push("The belt was last changed on "+was+(d(due)?", so it's due by "+d(due):"")+".");else if(d(due))info.push("It's due by "+d(due)+".")}
    if(type==="tyres"){var fit=d(c.tyreDate),sz=String(c.tyreSize||"").trim();if(fit||sz)info.push("The tyres"+(sz?" ("+sz+")":"")+(fit?" were fitted on "+fit:"")+(fit?".":" need a look."));if(d(due))info.push("I reckon they're due a check around "+d(due)+".")}
    if(info.length)lines.push(info.join(" "));
    if(String(o.comments||"").trim())lines.push("","While it's in, could you also look at this?",String(o.comments).trim().slice(0,4000));
    lines.push("",(when?"Let me know if that day works":"Let me know when you can fit it in")+", and roughly what it'll cost.","","Thanks!");
    var subject=subj+(pl?" for "+pl:""),to=String(c.motEmail||"").trim(),body=lines.join("\n");
    return {to:to,subject:subject,body:body,href:/^[^@\s?&#]+@[^@\s?&#]+\.[^@\s?&#]+$/.test(to)?"mailto:"+encodeURIComponent(to).replace(/%40/g,"@")+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body):""};
  }
  /* Parse "#remind=mot&car=AB12CDE" -> {type,car} or null */
  function parseLink(h){var m=/remind=([a-z]+)/.exec(h||""),c=/car=([A-Za-z0-9]+)/.exec(h||"");return m?{type:m[1],car:c?c[1].toUpperCase():""}:null}
  var api={KEY:KEY,TYPES:TYPES,DEFAULTS:DEFAULTS,settings:settings,EVERY:EVERY,fireDays:fireDays,load:load,save:save,dueItems:dueItems,active:active,upcoming:upcoming,email:email,parseLink:parseLink,daysUntil:daysUntil,beltDue:beltDue,tyreDue:tyreDue,dueOf:dueOf,bookLink:bookLink,phone:phone,opened:opened,iso:iso,plate:plate,vrn:vrn,niceDate:niceDate};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.D3Rem=api;
})(typeof self!=="undefined"?self:this);
