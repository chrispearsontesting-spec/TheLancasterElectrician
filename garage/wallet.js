/* Trac3 Wallet UI. */
(function(){
  "use strict";
  var Store=window.D3WalletStore, Lock=window.D3WalletLock, Ocr=window.D3WalletOcr, Bar=window.D3Barcode, View=window.D3DocView;
  var car=null, rec={docs:[]}, view="locked", current=null, camStream=null, camSlot=null, pendingFile=null, retakeOf=null;

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
    receipt:"Line up the receipt — number in the box",
    wheelnut:"Line up the code — number in the box",
    breakdown:"Line up the card — number in the box",
    other:"Line up the document — number in the box",
    noclaims:"Line up the no-claims letter"
  };
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

  function tileHtml(spec, d){
    if(!d){
      return '<button class="tile add" type="button" data-add="'+spec.slot+'">'+
        '<span class="plus"><span class="ico sm" data-ico="add"></span></span>'+
        (spec.slot==="other"?'<span>Add</span>':'<span class="addLab">'+esc(spec.title)+'</span><span class="addSub">Add</span>')+'</button>';
    }
    var num=formatNum(d.slot,d.number||d.phone||"");
    if(d.slot==="receipt"&&!num) num=(docs("receipt").length)+" receipt"+(docs("receipt").length===1?"":"s");
    if(d.slot==="noclaims"){ var y=Store.ncbCurrent(d,car); num=(y===1?"1 year":y+" years"); }
    var u=thumbUrl(d);
    var thumb=u?'<img alt="" src="'+u+'"/>':'';
    if(d.slot==="fuel"&&d.number&&window.D3Barcode){
      thumb='<canvas class="fuelThumb" width="300" height="80" data-code="'+String(d.number).replace(/"/g,"")+'"></canvas>';
    }
    if(d.slot==="wheelnut"&&!u){
      thumb='<svg class="docArt" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="400" height="260" rx="8" fill="#1a1a1e"/><polygon points="200,44 268,83 268,161 200,200 132,161 132,83" fill="none" stroke="#7dd3fc" stroke-width="6"/><circle cx="200" cy="122" r="28" fill="none" stroke="#7dd3fc" stroke-width="6"/></svg>';
    }
    if(d.slot==="noclaims"&&!u){
      thumb='<svg class="docArt" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="400" height="260" rx="8" fill="#1a1a1e"/><path d="M200 40l70 26v52c0 46-30 80-70 96-40-16-70-50-70-96V66z" fill="none" stroke="#7dd3fc" stroke-width="6"/><path d="M170 128l22 22 40-44" fill="none" stroke="#7dd3fc" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if(d.slot==="breakdown"&&!u){
      thumb='<svg class="docArt" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="400" height="260" rx="8" fill="#1a1a1e"/><path d="M168 70c8 0 14 6 16 14l6 28c1 6-1 12-6 15l-14 10c12 26 32 46 58 58l10-14c3-5 9-7 15-6l28 6c8 2 14 8 14 16v22c0 10-8 18-18 18C186 237 123 174 123 88c0-10 8-18 18-18z" fill="none" stroke="#7dd3fc" stroke-width="6" stroke-linejoin="round"/></svg>';
    }
    var copyVal=d.slot==="noclaims"?num:(d.number||d.phone||"");
    if(d.slot==="noclaims"&&copyVal) copyVal=copyVal+" no claims";
    var act=spec.call
      ? '<span class="copy" data-call="'+(d.phone||d.number||'')+'" aria-label="Call"><span class="ico" data-ico="phone"></span></span>'
      : (copyVal? '<span class="copy" data-copy="'+String(copyVal).replace(/"/g,"")+'" aria-label="Copy"><span class="ico" data-ico="copy"></span></span>':'');
    var cls=spec.call?"tile call":"tile";
    return '<button class="'+cls+'" type="button" data-open="'+d.id+'">'+
      '<div class="thumb">'+thumb+'</div><div class="meta"><span class="lab">'+esc(spec.title||d.title||"Document")+'</span>'+
      '<span class="numRow"><span class="num">'+(num?esc(num):"&nbsp;")+'</span>'+act+'</span></div></button>';
  }
  function esc(s){ return String(s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]}); }

  function otherDocs(){
    var known={}; DOCS.concat(CARDS).forEach(function(s){ known[s.slot]=1; });
    return (rec.docs||[]).filter(function(d){ return !known[d.slot]; });
  }

  function paintOpen(){
    var dg=el("docGrid"), cg=el("cardGrid");
    if(el("openCar")) el("openCar").textContent=carName(car);
    if(el("lockCar")) el("lockCar").textContent=carName(car);
    var dh="", i;
    for(i=0;i<DOCS.length;i++){
      var s=DOCS[i], list=docs(s.slot), d=list[0]||null;
      if(s.multi&&list.length) d=Object.assign({},list[0],{title:s.title});
      dh+=tileHtml(s,d);
    }
    dh+=tileHtml({slot:"other",title:"Add"},null);
    dg.innerHTML=dh;
    var ch="";
    for(i=0;i<CARDS.length;i++){
      var s=CARDS[i], list=docs(s.slot);
      ch+=tileHtml(s,list[0]||null);
    }
    otherDocs().forEach(function(d){ ch+=tileHtml({slot:d.slot,title:d.title||"Document"},d); });
    ch+=tileHtml({slot:"other",title:"Add"},null);
    cg.innerHTML=ch;
    Array.prototype.forEach.call(document.querySelectorAll("canvas.fuelThumb"),function(c){
      if(Bar) Bar.draw(c,c.getAttribute("data-code")||"",{width:300,height:80,bg:"#161820",fg:"#f2f2f2"});
    });
    if(window.dipstickIcons) dipstickIcons(dg.parentNode||document);
    if(window.dipstickIcons) dipstickIcons(cg);
  }

  function slotTitle(slot,d){
    var s=DOCS.concat(CARDS).filter(function(x){return x.slot===slot})[0];
    return (d&&d.title)||(s&&s.title)||"Document";
  }

  function showSaved(d){
    current=d;
    setView("saved");
    var known=DOCS.concat(CARDS).some(function(x){ return x.slot===d.slot; });
    el("savedKind").textContent=known?slotTitle(d.slot):(d.title||"Document");
    var num=formatNum(d.slot,d.number||"");
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
      }else{ sub.textContent=""; sub.hidden=true; }
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
        b.onclick=function(){ View.open({blob:d.blob,name:d.name,type:type,title:d.title||d.name}).catch(function(){}); };
        pic.appendChild(b);
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
    g.className="guide "+(card?"card ":"")+(slot==="licence"?"licence":slot==="fuel"?"fuel":slot==="noclaims"?"v5c generic":"v5c");
    el("camHint").textContent=HINTS[slot]||HINTS.other;
  }
  function stopCam(){
    if(camStream){ camStream.getTracks().forEach(function(t){ t.stop(); }); camStream=null; }
    var v=el("camVideo"); if(v) v.srcObject=null;
  }
  async function startCam(slot){
    camSlot=slot; pendingFile=null;
    setView("scan"); guideFor(slot);
    el("camBusy").hidden=true;
    try{
      camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920}},audio:false});
      el("camVideo").srcObject=camStream;
      await el("camVideo").play().catch(function(){});
    }catch(e){
      toast("Camera unavailable — choose a photo instead");
      el("scanPick").click();
    }
  }
  function windowRect(video){
    var g=el("camGuide"), w=el("camWin");
    if(!g||!w||!video) return {x:0,y:0,w:video.videoWidth,h:video.videoHeight};
    var gr=g.getBoundingClientRect(), wr=w.getBoundingClientRect(), vr=video.getBoundingClientRect();
    /* The video uses object-fit:cover, so undo that scale and crop offset. */
    var vw=video.videoWidth||vr.width, vh=video.videoHeight||vr.height;
    var sc=Math.max(vr.width/vw, vr.height/vh)||1;
    var ox=(vr.width-vw*sc)/2, oy=(vr.height-vh*sc)/2;
    var x=(wr.left-vr.left-ox)/sc, y=(wr.top-vr.top-oy)/sc, w=wr.width/sc, h=wr.height/sc;
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
  async function capture(){
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
    busy.hidden=false; busy.textContent="Reading the number…";
    var blob=await compressCanvas(srcCanvas,1600,0.8);
    var region=document.createElement("canvas");
    if(pendingFile){
      /* file: OCR a generous central band, plus a second pass of the whole image */
      var bx=srcCanvas.width*0.08, by=srcCanvas.height*0.15, bw=srcCanvas.width*0.84, bh=srcCanvas.height*0.7;
      region.width=bw; region.height=bh;
      region.getContext("2d").drawImage(srcCanvas,bx,by,bw,bh,0,0,bw,bh);
    }else{
      var r=windowRect(video);
      /* Map from on-screen video box to the captured canvas, which matches videoWidth. */
      region.width=Math.max(8,r.w); region.height=Math.max(8,r.h);
      region.getContext("2d").drawImage(srcCanvas,r.x,r.y,r.w,r.h,0,0,region.width,region.height);
    }
    var number="";
    try{
      if(Ocr){
        var res=await Ocr.readRegion(region, camSlot);
        number=res&&res.number||"";
      }
    }catch(e){}
    busy.hidden=true;
    stopCam();
    var doc={
      id:Store.newId(), slot:camSlot, title:slotTitle(camSlot),
      number:number, type:"image/jpeg", blob:blob, name:(camSlot||"doc")+".jpg", at:Date.now()
    };
    if(retakeOf&&retakeOf.slot===camSlot){
      /* Retake replaces the photo (and number, if one was read) on the same item. */
      doc=Object.assign({},retakeOf,{blob:blob,type:"image/jpeg",name:doc.name,at:Date.now(),number:number||retakeOf.number||"",ref:0});
    }
    retakeOf=null;
    if(camSlot==="breakdown"&&!doc.phone) doc.phone=number;
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
    /* Save immediately so Back keeps it; Retake can replace. */
    await Store.putDoc(car,doc);
    rec=await Store.load(car);
    current=findDoc(doc.id)||doc;
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
    doc.title=name; doc.number=number; doc.phone=phone;
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

  async function doUnlock(){
    var ok=false;
    try{ ok=await Lock.unlock(); }catch(e){ ok=false; }
    if(!ok){
      el("needPin").hidden=false;
      return false;
    }
    rec=await Store.load(car);
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
      closeAdd();
      rec={docs:[]};
      el("docGrid").innerHTML=""; el("cardGrid").innerHTML="";
      setView("locked");
    },5000);
    ["pointerdown","keydown"].forEach(function(t){
      document.addEventListener(t,function(){ if(view!=="locked"&&Lock) Lock.touch(); },{passive:true});
    });
  }

  async function boot(){
    relockWatch();
    car=Store.currentCar();
    if(el("lockCar")) el("lockCar").textContent=carName(car);
    if(el("openCar")) el("openCar").textContent=carName(car);
    var info=await Lock.canBio();
    if(el("unlockBtn")) el("unlockBtn").textContent=info.label||"Unlock with fingerprint";
    if(info.kind==="none") el("needPin").hidden=false;
    rec=await Store.load(car); // migrate even while locked; no photos shown
    if(Lock.unlocked()){
      paintOpen();
      var q=new URLSearchParams(location.search);
      if(q.get("doc")&&await openExisting(q.get("doc"))) return;
      if(q.get("open")){ var d=first(q.get("open")); if(d){ showSaved(d); return; } }
      setView("open");
    }else setView("locked");
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
      startCam(slot);
      return;
    }
    if(open){ openExisting(open.getAttribute("data-open")); }
  }

  function bind(){
    el("unlockBtn").onclick=function(){ doUnlock(); };
    el("docGrid").addEventListener("click",onGridClick);
    el("cardGrid").addEventListener("click",onGridClick);
    el("camClose").onclick=function(){ retakeOf=null; stopCam(); setView("open"); paintOpen(); };
    el("camShutter").onclick=function(){ capture(); };
    el("camFile").onclick=function(){ el("scanPick").click(); };
    el("scanPick").onchange=function(){
      var f=this.files&&this.files[0]; this.value="";
      if(!f) return;
      pendingFile=f;
      /* Show the chosen photo as the camera background so the user can still line up / just capture. */
      loadImage(f).then(function(im){
        var v=el("camVideo");
        /* hide live video, draw image into a snapshot on shutter; capture() uses pendingFile */
        v.style.display="none";
        toast("Photo loaded — press the shutter");
      });
    };
    el("savedBack").onclick=function(){ if(View) View.close(); setView("open"); paintOpen(); };
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
    el("savedAddMore").onclick=function(e){ e.preventDefault(); if(View) View.close(); if(current) startCam(current.slot); };
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
    el("savedRetake").onclick=function(e){ e.preventDefault(); if(View) View.close(); if(current){ retakeOf=current; startCam(current.slot); } };
    el("openBack").addEventListener("click",function(){ if(Lock) Lock.lock(); });
    el("lockBack").addEventListener("click",function(){ if(Lock) Lock.lock(); });
    el("addCancel").onclick=closeAdd;
    el("addSave").onclick=function(){ saveAdd().catch(function(e){ toast((e&&e.message)||"Could not save"); }); };
    el("addPhoto").onclick=function(){
      var slot=el("addSheet").dataset.slot;
      if(slot==="other"||slot==="breakdown"||slot==="wheelnut"){ el("addPick").click(); return; }
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
      if(!f) return; pendingFile=f; el("addHint").textContent="Photo ready: "+(f.name||"image");
    };
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"){
        if(el("addSheet").classList.contains("on")) closeAdd();
        else if(view==="scan"){ stopCam(); setView("open"); paintOpen(); }
        else if(view==="saved"){ if(View) View.close(); setView("open"); paintOpen(); }
      }
    });
  }

  window.D3Wallet={
    openInsuranceDoc:function(d){
      var id=(d&&(d.id||d.insId))||"";
      location.href="wallet.html?open=insurance"+(id?("&doc="+encodeURIComponent(id)):"");
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
