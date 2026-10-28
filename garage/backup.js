/* Driv3 encrypted backup. Everything stays on the phone; the file goes where the owner saves it.
   File (.driv3): "DRIV3BK1" | uint32 headerLen | header JSON {v,kdf,hash,iter,salt,iv,created,app} | AES-256-GCM ciphertext
   Plaintext: uint32 manifestLen | manifest JSON | blob bytes. Blobs/ArrayBuffers inside values become {"$blob":i} refs.
   Key: PBKDF2-SHA256(passphrase, random 16-byte salt, 300k iterations). Random 12-byte IV. */
(function(root){
  "use strict";
  var MAGIC="DRIV3BK1", ITER=300000, enc=new TextEncoder(), dec=new TextDecoder();
  var LS_RE=/^(gt\.|dipstick|dip\.|driv3)/, LS_SKIP={"gt.lock":1,"gt.lockTries":1};
  var DB_RE=/^(dipstick|driv3)/, KNOWN_DBS=["dipstick","dipstick-uploads"];
  function b64(u8){ var s=""; for(var i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
  function unb64(s){ return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)}); }
  function isBlob(v){ return typeof Blob!=="undefined"&&v instanceof Blob; }
  // Replace binary parts with refs. blobs: [{type, name?, data:Uint8Array}]
  async function pack(v,blobs){
    if(v===null||typeof v!=="object") return v;
    if(isBlob(v)){ var e={type:v.type||"",size:v.size,data:new Uint8Array(await v.arrayBuffer())}; if(typeof File!=="undefined"&&v instanceof File){ e.file=v.name; e.lm=v.lastModified; } blobs.push(e); return {$blob:blobs.length-1}; }
    if(v instanceof ArrayBuffer){ blobs.push({ab:1,data:new Uint8Array(v.slice(0))}); return {$blob:blobs.length-1}; }
    if(ArrayBuffer.isView(v)){ blobs.push({view:v.constructor.name,data:new Uint8Array(v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength))}); return {$blob:blobs.length-1}; }
    if(v instanceof Date) return {$date:v.getTime()};
    if(Array.isArray(v)){ var a=[]; for(var i=0;i<v.length;i++) a.push(await pack(v[i],blobs)); return a; }
    var o={}; for(var k in v) if(Object.prototype.hasOwnProperty.call(v,k)) o[k==="$blob"||k==="$date"?"$esc"+k:k]=await pack(v[k],blobs); return o;
  }
  function unpack(v,blobs){
    if(v===null||typeof v!=="object") return v;
    if(Array.isArray(v)) return v.map(function(x){return unpack(x,blobs)});
    if(typeof v.$blob==="number"&&Object.keys(v).length===1){ var b=blobs[v.$blob];
      if(b.ab) return b.data.buffer.slice(b.data.byteOffset,b.data.byteOffset+b.data.byteLength);
      if(b.view){ var C=root[b.view]||Uint8Array; var buf=b.data.buffer.slice(b.data.byteOffset,b.data.byteOffset+b.data.byteLength); return new C(buf); }
      if(b.file&&typeof File!=="undefined") return new File([b.data],b.file,{type:b.type,lastModified:b.lm});
      return new Blob([b.data],{type:b.type}); }
    if(typeof v.$date==="number"&&Object.keys(v).length===1) return new Date(v.$date);
    var o={}; for(var k in v) o[k.indexOf("$esc")===0?k.slice(4):k]=unpack(v[k],blobs); return o;
  }
  // snapshot = {ls:{k:v}, dbs:[{name,version,stores:[{name,keyPath,autoIncrement,indexes,records:[{k,v}]}]}]}
  async function serialize(snap){
    var blobs=[]; var man={v:1,ls:snap.ls,dbs:[]};
    for(var d of snap.dbs){ var dd={name:d.name,version:d.version,stores:[]};
      for(var s of d.stores){ var recs=[]; for(var r of s.records) recs.push({k:await pack(r.k,blobs),v:await pack(r.v,blobs)});
        dd.stores.push({name:s.name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:s.indexes,records:recs}); }
      man.dbs.push(dd); }
    var off=0; man.blobs=blobs.map(function(b){ var m={o:off,n:b.data.length}; off+=b.data.length; for(var k in b) if(k!=="data") m[k]=b[k]; return m; });
    var mj=enc.encode(JSON.stringify(man)), out=new Uint8Array(4+mj.length+off), dv=new DataView(out.buffer);
    dv.setUint32(0,mj.length); out.set(mj,4); var p=4+mj.length; blobs.forEach(function(b){ out.set(b.data,p); p+=b.data.length; });
    return out;
  }
  function deserialize(u8){
    var n=new DataView(u8.buffer,u8.byteOffset,u8.byteLength).getUint32(0), man=JSON.parse(dec.decode(u8.subarray(4,4+n))), base=4+n;
    var blobs=(man.blobs||[]).map(function(m){ var b={}; for(var k in m) b[k]=m[k]; b.data=u8.slice(base+m.o,base+m.o+m.n); return b; });
    return {ls:man.ls||{},dbs:(man.dbs||[]).map(function(d){ return {name:d.name,version:d.version,stores:d.stores.map(function(s){
      return {name:s.name,keyPath:s.keyPath,autoIncrement:s.autoIncrement,indexes:s.indexes||[],records:s.records.map(function(r){return {k:unpack(r.k,blobs),v:unpack(r.v,blobs)}})}; })}; })};
  }
  async function keyFrom(pass,salt,iter){
    var k=await crypto.subtle.importKey("raw",enc.encode(String(pass).normalize("NFC")),"PBKDF2",false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:salt,iterations:iter},k,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  async function encrypt(plain,pass,opt){
    opt=opt||{}; var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12)), iter=opt.iter||ITER;
    var hdr={v:1,app:"Driv3",kdf:"PBKDF2",hash:"SHA-256",iter:iter,cipher:"AES-256-GCM",salt:b64(salt),iv:b64(iv),created:opt.created||Date.now(),summary:opt.summary||null};
    var hj=enc.encode(JSON.stringify(hdr)), ad=enc.encode(MAGIC);
    var ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:iv,additionalData:hj},await keyFrom(pass,salt,iter),plain));
    var out=new Uint8Array(8+4+hj.length+ct.length); out.set(ad,0); new DataView(out.buffer).setUint32(8,hj.length); out.set(hj,12); out.set(ct,12+hj.length);
    return out;
  }
  function readHeader(u8){
    if(u8.length<16||dec.decode(u8.subarray(0,8))!==MAGIC) throw new Error("This isn't a Driv3 backup file.");
    var n=new DataView(u8.buffer,u8.byteOffset,u8.byteLength).getUint32(8);
    if(n>65536||12+n>u8.length) throw new Error("This backup file is damaged.");
    var hj=u8.subarray(12,12+n), h; try{ h=JSON.parse(dec.decode(hj)); }catch(e){ throw new Error("This backup file is damaged."); }
    if(h.v!==1) throw new Error("This backup was made by a newer Driv3. Update the app first.");
    return {h:h,hj:hj,ct:u8.subarray(12+n)};
  }
  async function decrypt(u8,pass){
    var p=readHeader(u8), key=await keyFrom(pass,unb64(p.h.salt),p.h.iter);
    try{ return {header:p.h,plain:new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(p.h.iv),additionalData:p.hj},key,p.ct))}; }
    catch(e){ var er=new Error("Wrong passphrase, or the file has been changed."); er.code="badpass"; throw er; }
  }
  function summarize(snap){
    var cars=0,files=0,bytes=0; try{ var g=JSON.parse(snap.ls["gt.garage"]||"null"); cars=g&&g.cars?g.cars.length:0; }catch(e){}
    function walk(v){ if(!v||typeof v!=="object") return; if(isBlob(v)){ files++; bytes+=v.size; return; } if(v instanceof ArrayBuffer||ArrayBuffer.isView(v)){ files++; bytes+=v.byteLength; return; } for(var k in v) walk(v[k]); }
    snap.dbs.forEach(function(d){ d.stores.forEach(function(s){ s.records.forEach(function(r){ walk(r.v); }); }); });
    try{ var h=JSON.parse(snap.ls["dipstick-history"]||"[]"); h.forEach(function(x){ if(x&&typeof x.data==="string"&&x.data.indexOf("data:")===0) files++; }); }catch(e){}
    return {cars:cars,files:files,bytes:bytes,keys:Object.keys(snap.ls).length};
  }
  function strength(p){
    p=String(p||""); if(!p) return {score:0,text:""};
    var cls=[/[a-z]/,/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(function(r){return r.test(p)}).length, words=p.trim().split(/\s+/).length;
    var s=p.length>=20||(words>=4&&p.length>=16)?3:p.length>=14&&cls>=2?3:p.length>=10&&cls>=2?2:p.length>=8?1:0;
    return {score:s,text:["Too short. Use at least 10 characters, or 4 random words.","Weak. Add more characters or words.","OK. Longer is stronger.","Strong."][s]};
  }
  var core={pack:pack,unpack:unpack,serialize:serialize,deserialize:deserialize,encrypt:encrypt,decrypt:decrypt,readHeader:readHeader,summarize:summarize,strength:strength,LS_RE:LS_RE,LS_SKIP:LS_SKIP,ITER:ITER};
  if(typeof module!=="undefined"&&module.exports){ module.exports=core; return; }

  // ---------------- browser: collect / restore ----------------
  function req(r){ return new Promise(function(res,rej){ r.onsuccess=function(){res(r.result)}; r.onerror=function(){rej(r.error)}; }); }
  function lsKeys(){ var ks=[]; for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(LS_RE.test(k)&&!LS_SKIP[k]) ks.push(k); } return ks.sort(); }
  async function dbNames(){
    var names=KNOWN_DBS.slice();
    if(indexedDB.databases){ try{ (await indexedDB.databases()).forEach(function(d){ if(d.name&&DB_RE.test(d.name)&&names.indexOf(d.name)<0) names.push(d.name); }); }catch(e){} }
    return names;
  }
  async function exists(name){ if(!indexedDB.databases) return true; try{ return (await indexedDB.databases()).some(function(d){return d.name===name}); }catch(e){ return true; } }
  async function dumpDb(name){
    if(!(await exists(name))) return null;
    var d=await new Promise(function(res,rej){ var r=indexedDB.open(name); r.onsuccess=function(){res(r.result)}; r.onerror=function(){rej(r.error)};
      r.onupgradeneeded=function(){ /* didn't exist */ r.transaction.abort(); }; }).catch(function(){ return null; });
    if(!d) return null;
    var out={name:name,version:d.version,stores:[]};
    for(var sn of Array.from(d.objectStoreNames)){
      var tx=d.transaction(sn), st=tx.objectStore(sn), keys=await req(st.getAllKeys()), vals=await req(st.getAll());
      out.stores.push({name:sn,keyPath:st.keyPath,autoIncrement:st.autoIncrement,
        indexes:Array.from(st.indexNames).map(function(n){ var ix=st.index(n); return {name:n,keyPath:ix.keyPath,unique:ix.unique,multiEntry:ix.multiEntry}; }),
        records:keys.map(function(k,i){ return {k:k,v:vals[i]}; })});
    }
    d.close(); return out;
  }
  async function collect(){
    var ls={}; lsKeys().forEach(function(k){ ls[k]=localStorage.getItem(k); });
    var dbs=[]; for(var n of await dbNames()){ var x=await dumpDb(n); if(x) dbs.push(x); }
    return {ls:ls,dbs:dbs};
  }
  function delDb(name){ return new Promise(function(res,rej){ var r=indexedDB.deleteDatabase(name); r.onsuccess=function(){res()}; r.onerror=function(){rej(r.error)};
    r.onblocked=function(){ rej(new Error("Close other Driv3 tabs or windows, then try again.")); }; }); }
  async function writeDb(d){
    await delDb(d.name);
    var db=await new Promise(function(res,rej){ var r=indexedDB.open(d.name,d.version||1);
      r.onupgradeneeded=function(){ d.stores.forEach(function(s){ var o={}; if(s.keyPath!=null) o.keyPath=s.keyPath; if(s.autoIncrement) o.autoIncrement=true;
        var st=r.result.createObjectStore(s.name,o); (s.indexes||[]).forEach(function(ix){ st.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry}); }); }); };
      r.onsuccess=function(){res(r.result)}; r.onerror=function(){rej(r.error)}; });
    for(var s of d.stores){ if(!s.records.length) continue;
      await new Promise(function(res,rej){ var tx=db.transaction(s.name,"readwrite"), st=tx.objectStore(s.name);
        s.records.forEach(function(r){ if(s.keyPath!=null) st.put(r.v); else st.put(r.v,r.k); });
        tx.oncomplete=function(){res()}; tx.onerror=function(){rej(tx.error)}; tx.onabort=function(){rej(tx.error||new Error("Restore stopped"))}; }); }
    db.close();
  }
  // Replace: wipes this app's data on the phone and puts the backup's in its place. Lock settings are left alone.
  async function restore(snap){
    var names=await dbNames(); snap.dbs.forEach(function(d){ if(names.indexOf(d.name)<0) names.push(d.name); });
    for(var n of names){ var b=snap.dbs.filter(function(d){return d.name===n})[0]; if(b) await writeDb(b); else await delDb(n); }
    lsKeys().forEach(function(k){ localStorage.removeItem(k); });
    Object.keys(snap.ls).forEach(function(k){ if(LS_RE.test(k)&&!LS_SKIP[k]) localStorage.setItem(k,snap.ls[k]); });
  }
  async function makeFile(pass){
    var snap=await collect(), sum=summarize(snap), plain=await serialize(snap);
    var bytes=await encrypt(plain,pass,{summary:null}); // summary not in header: header is not secret
    var d=new Date(), name="driv3-backup-"+d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+".driv3";
    return {bytes:bytes,name:name,summary:sum};
  }
  async function openFile(u8,pass){ var r=await decrypt(u8,pass), snap=deserialize(r.plain); return {snap:snap,summary:summarize(snap),created:r.header.created}; }
  root.Driv3Backup={collect:collect,restore:restore,makeFile:makeFile,openFile:openFile,readHeader:readHeader,summarize:summarize,strength:strength,core:core};
})(typeof window!=="undefined"?window:globalThis);
