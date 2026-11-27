/* Trac3 Wallet UI. */
(function(){
  "use strict";
  var Store=window.D3WalletStore, Lock=window.D3WalletLock, Ocr=window.D3WalletOcr, Bar=window.D3Barcode, View=window.D3DocView;
  var car=null, rec={docs:[]}, view="locked", current=null, camStream=null, camSlot=null, pendingFile=null, retakeOf=null;
  var torchOn=false, torchAvail=false, capturing=false, lastCapture=null, pendingReceipt=null;

  var DOCS=[
    {slot:"v5c",title:"V5C logbook"},
    {slot:"insurance",title:"Insurance",multi:true},
    {slot:"mot",title:"MOT certificate"},
    {slot:"receipt",title:"Service receipts",multi:true},
    {slot:"wheelnut",title:"Wheel nut code"}
  ];
  var CARDS=[
    {slot:"licence",title:"Driving licence"},
    {slot:"fuel",title:"Fuel card",multi:true},
    {slot:"breakdown",title:"Breakdown cover",call:true},
    {slot:"noclaims",title:"No claims"}
  ];
  var HINTS={
    v5c:"Line up the logbook — number in the box",
    licence:"Line up the licence — number in the box",
    fuel:"Line up the card — barcode in the box",
    insurance:"Line up the policy — number in the box",
    mot:"Line up the certificate — number in the box",
    receipt:"Line up the whole receipt",
    wheelnut:"Line up the code — number in the box",
    breakdown:"Line up the card — number in the box",
    other:"Line up the document — number in the box",
    noclaims:"Line up the no-claims letter"
  };
  var SLOT_ICO={
    v5c:"description",insurance:"verified_user",mot:"fact_check",receipt:"receipt_long",
    wheelnut:"hexagon",licence:"id_card",fuel:"local_gas_station",breakdown:"car_crash",
    noclaims:"shield",other:"local_parking"
  };
  var SCAN_SLOTS={v5c:1,insurance:1,mot:1,receipt:1,licence:1,fuel:1};
  function icoHtml(key, cls){
    return (window.dipstickIconHtml&&dipstickIconHtml(key, cls||"ico sm"))||"";
  }
  function formatPlate(c){
    var v=String((c&&c.plate)||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!v) return "";
    return v.length>4?v.slice(0,-3)+" "+v.slice(-3):v;
  }
  function paintCar(id){
    var e=el(id); if(!e) return;
    var plate=formatPlate(car);
    e.innerHTML=esc(carName(car))+(plate?' <span class="wPlate">'+esc(plate)+'</span>':'');
  }
  function fmtDay(iso){
    var p=String(iso||"").split("-"); if(p.length<3) return "";
    var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+p[1]-1];
    return mo?(String(+p[2])+" "+mo):"";
  }
  function statusChip(slot){
    var iso=slot==="insurance"?(car&&car.ins):slot==="mot"?(car&&car.mot):"";
    var day=fmtDay(iso); if(!day) return "";
    var tm=Date.parse(String(iso).slice(0,10)+"T12:00:00");
    var days=isNaN(tm)?99:Math.round((tm-Date.now())/86400000);
    var lab=slot==="insurance"?"Renews ":"Valid to ";
    return '<span class="wChip '+(days<=30?"warn":"ok")+'">'+lab+day+"</span>";
  }
  function el(id){ return document.getElementById(id); }
  function qs(s,r){ return (r||document).querySelector(s); }
  function carName(c){ return (c&&(c.nick||c.name||c.plate))||"Your car"; }

  function toast(msg){
    var t=el("walletToast"); if(!t) return;
    t.textContent=msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove("on"); },2800);
  }
  function fallbackCopy(text){
    var a=document.createElement("textarea");
    a.value=text; a.setAttribute("readonly",""); a.style.position="fixed"; a.style.left="-9999px";
    document.body.appendChild(a); a.select();
    try{ document.execCommand("copy"); }catch(e){}
    document.body.removeChild(a);
  }
  function copyText(text){
    text=String(text||""); if(!text) return;
    var go=function(){ toast("Copied"); };
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(go).catch(function(){ fallbackCopy(text); go(); });
    }else{ fallbackCopy(text); go(); }
  }

  function setView(name){
    view=name;
    document.body.setAttribute("data-view",name);
    if(name!=="scan") stopCam();
    if(Lock&&Lock.touch) Lock.touch();
  }

  function docs(slot){ return Store.docsIn(rec,slot); }
  function first(slot){ return docs(slot)[0]||null; }

  function formatNum(slot,n){
    n=String(n||"").trim();
    if(!n) return "";
    var d=n.replace(/\D/g,"");
    if(slot==="v5c"&&d.length===11) return d.slice(0,4)+" "+d.slice(4,8)+" "+d.slice(8);
    if(slot==="fuel"&&d.length>=8) return d.replace(/(\d{4})(?=\d)/g,"$1 ");
    if(slot==="mot"&&d.length>=8) return d.replace(/(\d{4})(?=\d)/g,"$1 ");
    return n;
  }

  function thumbUrl(d){
    if(!d||!d.blob) return "";
    if((d.type||d.blob.type||"").indexOf("image/")===0) return URL.createObjectURL(d.blob);
    return "";
  }

  /* Concept B · Tiles: saved items show their photo (or art), name, number and one Copy/Call;
     empty slots are dashed Scan / Add tiles; an odd last empty slot becomes a wide add row. */
  function artHtml(slot, d){
    var ico=SLOT_ICO[slot]||"doc";
    if(d&&d.blob&&!/^image\//.test(d.type||d.blob.type||"")){
      return '<span class="tArt pdf">'+icoHtml("description","ico")+'<b>PDF</b></span>';
    }
    if(slot==="fuel"&&d&&String(d.number||"").replace(/\D/g,"").length>=6) return '<canvas class="tBar" width="300" height="90" data-bar="'+esc(String(d.number).replace(/\D/g,""))+'"></canvas>';
    return '<span class="tArt">'+icoHtml(ico,"ico")+'</span>';
  }
  function tileHtml(spec, d, list, wide){
    list=list||(d?docs(spec.slot):[]);
    var ico=SLOT_ICO[spec.slot]||"doc";
    if(!d){
      var scan=!!SCAN_SLOTS[spec.slot], other=spec.slot==="other";
      var verb=other?'<span class="verb">Photo or PDF</span>':'<span class="verb">'+icoHtml(scan?"photo_camera":"add","ico xs")+(scan?"Scan":"Add")+'</span>';
      return '<button class="tile add'+(other?" other":"")+(wide?" wide":"")+'" type="button" data-add="'+spec.slot+'">'+
        '<span class="addic">'+icoHtml(other?"add":(scan?"document_scanner":ico))+'</span>'+
        '<span class="tt">'+esc(other?"Add other":spec.title)+'</span>'+verb+'</button>';
    }
    var num=formatNum(d.slot,d.number||d.phone||"");
    var n=list.length||1;
    if(d.slot==="receipt"){
      var bits=[];
      if(d.total!=null&&d.total!=="") bits.push("£"+Number(d.total).toFixed(2));
      else if(num) bits.push(num);
      if(d.dateISO) bits.push(d.dateISO.split("-").reverse().join("/"));
      else if(d.date) bits.push(d.date);
      if(d.supplier) bits.push(d.supplier);
      num=bits.length?bits.join(" · "):(n+" receipt"+(n===1?"":"s"));
    }
    if(d.slot==="noclaims"){ var y=Store.ncbCurrent(d,car); num=(y===1?"1 year":y+" years"); }
    var u=thumbUrl(d);
    var thumb=u?'<img alt="" src="'+u+'"/>':artHtml(d.slot,d);
    var badge=(spec.multi&&list.length>1)?'<span class="count">×'+list.length+'</span>':"";
    var copyVal=d.slot==="noclaims"?num:(d.number||d.phone||"");
    if(d.slot==="noclaims"&&copyVal) copyVal=copyVal+" no claims";
    var act="";
    if(spec.call&&(d.phone||d.number)) act='<span class="wIconBtn call" role="button" tabindex="0" data-call="'+esc(d.phone||d.number)+'" aria-label="Call">'+icoHtml("phone")+"</span>";
    else if(copyVal&&d.slot!=="receipt") act='<span class="wIconBtn" role="button" tabindex="0" data-copy="'+esc(String(copyVal))+'" aria-label="Copy">'+icoHtml("copy")+"</span>";
    return '<div class="tile" role="button" tabindex="0" data-open="'+d.id+'">'+
      '<div class="thumb">'+thumb+badge+'</div>'+
      '<div class="meta"><span class="tt">'+esc(spec.title||d.title||"Document")+'</span>'+
      '<span class="nr"><span class="num mono">'+(num?esc(num):"&nbsp;")+'</span>'+act+'</span></div></div>';
  }
  function gridHtml(specs){
    var cells=specs.map(function(s){ var list=s.list||docs(s.slot); return {s:s,d:s.doc||list[0]||null,list:list}; });
    var odd=cells.length%2===1, last=cells[cells.length-1];
    return cells.map(function(c,i){ return tileHtml(c.s,c.d,c.list, odd&&i===cells.length-1&&!c.d&&c.s.slot!=="other"); }).join("");
  }
  function esc(s){ return String(s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]}); }

  function otherDocs(){
    var known={}; DOCS.concat(CARDS).forEach(function(s){ known[s.slot]=1; });
    return (rec.docs||[]).filter(function(d){ return !known[d.slot]; });
  }

  /* Camera / file picker leave the app for a moment on Android; don't re-lock for that round trip. */
  function intentPass(){ try{ if(window.Driv3Lock&&Driv3Lock.intentPass) Driv3Lock.intentPass(); }catch(e){} if(Lock&&Lock.touch) Lock.touch(); }
  function pickFile(id){ intentPass(); el(id).click(); }
  var srcSlot=null;
  function openSrc(slot, replace){
    srcSlot={slot:slot, replace:replace||null};
    retakeOf=replace||null;
    el("srcTitle").textContent=replace?("Replace "+slotTitle(slot,replace).toLowerCase()):("Add "+slotTitle(slot));
    el("srcSheet").classList.add("on");
    if(el("page-open")) el("page-open").classList.add("dim");
    if(window.dipstickIcons) dipstickIcons(el("srcSheet"));
  }
  function closeSrc(){
    var sh=el("srcSheet"); if(sh) sh.classList.remove("on");
    if(el("page-open")) el("page-open").classList.remove("dim");
  }
  function closePick(){ closeSrc(); }
  function isPdf(f){ return /pdf$/i.test((f&&(f.type||f.name))||""); }
  /* Upload file: a PDF is stored as-is (and viewable); an image goes through the same OCR as a scan. */
  async function handleUpload(slot, f, replace){
    if(!f) return;
    if(!isPdf(f)){
      retakeOf=replace||null; camSlot=slot; pendingFile=f;
      try{ await capture(); }catch(e){ toast((e&&e.message)||"Can't read that file"); }
      pendingFile=null; return;
    }
    var blob=new Blob([await f.arrayBuffer()],{type:f.type||"application/pdf"});
    var doc=replace?Object.assign({},replace,{ref:0}):{id:Store.newId(),slot:slot,title:slotTitle(slot),number:"",at:Date.now()};
    doc.blob=blob; doc.type=blob.type; doc.name=f.name||"document.pdf"; doc.at=Date.now();
    if(replace&&replace.numberAuto) { doc.number=""; delete doc.numberAuto; }
    await Store.putDoc(car,doc);
    rec=await Store.load(car);
    toast("PDF saved");
    showSaved(findDoc(doc.id)||doc);
  }
  function paintOpen(){
    paintCar("openCar"); paintCar("lockCar");
    var slots=DOCS.concat(CARDS), others=otherDocs();
    var saved=0; slots.forEach(function(x){ saved+=docs(x.slot).length; }); saved+=others.length;
    var cnt=function(arr){ return arr.filter(function(x){ return docs(x.slot).length; }).length+"/"+arr.length; };
    if(el("wSum")) el("wSum").innerHTML=saved?("<b>"+saved+" saved</b> · tap one to open"):"<b>Nothing saved yet</b> · tap a tile to scan or add";
    if(el("docCnt")) el("docCnt").textContent=cnt(DOCS);
    if(el("cardCnt")) el("cardCnt").textContent=cnt(CARDS);
    if(el("docGrid")) el("docGrid").innerHTML=gridHtml(DOCS);
    if(el("cardGrid")) el("cardGrid").innerHTML=gridHtml(CARDS);
    var os=others.map(function(d){ return {slot:d.slot||"other",title:d.title||"Document",doc:d,list:[d]}; });
    os.push({slot:"other",title:"Add other",list:[]});
    if(el("otherGrid")) el("otherGrid").innerHTML=gridHtml(os);
    ["docGrid","cardGrid","otherGrid"].forEach(function(id){
      var n=el(id); if(!n) return;
      if(window.dipstickIcons) dipstickIcons(n);
      if(Bar) n.querySelectorAll("canvas[data-bar]").forEach(function(cv){ try{ Bar.draw(cv, cv.getAttribute("data-bar"), {width:300,height:90}); }catch(e){} });
    });
    if(window.dipstickPinBack) setTimeout(dipstickPinBack,40);
  }
  function slotTitle(slot,d){
    var s=DOCS.concat(CARDS).filter(function(x){return x.slot===slot})[0];
    return (d&&d.title)||(s&&s.title)||"Document";
  }

  /* Opened from another page (e.g. Reminders > Insurance > View): Back goes straight there. */
  var FROM=(function(){ var f=new URLSearchParams(location.search).get("from")||""; return /^[a-z0-9-]+\.html(\?[\w=&.-]*)?$/i.test(f)?f:""; })();
  var deepDoc=new URLSearchParams(location.search).get("doc")||"", autoOpened=false, tried={};
  function goFrom(){
    var ref=""; try{ ref=new URL(document.referrer).pathname; }catch(e){}
    if(ref && ref.slice(-FROM.split("?")[0].length-1)==="/"+FROM.split("?")[0] && history.length>1) history.back();
    else location.replace(FROM);
  }
  /* Insurance files with no policy number: read it from the document on the phone
     (PDF text first, then Tesseract) and fill it in. The user can Edit it. */
  async function autoPolicy(d){
    if(tried[d.id]) return; tried[d.id]=1;
    var sub=el("savedSub"); if(sub){ sub.hidden=false; sub.textContent="Looking for the policy number…"; }
    var n="";
    try{ n=Ocr.extractPolicy(await View.textOf(d.blob,d.name)); }catch(e){}
    if(!n){ if(current===d&&sub){ sub.hidden=true; sub.textContent=""; } return; }
    var doc=Object.assign({},d,{number:n,numberAuto:1});
    try{ await Store.putDoc(car,doc); rec=await Store.load(car); }catch(e){ return; }
    var fresh=findDoc(d.id)||doc; if(!fresh.blob) fresh.blob=d.blob;
    if(current&&current.id===d.id){
      showSaved(fresh);
      if(!(View.note&&View.note("Policy number saved:",n,function(){ openAdd(fresh.slot,fresh); }))) toast("Policy number filled in from the document");
    }
  }

  function showSaved(d){
    current=d;
    setView("saved");
    var known=DOCS.concat(CARDS).some(function(x){ return x.slot===d.slot; });
    el("savedKind").textContent=known?slotTitle(d.slot):(d.title||"Document");
    var num=formatNum(d.slot,d.number||"");
    if(d.slot==="receipt"&&d.total!=null&&d.total!=="") num="£"+Number(d.total).toFixed(2);
    if(d.slot==="noclaims"){ var y=Store.ncbCurrent(d,car); num=(y===1?"1 year":y+" years"); }
    var big=el("savedNum");
    big.textContent=num;
    big.hidden=!num;
    big.onclick=function(){ if(num) copyText(d.slot==="noclaims"?num+" no claims":formatNum(d.slot,d.number)); };
    var sub=el("savedSub");
    if(sub){
      if(d.slot==="noclaims"){
        var next=Store.ncbNextDate(d,car);
        var bits=[];
        if(d.ncbAt) bits.push("Counting from "+d.ncbAt.split("-").reverse().join("/"));
        if(next) bits.push("Next increase "+next.split("-").reverse().join("/"));
        sub.textContent=bits.join(" · ");
        sub.hidden=!bits.length;
      }else if(d.slot==="receipt"){
        var bits=[];
        if(d.supplier) bits.push(d.supplier);
        if(d.dateISO) bits.push(d.dateISO.split("-").reverse().join("/"));
        else if(d.date) bits.push(d.date);
        if(d.total!=null&&d.total!=="") bits.push("£"+Number(d.total).toFixed(2));
        if(d.vat!=null&&d.vat!=="") bits.push("VAT £"+Number(d.vat).toFixed(2)+(d.vatRate!=null?" @ "+d.vatRate+"%":""));
        else if(d.vatRate!=null&&d.vatRate!=="") bits.push("VAT @ "+d.vatRate+"%");
        if(d.vatNo) bits.push(d.vatNo);
        if(d.litres!=null&&d.litres!=="") bits.push(Number(d.litres)+" L");
        if(d.ppl!=null&&d.ppl!=="") bits.push(Number(d.ppl)+" p/l");
        sub.textContent=bits.join(" · ");
        sub.hidden=!bits.length;
      }else if(d.numberAuto&&d.number){ sub.textContent="Read from the document. Tap Edit if it’s wrong."; sub.hidden=false; }
      else{ sub.textContent=""; sub.hidden=true; }
    }
    if(!num && d.slot!=="noclaims"){
      big.hidden=false; big.textContent="Add number"; big.classList.add("addNum");
      big.onclick=function(){ if(View) View.close(); openAdd(d.slot,d); };
    }else big.classList.remove("addNum");
    var ed=el("savedEdit");
    if(ed){ ed.hidden=false; ed.textContent=d.slot==="noclaims"?"Reset after a claim":"Edit"; }
    var bar=el("savedBarcode");
    if(d.slot==="fuel"&&d.number&&Bar){
      bar.hidden=false;
      Bar.draw(el("savedBarCv"), String(d.number).replace(/\D/g,""), {width:400,height:120});
      el("savedBarLabel").textContent=formatNum("fuel",d.number);
    }else bar.hidden=true;
    var pic=el("savedPic"); pic.innerHTML="";
    if(d.blob){
      var type=d.type||d.blob.type||"";
      if(type.indexOf("image/")===0){
        var img=document.createElement("img");
        img.alt=d.title||"Document";
        img.src=URL.createObjectURL(d.blob);
        pic.appendChild(img);
      }else if(View){
        /* PDFs: a tap-to-open tile so the number and buttons stay on screen. */
        var b=document.createElement("button");
        b.type="button"; b.className="pdfTile";
        b.innerHTML='<span class="ico lg" data-ico="doc" aria-hidden="true"></span><span class="pdfName"></span><span class="pdfOpen">Tap to view</span>';
        b.querySelector(".pdfName").textContent=d.name||"document.pdf";
        b.onclick=function(){ View.open({blob:d.blob,name:d.name,type:type,title:d.title||d.name,onBack:(FROM&&deepDoc)?goFrom:null}).catch(function(){}); };
        pic.appendChild(b);
        if(FROM&&deepDoc&&!autoOpened&&(d.id===deepDoc||d.insId===deepDoc)){ autoOpened=true; setTimeout(function(){ b.click(); },0); }
        if(window.dipstickIcons) try{ window.dipstickIcons(b); }catch(e){}
      }
    }
    var call=el("savedCall");
    if(d.slot==="breakdown"&&(d.phone||d.number)){
      call.hidden=false; call.href="tel:"+String(d.phone||d.number).replace(/\s/g,"");
      call.textContent="Call "+(d.phone||d.number);
    }else{ call.hidden=true; }
    /* Several of one kind (receipts, fuel cards, insurance files): page through them. */
    var sib=docs(d.slot), at=sib.findIndex(function(x){ return x.id===d.id; });
    var pg=el("savedPager");
    if(pg){
      pg.hidden=!(sib.length>1&&at>=0);
      if(!pg.hidden){
        el("savedPos").textContent=(at+1)+" of "+sib.length;
        el("savedPrev").onclick=function(){ if(View) View.close(); showSaved(sib[(at-1+sib.length)%sib.length]); };
        el("savedNext").onclick=function(){ if(View) View.close(); showSaved(sib[(at+1)%sib.length]); };
      }
    }
    var spec=DOCS.concat(CARDS).filter(function(x){ return x.slot===d.slot; })[0];
    el("savedAddMore").hidden=!(spec&&spec.multi);
    if(window.dipstickIcons) try{ dipstickIcons(el("page-saved")); }catch(e){}
    if(d.slot==="insurance"&&!d.number&&d.blob&&View&&View.textOf&&Ocr&&Ocr.extractPolicy) autoPolicy(d);
  }

  function findDoc(id){ return (rec.docs||[]).find(function(d){ return d.id===id || d.insId===id; }); }

  async function openExisting(id){
    var d=findDoc(id); if(!d) return false;
    showSaved(d); return true;
  }

  /* -------- camera -------- */
  function guideFor(slot){
    var g=el("camGuide");
    var card=slot==="licence"||slot==="fuel"||slot==="breakdown";
    var receipt=slot==="receipt";
    g.className="guide "+(card?"card ":"")+(receipt?"generic receipt":slot==="licence"?"licence":slot==="fuel"?"fuel":slot==="noclaims"?"v5c generic":"v5c");
    el("camHint").textContent=HINTS[slot]||HINTS.other;
  }
  function videoTrack(){
    return camStream&&camStream.getVideoTracks&&camStream.getVideoTracks()[0]||null;
  }
  function paintTorch(){
    var b=el("camTorch"); if(!b) return;
    b.hidden=!torchAvail;
    b.setAttribute("aria-pressed", torchOn?"true":"false");
    b.classList.toggle("on", !!torchOn);
  }
  async function setTorch(on){
    torchOn=!!on;
    paintTorch();
    try{
      var t=videoTrack(); if(!t||!t.applyConstraints) return;
      var caps=t.getCapabilities&&t.getCapabilities();
      if(!caps||!caps.torch) return;
      await t.applyConstraints({advanced:[{torch:!!on}]});
    }catch(e){}
  }
  async function detectTorch(){
    torchAvail=false;
    try{
      var t=videoTrack();
      var caps=t&&t.getCapabilities&&t.getCapabilities();
      torchAvail=!!(caps&&caps.torch);
    }catch(e){}
    paintTorch();
  }
  function showFocusRing(x,y){
    var r=el("camFocus"); if(!r) return;
    r.style.left=x+"px"; r.style.top=y+"px";
    r.classList.remove("show");
    void r.offsetWidth;
    r.classList.add("show");
  }
  async function tapFocus(ev){
    if(ev.target.closest("button,a,input,.camBar,.camFile,.camClose,.camTorch,.camFail,.wSheet,.camHint")) return;
    var cam=document.querySelector("#page-scan .cam")||el("camVideo")&&el("camVideo").parentElement;
    if(!cam) return;
    var cr=cam.getBoundingClientRect();
    showFocusRing(ev.clientX-cr.left, ev.clientY-cr.top);
    var video=el("camVideo");
    var vr=video?video.getBoundingClientRect():cr;
    var nx=(ev.clientX-vr.left)/Math.max(1,vr.width), ny=(ev.clientY-vr.top)/Math.max(1,vr.height);
    nx=Math.max(0,Math.min(1,nx)); ny=Math.max(0,Math.min(1,ny));
    try{
      var t=videoTrack(); if(!t||!t.applyConstraints) return;
      var caps=t.getCapabilities&&t.getCapabilities()||{};
      var adv={};
      if(caps.pointsOfInterest) adv.pointsOfInterest=[{x:nx,y:ny}];
      var modes=caps.focusMode||[];
      if(modes.indexOf("single-shot")>=0) adv.focusMode="single-shot";
      else if(modes.indexOf("manual")>=0) adv.focusMode="manual";
      else if(modes.indexOf("continuous")>=0) adv.focusMode="continuous";
      var em=caps.exposureMode||[];
      if(em.indexOf("single-shot")>=0) adv.exposureMode="single-shot";
      else if(em.indexOf("continuous")>=0) adv.exposureMode="continuous";
      if(Object.keys(adv).length) await t.applyConstraints({advanced:[adv]});
    }catch(e){}
  }
  function hideFail(){ var f=el("camFail"); if(f) f.hidden=true; }
  function showFail(msg){
    var f=el("camFail"); if(!f) return;
    if(el("camFailMsg")) el("camFailMsg").textContent=msg||"Couldn't read it — try again or type it";
    f.hidden=false;
  }
  function stopCam(){
    try{ if(torchOn) { var t=videoTrack(); if(t&&t.applyConstraints) t.applyConstraints({advanced:[{torch:false}]}); } }catch(e){}
    torchOn=false; torchAvail=false; paintTorch();
    if(camStream){ camStream.getTracks().forEach(function(t){ t.stop(); }); camStream=null; }
    var v=el("camVideo"); if(v){ v.srcObject=null; v.style.display=""; }
    hideFail();
    var b=el("camBusy"); if(b) b.hidden=true;
  }
  async function startCam(slot){
    camSlot=slot; pendingFile=null; lastCapture=null;
    setView("scan"); guideFor(slot);
    hideFail();
    var busy=el("camBusy"); if(busy) busy.hidden=true;
    var v=el("camVideo"); if(v) v.style.display="";
    if(Ocr&&Ocr.prewarm) Ocr.prewarm();
    try{
      camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
      el("camVideo").srcObject=camStream;
      await el("camVideo").play().catch(function(){});
      await detectTorch();
      if(torchAvail) await setTorch(true);
    }catch(e){
      toast("Camera unavailable — upload a file instead");
      pickFile("scanPick");
    }
  }
  function windowRect(video){
    var g=el("camGuide"), w=el("camWin");
    if(!g||!w||!video) return {x:0,y:0,w:video.videoWidth,h:video.videoHeight};
    var wr=w.getBoundingClientRect(), vr=video.getBoundingClientRect();
    /* The video uses object-fit:cover, so undo that scale and crop offset. */
    var vw=video.videoWidth||vr.width, vh=video.videoHeight||vr.height;
    var sc=Math.max(vr.width/vw, vr.height/vh)||1;
    var ox=(vr.width-vw*sc)/2, oy=(vr.height-vh*sc)/2;
    var x=(wr.left-vr.left-ox)/sc, y=(wr.top-vr.top-oy)/sc, w=wr.width/sc, h=wr.height/sc;
    /* A little padding around the box so glyphs on the edge aren't clipped. */
    var px=w*0.08, py=h*0.22;
    x-=px; y-=py; w+=px*2; h+=py*2;
    x=Math.max(0,x); y=Math.max(0,y);
    return {x:x, y:y, w:Math.max(8,Math.min(w,vw-x)), h:Math.max(8,Math.min(h,vh-y))};
  }
  function compressCanvas(src, maxEdge, quality){
    var w=src.width, h=src.height, scale=Math.min(1, (maxEdge||1600)/Math.max(w,h,1));
    var c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(w*scale)); c.height=Math.max(1,Math.round(h*scale));
    c.getContext("2d").drawImage(src,0,0,c.width,c.height);
    return new Promise(function(ok){
      c.toBlob(function(b){ ok(b||null); }, "image/jpeg", quality||0.8);
    });
  }
  function loadImage(src){
    return new Promise(function(ok,no){
      var im=new Image();
      var u=typeof src==="string"?src:URL.createObjectURL(src);
      im.onload=function(){ if(typeof src!=="string") try{URL.revokeObjectURL(u)}catch(e){} ok(im); };
      im.onerror=function(){ if(typeof src!=="string") try{URL.revokeObjectURL(u)}catch(e){} no(new Error("Can't read that photo")); };
      im.src=u;
    });
  }
  function moneyOrBlank(s){
    if(s==null||s==="") return null;
    var n=parseFloat(String(s).replace(/[£,\s]/g,""));
    return isNaN(n)?null:Math.round(n*100)/100;
  }
  function fillReceiptSheet(rec){
    rec=rec||{};
    el("recvSupplier").value=rec.supplier||"";
    el("recvDate").value=rec.dateISO||"";
    el("recvTotal").value=rec.total!=null?Number(rec.total).toFixed(2):"";
    el("recvVat").value=rec.vat!=null?Number(rec.vat).toFixed(2):"";
    el("recvVatRate").value=rec.vatRate!=null?String(rec.vatRate):"";
    el("recvVatNo").value=rec.vatNo||"";
    el("recvLitres").value=rec.litres!=null?String(rec.litres):"";
    el("recvPpl").value=rec.ppl!=null?String(rec.ppl):"";
    el("recvSheet").classList.add("on");
    if(window.dipstickIcons) dipstickIcons(el("recvSheet"));
  }
  function closeReceiptSheet(){ var s=el("recvSheet"); if(s) s.classList.remove("on"); }
  async function saveReceiptFromSheet(){
    if(!pendingReceipt) return;
    var fields={
      supplier:el("recvSupplier").value.trim(),
      dateISO:el("recvDate").value||"",
      total:moneyOrBlank(el("recvTotal").value),
      vat:moneyOrBlank(el("recvVat").value),
      vatRate:moneyOrBlank(el("recvVatRate").value),
      vatNo:el("recvVatNo").value.trim().toUpperCase().replace(/\s+/g,""),
      litres:moneyOrBlank(el("recvLitres").value),
      ppl:moneyOrBlank(el("recvPpl").value)
    };
    fields.date=fields.dateISO?fields.dateISO.split("-").reverse().join("/"):"";
    var pr=pendingReceipt;
    var doc=pr.doc||{};
    doc.supplier=fields.supplier; doc.date=fields.date; doc.dateISO=fields.dateISO;
    doc.total=fields.total; doc.vat=fields.vat; doc.vatRate=fields.vatRate; doc.vatNo=fields.vatNo;
    doc.litres=fields.litres; doc.ppl=fields.ppl;
    if(pr.text) doc.text=pr.text;
    doc.number=fields.total!=null?("£"+Number(fields.total).toFixed(2)):"";
    doc.numberAuto=true;
    await Store.putDoc(car,doc);
    rec=await Store.load(car);
    closeReceiptSheet();
    pendingReceipt=null;
    lastCapture=null;
    showSaved(findDoc(doc.id)||doc);
  }
  async function finishScanDoc(doc){
    if(camSlot==="breakdown"&&!doc.phone) doc.phone=doc.number;
    if(camSlot==="noclaims"){
      var draft=window.__ncbDraft||{};
      var prev=draft.editId?findDoc(draft.editId):first("noclaims");
      if(prev){ doc.id=prev.id; doc.ncbYears=prev.ncbYears; doc.ncbAt=prev.ncbAt; }
      if(draft.years!==undefined&&draft.years!==""){ var y=parseInt(draft.years,10); if(!isNaN(y)) doc.ncbYears=y; }
      if(draft.at) doc.ncbAt=draft.at;
      if(doc.ncbYears==null) doc.ncbYears=0;
      if(!doc.ncbAt) doc.ncbAt=(car&&car.ins)||new Date().toISOString().slice(0,10);
      doc.number=String(Store.ncbCurrent(doc,car));
      doc.title="No claims";
      window.__ncbDraft=null;
    }
    current=doc;
    showSaved(doc);
    await Store.putDoc(car,doc);
    rec=await Store.load(car);
    current=findDoc(doc.id)||doc;
  }
  async function capture(){
    if(capturing) return;
    var video=el("camVideo"), busy=el("camBusy");
    var srcCanvas=document.createElement("canvas");
    if(pendingFile){
      var im=await loadImage(pendingFile);
      srcCanvas.width=im.naturalWidth||im.width; srcCanvas.height=im.naturalHeight||im.height;
      srcCanvas.getContext("2d").drawImage(im,0,0);
    }else if(video&&video.videoWidth){
      srcCanvas.width=video.videoWidth; srcCanvas.height=video.videoHeight;
      srcCanvas.getContext("2d").drawImage(video,0,0);
    }else{ toast("No picture yet"); return; }
    capturing=true;
    hideFail();
    var isReceipt=camSlot==="receipt";
    if(busy){ busy.hidden=false; busy.textContent=isReceipt?"Reading the receipt…":"Reading the number…"; }
    var blob=await compressCanvas(srcCanvas,1600,0.8);
    var region=document.createElement("canvas");
    if(isReceipt){
      /* Full receipt, not the number box — a tiny inset avoids dark viewfinder edges. */
      var inset=Math.round(Math.min(srcCanvas.width,srcCanvas.height)*0.02);
      var rw=Math.max(8,srcCanvas.width-inset*2), rh=Math.max(8,srcCanvas.height-inset*2);
      region.width=rw; region.height=rh;
      region.getContext("2d").drawImage(srcCanvas,inset,inset,rw,rh,0,0,rw,rh);
    }else if(pendingFile){
      /* file: OCR a generous central band */
      var bx=srcCanvas.width*0.08, by=srcCanvas.height*0.15, bw=srcCanvas.width*0.84, bh=srcCanvas.height*0.7;
      region.width=bw; region.height=bh;
      region.getContext("2d").drawImage(srcCanvas,bx,by,bw,bh,0,0,bw,bh);
    }else{
      var r=windowRect(video);
      region.width=Math.max(8,r.w); region.height=Math.max(8,r.h);
      region.getContext("2d").drawImage(srcCanvas,r.x,r.y,r.w,r.h,0,0,region.width,region.height);
    }
    var number="", rec=null, ocrErr=null, ocrText="";
    try{
      if(Ocr){
        var res=await Ocr.readRegion(region, camSlot);
        number=res&&res.number||"";
        ocrText=res&&res.text||"";
        if(isReceipt) rec=res;
      }
    }catch(e){ ocrErr=e; }
    if(busy) busy.hidden=true;
    capturing=false;
    lastCapture={blob:blob, slot:camSlot};

    var base=retakeOf&&retakeOf.slot===camSlot
      ? Object.assign({},retakeOf,{blob:blob,type:"image/jpeg",name:(camSlot||"doc")+".jpg",at:Date.now(),ref:0})
      : {id:Store.newId(), slot:camSlot, title:slotTitle(camSlot), number:"", type:"image/jpeg", blob:blob, name:(camSlot||"doc")+".jpg", at:Date.now()};

    if(isReceipt){
      try{ await setTorch(false); }catch(e){}
      stopCam();
      if(rec&&rec.number) base.number=rec.number;
      pendingReceipt={doc:base, text:ocrText||(rec&&rec.text)||""};
      fillReceiptSheet(rec||{});
      if(ocrErr) toast("Couldn't read it — check or type the details");
      return;
    }

    if(ocrErr || !number){
      /* Live camera: keep it running so Retry is instant. File upload: open the add form. Never silently save a blank. */
      if(pendingFile && view!=="scan"){
        var slot=camSlot, prev=retakeOf;
        pendingFile=new File([blob],(slot||"doc")+".jpg",{type:"image/jpeg"});
        openAdd(slot, prev);
        if(el("addHint")) el("addHint").textContent="Couldn't read it — type the number";
        toast("Couldn't read it — try again or type it");
        return;
      }
      showFail();
      return;
    }

    try{ await setTorch(false); }catch(e){}
    stopCam();
    retakeOf=null;
    pendingFile=null;
    base.number=number;
    base.numberAuto=true;
    await finishScanDoc(base);
  }

  function openAdd(slot, existing){
    var sh=el("addSheet");
    sh.dataset.slot=slot||"other";
    sh.dataset.editId=existing&&existing.id||"";
    var isNcb=slot==="noclaims";
    el("addTitle").textContent=isNcb?(existing?"Reset no claims":"No claims"):slot==="breakdown"?"Breakdown cover":slot==="other"?"Add":("Add "+slotTitle(slot));
    el("addName").value=slot&&slot!=="other"?slotTitle(slot):(existing&&existing.title)||"";
    el("addNumber").value=(existing&&existing.number)||"";
    el("addHint").textContent="";
    pendingFile=null;
    var isCall=slot==="breakdown";
    el("addPhone").hidden=!isCall; el("addPhoneLab").hidden=!isCall;
    if(isCall){ el("addPhone").hidden=false; el("addPhoneLab").hidden=false; el("addPhone").value=(existing&&existing.phone)||""; }
    var wrap=el("addNcbWrap");
    if(wrap){
      wrap.hidden=!isNcb;
      var nameLab=document.querySelector("label[for='addName']");
      var numLab=document.querySelector("label[for='addNumber']");
      el("addName").hidden=isNcb; if(nameLab) nameLab.hidden=isNcb;
      el("addNumber").hidden=isNcb; if(numLab) numLab.hidden=isNcb;
      if(isNcb){
        var years=existing?Store.ncbCurrent(existing,car):(existing&&existing.ncbYears);
        el("addNcbYears").value=years==null||years===""?"":years;
        var at=(existing&&existing.ncbAt)||(car&&car.ins)||"";
        el("addNcbAt").value=at||"";
        el("addNcbHint").textContent=car&&car.ins?"The years go up by one each year on your insurance renewal date ("+car.ins.split("-").reverse().join("/")+").":"Set a date — the years go up by one each year on this date. The insurance renewal date is used if you've set one.";
      }
    }
    sh.classList.add("on");
  }
  function closeAdd(){ el("addSheet").classList.remove("on"); }

  async function saveAdd(){
    var slot=el("addSheet").dataset.slot||"other";
    var editId=el("addSheet").dataset.editId;
    var name=el("addName").value.trim()||slotTitle(slot);
    var number=el("addNumber").value.trim();
    var phone=el("addPhone").value.trim();
    var prev=editId?findDoc(editId):null;
    var doc=prev?Object.assign({},prev):{id:Store.newId(),slot:slot==="other"?"other":slot,at:Date.now()};
    doc.slot=slot==="other"?"other":slot;
    doc.title=name; doc.number=number; doc.phone=phone; delete doc.numberAuto;
    if(slot==="noclaims"){
      var y=parseInt(el("addNcbYears").value,10);
      if(isNaN(y)||y<0) y=0;
      doc.ncbYears=y;
      doc.ncbAt=el("addNcbAt").value||(car&&car.ins)||new Date().toISOString().slice(0,10);
      doc.title="No claims";
      doc.number=String(Store.ncbCurrent(doc,car));
    }
    if(pendingFile){
      doc.ref=0; /* its own file now, not a link to Reminders > Insurance */
      if(/pdf$/i.test(pendingFile.type||pendingFile.name||"")){
        doc.blob=new Blob([await pendingFile.arrayBuffer()],{type:pendingFile.type||"application/pdf"});
        doc.type=doc.blob.type; doc.name=pendingFile.name||"document.pdf";
      }else{
        var im=await loadImage(pendingFile);
        var c=document.createElement("canvas");
        c.width=im.naturalWidth||im.width; c.height=im.naturalHeight||im.height;
        c.getContext("2d").drawImage(im,0,0);
        doc.blob=await compressCanvas(c,1600,0.8);
        doc.type="image/jpeg"; doc.name=(pendingFile.name||"photo").replace(/\.\w+$/,"")+".jpg";
      }
    }
    await Store.putDoc(car,doc);
    rec=await Store.load(car);
    closeAdd();
    showSaved(findDoc(doc.id)||doc);
  }

  function paintLocked(info){
    info=info||{kind:"none",label:"Unlock"};
    var none=info.kind==="none";
    var mark=el("lockMark");
    if(mark){
      mark.classList.toggle("warn",none);
      mark.innerHTML='<span class="ico lg" data-ico="'+(none?"lock_open":"fingerprint")+'" aria-hidden="true"></span>';
      if(window.dipstickIcons) dipstickIcons(mark);
    }
    if(el("lockTitle")) el("lockTitle").textContent=none?"No screen lock yet":"Wallet locked";
    if(el("lockWho")) el("lockWho").textContent=none?"Anyone holding this phone could open it.":"Fingerprint, face or your phone's PIN";
    if(el("needPin")) el("needPin").hidden=!none;
    var btn=el("unlockBtn");
    if(btn){
      btn.innerHTML='<span class="ico" data-ico="'+(none?"lock_open":"fingerprint")+'" aria-hidden="true"></span>'+(info.label||"Unlock");
      if(window.dipstickIcons) dipstickIcons(btn);
    }
  }

  async function doUnlock(){
    var ok=false;
    try{ ok=await Lock.unlock(); }catch(e){ ok=false; }
    if(!ok){
      var info=await Lock.canBio();
      paintLocked(info);
      return false;
    }
    rec=await Store.load(car);
    if(Ocr&&Ocr.prewarm) Ocr.prewarm();
    var q=new URLSearchParams(location.search);
    var docId=q.get("doc"), open=q.get("open");
    paintOpen();
    if(docId&&await openExisting(docId)) return true;
    if(open){
      var d=first(open);
      if(d){ showSaved(d); return true; }
    }
    setView("open");
    return true;
  }

  /* Re-lock after the 2-minute idle window even if the page just sits open. */
  function relockWatch(){
    setInterval(function(){
      if(view==="locked"||!Lock||Lock.unlocked()) return;
      stopCam();
      if(View&&View.close) View.close();
      closeAdd(); closePick();
      rec={docs:[]};
      ["docGrid","cardGrid","otherGrid"].forEach(function(id){ if(el(id)) el(id).innerHTML=""; });
      setView("locked");
    },5000);
    ["pointerdown","keydown"].forEach(function(t){
      document.addEventListener(t,function(){ if(view!=="locked"&&Lock) Lock.touch(); },{passive:true});
    });
  }

  async function boot(){
    relockWatch();
    car=Store.currentCar();
    paintCar("lockCar"); paintCar("openCar");
    var info=await Lock.canBio();
    paintLocked(info);
    rec=await Store.load(car); // migrate even while locked; no photos shown
    if(Lock.unlocked()){
      paintOpen();
      var q=new URLSearchParams(location.search);
      if(q.get("doc")&&await openExisting(q.get("doc"))) return;
      if(q.get("open")){ var d=first(q.get("open")); if(d){ showSaved(d); return; } }
      setView("open");
    }else{
      setView("locked");
      /* Like Google Wallet: the phone's own verification sheet appears straight away, with this
         locked screen behind it. After a cancel (here or on the home tap) it waits for Unlock. */
      var skip=sessionStorage.getItem("d3.walletNoAuto")==="1";
      sessionStorage.removeItem("d3.walletNoAuto");
      if(!skip && (info.kind==="cap"||info.kind==="webauthn")){
        /* If the app lock is up, let it finish first (one sheet at a time); its unlock counts. */
        if(document.documentElement.classList.contains("d3lk")) window.addEventListener("driv3:unlock",function(){ doUnlock(); },{once:true});
        else doUnlock();
      }
    }
  }

  function onGridClick(e){
    var add=e.target.closest("[data-add]");
    var copy=e.target.closest("[data-copy]");
    var call=e.target.closest("[data-call]");
    var open=e.target.closest("[data-open]");
    if(copy){ e.preventDefault(); e.stopPropagation(); copyText(copy.getAttribute("data-copy")); return; }
    if(call){ e.preventDefault(); e.stopPropagation(); var n=call.getAttribute("data-call"); if(n) location.href="tel:"+String(n).replace(/\s/g,""); return; }
    if(add){
      var slot=add.getAttribute("data-add");
      if(slot==="other"||slot==="breakdown"||slot==="wheelnut"||slot==="noclaims"){ openAdd(slot); return; }
      openSrc(slot);
      return;
    }
    if(open){ openExisting(open.getAttribute("data-open")); }
  }

  function bind(){
    el("unlockBtn").onclick=function(){ doUnlock(); };
    el("docGrid").addEventListener("click",onGridClick);
    el("cardGrid").addEventListener("click",onGridClick);
    if(el("otherGrid")) el("otherGrid").addEventListener("click",onGridClick);
    ["docGrid","cardGrid","otherGrid"].forEach(function(id){ var g=el(id); if(g) g.addEventListener("keydown",function(e){ if((e.key==="Enter"||e.key===" ")&&e.target.matches("[role=button]")){ e.preventDefault(); e.target.click(); } }); });
    el("srcCancel").onclick=closeSrc; el("srcScrim").onclick=closeSrc;
    el("srcCam").onclick=function(){ var s2=srcSlot; closeSrc(); if(!s2) return; retakeOf=s2.replace; startCam(s2.slot); };
    el("srcFile").onclick=function(){ pickFile("upPick"); };
    el("upPick").onchange=function(){
      var f=this.files&&this.files[0], s2=srcSlot; this.value=""; closeSrc();
      if(f&&s2) handleUpload(s2.slot,f,s2.replace).catch(function(e){ toast((e&&e.message)||"Could not save"); });
    };
    el("camClose").onclick=function(){ retakeOf=null; pendingReceipt=null; closeReceiptSheet(); stopCam(); setView("open"); paintOpen(); };
    el("camShutter").onclick=function(){ capture(); };
    el("camFile").onclick=function(){ pickFile("scanPick"); };
    if(el("camTorch")) el("camTorch").onclick=function(){ setTorch(!torchOn); };
    var camEl=document.querySelector("#page-scan .cam");
    if(camEl) camEl.addEventListener("click",function(ev){ tapFocus(ev); });
    if(el("camRetry")) el("camRetry").onclick=function(){ hideFail(); if(pendingFile||(el("camVideo")&&el("camVideo").srcObject)) capture(); };
    if(el("camType")) el("camType").onclick=function(){
      hideFail();
      var slot=camSlot, cap=lastCapture, prev=retakeOf;
      stopCam();
      if(slot==="receipt"){
        var blob=cap&&cap.blob;
        var doc=prev&&prev.slot===slot?Object.assign({},prev,{blob:blob,type:"image/jpeg",name:(slot||"doc")+".jpg",at:Date.now(),ref:0}):{id:Store.newId(),slot:slot,title:slotTitle(slot),number:"",type:"image/jpeg",blob:blob,name:(slot||"doc")+".jpg",at:Date.now()};
        pendingReceipt={doc:doc,text:""};
        fillReceiptSheet({});
        return;
      }
      if(cap&&cap.blob) pendingFile=new File([cap.blob],(slot||"doc")+".jpg",{type:"image/jpeg"});
      openAdd(slot, prev);
      if(el("addHint")) el("addHint").textContent="Photo ready — type the number";
    };
    if(el("recvSave")) el("recvSave").onclick=function(){ saveReceiptFromSheet().catch(function(e){ toast((e&&e.message)||"Could not save"); }); };
    if(el("recvRetry")) el("recvRetry").onclick=function(){
      closeReceiptSheet();
      var slot=camSlot|| (pendingReceipt&&pendingReceipt.doc&&pendingReceipt.doc.slot)||"receipt";
      var keep=pendingReceipt&&pendingReceipt.doc&&retakeOf?retakeOf: (pendingReceipt&&pendingReceipt.doc&&pendingReceipt.doc.id?pendingReceipt.doc:null);
      pendingReceipt=null;
      if(keep&&keep.id) retakeOf=keep;
      startCam(slot);
    };
    if(el("recvCancel")) el("recvCancel").onclick=function(){ closeReceiptSheet(); pendingReceipt=null; retakeOf=null; setView("open"); paintOpen(); };
    el("scanPick").onchange=function(){
      var f=this.files&&this.files[0]; this.value="";
      if(!f) return;
      if(isPdf(f)){ var rt=retakeOf; stopCam(); handleUpload(camSlot,f,rt).catch(function(e){ toast((e&&e.message)||"Could not save"); }); return; }
      pendingFile=f;
      /* Show the chosen photo as the camera background so the user can still line up / just capture. */
      loadImage(f).then(function(im){
        var v=el("camVideo");
        /* hide live video, draw image into a snapshot on shutter; capture() uses pendingFile */
        v.style.display="none";
        toast("Photo loaded — press the shutter");
      });
    };
    el("savedBack").onclick=function(){ if(View) View.close(); if(FROM&&deepDoc){ goFrom(); return; } setView("open"); paintOpen(); };
    el("savedCopy").onclick=function(){
      if(!current) return;
      if(current.slot==="noclaims"){ var y=Store.ncbCurrent(current,car); copyText((y===1?"1 year":y+" years")+" no claims"); return; }
      if(current.number||current.phone) copyText(formatNum(current.slot,current.number||current.phone));
      else toast("No number to copy");
    };
    if(el("savedEdit")) el("savedEdit").onclick=function(e){
      e.preventDefault(); if(View) View.close(); if(!current) return;
      openAdd(current.slot,current);
      if(current.slot==="noclaims"){
        /* After a claim the count starts again from today. */
        el("addNcbYears").value="0";
        el("addNcbAt").value=new Date().toISOString().slice(0,10);
      }
    };
    el("savedShare").onclick=function(){
      if(!current) return;
      if(current.blob&&View){ View.open({blob:current.blob,name:current.name,type:current.type,title:current.title}).then(function(){ /* user can share from viewer */ }); }
      var parts=[current.title, formatNum(current.slot,current.number||"")].filter(Boolean).join(" — ");
      if(navigator.share){
        var p;
        if(current.blob){
          try{
            var f=new File([current.blob], current.name||"document.jpg", {type:current.type||"image/jpeg"});
            if(navigator.canShare&&navigator.canShare({files:[f]})) p=navigator.share({title:current.title,text:parts,files:[f]});
          }catch(e){}
        }
        (p||navigator.share({title:current.title,text:parts})).catch(function(){ if(parts) copyText(parts); });
      }else if(parts) copyText(parts);
    };
    el("savedAddMore").onclick=function(e){ e.preventDefault(); if(View) View.close(); if(current) openSrc(current.slot); };
    el("savedUpload").onclick=function(e){ e.preventDefault(); if(View) View.close(); if(!current) return; srcSlot={slot:current.slot,replace:current}; pickFile("upPick"); };
    el("savedDelete").onclick=async function(e){
      e.preventDefault(); if(!current) return;
      var name=current.title||slotTitle(current.slot);
      if(current.ref){ toast("Delete it in Reminders › Insurance"); return; }
      if(!confirm("Delete "+name+" from the Wallet?")) return;
      if(View) View.close();
      await Store.removeDoc(car,current.id);
      rec=await Store.load(car); current=null;
      paintOpen(); setView("open"); toast("Deleted");
    };
    el("savedRetake").onclick=function(e){
      e.preventDefault(); if(View) View.close(); if(!current) return;
      if(SCAN_SLOTS[current.slot]||current.slot==="noclaims"){ retakeOf=current; startCam(current.slot); return; }
      openAdd(current.slot,current); pickFile("addCam");
    };
    el("openBack").addEventListener("click",function(){ if(Lock) Lock.lock(); });
    el("lockBack").addEventListener("click",function(){ if(Lock) Lock.lock(); });
    el("addCancel").onclick=closeAdd;
    el("addSave").onclick=function(){ saveAdd().catch(function(e){ toast((e&&e.message)||"Could not save"); }); };
    el("addUpload").onclick=function(){ pickFile("addPick"); };
    el("addCam").onchange=function(){
      var f=this.files&&this.files[0]; this.value="";
      if(!f) return; pendingFile=f; el("addHint").textContent="Photo ready: "+(f.name||"photo");
    };
    el("addPhoto").onclick=function(){
      var slot=el("addSheet").dataset.slot;
      if(slot==="other"||slot==="breakdown"||slot==="wheelnut"){ pickFile("addCam"); return; }
      if(slot==="noclaims"){
        /* Keep the years/date the user typed, then open the letter camera. */
        window.__ncbDraft={
          years:el("addNcbYears").value,
          at:el("addNcbAt").value,
          editId:el("addSheet").dataset.editId||""
        };
        closeAdd(); startCam("noclaims"); return;
      }
      closeAdd(); startCam(slot);
    };
    el("addPick").onchange=function(){
      var f=this.files&&this.files[0]; this.value="";
      if(!f) return; pendingFile=f; el("addHint").textContent=(isPdf(f)?"PDF ready: ":"Photo ready: ")+(f.name||"file");
    };
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"){
        if(el("srcSheet")&&el("srcSheet").classList.contains("on")) closeSrc();
        else if(el("addSheet").classList.contains("on")) closeAdd();
        else if(view==="scan"){ stopCam(); setView("open"); paintOpen(); }
        else if(view==="saved"){ if(View) View.close(); setView("open"); paintOpen(); }
      }
    });
  }

  window.D3Wallet={
    openInsuranceDoc:function(d){
      var id=(d&&(d.id||d.insId))||"";
      location.href="wallet.html?open=insurance"+(id?("&doc="+encodeURIComponent(id)):"")+"&from="+encodeURIComponent((location.pathname.split("/").pop()||"home.html"));
      return Promise.resolve();
    },
    go:function(opts){
      opts=opts||{};
      var q="wallet.html";
      var p=[];
      if(opts.open) p.push("open="+encodeURIComponent(opts.open));
      if(opts.doc) p.push("doc="+encodeURIComponent(opts.doc));
      if(p.length) q+="?"+p.join("&");
      location.href=q;
    }
  };

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ bind(); boot(); });
  else { bind(); boot(); }
})();
