/* Driv3 free full export: a readable JSON copy of everything collect() gathers,
   plus an optional costs/history CSV. Restore uses Driv3Backup.restore(). */
(function(root){
  "use strict";
  function bak(){
    var B=root.Driv3Backup;
    if(B&&B.core) return B;
    if(B&&B.pack) return {core:B,summarize:B.summarize,collect:B.collect,restore:B.restore};
    throw new Error("Backup module is missing.");
  }
  function b64(u8){ var s=""; for(var i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
  function unb64(s){ return Uint8Array.from(atob(String(s||"")),function(c){return c.charCodeAt(0)}); }
  function today(){
    var d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function isoDate(v){
    if(v==null||v==="") return "";
    var n=+v;
    if(n>1e11){ var d=new Date(n); return isNaN(+d)?String(v):d.toISOString().slice(0,10); }
    return String(v);
  }

  async function snapToJson(snap){
    var B=bak(), blobs=[], dbs=[];
    for(var i=0;i<(snap.dbs||[]).length;i++){
      var d=snap.dbs[i], dd={name:d.name,version:d.version,stores:[]};
      for(var j=0;j<(d.stores||[]).length;j++){
        var s=d.stores[j], recs=[];
        for(var k=0;k<(s.records||[]).length;k++){
          var r=s.records[k];
          recs.push({k:await B.core.pack(r.k,blobs),v:await B.core.pack(r.v,blobs)});
        }
        dd.stores.push({name:s.name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:s.indexes||[],records:recs});
      }
      dbs.push(dd);
    }
    var encoded=blobs.map(function(b){
      var m={}; for(var key in b) if(key!=="data") m[key]=b[key];
      m.data=b64(b.data); return m;
    });
    return {v:1,app:"Driv3",format:"driv3-json",created:Date.now(),summary:B.summarize(snap),ls:snap.ls||{},dbs:dbs,blobs:encoded};
  }

  function jsonToSnap(obj){
    if(!obj||obj.format!=="driv3-json") throw new Error("This isn't a Driv3 export file.");
    if(obj.v!==1) throw new Error("This export was made by a newer Driv3. Update the app first.");
    var B=bak();
    var blobs=(obj.blobs||[]).map(function(m){
      var b={}; for(var key in m) if(key!=="data") b[key]=m[key];
      b.data=unb64(m.data); return b;
    });
    return {ls:Object.assign({},obj.ls||{}),dbs:(obj.dbs||[]).map(function(d){
      return {name:d.name,version:d.version,stores:(d.stores||[]).map(function(s){
        return {name:s.name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:s.indexes||[],
          records:(s.records||[]).map(function(r){ return {k:B.core.unpack(r.k,blobs),v:B.core.unpack(r.v,blobs)}; })};
      })};
    })};
  }

  function checkRestore(exported,snap){
    var B=bak();
    var sum=B.summarize(snap);
    var expKeys=Object.keys((exported&&exported.ls)||{}).sort();
    var gotKeys=Object.keys((snap&&snap.ls)||{}).sort();
    var keysOk=expKeys.length===gotKeys.length&&expKeys.every(function(k,i){return k===gotKeys[i];});
    var wantCars=exported&&exported.summary?exported.summary.cars:sum.cars;
    var garageOk=!exported||!exported.ls||exported.ls["gt.garage"]===(snap.ls||{})["gt.garage"];
    return {ok:!!(keysOk&&sum.cars===wantCars&&garageOk),cars:sum.cars,files:sum.files,keys:gotKeys.length,dbs:(snap.dbs||[]).length};
  }

  function looksLikeExport(text){
    try{ var o=typeof text==="string"?JSON.parse(text):text; return !!(o&&o.format==="driv3-json"&&o.v); }
    catch(e){ return false; }
  }

  function openJson(text){
    var obj=typeof text==="string"?JSON.parse(text):text;
    var snap=jsonToSnap(obj);
    return {obj:obj,snap:snap,summary:bak().summarize(snap),created:obj.created,check:checkRestore(obj,snap)};
  }

  async function makeJson(snap){
    if(!snap){
      if(!bak().collect) throw new Error("Can't collect data in this environment.");
      snap=await bak().collect();
    }
    var obj=await snapToJson(snap);
    var text=JSON.stringify(obj);
    var back=jsonToSnap(JSON.parse(text));
    var check=checkRestore(obj,back);
    return {obj:obj,text:text,name:"driv3-backup-"+today()+".json",summary:obj.summary,check:check};
  }

  function csvEsc(v){
    v=String(v==null?"":v);
    if(/[",\n\r]/.test(v)) return '"'+v.replace(/"/g,'""')+'"';
    return v;
  }
  function row(type,date,plate,title,miles,cost,notes){
    return [type,isoDate(date),plate||"",title||"",miles==null||miles===""?"":miles,cost==null||cost===""?"":cost,notes||""].map(csvEsc).join(",");
  }

  function makeCsv(ls){
    ls=ls||{};
    var lines=["type,date,plate,title,miles,cost_gbp,notes"];
    try{
      var g=JSON.parse(ls["gt.garage"]||"null");
      ((g&&g.cars)||[]).forEach(function(c){
        if(!c) return;
        lines.push(row("car",c.added||"",c.plate,[c.name,c.nick].filter(Boolean).join(" "),c.miles||c.mileage||"", "", c.fuel||""));
      });
    }catch(e){}
    try{
      (JSON.parse(ls["gt.driveLog"]||"[]")||[]).forEach(function(t){
        if(!t||t.type==="run") return;
        lines.push(row("journey",t.end||t.when||t.date,t.plate,(t.from&&t.to)?t.from+" → "+t.to:(t.title||""),t.miles,t.cost,t.note||t.fuel||""));
      });
    }catch(e){}
    try{
      (JSON.parse(ls["gt.loggedTrips"]||"[]")||[]).forEach(function(t){
        if(!t) return;
        lines.push(row("trip",t.when||t.date,t.plate,t.title||"",t.miles,t.cost,t.note||""));
      });
    }catch(e){}
    try{
      (JSON.parse(ls["gt.diy"]||"[]")||[]).forEach(function(e){
        if(!e) return;
        lines.push(row("work",e.date||e.created,e.plate,e.title||e.kind||"Work done","",e.cost||"",e.desc||e.kind||""));
      });
    }catch(e){}
    try{
      (JSON.parse(ls["dipstick-history"]||"[]")||[]).forEach(function(h){
        if(!h) return;
        lines.push(row("history",h.ts||h.date,h.plate,h.note||h.title||"History","",h.cost||"",h.type||""));
      });
    }catch(e){}
    return {text:lines.join("\n")+"\n",name:"driv3-costs-"+today()+".csv"};
  }

  var api={snapToJson:snapToJson,jsonToSnap:jsonToSnap,checkRestore:checkRestore,openJson:openJson,makeJson:makeJson,makeCsv:makeCsv,looksLikeExport:looksLikeExport,today:today};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  root.Driv3Export=api;
})(typeof window!=="undefined"?window:globalThis);
