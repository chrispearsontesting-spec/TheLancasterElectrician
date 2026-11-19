/* In-app document viewer for images and PDFs. Blob URLs in a new tab are
   blocked in the PWA and the Android WebView, so View must render here. */
(function(root){
  "use strict";
  var el=null, urls=[];

  function css(){
    if(document.getElementById("d3docCss")) return;
    var s=document.createElement("style"); s.id="d3docCss";
    s.textContent=
      "#d3docView{position:fixed;inset:0;z-index:80;background:#0b0c0e;color:#f2f2f2;display:flex;flex-direction:column;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}"+
      "#d3docView[hidden]{display:none !important}"+
      "#d3docWrap{flex:1;min-height:0;position:relative;display:flex}"+
      "#d3docStage{flex:1;min-height:0;overflow:auto;display:block;padding:16px 16px 8px;background:#050506;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}"+
      "#d3docStage img,#d3docStage canvas{max-width:none;height:auto;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.45);display:block;margin:0 auto 12px;background:#fff}"+
      "#d3docStage img{max-width:100%}"+
      "#d3docZoom{position:absolute;right:12px;bottom:12px;display:flex;gap:8px;z-index:2}"+
      "#d3docZoom button{width:44px;height:44px;border-radius:50%;border:1px solid #2a2a2e;background:rgba(20,20,22,.92);color:#f2f2f2;font:600 22px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:0}"+
      "#d3docZoom button:disabled{opacity:.4}"+
      "#d3docStage .d3docMsg{color:#8b8b8b;text-align:center;padding:24px 12px;line-height:1.45}"+
      "#d3docDock{flex:0 0 auto;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));background:#0b0c0e;border-top:1px solid #2a2a2e}"+
      "#d3docDock .d3docTitle{margin:0 0 12px;font-size:16px;font-weight:650;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
      "#d3docDock .btnRow{display:flex;gap:10px}"+
      "#d3docDock .btnRow .btn{flex:1;width:auto !important;margin-top:0 !important}"+
      "#d3docBack{margin-top:8px !important}"+
      "#d3docNote{display:flex;align-items:center;gap:10px;margin:-4px 0 12px;padding:10px 12px;border-radius:12px;background:#101a22;border:1px solid #23425a;font-size:14px;color:#dbeafe}"+
      "#d3docNote[hidden]{display:none !important}#d3docNote span{flex:1;min-width:0}#d3docNote b{color:#7dd3fc;font-family:ui-monospace,Menlo,monospace}"+
      "#d3docNote button{background:none;border:0;color:#7dd3fc;font-weight:650;font-size:14px;padding:4px 2px}";
    document.head.appendChild(s);
  }
  function build(){
    if(el) return el;
    css();
    el=document.createElement("div");
    el.id="d3docView"; el.hidden=true;
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-label","Document");
    el.innerHTML='<div id="d3docWrap"><div id="d3docStage"></div><div id="d3docZoom"><button type="button" id="d3docOut" aria-label="Zoom out">\u2212</button><button type="button" id="d3docIn" aria-label="Zoom in">+</button></div></div><div id="d3docDock">'+
      '<p class="d3docTitle" id="d3docTitle"></p>'+
      '<div id="d3docNote" role="status" hidden><span></span><button type="button">Edit</button></div>'+
      '<div class="btnRow">'+
      '<button class="btn" type="button" id="d3docShare">Share</button>'+
      '<button class="btn" type="button" id="d3docSave">Download</button>'+
      '</div>'+
      '<button class="btn" type="button" id="d3docBack">Back</button></div>';
    document.body.appendChild(el);
    el.querySelector("#d3docBack").onclick=back;
    el.querySelector("#d3docIn").onclick=function(){ setZoom(zoom*1.5,true); };
    el.querySelector("#d3docOut").onclick=function(){ setZoom(zoom/1.5,true); };
    pinch(el.querySelector("#d3docStage"));
    el.querySelector("#d3docShare").onclick=function(){ share(); };
    el.querySelector("#d3docSave").onclick=function(){ download(); };
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape" && el && !el.hidden){ e.preventDefault(); back(); }
    });
    return el;
  }
  function revoke(){
    urls.forEach(function(u){ try{ URL.revokeObjectURL(u); }catch(e){} });
    urls=[];
  }
  function asBlob(file, type){
    if(!file) return null;
    if(typeof Blob!=="undefined" && file instanceof Blob) return file.type?file:new Blob([file],{type:type||"application/octet-stream"});
    return new Blob([file],{type:type||"application/octet-stream"});
  }
  function isPdf(blob, name){
    var t=(blob&&blob.type||"").toLowerCase();
    if(t.indexOf("pdf")>=0) return true;
    return /\.pdf$/i.test(name||"");
  }
  function isImage(blob, name){
    var t=(blob&&blob.type||"").toLowerCase();
    if(t.indexOf("image/")===0) return true;
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(name||"");
  }
  var current=null;
  var pdfLib=null;
  /* pdf.js 4.x ships as an ES module, so it must be loaded with import(), not a <script> tag. */
  function loadPdfJs(){
    if(pdfLib) return Promise.resolve(pdfLib);
    var base=new URL("./vendor/pdfjs/", document.baseURI).href;
    return import(base+"pdf.min.js").then(function(m){
      pdfLib=m&&m.getDocument?m:(m&&m.default)||root.pdfjsLib;
      if(!pdfLib) throw new Error("PDF viewer unavailable");
      pdfLib.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.js";
      return pdfLib;
    });
  }
  /* Sharp PDFs: each page is drawn at the screen's real pixel density for the current zoom,
     and drawn again (sharp) after a pinch or +/- so zoomed text never goes soft. */
  var pdf=null, pages=[], zoom=1, gen=0, reTimer=0, MAXZ=4;
  function fitW(){ var st=el&&el.querySelector("#d3docStage"); return Math.max(200,Math.min(((st&&st.clientWidth)||360)-32,800)); }
  async function renderPdf(stage, blob){
    var lib=await loadPdfJs();
    if(!lib) throw new Error("PDF viewer unavailable");
    var data=new Uint8Array(await blob.arrayBuffer());
    pdf=await lib.getDocument({data:data,isEvalSupported:false}).promise;
    pages=[];
    for(var i=1;i<=pdf.numPages;i++){
      var page=await pdf.getPage(i);
      var c=document.createElement("canvas");
      c.setAttribute("aria-label","Page "+i+" of "+pdf.numPages);
      pages.push({page:page,canvas:c,base:page.getViewport({scale:1})});
      stage.appendChild(c);
    }
    sizeAll(); await drawAll();
  }
  function sizeAll(){
    var w=fitW()*zoom;
    pages.forEach(function(p){ p.canvas.style.width=w+"px"; p.canvas.style.height=(w*p.base.height/p.base.width)+"px"; });
    if(el){ var im=el.querySelector("#d3docStage img"); if(im) im.style.width=(zoom===1?"":(fitW()*zoom)+"px"), im.style.maxWidth=(zoom===1?"100%":"none"); }
  }
  async function drawAll(){
    var my=++gen, dpr=Math.max(1,Math.min(3,root.devicePixelRatio||1));
    for(var k=0;k<pages.length;k++){
      if(my!==gen) return;
      var p=pages[k], cssW=fitW()*zoom, scale=cssW/p.base.width*dpr;
      var px=p.base.width*p.base.height*scale*scale, cap=16e6;           // keep under the canvas memory limit
      if(px>cap) scale*=Math.sqrt(cap/px);
      var vp=p.page.getViewport({scale:scale});
      var off=document.createElement("canvas"); off.width=Math.floor(vp.width); off.height=Math.floor(vp.height);
      try{ await p.page.render({canvasContext:off.getContext("2d"),viewport:vp}).promise; }catch(e){ continue; }
      if(my!==gen) return;
      p.canvas.width=off.width; p.canvas.height=off.height;
      p.canvas.getContext("2d").drawImage(off,0,0);
    }
  }
  function setZoom(z,redraw,fx,fy){
    var st=el.querySelector("#d3docStage"), old=zoom;
    z=Math.max(1,Math.min(MAXZ,z)); if(Math.abs(z-old)<0.001) return;
    if(fx==null){ fx=st.clientWidth/2; fy=st.clientHeight/2; }
    var cx=(st.scrollLeft+fx)/old, cy=(st.scrollTop+fy)/old;
    zoom=z; sizeAll();
    st.scrollLeft=cx*z-fx; st.scrollTop=cy*z-fy;
    el.querySelector("#d3docOut").disabled=zoom<=1; el.querySelector("#d3docIn").disabled=zoom>=MAXZ;
    clearTimeout(reTimer);
    if(pages.length) reTimer=setTimeout(drawAll, redraw?0:180);
  }
  function pinch(st){
    var d0=0, z0=1, last=0;
    function dist(t){ var a=t[0],b=t[1]; return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }
    function mid(t){ var r=st.getBoundingClientRect(); return [(t[0].clientX+t[1].clientX)/2-r.left,(t[0].clientY+t[1].clientY)/2-r.top]; }
    st.addEventListener("touchstart",function(e){
      if(e.touches.length===2){ d0=dist(e.touches); z0=zoom; }
      else if(e.touches.length===1){ var n=Date.now(); if(n-last<300){ var r=st.getBoundingClientRect(); setZoom(zoom>1.2?1:2.5,true,e.touches[0].clientX-r.left,e.touches[0].clientY-r.top); e.preventDefault(); } last=n; }
    },{passive:false});
    st.addEventListener("touchmove",function(e){
      if(e.touches.length===2&&d0){ e.preventDefault(); var m=mid(e.touches); setZoom(z0*dist(e.touches)/d0,false,m[0],m[1]); }
    },{passive:false});
    st.addEventListener("touchend",function(e){ if(e.touches.length<2) d0=0; });
    /* Desktop trackpad pinch arrives as ctrl+wheel. */
    st.addEventListener("wheel",function(e){ if(e.ctrlKey){ e.preventDefault(); var r=st.getBoundingClientRect(); setZoom(zoom*Math.exp(-e.deltaY/200),false,e.clientX-r.left,e.clientY-r.top); } },{passive:false});
  }
  /* Text for auto-filling numbers: the PDF's own text layer first; scanned PDFs and photos
     go through the on-device Tesseract (wallet-ocr.js). Nothing leaves the phone. */
  async function textOf(blob, name){
    blob=asBlob(blob);
    if(!blob) return "";
    var ocr=root.D3WalletOcr, out="";
    if(isPdf(blob,name)){
      var lib=await loadPdfJs();
      var doc=await lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false}).promise;
      var n=Math.min(doc.numPages,3), pg;
      for(var i=1;i<=n;i++){
        pg=await doc.getPage(i);
        var tc=await pg.getTextContent();
        out+=tc.items.map(function(it){ return it.str+(it.hasEOL?"\n":" "); }).join("")+"\n";
      }
      if(out.replace(/\s/g,"").length>40||!ocr) return out;
      pg=await doc.getPage(1);
      var vp=pg.getViewport({scale:2}), c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
      await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
      return out+"\n"+await ocr.ocrCanvas(c,{psm:"6"});
    }
    if(isImage(blob,name)&&ocr){
      var bmp=await createImageBitmap(blob), cv=document.createElement("canvas"), sc=Math.min(1,2400/Math.max(bmp.width,1));
      cv.width=Math.round(bmp.width*sc); cv.height=Math.round(bmp.height*sc); cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);
      return await ocr.ocrCanvas(cv,{psm:"6"});
    }
    return "";
  }
  function renderImage(stage, blob){
    var u=URL.createObjectURL(blob); urls.push(u);
    var img=document.createElement("img");
    img.alt=current&&current.title||"Document";
    img.src=u;
    stage.appendChild(img);
  }
  function message(stage, text){
    var p=document.createElement("p"); p.className="d3docMsg"; p.textContent=text; stage.appendChild(p);
  }
  async function open(opts){
    opts=opts||{};
    var blob=asBlob(opts.blob||opts.file, opts.type);
    if(!blob){ throw new Error("That document could not be opened."); }
    current={blob:blob,name:opts.name||"document",title:opts.title||opts.name||"Document",onBack:typeof opts.onBack==="function"?opts.onBack:null};
    pages=[]; pdf=null; zoom=1; gen++;
    var box=build();
    var stage=box.querySelector("#d3docStage");
    stage.innerHTML=""; revoke();
    box.querySelector("#d3docTitle").textContent=current.title;
    box.querySelector("#d3docNote").hidden=true;
    box.hidden=false;
    box.querySelector("#d3docOut").disabled=true; box.querySelector("#d3docIn").disabled=false;
    document.documentElement.classList.add("d3docOpen");
    if(isImage(blob, current.name)){
      renderImage(stage, blob);
      return;
    }
    if(isPdf(blob, current.name)){
      try{ await renderPdf(stage, blob); }
      catch(e){
        message(stage, "This PDF can't be shown here. Use Download or Share to open it in another app.");
      }
      return;
    }
    message(stage, "This file type can't be previewed. Use Download or Share to open it in another app.");
  }
  /* Back: close, then let the opener send the user back where they came from (e.g. Insurance). */
  function back(){
    var cb=current&&current.onBack;
    close();
    if(cb) try{ cb(); }catch(e){}
  }
  function close(){
    if(!el) return;
    gen++; pages=[]; pdf=null; zoom=1;
    el.hidden=true;
    el.querySelector("#d3docStage").innerHTML="";
    revoke();
    current=null;
    document.documentElement.classList.remove("d3docOpen");
  }
  function download(){
    if(!current) return;
    var u=URL.createObjectURL(current.blob); urls.push(u);
    var a=document.createElement("a");
    a.href=u; a.download=current.name||"document";
    document.body.appendChild(a); a.click(); a.remove();
  }
  function share(){
    if(!current) return;
    var file;
    try{ file=new File([current.blob], current.name||"document", {type:current.blob.type||"application/octet-stream"}); }catch(e){ file=null; }
    if(root.driv3ShareFiles && file){ return root.driv3ShareFiles([file], current.title); }
    if(navigator.share){
      var p=file&&navigator.canShare&&navigator.canShare({files:[file]}) ? navigator.share({title:current.title,files:[file]}) : navigator.share({title:current.title,text:current.title});
      return p && p.catch(function(){ download(); });
    }
    download();
  }

  /* A line under the title, e.g. "Policy number HD-123 saved · Edit". */
  function note(label, value, onEdit){
    if(!el||el.hidden) return false;
    var n=el.querySelector("#d3docNote"), sp=n.querySelector("span"), b=n.querySelector("button");
    sp.textContent=label+" "; var v=document.createElement("b"); v.textContent=value; sp.appendChild(v);
    b.hidden=!onEdit; b.onclick=function(){ close(); if(onEdit) onEdit(); };
    n.hidden=false; return true;
  }
  var api={open:open,close:close,isPdf:isPdf,isImage:isImage,textOf:textOf,note:note,isOpen:function(){ return !!(el&&!el.hidden); }};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.D3DocView=api;
})(typeof window!=="undefined"?window:globalThis);
