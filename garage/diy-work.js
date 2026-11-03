/* Driv3 DIY "Work done" entries - one store shared by Drive diary + History.
   Text in localStorage "gt.diy" (array); photos/invoices as blobs in IndexedDB "dipstick" store "files" under "gt.diyFile.<id>".
   Both are covered by the .driv3 backup (gt.* keys + dipstick DB). */
(function(root){
  var KEY="gt.diy", GONE="gt.diyGone";
  var LABEL={service:"Full service done",mot:"MOT passed",belt:"Timing belt changed",tyre:"Tyres fitted"};
  function rd(k,d){try{return JSON.parse(localStorage.getItem(k)||"null")||d}catch(e){return d}}
  function all(){return rd(KEY,[])}
  function put(list){localStorage.setItem(KEY,JSON.stringify(list))}
  function vrn(p){return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
  function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
  function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function minusYear(s){var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s||"");return m?(+m[1]-1)+"-"+m[2]+"-"+m[3]:""}
  function get(id){return all().filter(function(e){return e.id===id})[0]||null}
  function forPlate(p){var v=vrn(p);return all().filter(function(e){return !v||(e.plate?e.plate===v:(root.D3Car?D3Car.owns("",v):true))})}
  function save(e){var l=all(),i=-1;l.forEach(function(x,n){if(x.id===e.id)i=n});e.updated=Date.now();if(!e.id){e.id=uid();e.created=Date.now()}if(i<0)l.push(e);else l[i]=e;put(l);return e}
  function db(){return new Promise(function(res,rej){var r=indexedDB.open("dipstick",2);r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains("files"))r.result.createObjectStore("files")};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
  function tx(mode,fn){return db().then(function(d){return new Promise(function(res,rej){var t=d.transaction("files",mode),s=t.objectStore("files"),out=fn(s);t.oncomplete=function(){res(out&&out.result!==undefined?out.result:out)};t.onerror=function(){rej(t.error)}})})}
  function putBlob(id,blob){return tx("readwrite",function(s){s.put(blob,"gt.diyFile."+id)})}
  function getBlob(id){return tx("readonly",function(s){return s.get("gt.diyFile."+id)})}
  function delBlob(id){return tx("readwrite",function(s){s.delete("gt.diyFile."+id)})}
  function remove(id){var e=get(id);if(!e)return Promise.resolve();put(all().filter(function(x){return x.id!==id}));
    if(e.auto){var g=rd(GONE,[]);g.push(e.auto);localStorage.setItem(GONE,JSON.stringify(g))}
    return Promise.all((e.files||[]).map(function(f){return delBlob(f.id).catch(function(){})}))}
  function compress(file){
    if(!/^image\//.test(file.type)||/gif|svg/.test(file.type))return Promise.resolve(file);
    return new Promise(function(res){var u=URL.createObjectURL(file),im=new Image();
      im.onload=function(){var s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
        c.getContext("2d").drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){res(b&&b.size<file.size?b:file)},"image/jpeg",0.8)};
      im.onerror=function(){URL.revokeObjectURL(u);res(file)};im.src=u})}
  /* Add a file to an entry: kind "photo" | "invoice" */
  function addFile(e,file,kind,title,price){return compress(file).then(function(b){var f={id:uid(),kind:kind,name:file.name||"file",type:b.type||file.type,title:title||"",price:price||""};
    return putBlob(f.id,b).then(function(){e.files=e.files||[];e.files.push(f);return f})})}
  /* Auto "work done" event for a car type+date (no duplicates, and never re-adds one the user deleted) */
  function markDone(car,type,date){
    if(!date||!LABEL[type])return null;var v=vrn(car&&car.plate),k=v+"|"+type+"|"+date;
    if(rd(GONE,[]).indexOf(k)>=0)return null;
    if(all().some(function(e){return e.auto===k||(e.plate===v&&e.kind===type&&e.date===date)}))return null;
    return save({date:date,plate:v,kind:type,auto:k,title:LABEL[type],desc:"",files:[]})}
  function doneDates(c){return {service:minusYear(c.oil),mot:minusYear(c.mot),belt:(c.beltDate||"").slice(0,10),tyre:(c.tyreDate||"").slice(0,10)}}
  /* Compare old vs new car fields after an edit; log any new last-done date that is not in the future */
  function onEdit(before,after){var a=doneDates(before||{}),b=doneDates(after||{}),t=iso(new Date());
    Object.keys(b).forEach(function(k){if(b[k]&&b[k]!==a[k]&&b[k]<=t)markDone(after,k,b[k])})}
  /* Backfill from saved dates: last-done within the past 60 days */
  function backfill(){var g=rd("gt.garage",null),t=new Date(),lo=iso(new Date(t.getTime()-60*864e5)),hi=iso(t);
    ((g&&g.cars)||[]).forEach(function(c){var d=doneDates(c);Object.keys(d).forEach(function(k){if(d[k]&&d[k]>=lo&&d[k]<=hi)markDone(c,k,d[k])})})}
  /* Cost of an entry: typed prices always count; prices read from receipts count once per identical amount (order confirmation + delivery screenshot), unticked (skip) ones don't. */
  function cost(e){var seen={},t=0;(e&&e.files||[]).forEach(function(f){if(f.skip)return;var n=parseFloat(String(f.price||"").replace(/[^0-9.]/g,""));if(!isFinite(n)||!n)return;
    if(f.priceSrc==="receipt"){var k=n.toFixed(2);if(seen[k])return;seen[k]=1}t+=n});return Math.round(t*100)/100}
  root.D3Diy={cost:cost,KEY:KEY,all:all,get:get,forPlate:forPlate,save:save,remove:remove,addFile:addFile,getBlob:getBlob,delBlob:delBlob,markDone:markDone,onEdit:onEdit,backfill:backfill,vrn:vrn,LABEL:LABEL};
})(this);
