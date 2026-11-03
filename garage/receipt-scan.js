/* Driv3 receipt reader: finds the total on DIY work photos / invoices, entirely on this phone.
   OCR: Tesseract.js (vendor/tesseract, loaded only when there is something to read). PDFs: pdf.js text first, OCR if no text.
   Result cached on the file: f.scan={v,amt,src,at}. If the price is empty it is filled with priceSrc:"receipt" (editable, untickable via f.skip). */
(function(root){
  "use strict";
  var V=1, BASE=new URL("vendor/",location.href).href, worker=null, busy=false, pill=null;
  function money(n){ return "£"+(+n).toFixed(2); }
  function esc(x){ return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]}); }

  /* ---------- total parsing (UK receipts / order confirmations / invoices) ---------- */
  var NUM=/(?:£|GBP|\bE(?=\s?\d)|\bf(?=\d))?\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)\s?[.,·]\s?(\d{2})(?!\d)/g;
  var STRONG=/grand\s*total|order\s*total|total\s*(?:paid|due|payable|to\s*pay|amount|inc|incl|including|\(inc)|amount\s*(?:paid|due|payable|charged)|balance\s*(?:due|to\s*pay|paid)|invoice\s*total|total\s*gbp|you\s*paid|card\s*payment|paid\s*by\s*card/i;
  var WEAK=/\btota[l1]\b|\bbalance\b|\bamount\b|\bto\s*pay\b|\bvisa\b|\bmastercard\b|\bdebit\b|\bcontactless\b/i;
  var SKIP=/sub\s*-?\s*tota[l1]|\bvat\b|\btax\b|discount|saving|you\s*saved|\bchange\b|cashback|tendered|\bqty\b|items?\s*:|net\s*(?:total|amount)|ex\.?\s*vat|exc\.?\s*vat|points|rrp|was\s*£|per\s*item|unit\s*price/i;
  function amounts(line){ var out=[],m; NUM.lastIndex=0; while((m=NUM.exec(line))){ var v=parseFloat(m[1].replace(/[,\s]/g,"")+"."+m[2]); if(v>0&&v<50000) out.push({v:v,pound:/£|GBP/.test(m[0])}); } return out; }
  function parseTotal(text){
    var lines=String(text||"").split(/\r?\n/).map(function(l){return l.replace(/\s+/g," ").trim()}).filter(Boolean), best=null;
    function cand(v,score,i){ if(!best||score>best.score||(score===best.score&&v>best.v)) best={v:v,score:score,line:i}; }
    lines.forEach(function(l,i){
      var strong=STRONG.test(l), weak=!strong&&WEAK.test(l); if(!strong&&!weak) return;
      if(SKIP.test(l)&&!/grand|order\s*total|amount\s*paid/i.test(l)) return;
      var a=amounts(l); if(!a.length&&lines[i+1]&&!SKIP.test(lines[i+1])) a=amounts(lines[i+1]);
      if(a.length) cand(Math.max.apply(null,a.map(function(x){return x.v})),strong?3:2,i);
    });
    if(best) return {amt:best.v,how:best.score===3?"total":"total?"};
    var all=[]; lines.forEach(function(l){ if(SKIP.test(l)) return; amounts(l).forEach(function(x){ if(x.pound&&x.v>=0.5&&x.v<20000) all.push(x.v); }); });
    if(all.length) return {amt:Math.max.apply(null,all),how:"largest"};
    return {amt:null,how:"none"};
  }

  /* ---------- loaders ---------- */
  function script(src){ return new Promise(function(ok,no){ var s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); }
  async function ocrWorker(){
    if(worker) return worker;
    if(!root.Tesseract) await script(BASE+"tesseract/tesseract.min.js");
    worker=await root.Tesseract.createWorker("eng",1,{workerPath:BASE+"tesseract/worker.min.js",corePath:BASE+"tesseract/",langPath:BASE+"tesseract",gzip:true,workerBlobURL:false,cacheMethod:"none"});
    return worker;
  }
  var pdfLib=null;
  async function pdfjs(){ if(pdfLib) return pdfLib; pdfLib=await import(BASE+"pdfjs/pdf.min.js"); pdfLib.GlobalWorkerOptions.workerSrc=BASE+"pdfjs/pdf.worker.min.js"; return pdfLib; }
  /* Scale to ~1800px wide, greyscale, and flip dark-mode screenshots to dark-on-light for OCR. */
  function prep(src){ return new Promise(function(ok,no){ var im=new Image(), u=typeof src==="string"?src:URL.createObjectURL(src);
    im.onload=function(){ var s=Math.min(2.5,Math.max(1,1800/im.width)), c=document.createElement("canvas"); c.width=Math.round(im.width*s); c.height=Math.round(im.height*s);
      var x=c.getContext("2d",{willReadFrequently:true}); x.drawImage(im,0,0,c.width,c.height); var d=x.getImageData(0,0,c.width,c.height), p=d.data, sum=0;
      for(var i=0;i<p.length;i+=4){ var g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2]; p[i]=p[i+1]=p[i+2]=g; sum+=g; }
      if(sum/(p.length/4)<110) for(var j=0;j<p.length;j+=4){ p[j]=p[j+1]=p[j+2]=255-p[j]; }
      x.putImageData(d,0,0); if(typeof src!=="string") URL.revokeObjectURL(u); ok(c); };
    im.onerror=function(){ if(typeof src!=="string") URL.revokeObjectURL(u); no(new Error("image")); }; im.src=u; }); }
  async function ocr(canvas,psm){ var w=await ocrWorker(); await w.setParameters({tessedit_pageseg_mode:psm||"6",preserve_interword_spaces:"1"}); var r=await w.recognize(canvas); return r.data.text||""; }
  /* Block mode first; if no clear total, retry sparse-text mode (catches right-aligned price columns) and keep the better answer. */
  async function ocrBest(c){ var t=await ocr(c,"6"), p=parseTotal(t); if(p.how==="total") return {t:t,p:p}; var t2=await ocr(c,"11"), p2=parseTotal(t2), t3=t+"\n"+t2, p3=parseTotal(t3);
    var best=[{t:t,p:p},{t:t2,p:p2},{t:t3,p:p3}].sort(function(a,b){ var r={total:3,"total?":2,largest:1,none:0}; return r[b.p.how]-r[a.p.how]; })[0]; return best; }
  async function pdfText(blob){
    var L=await pdfjs(), doc=await L.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false}).promise, out=[];
    for(var n=1;n<=Math.min(doc.numPages,3);n++){ var pg=await doc.getPage(n), tc=await pg.getTextContent(), rows={};
      tc.items.forEach(function(it){ var y=Math.round(it.transform[5]/3); (rows[y]=rows[y]||[]).push(it); });
      Object.keys(rows).sort(function(a,b){return b-a}).forEach(function(y){ out.push(rows[y].sort(function(a,b){return a.transform[4]-b.transform[4]}).map(function(i){return i.str}).join(" ")); }); }
    var text=out.join("\n");
    if(text.replace(/\s/g,"").length<20){ var p1=await doc.getPage(1), vp=p1.getViewport({scale:2.2}), c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
      var ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); await p1.render({canvasContext:ctx,viewport:vp}).promise; var o=await ocrBest(c); return {text:o.t,src:"pdf-ocr"}; }
    return {text:text,src:"pdf"};
  }
  /* Read one blob → {amt, how, src, text} */
  async function read(blob,type){
    type=type||blob.type||"";
    if(/pdf/.test(type)){ var r=await pdfText(blob), p=parseTotal(r.text); return {amt:p.amt,how:p.how,src:r.src,text:r.text}; }
    if(/^image\//.test(type)){ var o=await ocrBest(await prep(blob)); return {amt:o.p.amt,how:o.p.how,src:"ocr",text:o.t}; }
    return {amt:null,how:"none",src:"none",text:""};
  }

  /* ---------- background queue over gt.diy ---------- */
  function todo(){ var out=[]; if(!root.D3Diy) return out;
    D3Diy.all().forEach(function(w){ (w.files||[]).forEach(function(f){ if((!f.scan||f.scan.v!==V)&&!String(f.price||"").trim()&&/^image\/|pdf/.test(f.type||"")) out.push({w:w.id,f:f.id}); }); }); return out; }
  function showPill(on,txt){ if(on&&!pill){ pill=document.createElement("div"); pill.id="rcPill"; pill.setAttribute("role","status"); document.body.appendChild(pill); }
    if(pill){ pill.textContent=txt||"Reading receipts…"; pill.style.display=on?"":"none"; } }
  async function run(){
    if(busy) return; var q=todo(); if(!q.length) return; busy=true;
    try{
      for(var i=0;i<q.length;i++){ showPill(true,"Reading receipts… "+(i+1)+"/"+q.length);
        var res={amt:null,how:"error",src:"none"}; try{ var b=await D3Diy.getBlob(q[i].f); if(b) res=await read(b,b.type); }catch(e){ console.warn("receipt",e); }
        var w=D3Diy.get(q[i].w); if(!w) continue; var f=(w.files||[]).filter(function(x){return x.id===q[i].f})[0]; if(!f) continue;
        f.scan={v:V,amt:res.amt,how:res.how,src:res.src,at:Date.now()};
        if(res.amt&&!String(f.price||"").trim()){ f.price=res.amt.toFixed(2); f.priceSrc="receipt"; }
        RAW_SAVE(w); redraw();
      }
    } finally { busy=false; showPill(false); if(todo().length) setTimeout(run,500); }
  }
  function redraw(){ try{ if(typeof root.render==="function") root.render(root.selected); }catch(e){} }

  /* ---------- card UI: "Found £X on receipt — Use / Edit" ---------- */
  function decorate(){
    if(!root.D3Diy) return;
    document.querySelectorAll(".card.diy").forEach(function(c){
      var ob=c.querySelector("[data-openw]"); if(!ob) return; var w=D3Diy.get(ob.getAttribute("data-openw")); if(!w) return;
      var old=c.querySelector(".rcBox"); if(old) old.remove();
      var rs=(w.files||[]).filter(function(f){return f.priceSrc==="receipt"&&String(f.price||"").trim()}); if(!rs.length) return;
      var seen={}, n=0, ph=0, inv=0;
      var label={}; (w.files||[]).forEach(function(f){ if(f.kind==="photo") label[f.id]="photo "+(++ph); else label[f.id]="invoice "+(++inv); });
      var html=rs.map(function(f){ var a=(+f.price).toFixed(2), dup=!f.skip&&seen[a]; if(!f.skip) seen[a]=1; n++;
        return "<div class='rcRow'><label><input type='checkbox' data-rcuse='"+f.id+"'"+(f.skip?"":" checked")+"/><span>Found <b>"+money(f.price)+"</b> on "+esc(label[f.id]||"receipt")+"</span></label>"+
          "<button type='button' class='rcEdit' data-rcedit='"+f.id+"'>Edit</button>"+(dup?"<small>Same amount as above — counted once</small>":"")+"</div>"; }).join("");
      var box=document.createElement("div"); box.className="rcBox"; box.innerHTML="<p class='rcHead'>Read from receipt"+(n>1?"s":"")+" · total "+money(D3Diy.cost(w))+"</p>"+html;
      var row=c.querySelector(".row"); c.insertBefore(box,row||null);
      box.onchange=function(e){ var id=e.target.getAttribute("data-rcuse"); if(!id) return; var w2=D3Diy.get(w.id); (w2.files||[]).forEach(function(f){ if(f.id===id) f.skip=!e.target.checked; }); RAW_SAVE(w2); redraw(); };
      box.onclick=function(e){ var id=e.target.getAttribute("data-rcedit"); if(!id) return; var w2=D3Diy.get(w.id), f=(w2.files||[]).filter(function(x){return x.id===id})[0]; if(!f) return;
        var v=prompt("Price on this receipt (£)",f.price); if(v===null) return; v=String(v).replace(/[^0-9.]/g,"");
        if(!v){ f.price=""; f.priceSrc=""; f.skip=false; } else { f.price=(+v).toFixed(2); f.priceSrc="user"; f.skip=false; } RAW_SAVE(w2); redraw(); };
    });
  }
  var css=document.createElement("style"); css.textContent="#rcPill{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#1c1c20;border:1px solid #2e2e34;color:#cfcfcf;font-size:13px;padding:7px 14px;border-radius:999px;z-index:50}"+
    ".rcBox{margin:10px 0 0;padding:10px 12px;border:1px solid #2a2a2e;border-radius:12px;background:#141418}.rcHead{margin:0 0 6px;font-size:12px;color:#8a8a90}.rcRow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:14px;padding:3px 0}.rcBox .rcRow label{flex:1;display:flex!important;flex-direction:row;align-items:center;gap:8px;margin:0!important;padding:0;font-size:14px;color:#e5e5e5;text-transform:none;letter-spacing:0;min-width:0}.rcBox .rcRow input[type=checkbox]{width:18px!important;height:18px;margin:0;flex:0 0 auto;accent-color:#22c55e}.rcBox .rcRow span{flex:1}.rcRow b{color:#fff}.rcRow small{flex-basis:100%;color:#f59e0b;font-size:12px;padding-left:26px}.rcEdit{background:#222226;color:#e5e5e5;border:1px solid #333;border-radius:8px;padding:4px 10px;font-size:13px}";
  document.head.appendChild(css);

  var RAW_SAVE=function(w){ return D3Diy.save(w); };
  function hook(){
    if(!root.D3Diy||hook.done) return; hook.done=true;
    var save=D3Diy.save; RAW_SAVE=function(w){ return save.call(D3Diy,w); };
    D3Diy.save=function(w){ var r=save.apply(D3Diy,arguments); setTimeout(run,300); return r; };   // new uploads get read right after Save
    if(typeof root.render==="function"){ var orig=root.render; root.render=function(){ var r=orig.apply(this,arguments); try{ decorate(); }catch(e){} return r; }; }
    decorate(); setTimeout(run,1500);
  }
  root.D3Receipt={parseTotal:parseTotal,read:read,run:run,decorate:decorate};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",hook); else setTimeout(hook,0);
})(window);
