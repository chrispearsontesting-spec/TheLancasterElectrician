/* Compact Code 128 barcode (set B, with auto set C for digit pairs). Renders to a canvas. */
(function(root){
  "use strict";
  /* 106 patterns: 0-95 set-B values, 96-102 extras, 103-105 start A/B/C, stop added separately */
  var PAT=[
    "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
    "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000",
    "10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010",
    "10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
    "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110",
    "10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","1100011101011"
  ];
  var START_B=104, START_C=105, CODE_B=100, CODE_C=99, STOP=106;

  function encode(text){
    text=String(text||"");
    if(!text) return "";
    var useC=text.length>=2&&/^\d+$/.test(text)&&text.length%2===0;
    var codes=[], sum, i;
    if(useC){
      codes.push(START_C); sum=START_C;
      for(i=0;i<text.length;i+=2){ var v=parseInt(text.slice(i,i+2),10); codes.push(v); sum+=v*codes.length; }
    }else{
      codes.push(START_B); sum=START_B;
      for(i=0;i<text.length;i++){
        var ch=text.charCodeAt(i);
        if(ch<32||ch>126) ch=63; // '?'
        var v=ch-32;
        codes.push(v); sum+=v*codes.length;
      }
    }
    codes.push(sum%103);
    codes.push(STOP);
    var bits="11010010000"; // quiet-ish; start is in PAT
    bits="";
    codes.forEach(function(c){ bits+=PAT[c]; });
    return bits;
  }
  function draw(canvas, text, opts){
    opts=opts||{};
    var bits=encode(text);
    if(!bits) return canvas;
    var w=opts.width||canvas.width||320, h=opts.height||canvas.height||80;
    canvas.width=w; canvas.height=h;
    var ctx=canvas.getContext("2d");
    ctx.fillStyle=opts.bg||"#ffffff"; ctx.fillRect(0,0,w,h);
    var quiet=Math.max(8, Math.round(w*0.06));
    var barW=(w-quiet*2)/bits.length;
    ctx.fillStyle=opts.fg||"#111111";
    for(var i=0;i<bits.length;i++){
      if(bits[i]==="1") ctx.fillRect(Math.round(quiet+i*barW), 6, Math.ceil(barW), h-12);
    }
    return canvas;
  }
  function toDataURL(text, w, h){
    var c=document.createElement("canvas");
    draw(c,text,{width:w||400,height:h||120});
    return c.toDataURL("image/png");
  }
  var api={encode:encode,draw:draw,toDataURL:toDataURL};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.D3Barcode=api;
})(typeof window!=="undefined"?window:globalThis);
