/* Per-car Wallet records in the existing dipstick IndexedDB "files" store, so
   Driv3Backup already includes them. Keys: gt.wallet.<carId>. */
(function(root){
  "use strict";
  function vrn(c){ return String((c&&c.plate)||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  function carId(c){ return (c&&c.id)||vrn(c)||"none"; }
  function keyFor(c){ return "gt.wallet."+carId(c); }
  function db(){
    return new Promise(function(res,rej){
      var r=indexedDB.open("dipstick",2);
      r.onupgradeneeded=function(){ if(!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files"); };
      r.onsuccess=function(){ res(r.result); };
      r.onerror=function(){ rej(r.error); };
    });
  }
  async function idbGet(k){
    try{
      var d=await db();
      return await new Promise(function(res,rej){
        var t=d.transaction("files").objectStore("files").get(k);
        t.onsuccess=function(){ res(t.result||null); };
        t.onerror=function(){ rej(t.error); };
      });
    }catch(e){ return null; }
  }
  async function idbPut(k,v){
    var d=await db();
    return new Promise(function(res,rej){
      var t=d.transaction("files","readwrite").objectStore("files").put(v,k);
      t.onsuccess=function(){ res(); };
      t.onerror=function(){ rej(t.error); };
    });
  }
  function empty(){ return {v:1,docs:[]}; }
  function currentCar(){
    try{
      var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
      if(s&&s.cars&&s.cars.length) return s.cars[s.i]||s.cars[0];
    }catch(e){}
    return {plate:"",id:"none"};
  }
  function saveCar(mut){
    try{
      var s=JSON.parse(localStorage.getItem("gt.garage")||"null");
      if(!s||!s.cars||!s.cars.length) return;
      mut(s.cars[s.i]||s.cars[0]);
      localStorage.setItem("gt.garage",JSON.stringify(s));
    }catch(e){}
  }
  /* Insurance files live once, in gt.insDocs.<plate> (the Reminders > Insurance
     list). Wallet insurance items just point at them (ref:1, insId) so the photo
     or PDF isn't stored twice; the blob is joined in when the wallet loads. */
  async function insList(c){
    var plate=vrn(c)||"none";
    var list=await idbGet("gt.insDocs."+plate); list=Array.isArray(list)?list.slice():[];
    var old=await idbGet("gt.insPdf."+plate);
    if(old&&old.blob) list.unshift({id:"legacy",title:"Policy",name:old.name||"policy.pdf",type:old.type||"application/pdf",blob:old.blob,at:old.at||0,legacy:1});
    return list;
  }
  async function load(c){
    c=c||currentCar();
    var rec=await idbGet(keyFor(c));
    if(!rec||!Array.isArray(rec.docs)) rec=empty();
    var list=await insList(c);
    var changed=false;
    if(migrateInsurance(rec,list)) changed=true;
    if(migrateV5cRef(c,rec)) changed=true;
    /* Join blobs; drop refs whose file was deleted from Reminders > Insurance. */
    var byId={}; list.forEach(function(d){ if(d&&d.id) byId[d.id]=d; });
    var kept=[];
    rec.docs.forEach(function(d){
      if(d&&d.ref&&d.insId){
        var src=byId[d.insId];
        if(!src||!src.blob){ changed=true; return; }
        d.blob=src.blob; d.type=d.type||src.type; d.name=d.name||src.name;
      }
      kept.push(d);
    });
    rec.docs=kept;
    if(changed) await save(c,rec);
    return rec;
  }
  function stripRefs(rec){
    return {v:1,docs:(rec.docs||[]).map(function(d){
      if(d&&d.ref&&d.insId&&d.blob){ var o=Object.assign({},d); delete o.blob; return o; }
      return d;
    })};
  }
  async function save(c,rec){
    c=c||currentCar();
    rec=rec||empty();
    rec.v=1;
    await idbPut(keyFor(c),stripRefs(rec));
    return rec;
  }
  function newId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

  function migrateInsurance(rec,list){
    rec.docs=rec.docs||[];
    var changed=false;
    list.forEach(function(d){
      if(!d||!d.blob) return;
      var hit=rec.docs.find(function(x){
        return x.slot==="insurance" && (x.insId===d.id || (x.name===d.name && x.at===d.at));
      });
      if(hit){
        /* earlier builds copied the blob; switch it to a reference */
        if(!hit.ref&&hit.insId===d.id){ hit.ref=1; changed=true; }
        return;
      }
      rec.docs.push({
        id:newId(),
        slot:"insurance",
        title:d.title||d.name||"Insurance",
        name:d.name||"document",
        type:d.type||(d.blob&&d.blob.type)||"application/pdf",
        number:d.number||"",
        at:d.at||Date.now(),
        insId:d.id||"",
        ref:1
      });
      changed=true;
    });
    return changed;
  }
  function migrateV5cRef(c,rec){
    var n=String((c&&c.v5cRef)||"").replace(/\D/g,"");
    if(n.length!==11) return false;
    if(rec.docs.some(function(d){ return d.slot==="v5c" && String(d.number||"").replace(/\D/g,"")===n; })) return false;
    rec.docs.push({id:newId(),slot:"v5c",title:"V5C logbook",number:n,at:Date.now(),fromTax:1});
    return true;
  }

  async function putDoc(c,doc){
    var rec=await load(c);
    if(!doc.id) doc.id=newId();
    if(!doc.at) doc.at=Date.now();
    var i=rec.docs.findIndex(function(x){return x.id===doc.id});
    if(i>=0) rec.docs[i]=doc; else rec.docs.push(doc);
    await save(c,rec);
    return doc;
  }
  async function removeDoc(c,id){
    var rec=await load(c);
    rec.docs=rec.docs.filter(function(x){return x.id!==id});
    await save(c,rec);
    return rec;
  }
  function docsIn(rec,slot){
    return (rec&&rec.docs||[]).filter(function(d){ return d.slot===slot; });
  }
  function firstIn(rec,slot){ return docsIn(rec,slot)[0]||null; }
  function v5cNumber(rec){
    var d=firstIn(rec,"v5c");
    var n=d?String(d.number||"").replace(/\D/g,""):"";
    return n.length===11?n:"";
  }

  function parseISO(iso){
    if(!iso||!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
    return new Date(iso.slice(0,10)+"T12:00:00");
  }
  /* Years of no-claims bonus: base years as of ncbAt, plus one for each
     insurance renewal anniversary that has passed since then. Uses the car's
     insurance renewal date (month/day) when set. */
  function ncbCurrent(doc, car){
    var base=parseInt(doc&&doc.ncbYears,10); if(isNaN(base)||base<0) base=0;
    var from=parseISO(doc&&doc.ncbAt);
    if(!from) return base;
    var renew=parseISO((car&&car.ins)||(doc&&doc.ncbAt));
    var month=renew?renew.getMonth():from.getMonth();
    var day=renew?renew.getDate():from.getDate();
    var today=new Date(); today.setHours(12,0,0,0);
    var y=from.getFullYear();
    var next=new Date(y, month, day, 12,0,0,0);
    if(next<=from) next.setFullYear(y+1);
    var n=0;
    while(next<=today){ n++; next.setFullYear(next.getFullYear()+1); if(n>80) break; }
    return base+n;
  }
  function ncbNextDate(doc, car){
    var renew=parseISO((car&&car.ins)||(doc&&doc.ncbAt));
    if(!renew) return "";
    var today=new Date(); today.setHours(12,0,0,0);
    var next=new Date(today.getFullYear(), renew.getMonth(), renew.getDate(), 12,0,0,0);
    if(next<=today) next.setFullYear(next.getFullYear()+1);
    var m=next.getMonth()+1, d=next.getDate();
    return next.getFullYear()+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  }

  var api={
    carId:carId,vrn:vrn,keyFor:keyFor,currentCar:currentCar,saveCar:saveCar,
    load:load,save:save,putDoc:putDoc,removeDoc:removeDoc,newId:newId,
    docsIn:docsIn,firstIn:firstIn,v5cNumber:v5cNumber,
    migrateInsurance:migrateInsurance,stripRefs:stripRefs,
    ncbCurrent:ncbCurrent,ncbNextDate:ncbNextDate,
    idbGet:idbGet,idbPut:idbPut
  };
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else {
    root.D3WalletStore=api;
    if(!root.D3Wallet) root.D3Wallet={
      openInsuranceDoc:function(d){
        var id=(d&&(d.id||d.insId))||"";
        var from=(root.location.pathname.split("/").pop()||"home.html");
        root.location.href="wallet.html?open=insurance"+(id?("&doc="+encodeURIComponent(id)):"")+"&from="+encodeURIComponent(from);
        return Promise.resolve();
      }
    };
  }
})(typeof window!=="undefined"?window:globalThis);
