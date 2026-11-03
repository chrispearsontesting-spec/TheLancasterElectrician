/* Driv3 maintenance links: one place that records "done" work so the planner, MOT page,
   reminders, car details and Drive diary all agree. Per car, keyed by number plate. */
(function(root){
  function rd(k,d){try{var v=JSON.parse(localStorage.getItem(k)||"null");return v==null?d:v}catch(e){return d}}
  function wr(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  function vrn(p){return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
  function iso(d){d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function plusYear(s){var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s||"");return m?(+m[1]+1)+"-"+m[2]+"-"+m[3]:""}
  /* MOT job ids (jobs-data.js) grouped into the areas the MOT page ticks */
  var CAT={tyres2:"Tyres",pads:"Brakes",fpads:"Brakes",rearpads:"Brakes",rpads:"Brakes",caliper:"Brakes",hoses:"Brakes",brakepipe:"Brakes",handbrake:"Brakes",
    spring:"Suspension",damp:"Suspension",rdamp:"Suspension",drop:"Suspension",arbbush:"Suspension",balljoint:"Suspension",track:"Suspension",bearing:"Suspension",wishbone:"Suspension",bush:"Suspension",subframe:"Suspension",
    exhaust:"Exhaust",backbox:"Exhaust",cat:"Exhaust",dpfr:"Exhaust"};
  function key(p){return "gt.motDone."+vrn(p)}
  function load(p){var o=rd(key(p),null);if(!o){var old=rd("gt.motDone",null);o=old||{};}
    var t=iso(),ch=false;Object.keys(o).forEach(function(k){if(o[k]===true){o[k]={at:t};ch=true}});if(ch&&vrn(p))wr(key(p),o);return o}
  function garage(){return rd("gt.garage",null)}
  function carIdx(g,p){var v=vrn(p),i=-1;((g&&g.cars)||[]).forEach(function(c,n){if(i<0&&vrn(c.plate)===v)i=n});return i}
  /* Is this item done since `since` (yyyy-mm-dd, e.g. the MOT test day)? A tick made before a newer MOT no longer counts. */
  function isDone(p,name,since){var e=load(p)[name];since=String(since||"").slice(0,10);
    if(e&&(!since||String(e.at||"")>=since))return true;
    /* Tyres changed in car details / home (fitted date after the MOT) also count */
    if(name==="Tyres"&&since){var g=garage(),i=carIdx(g,p),c=i>=0?g.cars[i]:null;if(c&&c.tyreDate&&String(c.tyreDate).slice(0,10)>=since)return true}
    return false}
  /* Mark an item done (on=true) or undo it. Updates the car's own dates so every page moves on together. */
  function setDone(p,name,on,date){
    var o=load(p),g=garage(),i=carIdx(g,p),c=i>=0?g.cars[i]:null,d=(date||iso()).slice(0,10),prev=o[name]||{};
    if(on){ var e={at:d};
      if(c){ if(name==="Tyres"){e.prev=c.tyreDate||"";c.tyreDate=d;if(!c.tyreLife)c.tyreLife="20000";}
        else if(name==="Service"){e.prev=c.oil||"";c.oil=plusYear(d);}
        else if(name==="Timing belt"){e.prev=c.beltDate||"";c.beltDate=d;} }
      o[name]=e;
      if(c&&root.D3Diy){var t={Tyres:"tyre",Service:"service","Timing belt":"belt"}[name];if(t)try{D3Diy.markDone(c,t,d)}catch(x){}}
    } else {
      if(c&&prev.prev!==undefined){ if(name==="Tyres"&&c.tyreDate===prev.at)c.tyreDate=prev.prev;
        if(name==="Service"&&c.oil===plusYear(prev.at))c.oil=prev.prev;
        if(name==="Timing belt"&&c.beltDate===prev.at)c.beltDate=prev.prev; }
      delete o[name];
    }
    wr(key(p),o); if(c) wr("gt.garage",g);
    try{root.dispatchEvent(new CustomEvent("d3maint",{detail:{plate:vrn(p),name:name,on:on}}))}catch(x){}
    return o;
  }
  function catOf(jobId){return CAT[jobId]||null}
  /* Re-draw when another page or tab changed the data, or when the page comes back from the back/forward cache */
  function onChange(fn){var t;function go(){clearTimeout(t);t=setTimeout(fn,30)}
    root.addEventListener("storage",function(e){if(!e.key||/^gt\./.test(e.key))go()});
    root.addEventListener("pageshow",function(e){if(e.persisted)go()});
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")go()});
    root.addEventListener("d3maint",go);}
  root.D3Maint={load:load,isDone:isDone,setDone:setDone,catOf:catOf,onChange:onChange,vrn:vrn,iso:iso};
})(window);
