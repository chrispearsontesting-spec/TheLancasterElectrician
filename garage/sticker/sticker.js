// Driv3 QR sticker (James May v14 frame). The frame art is a blank PNG (no QR, no ID);
// the car's real link and a short ID are drawn on top here, at the spec positions (360-unit artboard).
(function(){
  var SPEC={S:360, black:{qx:73.6667,qy:65.6667,idy:297}, white:{qx:74.6667,qy:66.6667,idy:298}, q:212.6667, idSize:7.5, idTrack:0.12, idColor:"#5a5c62"};
  var imgs={}, fontP=null;
  function frame(theme){
    if(!imgs[theme]) imgs[theme]=new Promise(function(ok,bad){ var i=new Image(); i.onload=function(){ok(i)}; i.onerror=function(){bad(new Error("Sticker art didn't load"))}; i.src="./sticker/frame-"+theme+".png?v=14"; });
    return imgs[theme];
  }
  function font(){
    if(!fontP) fontP=(window.FontFace?new FontFace("Driv3 ID Mono","url(./sticker/geist-mono-id.woff?v=14)",{weight:"500"}).load().then(function(f){document.fonts.add(f)}).catch(function(){}):Promise.resolve());
    return fontP;
  }
  // Short, non-secret label: the plate if there is one, otherwise "DRV-" + 4 characters (never the whole link id).
  function label(plate,upId){
    var p=String(plate||"").toUpperCase().replace(/[^A-Z0-9 ]/g,"").trim();
    if(p) return p;
    return "DRV-"+String(upId||"").replace(/[^A-Za-z0-9]/g,"").slice(0,4).toUpperCase();
  }
  // opts: {url, id, theme:"black"|"white", size:px}
  function draw(canvas,opts){
    var theme=opts.theme==="white"?"white":"black", W=opts.size||1440, k=W/SPEC.S, P=SPEC[theme];
    return Promise.all([frame(theme),font()]).then(function(r){
      canvas.width=canvas.height=W;
      var g=canvas.getContext("2d"); g.imageSmoothingEnabled=true; g.imageSmoothingQuality="high";
      g.drawImage(r[0],0,0,W,W);
      var q=qrcode(0,"M"); q.addData(opts.url); q.make();
      var n=q.getModuleCount(), x0=P.qx*k, y0=P.qy*k, m=SPEC.q*k/n;
      g.fillStyle="#fff"; g.fillRect(x0,y0,SPEC.q*k,SPEC.q*k);
      g.fillStyle="#0b0c0e";
      for(var rr=0;rr<n;rr++) for(var c=0;c<n;c++) if(q.isDark(rr,c)){
        var a=Math.round(x0+c*m), b=Math.round(y0+rr*m); g.fillRect(a,b,Math.round(x0+(c+1)*m)-a,Math.round(y0+(rr+1)*m)-b);
      }
      var fs=SPEC.idSize*k, t=String(opts.id||"");
      g.font="500 "+fs+"px 'Driv3 ID Mono', 'Geist Mono', ui-monospace, monospace"; g.fillStyle=SPEC.idColor; g.textBaseline="middle";
      var tr=SPEC.idTrack*fs, w=0, i; for(i=0;i<t.length;i++) w+=g.measureText(t[i]).width+tr;
      var x=SPEC.S/2*k-w/2; g.textAlign="left"; // CSS letter-spacing adds a trailing gap; centre the same way
      for(i=0;i<t.length;i++){ g.fillText(t[i],x,P.idy*k); x+=g.measureText(t[i]).width+tr; }
      return canvas;
    });
  }
  // PNG with a pHYs chunk so print apps read it at the right size (e.g. 300 dpi).
  function pngWithDpi(blob,dpi){
    return blob.arrayBuffer().then(function(buf){
      var src=new Uint8Array(buf), ppm=Math.round(dpi/0.0254), ch=new Uint8Array(21), dv=new DataView(ch.buffer);
      dv.setUint32(0,9); ch.set([112,72,89,115],4); dv.setUint32(8,ppm); dv.setUint32(12,ppm); ch[16]=1;
      var crc=-1; for(var i=4;i<17;i++){ crc^=ch[i]; for(var j=0;j<8;j++) crc=(crc>>>1)^(0xEDB88320&-(crc&1)); }
      dv.setUint32(17,(crc^-1)>>>0);
      var out=new Uint8Array(src.length+21); out.set(src.subarray(0,33)); out.set(ch,33); out.set(src.subarray(33),54);
      return new Blob([out],{type:"image/png"});
    });
  }
  function blob(canvas,dpi){ return new Promise(function(ok){ canvas.toBlob(ok,"image/png"); }).then(function(b){ return dpi?pngWithDpi(b,dpi):b; }); }
  window.Driv3Sticker={draw:draw,label:label,blob:blob,SIZES:{hi:1440,print:1181}};
})();
