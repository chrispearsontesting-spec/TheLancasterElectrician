/* On-device OCR for Wallet capture, using the self-hosted Tesseract (no CDN, nothing paid).
   Android aapt decompresses *.gz in assets and drops the suffix, so the APK has
   eng.traineddata while the website keeps eng.traineddata.gz. We probe both. */
(function(root){
  "use strict";
  var worker=null, loading=false, loadFailed=null;
  var TIMEOUT=10000, LOAD_TIMEOUT=20000;

  function baseUrl(){
    return new URL("vendor/tesseract/", (root.location&&root.location.href)||"http://127.0.0.1/").href;
  }
  function tesseractPaths(gzip){
    var VB=baseUrl();
    return {workerPath:VB+"worker.min.js", corePath:VB, langPath:VB.replace(/\/$/,""), gzip:!!gzip, workerBlobURL:false, cacheMethod:"none"};
  }
  /* Cheap probe: Range or a short GET. gzip files start 1F 8B; traineddata is a large binary. */
  async function probeLang(url, gzip){
    try{
      var r=await fetch(url, {headers:{"Range":"bytes=0-15"}, cache:"no-store"});
      if(!r.ok && r.status!==206) return false;
      var buf=await r.arrayBuffer();
      var u=new Uint8Array(buf);
      if(u.length<2) return false;
      if(gzip) return u[0]===0x1f && u[1]===0x8b;
      if(u[0]===0x1f && u[1]===0x8b) return false;
      return true;
    }catch(e){ return false; }
  }
  async function resolveLang(){
    var VB=baseUrl();
    if(await probeLang(VB+"eng.traineddata", false)) return tesseractPaths(false);
    if(await probeLang(VB+"eng.traineddata.gz", true)) return tesseractPaths(true);
    throw new Error("OCR language data missing");
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
  function withTimeout(p, ms, msg){
    var t;
    var q=new Promise(function(ok,no){
      t=setTimeout(function(){ no(new Error(msg||"Couldn't read it")); }, ms||TIMEOUT);
      Promise.resolve(p).then(function(v){ clearTimeout(t); ok(v); }, function(e){ clearTimeout(t); no(e); });
    });
    return q;
  }
  async function resetWorker(){
    var w=worker; worker=null; loading=false;
    if(w) try{ await w.terminate(); }catch(e){}
  }
  /* Tesseract.js v5: createWorker(lang, oem, options) loads and initialises in one go. */
  async function getWorker(){
    if(worker) return worker;
    if(loading) return loading;
    loading=(async function(){
      var T=await loadScript();
      var opts=await resolveLang();
      var w=await T.createWorker("eng",1,opts);
      worker=w; loading=false; loadFailed=null;
      return w;
    })();
    try{ return await withTimeout(loading, LOAD_TIMEOUT, "Couldn't read it"); }
    catch(e){ loading=false; loadFailed=e; throw e; }
  }
  function prewarm(){ getWorker().catch(function(){}); }

  /* Greyscale, stretch contrast, invert if dark, and scale small crops up so the
     number is ~60px tall: much better accuracy on a narrow window. */
  function scaleCanvas(src, scale){
    var c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(src.width*scale)); c.height=Math.max(1,Math.round(src.height*scale));
    var x=c.getContext("2d",{willReadFrequently:true});
    x.imageSmoothingQuality="high";
    x.drawImage(src,0,0,c.width,c.height);
    return {c:c,x:x};
  }
  function toGrey(img){
    var p=img.data, min=255, max=0, sum=0, n=p.length/4, i, hist=new Array(256).fill(0);
    for(i=0;i<p.length;i+=4){ var g=Math.round(0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]); p[i]=p[i+1]=p[i+2]=g; if(g<min)min=g; if(g>max)max=g; sum+=g; hist[g]++; }
    return {min:min,max:max,mean:sum/n,hist:hist};
  }
  function stretch(img, st){
    var p=img.data, inv=st.mean<110, range=(st.max-st.min)||1, i;
    for(i=0;i<p.length;i+=4){
      var v=(p[i]-st.min)/range; if(inv) v=1-v;
      v=Math.max(0,Math.min(1,(v-0.5)*1.4+0.5));
      p[i]=p[i+1]=p[i+2]=Math.round(v*255);
    }
  }
  function otsu(st){
    var hist=st.hist, total=0, i, sum=0;
    for(i=0;i<256;i++){ total+=hist[i]; sum+=i*hist[i]; }
    var sumB=0, wB=0, max=0, thr=127;
    for(i=0;i<256;i++){
      wB+=hist[i]; if(!wB) continue;
      var wF=total-wB; if(!wF) break;
      sumB+=i*hist[i];
      var mB=sumB/wB, mF=(sum-sumB)/wF, between=wB*wF*(mB-mF)*(mB-mF);
      if(between>max){ max=between; thr=i; }
    }
    return thr;
  }
  function threshold(img, t){
    var p=img.data, i;
    for(i=0;i<p.length;i+=4){ var v=p[i]<t?0:255; p[i]=p[i+1]=p[i+2]=v; }
  }
  function padWhite(c){
    var m=Math.max(8,Math.round(c.height*0.25));
    var pad=document.createElement("canvas");
    pad.width=c.width+2*m; pad.height=c.height+2*m;
    var px=pad.getContext("2d"); px.fillStyle="#fff"; px.fillRect(0,0,pad.width,pad.height); px.drawImage(c,m,m);
    return pad;
  }
  function prep(src, mode){
    var w=src.width, h=src.height, scale=Math.max(1, Math.min(4, 120/Math.max(h,1)));
    if(w*scale>2400) scale=2400/w;
    var drawn=scaleCanvas(src, scale), img=drawn.x.getImageData(0,0,drawn.c.width,drawn.c.height);
    var st=toGrey(img);
    if(mode==="otsu"){ if(st.mean<110){ var p=img.data,i; for(i=0;i<p.length;i+=4) p[i]=p[i+1]=p[i+2]=255-p[i]; st=toGrey(img); } threshold(img, otsu(st)); }
    else stretch(img, st);
    drawn.x.putImageData(img,0,0);
    return padWhite(drawn.c);
  }
  async function ocrCanvas(canvas, opt){
    opt=opt||{};
    var w=await getWorker();
    var params={tessedit_pageseg_mode:String(opt.psm||"7")};
    if(opt.whitelist) params.tessedit_char_whitelist=opt.whitelist;
    else params.tessedit_char_whitelist="";
    await w.setParameters(params);
    var src=root.document?prep(canvas, opt.prep||"stretch"):canvas;
    var res=await w.recognize(src);
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
    if(slot==="receipt"){ var r=extractReceipt(text); return r.total!=null?("£"+r.total.toFixed(2)):""; }
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

  /* ---- Receipts (self-employed: date, total, VAT, VAT number, supplier; fuel: litres, p/l) ---- */
  var MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  function isoDate(d,m,y){
    d=+d; m=+m; y=+y; if(y<100) y+=y>=70?1900:2000;
    if(!d||!m||m>12||d>31||y<1990||y>2100) return "";
    return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  }
  function parseMoney(s){
    if(s==null) return null;
    var t=String(s).replace(/,/g,"").replace(/\s/g,"");
    var m=t.match(/£?\s*(\d+(?:\.\d{1,2})?)/);
    if(!m) return null;
    var n=parseFloat(m[1]);
    return isNaN(n)?null:Math.round(n*100)/100;
  }
  function findDates(t){
    var out=[], m, re1=/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
    while((m=re1.exec(t))){ var iso=isoDate(m[1],m[2],m[3]); if(iso) out.push({iso:iso, raw:m[0]}); }
    var re2=/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{2,4})\b/ig;
    while((m=re2.exec(t))){ var mo=MONTHS[m[2].toLowerCase()]; var iso=isoDate(m[1],mo,m[3]); if(iso) out.push({iso:iso, raw:m[0]}); }
    return out;
  }
  function extractVatNo(t){
    var u=t.toUpperCase().replace(/[\u2010-\u2015]/g,"-");
    function norm(d){ var n=String(d).replace(/\D/g,""); if(n.length===9||n.length===12) return "GB"+n; return ""; }
    var m=u.match(/\bGB\s*(\d{3}\s*\d{4}\s*\d{2}(?:\s*\d{3})?)\b/);
    if(m){ var n=norm(m[1]); if(n) return n; }
    m=u.match(/VAT\s*(?:REG(?:ISTRATION)?(?:\s*(?:NO|NUM|NUMBER|N[°O]|#))?|NO(?:\s*\.)?|NUM(?:BER)?|N[°O]|#)\s*[:.\-]?\s*(?:GB\s*)?(\d{3}[\s\-]*\d{4}[\s\-]*\d{2}(?:[\s\-]*\d{3})?)/);
    if(m){ var n2=norm(m[1]); if(n2) return n2; }
    m=u.match(/\b(\d{3}[\s\-]*\d{4}[\s\-]*\d{2}(?:[\s\-]*\d{3})?)\b/);
    if(m && /VAT/.test(u)){ var n3=norm(m[1]); if(n3) return n3; }
    return "";
  }
  function extractReceipt(text){
    var raw=String(text||"").replace(/\r/g,"\n").replace(/[\u00a3]/g,"£").replace(/[\u2010-\u2015]/g,"-");
    var t=raw, lines=raw.split(/\n+/).map(function(l){ return l.replace(/[ \t]+/g," ").trim(); }).filter(Boolean);
    var joined=lines.join("\n");
    var dates=findDates(joined);
    var dateISO=dates.length?dates[dates.length-1].iso:"";
    /* Prefer a date near 'DATE' if present. */
    for(var i=0;i<lines.length;i++){
      if(/\bDATE\b/i.test(lines[i])){ var d=findDates(lines[i]+" "+(lines[i+1]||"")); if(d.length){ dateISO=d[0].iso; break; } }
    }
    var date=dateISO?dateISO.split("-").reverse().join("/"):"";

    function lineMoney(s){
      var ms=String(s).replace(/,/g,"").match(/£\s*\d+(?:\.\d{1,2})?|\b\d+\.\d{2}\b/g);
      if(!ms||!ms.length) return null;
      return parseMoney(ms[ms.length-1]);
    }
    var total=null, subtotal=null;
    lines.forEach(function(l){
      if(/SUB[\s-]*TOTAL/i.test(l)){ var v=lineMoney(l); if(v!=null) subtotal=v; return; }
      if(/\b(AMOUNT\s*DUE|AMT\s*DUE|TO\s*PAY|TOTAL\s*DUE|GRAND\s*TOTAL|BALANCE\s*DUE|\bTOTAL\b)\b/i.test(l) && !/SUB/i.test(l)){
        var v=lineMoney(l); if(v!=null) total=v;
      }
    });
    if(total==null){
      /* last pound amount on the page that's not a unit price under £4 (p/l in pounds) */
      var all=[];
      lines.forEach(function(l){ var v=lineMoney(l); if(v!=null&&v>=1) all.push(v); });
      if(all.length) total=all[all.length-1];
    }

    var vat=null, vatRate=null;
    var rm=joined.match(/VAT\s*(?:@|AT|=|:)?\s*(\d{1,2}(?:\.\d+)?)\s*\s*%/i) || joined.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*VAT/i);
    if(rm) vatRate=parseFloat(rm[1]);
    lines.forEach(function(l){
      if(!/\bVAT\b/i.test(l)) return;
      if(/%/.test(l) && lineMoney(l)==null) return;
      if(/VAT\s*(REG|NO|NUM|NUMBER)/i.test(l) && !/£|\d+\.\d{2}/.test(l)) return;
      var v=lineMoney(l);
      if(v!=null && (total==null || v<total)) vat=v;
    });
    if(vat==null && total!=null && vatRate){ vat=Math.round(total/(100+vatRate)*vatRate*100)/100; }

    var vatNo=extractVatNo(joined);

    var skip=/^(vat\s*(receipt|invoice|reg)|tax\s*invoice|customer\s*copy|thank\s*you|receipt|invoice|fuel\s*receipt|date\b|tel\b|www\.|http)/i;
    var supplier="";
    for(var k=0;k<Math.min(6,lines.length);k++){
      var l=lines[k].replace(/^[*\-=]+|[*\-=]+$/g,"").trim();
      if(l.length<3||l.length>48) continue;
      if(skip.test(l)) continue;
      if(findDates(l).length && l.length<18) continue;
      if(/^£?\d/.test(l)) continue;
      if(/^[0-9\s\/.:-]+$/.test(l)) continue;
      if(!/[A-Za-z]{3}/.test(l)) continue;
      supplier=l; break;
    }

    var litres=null, ppl=null;
    var lm=joined.match(/\b(\d{1,3}(?:\.\d{1,3})?)\s*(?:LTRS?|LITRES?|LITERS?|L)\b/i);
    if(lm) litres=parseFloat(lm[1]);
    var pm=joined.match(/\b(\d{2,3}(?:\.\d{1,2})?)\s*(?:P(?:ENCE)?\s*(?:PER\s*L(?:ITRE)?|\/\s*L(?:ITRE)?)|P\/L|PPL)\b/i);
    if(pm) ppl=parseFloat(pm[1]);
    if(ppl==null){
      var pm2=joined.match(/£\s*(1\.\d{2,3})\s*(?:PER\s*L(?:ITRE)?|\/\s*L(?:ITRE)?)/i);
      if(pm2) ppl=Math.round(parseFloat(pm2[1])*1000)/10;
    }
    if(ppl==null){
      var pm3=joined.match(/\b(\d{2,3}\.\d)\s*P(?:ENCE)?\b/i);
      if(pm3) ppl=parseFloat(pm3[1]);
    }

    return {date:date, dateISO:dateISO, total:total, vat:vat, vatRate:vatRate, vatNo:vatNo, supplier:supplier, litres:litres, ppl:ppl, text:raw};
  }

  async function readRegion(canvas, slot, progress){
    var work=(async function(){
      if(slot==="receipt") return await readReceipt(canvas, progress);
      var wl=whitelist(slot);
      var psm=slot==="fuel"?"6":"7";
      var text=await ocrCanvas(canvas,{whitelist:wl,psm:psm,prep:"stretch"});
      if(progress) progress(0.45);
      var n=extract(slot,text);
      if(!n){
        var t2=await ocrCanvas(canvas,{whitelist:wl,psm:"6",prep:"otsu"});
        var n2=extract(slot,t2);
        text=text+"\n"+t2;
        if(n2) n=n2;
      }
      if(!n && slot!=="fuel"){
        var t3=await ocrCanvas(canvas,{whitelist:wl,psm:psm,prep:"otsu"});
        var n3=extract(slot,t3);
        text=text+"\n"+t3;
        if(n3) n=n3;
      }
      if(progress) progress(1);
      return {text:text,number:n};
    })();
    try{ return await withTimeout(work, TIMEOUT, "Couldn't read it"); }
    catch(e){ resetWorker(); throw e; }
  }
  async function readReceipt(canvas, progress){
    var text=await ocrCanvas(canvas,{whitelist:"",psm:"4",prep:"stretch"});
    if(progress) progress(0.5);
    var rec=extractReceipt(text);
    if(!rec.total && !rec.vatNo && !rec.supplier){
      var t2=await ocrCanvas(canvas,{whitelist:"",psm:"6",prep:"otsu"});
      text=text+"\n"+t2;
      rec=extractReceipt(text);
    }
    rec.text=text;
    rec.number=rec.total!=null?("£"+rec.total.toFixed(2)):"";
    if(progress) progress(1);
    return rec;
  }

  var api={ocrCanvas:ocrCanvas,extract:extract,extractV5c:extractV5c,extractLicence:extractLicence,
    extractInsurance:extractInsurance,extractPolicy:extractPolicy,extractFuel:extractFuel,extractReceipt:extractReceipt,
    whitelist:whitelist,readRegion:readRegion,readReceipt:readReceipt,prewarm:prewarm,resetWorker:resetWorker,
    TIMEOUT:TIMEOUT,LOAD_TIMEOUT:LOAD_TIMEOUT,withTimeout:withTimeout};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.D3WalletOcr=api;
})(typeof window!=="undefined"?window:globalThis);
