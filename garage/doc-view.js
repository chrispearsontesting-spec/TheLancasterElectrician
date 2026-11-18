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
      "#d3docStage{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px 16px 8px;background:#050506;-webkit-overflow-scrolling:touch}"+
      "#d3docStage img,#d3docStage canvas{max-width:100%;height:auto;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.45);display:block;margin:0 auto 12px;background:#111}"+
      "#d3docStage .d3docMsg{color:#8b8b8b;text-align:center;padding:24px 12px;line-height:1.45}"+
      "#d3docDock{flex:0 0 auto;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));background:#0b0c0e;border-top:1px solid #2a2a2e}"+
      "#d3docDock .d3docTitle{margin:0 0 12px;font-size:16px;font-weight:650;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
      "#d3docDock .btnRow{display:flex;gap:10px}"+
      "#d3docDock .btnRow .btn{flex:1;width:auto !important;margin-top:0 !important}"+
      "#d3docBack{margin-top:8px !important}";
    document.head.appendChild(s);
  }
  function build(){
    if(el) return el;
    css();
    el=document.createElement("div");
    el.id="d3docView"; el.hidden=true;
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-label","Document");
    el.innerHTML='<div id="d3docStage"></div><div id="d3docDock">'+
      '<p class="d3docTitle" id="d3docTitle"></p>'+
      '<div class="btnRow">'+
      '<button class="btn" type="button" id="d3docShare">Share</button>'+
      '<button class="btn" type="button" id="d3docSave">Download</button>'+
      '</div>'+
      '<button class="btn" type="button" id="d3docBack">Back</button></div>';
    document.body.appendChild(el);
    el.querySelector("#d3docBack").onclick=close;
    el.querySelector("#d3docShare").onclick=function(){ share(); };
    el.querySelector("#d3docSave").onclick=function(){ download(); };
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape" && el && !el.hidden){ e.preventDefault(); close(); }
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
  async function renderPdf(stage, blob){
    var lib=await loadPdfJs();
    if(!lib) throw new Error("PDF viewer unavailable");
    var data=new Uint8Array(await blob.arrayBuffer());
    var pdf=await lib.getDocument({data:data,isEvalSupported:false}).promise;
    var maxW=Math.min(stage.clientWidth||360, 800);
    for(var i=1;i<=pdf.numPages;i++){
      var page=await pdf.getPage(i);
      var base=page.getViewport({scale:1});
      var scale=Math.min(2, maxW/base.width);
      var vp=page.getViewport({scale:scale});
      var c=document.createElement("canvas");
      c.width=vp.width; c.height=vp.height;
      c.setAttribute("aria-label","Page "+i+" of "+pdf.numPages);
      await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
      stage.appendChild(c);
    }
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
    current={blob:blob,name:opts.name||"document",title:opts.title||opts.name||"Document"};
    var box=build();
    var stage=box.querySelector("#d3docStage");
    stage.innerHTML=""; revoke();
    box.querySelector("#d3docTitle").textContent=current.title;
    box.hidden=false;
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
  function close(){
    if(!el) return;
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

  var api={open:open,close:close,isPdf:isPdf,isImage:isImage};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.D3DocView=api;
})(typeof window!=="undefined"?window:globalThis);
