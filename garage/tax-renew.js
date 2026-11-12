/* Tax renew: read a V11 (16-digit) or V5C (11-digit) reference from a photo, on this phone only. */
(function(root){
  "use strict";
  var GOV="https://www.gov.uk/vehicle-tax";
  var V5C_HELP="https://www.gov.uk/vehicle-log-book";
  var worker=null, loading=false;

  function digitsOnly(s){ return String(s||"").replace(/\D/g,""); }
  function ocrDigitMap(s){
    return String(s||"")
      .replace(/[Oo]/g,"0")
      .replace(/[Il|]/g,"1")
      .replace(/[Ss]/g,"5")
      .replace(/[B]/g,"8")
      .replace(/[Z]/g,"2")
      .replace(/[Gg]/g,"6");
  }
  function classify(digits){
    digits=digitsOnly(digits);
    if(digits.length===16) return "v11";
    if(digits.length===11) return "v5c";
    return "";
  }
  function labelFor(type){
    if(type==="v11") return "Reminder letter (V11)";
    if(type==="v5c") return "Logbook (V5C)";
    return "";
  }
  function formatRef(type,digits){
    digits=digitsOnly(digits);
    var t=type||classify(digits);
    if(t==="v11"&&digits.length===16) return digits.replace(/(\d{4})(?=\d)/g,"$1 ");
    return digits;
  }
  function plausibleV5C(d){
    return d.length===11 && !/^07/.test(d) && !/^44/.test(d);
  }
  function collect(src){
    var v11=[], v5c=[], re=/\d(?:[\s\-]*\d){10,19}/g, m;
    while((m=re.exec(src))){
      var d=digitsOnly(m[0]);
      if(d.length>=16) v11.push(d.slice(0,16));
      else if(plausibleV5C(d)) v5c.push(d);
    }
    return {v11:v11,v5c:v5c};
  }
  function unique(list){
    var seen={}, out=[];
    list.forEach(function(x){ if(!seen[x]){ seen[x]=1; out.push(x); } });
    return out;
  }
  function extractTaxRef(text){
    var raw=String(text||"");
    var a=collect(raw), b=collect(ocrDigitMap(raw));
    var v11=unique(a.v11.concat(b.v11));
    var v5c=unique(a.v5c.concat(b.v5c));
    if(v11.length) return {type:"v11",digits:v11[0],label:labelFor("v11"),formatted:formatRef("v11",v11[0])};
    if(v5c.length) return {type:"v5c",digits:v5c[0],label:labelFor("v5c"),formatted:formatRef("v5c",v5c[0])};
    return null;
  }

  function prepImage(src){
    return new Promise(function(ok,no){
      var im=new Image(), u=typeof src==="string"?src:URL.createObjectURL(src);
      im.onload=function(){
        var w=im.naturalWidth||im.width, h=im.naturalHeight||im.height;
        var scale=Math.min(2.5, Math.max(1, 1800/Math.max(w,1)));
        var c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(w*scale));
        c.height=Math.max(1,Math.round(h*scale));
        var x=c.getContext("2d",{willReadFrequently:true});
        x.drawImage(im,0,0,c.width,c.height);
        var img=x.getImageData(0,0,c.width,c.height), p=img.data;
        var min=255,max=0,sum=0,n=p.length/4;
        for(var i=0;i<p.length;i+=4){
          var g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];
          p[i]=p[i+1]=p[i+2]=g; if(g<min)min=g; if(g>max)max=g; sum+=g;
        }
        if(sum/n<110){ for(var j=0;j<p.length;j+=4) p[j]=p[j+1]=p[j+2]=255-p[j]; min=255-max; max=255-min; }
        var range=(max-min)||1;
        for(var k=0;k<p.length;k+=4){
          var v=(p[k]-min)/range;
          v=Math.max(0,Math.min(1,(v-0.5)*1.35+0.5));
          p[k]=p[k+1]=p[k+2]=Math.round(v*255);
        }
        x.putImageData(img,0,0);
        if(typeof src!=="string") try{URL.revokeObjectURL(u)}catch(e){}
        ok(c);
      };
      im.onerror=function(){ if(typeof src!=="string") try{URL.revokeObjectURL(u)}catch(e){} no(new Error("Can't read that photo")); };
      im.src=u;
    });
  }

  function tesseractPaths(){
    var VB=new URL("vendor/tesseract/", (root.location&&root.location.href)||"http://127.0.0.1/").href;
    return {workerPath:VB+"worker.min.js", corePath:VB, langPath:VB.replace(/\/$/,""), gzip:true, workerBlobURL:false, cacheMethod:"none"};
  }
  function loadScript(){
    return new Promise(function(ok,no){
      if(root.Tesseract){ ok(root.Tesseract); return; }
      var s=document.createElement("script");
      s.src="./vendor/tesseract/tesseract.min.js?v=5.1.1";
      s.onload=function(){ ok(root.Tesseract); };
      s.onerror=function(){ no(new Error("The photo reader could not load.")); };
      document.head.appendChild(s);
    });
  }
  async function getWorker(){
    var T=await loadScript();
    if(worker) return worker;
    if(loading){ return loading; }
    var opts=tesseractPaths();
    loading=T.createWorker("eng",1,opts).then(function(w){ worker=w; loading=null; return w; });
    return loading;
  }
  async function ocrCanvas(canvas, onProgress){
    var T=await loadScript();
    var opts=tesseractPaths();
    opts.logger=function(m){
      if(onProgress && m && m.status==="recognizing text") onProgress(m.progress||0);
    };
    var texts=[];
    function run(img, extra){
      var o=Object.assign({},opts,extra||{});
      return T.recognize(img,"eng",o).then(function(r){ return (r&&r.data&&r.data.text)||""; });
    }
    texts.push(await run(canvas,{tessedit_char_whitelist:"0123456789 ",tessedit_pageseg_mode:"6"}));
    var found=extractTaxRef(texts.join("\n"));
    if(found) return {text:texts.join("\n"),ref:found};
    texts.push(await run(canvas,{tessedit_char_whitelist:"0123456789 ",tessedit_pageseg_mode:"11"}));
    found=extractTaxRef(texts.join("\n"));
    return {text:texts.join("\n"),ref:found};
  }
  async function readFile(file, onProgress){
    var canvas=await prepImage(file);
    return ocrCanvas(canvas, onProgress);
  }

  function carState(){
    try{ var s=JSON.parse(localStorage.getItem("gt.garage")||"null"); if(s&&s.cars&&s.cars.length) return s; }catch(e){}
    return {i:0,cars:[]};
  }
  function currentCar(s){ s=s||carState(); return (s.cars&&s.cars[s.i])||null; }
  function saveCar(fn){
    var s=carState(), c=currentCar(s); if(!c) return;
    fn(c); localStorage.setItem("gt.garage",JSON.stringify(s));
  }

  function el(id){ return document.getElementById(id); }
  function setState(name){
    var rootEl=el("taxSheet");
    if(rootEl) rootEl.setAttribute("data-state",name);
    ["taxStart","taxBusy","taxResult","taxFail"].forEach(function(id){
      var n=el(id); if(n) n.hidden=(id!=="tax"+name.charAt(0).toUpperCase()+name.slice(1));
    });
    // ids: taxStart, taxBusy, taxResult, taxFail — map state names
  }
  function show(state){
    var rootEl=el("taxSheet");
    if(rootEl) rootEl.setAttribute("data-state",state);
    var map={start:"taxStart",busy:"taxBusy",result:"taxResult",fail:"taxFail"};
    Object.keys(map).forEach(function(k){ var n=el(map[k]); if(n) n.hidden=k!==state; });
  }
  function toast(msg){
    var t=el("taxToast");
    if(!t){
      t=document.createElement("div");
      t.id="taxToast";
      t.setAttribute("role","status");
      document.body.appendChild(t);
    }
    t.textContent=msg;
    t.classList.add("on");
    clearTimeout(toast.t);
    toast.t=setTimeout(function(){ t.classList.remove("on"); },3500);
  }
  function openGov(){
    if(root.driv3OpenExternal) return root.driv3OpenExternal(GOV);
    var w=root.open(GOV,"_blank","noopener");
    if(!w) root.location.href=GOV;
  }
  function fallbackCopy(text){
    var a=document.createElement("textarea");
    a.value=text; a.setAttribute("readonly",""); a.style.position="fixed"; a.style.left="-9999px";
    document.body.appendChild(a); a.select();
    try{ document.execCommand("copy"); }catch(e){}
    document.body.removeChild(a);
  }
  function applyRef(ref, typed){
    var box=el("taxRef"), typ=el("taxRefType"), rem=el("taxRememberRow"), chk=el("taxRemember");
    if(!box) return;
    var type=ref&&ref.type||classify(box.value);
    var digits=ref?ref.digits:digitsOnly(box.value);
    if(ref&&!typed) box.value=ref.formatted||formatRef(type,digits);
    if(typ) typ.textContent=labelFor(type)||(digits?"That doesn't look like a 16- or 11-digit reference yet.":"");
    if(rem) rem.hidden=type!=="v5c";
    if(chk&&type!=="v5c") chk.checked=false;
    box.setAttribute("data-type",type||"");
  }
  function openSheet(){
    var sheet=el("taxSheet"); if(!sheet) return;
    sheet.className="sheet on";
    sheet.setAttribute("data-state","start");
    show("start");
    var box=el("taxRef"), typ=el("taxRefType"), chk=el("taxRemember"), rem=el("taxRememberRow"), busy=el("taxBusyMsg");
    if(box) box.value="";
    if(typ) typ.textContent="";
    if(chk) chk.checked=false;
    if(rem) rem.hidden=true;
    if(busy) busy.textContent="Reading the photo… this stays on your phone.";
    var saved=currentCar();
    if(saved&&saved.v5cRef&&digitsOnly(saved.v5cRef).length===11){
      applyRef({type:"v5c",digits:digitsOnly(saved.v5cRef),formatted:formatRef("v5c",saved.v5cRef)});
      // Stay on the start view; a remembered number is available if they type or we could mention it.
      // Pre-fill only after they choose Type it in, unless we go straight to result.
      // Show result with the saved logbook number so they can copy without scanning again.
      applyRef({type:"v5c",digits:digitsOnly(saved.v5cRef),formatted:formatRef("v5c",saved.v5cRef)});
      show("result");
    }
    var pick=el("taxScanPick"); if(pick) pick.value="";
    var back=el("taxBack"); if(back) back.focus();
  }
  function closeSheet(){
    var sheet=el("taxSheet"); if(sheet){ sheet.className="sheet"; sheet.setAttribute("data-state","closed"); }
  }
  function startManual(){
    var box=el("taxRef");
    if(box && !digitsOnly(box.value)) box.value="";
    applyRef(null,true);
    show("result");
    if(box) box.focus();
  }
  async function scanFile(file){
    if(!file) return;
    show("busy");
    var busy=el("taxBusyMsg");
    try{
      var res=await readFile(file, function(p){
        if(busy) busy.textContent="Reading the photo… "+Math.round(p*100)+"%";
      });
      // Drop the file as soon as we've read it — never stored.
      var pick=el("taxScanPick"); if(pick) pick.value="";
      if(res&&res.ref){ applyRef(res.ref); show("result"); }
      else show("fail");
    }catch(e){
      show("fail");
    }
  }
  function copyAndOpen(){
    var box=el("taxRef"); if(!box) return;
    var digits=digitsOnly(box.value);
    var type=classify(digits);
    if(!type){ toast("Enter a 16-digit reminder number or an 11-digit logbook number."); return; }
    var text=formatRef(type,digits);
    var chk=el("taxRemember");
    if(type==="v5c"&&chk&&chk.checked){
      saveCar(function(c){ c.v5cRef=digits; });
    }
    function go(){ toast("Number copied — paste it on GOV.UK"); openGov(); }
    if(root.navigator&&root.navigator.clipboard&&root.navigator.clipboard.writeText){
      root.navigator.clipboard.writeText(text).then(go).catch(function(){ fallbackCopy(text); go(); });
    }else{ fallbackCopy(text); go(); }
  }

  function attach(){
    if(!el("taxSheet")) return;
    document.addEventListener("click",function(e){
      var openBtn=e.target.closest&&e.target.closest("[data-tax-renew]");
      if(openBtn){ e.preventDefault(); openSheet(); return; }
    });
    var scan=el("taxScan");
    if(scan) scan.onclick=function(){ var p=el("taxScanPick"); if(p) p.click(); };
    var pick=el("taxScanPick");
    if(pick) pick.onchange=function(){ var f=this.files&&this.files[0]; this.value=""; if(f) scanFile(f); };
    var typeLink=el("taxTypeIn"), typeFail=el("taxTypeInFail"), typeAgain=el("taxTypeAgain"), retry=el("taxRetry");
    if(typeLink) typeLink.onclick=function(e){ e.preventDefault(); startManual(); };
    if(typeFail) typeFail.onclick=function(e){ e.preventDefault(); startManual(); };
    if(typeAgain) typeAgain.onclick=function(e){ e.preventDefault(); startManual(); };
    if(retry) retry.onclick=function(){ var p=el("taxScanPick"); show("start"); if(p) p.click(); };
    var gov=el("taxGoGov"), gov2=el("taxGoGov2");
    if(gov) gov.onclick=function(){ openGov(); };
    if(gov2) gov2.onclick=function(){ openGov(); };
    var copy=el("taxCopy"); if(copy) copy.onclick=copyAndOpen;
    var back=el("taxBack"); if(back) back.onclick=closeSheet;
    var box=el("taxRef");
    if(box) box.addEventListener("input",function(){ applyRef(null,true); });
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"){ var s=el("taxSheet"); if(s&&s.classList.contains("on")){ e.preventDefault(); closeSheet(); } }
    });
  }

  var api={extractTaxRef:extractTaxRef,formatRef:formatRef,classify:classify,labelFor:labelFor,digitsOnly:digitsOnly,ocrDigitMap:ocrDigitMap,prepImage:prepImage,readFile:readFile,open:openSheet,close:closeSheet,GOV:GOV,V5C_HELP:V5C_HELP};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else {
    root.D3TaxRenew=api;
    if(root.document){
      if(root.document.readyState==="loading") root.document.addEventListener("DOMContentLoaded",attach);
      else attach();
    }
  }
})(typeof window!=="undefined"?window:typeof global!=="undefined"?global:this);
