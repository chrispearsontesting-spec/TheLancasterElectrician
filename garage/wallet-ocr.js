/* On-device OCR for Wallet capture, using the existing self-hosted Tesseract. */
(function(root){
  "use strict";
  var worker=null, loading=false;

  function tesseractPaths(){
    var VB=new URL("vendor/tesseract/", (root.location&&root.location.href)||"http://127.0.0.1/").href;
    return {workerPath:VB+"worker.min.js", corePath:VB, langPath:VB.replace(/\/$/,""), gzip:true, workerBlobURL:false, cacheMethod:"none"};
  }
  function loadScript(){
    if(root.Tesseract) return Promise.resolve(root.Tesseract);
    return new Promise(function(ok,no){
      var s=document.createElement("script");
      s.src="./vendor/tesseract/tesseract.min.js?v=5.1.1";
      s.onload=function(){ ok(root.Tesseract); };
      s.onerror=function(){ no(new Error("OCR failed to load")); };
      document.head.appendChild(s);
    });
  }
  /* Tesseract.js v5: createWorker(lang, oem, options) loads and initialises in one go. */
  async function getWorker(){
    if(worker) return worker;
    if(loading) return loading;
    loading=(async function(){
      var T=await loadScript();
      var w=await T.createWorker("eng",1,tesseractPaths());
      worker=w; loading=false;
      return w;
    })();
    try{ return await loading; }catch(e){ loading=false; throw e; }
  }
  /* Greyscale, stretch contrast, invert if dark, and scale small crops up so the
     number is ~60px tall: much better accuracy on a narrow window. */
  function prep(src){
    var w=src.width, h=src.height, scale=Math.max(1, Math.min(4, 120/Math.max(h,1)));
    if(w*scale>2400) scale=2400/w;
    var c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(w*scale)); c.height=Math.max(1,Math.round(h*scale));
    var x=c.getContext("2d",{willReadFrequently:true});
    x.imageSmoothingQuality="high";
    x.drawImage(src,0,0,c.width,c.height);
    var img=x.getImageData(0,0,c.width,c.height), p=img.data, min=255, max=0, sum=0, n=p.length/4, i;
    for(i=0;i<p.length;i+=4){ var g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]; p[i]=p[i+1]=p[i+2]=g; if(g<min)min=g; if(g>max)max=g; sum+=g; }
    var inv=sum/n<110, range=(max-min)||1;
    for(i=0;i<p.length;i+=4){
      var v=(p[i]-min)/range; if(inv) v=1-v;
      v=Math.max(0,Math.min(1,(v-0.5)*1.4+0.5));
      p[i]=p[i+1]=p[i+2]=Math.round(v*255);
    }
    x.putImageData(img,0,0);
    /* white margin helps Tesseract find the line */
    var pad=document.createElement("canvas"), m=Math.round(c.height*0.25);
    pad.width=c.width+2*m; pad.height=c.height+2*m;
    var px=pad.getContext("2d"); px.fillStyle="#fff"; px.fillRect(0,0,pad.width,pad.height); px.drawImage(c,m,m);
    return pad;
  }
  async function ocrCanvas(canvas, opt){
    opt=opt||{};
    var w=await getWorker();
    var params={tessedit_pageseg_mode:opt.psm||"7",tessedit_char_whitelist:opt.whitelist||""};
    await w.setParameters(params);
    var res=await w.recognize(root.document?prep(canvas):canvas);
    return (res&&res.data&&res.data.text)||"";
  }

  function clean(s){ return String(s||"").replace(/\s+/g," ").trim(); }
  function alnum(s){ return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  function digits(s){ return String(s||"").replace(/\D/g,""); }

  function extractV5c(text){
    if(root.D3TaxRenew&&D3TaxRenew.extractTaxRef){
      var r=D3TaxRenew.extractTaxRef(text);
      if(r&&r.type==="v5c") return r.digits;
      if(r&&r.type==="v11") return ""; // don't treat V11 as a logbook number
    }
    var d=digits(text);
    var m=d.match(/(?:^|\D)(\d{11})(?:\D|$)/);
    if(m&&!/^07/.test(m[1])) return m[1];
    return d.length===11&&!/^07/.test(d)?d:"";
  }
  /* DVLA licence number: 1-5 surname (short names padded with 9), 6-11 digits
     (birth date), 12-13 initials (or 9), 14 a digit, 15-16 check letters.
     Fix the usual OCR mix-ups by position. */
  var TO_L={"0":"O","1":"I","2":"Z","5":"S","8":"B","6":"G"}, TO_D={"O":"0","Q":"0","D":"0","I":"1","L":"1","Z":"2","S":"5","B":"8","G":"6"};
  function fixLicence(w){
    var out="";
    for(var i=0;i<16;i++){
      var ch=w[i], letter=(i<5||i===11||i===12), digit=(i>=5&&i<=10)||i===13, check=i>=14;
      if(digit) ch=TO_D[ch]||ch;
      else if(letter){ if(ch!=="9") ch=TO_L[ch]||ch; }
      else if(check) ch=TO_L[ch]||ch;
      out+=ch;
    }
    return out;
  }
  var LIC_RE=/^[A-Z9]{5}\d{6}[A-Z9]{2}\d[A-Z]{2}$/;
  function extractLicence(text){
    var t=alnum(text);
    for(var i=0;i+16<=t.length;i++){
      var w=t.slice(i,i+16);
      if(LIC_RE.test(w)) return w;
    }
    for(var j=0;j+16<=t.length;j++){
      var f=fixLicence(t.slice(j,j+16));
      if(LIC_RE.test(f)) return f;
    }
    return "";
  }
  function extractInsurance(text){
    var t=clean(text).toUpperCase();
    /* Keep hyphens: insurers' sites usually want the policy number exactly as printed. */
    var parts=t.split(/[^A-Z0-9\-]+/).map(function(p){ return p.replace(/^-+|-+$/g,""); }).filter(function(p){ var n=p.replace(/-/g,""); return n.length>=6&&n.length<=20&&/[A-Z]/.test(n)&&/\d/.test(n); });
    if(parts.length) return parts.sort(function(a,b){return b.length-a.length;})[0];
    var a=alnum(t);
    return (a.length>=6&&a.length<=20)?a:"";
  }
  /* A whole policy document (PDF text layer or a page of OCR): take the reference printed
     after a "Policy number" style label, never just the longest code on the page. */
  function extractPolicy(text){
    var t=String(text||"").replace(/[\u2010-\u2015]/g,"-");
    var re=/(?:policy|certificate|cover\s*note)\s*(?:number|no\.?|num|ref(?:erence)?|#|id)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\/\- ]{3,30})/ig, m, best="";
    while((m=re.exec(t))){
      var tok=m[1].trim().split(/\s{2,}|\s(?=[A-Za-z]{3,}\b)/)[0].replace(/[\s\-\/]+$/,"").trim().toUpperCase();
      var n=tok.replace(/[^A-Z0-9]/g,"");
      if(n.length>=5&&n.length<=24&&/\d/.test(n)){ best=tok.replace(/\s+/g,""); break; }
    }
    return best;
  }
  function extractFuel(text){
    var d=digits(text);
    if(d.length>=12&&d.length<=19) return d;
    var m=String(text||"").match(/(?:\d[\s-]*){12,19}/);
    return m?digits(m[0]):(d.length>=8&&d.length<=19?d:"");
  }
  function extractMot(text){
    var d=digits(text);
    if(d.length>=8&&d.length<=16) return d;
    return "";
  }
  function extractWheelnut(text){
    var t=clean(text).toUpperCase().replace(/\s+/g,"");
    var m=t.match(/[A-Z0-9]{1,4}-?[A-Z0-9]{1,4}/);
    return m?m[0].slice(0,8):"";
  }
  function extract(slot,text){
    if(slot==="v5c") return extractV5c(text);
    if(slot==="licence") return extractLicence(text);
    if(slot==="insurance") return extractInsurance(text);
    if(slot==="fuel") return extractFuel(text);
    if(slot==="mot") return extractMot(text);
    if(slot==="wheelnut") return extractWheelnut(text);
    var a=alnum(text);
    return a.length>=4&&a.length<=24?a:"";
  }
  var WHITE={
    v5c:"0123456789 ",
    fuel:"0123456789 ",
    mot:"0123456789 ",
    licence:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    insurance:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
    wheelnut:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
  };
  function whitelist(slot){ return WHITE[slot]||"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- "; }

  async function readRegion(canvas, slot, progress){
    var wl=whitelist(slot);
    var text=await ocrCanvas(canvas,{whitelist:wl,psm:slot==="fuel"?"6":"7"});
    if(progress) progress(0.7);
    var n=extract(slot,text);
    if(!n && slot!=="fuel"){
      var t2=await ocrCanvas(canvas,{whitelist:wl,psm:"6"});
      n=extract(slot,t2);
      text=text+"\n"+t2;
    }
    if(progress) progress(1);
    return {text:text,number:n};
  }

  var api={ocrCanvas:ocrCanvas,extract:extract,extractV5c:extractV5c,extractLicence:extractLicence,
    extractInsurance:extractInsurance,extractPolicy:extractPolicy,extractFuel:extractFuel,whitelist:whitelist,readRegion:readRegion};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.D3WalletOcr=api;
})(typeof window!=="undefined"?window:globalThis);
