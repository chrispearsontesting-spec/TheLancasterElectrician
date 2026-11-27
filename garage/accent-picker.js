/* Trac3 App colour picker (Settings): hue/saturation wheel + brightness slider + live preview + the preset swatches.
   T3AccentPicker.mount(el). Uses T3Accent (accent.js): presets are saved as their name, any other colour as "#rrggbb" in gt.accent.
   --on-accent (text on a solid accent button) is worked out from the colour's contrast by accent.js. */
(function(){
  var A=window.T3Accent; if(!A) return;
  var VMIN=0.35; // keep the colour readable on the dark background
  function mount(el){
    el.innerHTML=
      '<div class="apHead"><span class="apLab" id="apLab">App colour</span><span class="apName" id="apName"></span></div>'+
      '<div class="apRow" id="apSw" role="radiogroup" aria-labelledby="apLab"></div>'+
      '<div class="apWheelBox" data-noswipe>'+
        '<div class="apWheel" id="apWheel" tabindex="0" role="slider" aria-label="Colour: hue and strength. Use the arrow keys" aria-valuemin="0" aria-valuemax="359"><canvas id="apCv" width="440" height="440"></canvas><i class="apDim" id="apDim"></i><b class="apKnob" id="apKnob"></b></div>'+
        '<div class="apSide"><div class="apPrev" id="apPrev"><span class="apDot"></span><span class="apBtn">Preview</span></div><code class="apHex" id="apHex"></code></div>'+
      '</div>'+
      '<label class="apBri" for="apV"><span>Brightness</span><input id="apV" type="range" min="'+Math.round(VMIN*100)+'" max="100" step="1" aria-label="Brightness" data-noswipe></label>';
    var cv=el.querySelector("#apCv"), ctx=cv.getContext("2d"), wheel=el.querySelector("#apWheel"), knob=el.querySelector("#apKnob"), dim=el.querySelector("#apDim"), V=el.querySelector("#apV"), hex=el.querySelector("#apHex"), nm=el.querySelector("#apName"), sw=el.querySelector("#apSw");
    var st={h:200,s:.5,v:1};
    function draw(){ var n=cv.width, r=n/2, img=ctx.createImageData(n,n), d=img.data;
      for(var y=0;y<n;y++) for(var x=0;x<n;x++){ var dx=x+.5-r, dy=y+.5-r, q=Math.sqrt(dx*dx+dy*dy), i=(y*n+x)*4; if(q>r){ d[i+3]=0; continue; }
        var h=(Math.atan2(dy,dx)*180/Math.PI+360)%360, c=A.hsv2hex(h,Math.min(1,q/r),1); d[i]=parseInt(c.slice(1,3),16); d[i+1]=parseInt(c.slice(3,5),16); d[i+2]=parseInt(c.slice(5,7),16); d[i+3]=q>r-1.2?Math.round(255*(r-q)/1.2):255; }
      ctx.putImageData(img,0,0); }
    function cur(){ return A.hsv2hex(st.h,st.s,st.v); }
    function ui(fromState){
      var c=fromState?cur():A.hex, r=wheel.clientWidth/2||55;
      knob.style.left=(r+Math.cos(st.h*Math.PI/180)*st.s*r)+"px"; knob.style.top=(r+Math.sin(st.h*Math.PI/180)*st.s*r)+"px"; knob.style.background=cur();
      dim.style.opacity=String(1-st.v); V.value=Math.round(st.v*100);
      V.style.background="linear-gradient(90deg,"+A.hsv2hex(st.h,st.s,VMIN)+","+A.hsv2hex(st.h,st.s,1)+")";
      hex.textContent=c.toUpperCase(); wheel.setAttribute("aria-valuenow",String(Math.round(st.h)));
      nm.textContent=A.isCustom()?"Custom":A.palette[A.key].name;
      sw.innerHTML=A.order.map(function(k){ var p=A.palette[k], on=A.key===k; return '<button type="button" class="apS" role="radio" data-acc="'+k+'" aria-checked="'+on+'" aria-label="'+p.name+'" title="'+p.name+'" style="color:'+p.hex+'"><i style="background:'+p.hex+'"></i></button>'; }).join("");
    }
    function fromHex(h){ var o=A.hex2hsv(h); st.h=o.h; st.s=o.s; st.v=Math.max(VMIN,o.v); }
    function apply(){ A.set(cur()); ui(true); }
    function pos(e){ var b=wheel.getBoundingClientRect(), r=b.width/2, dx=e.clientX-b.left-r, dy=e.clientY-b.top-r, q=Math.sqrt(dx*dx+dy*dy);
      st.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360; st.s=Math.min(1,q/r); apply(); }
    var down=false;
    wheel.addEventListener("pointerdown",function(e){ down=true; try{ wheel.setPointerCapture(e.pointerId); }catch(x){} pos(e); e.preventDefault(); });
    wheel.addEventListener("pointermove",function(e){ if(down) pos(e); });
    wheel.addEventListener("pointerup",function(){ down=false; }); wheel.addEventListener("pointercancel",function(){ down=false; });
    wheel.addEventListener("keydown",function(e){ var k=e.key, d=e.shiftKey?10:3;
      if(k==="ArrowLeft"||k==="ArrowDown") st.h-=d; else if(k==="ArrowRight"||k==="ArrowUp") st.h+=d; else if(k==="+") st.s=Math.min(1,st.s+.05); else if(k==="-") st.s=Math.max(0,st.s-.05); else return;
      st.h=(st.h+360)%360; apply(); e.preventDefault(); });
    V.addEventListener("input",function(){ st.v=Math.max(VMIN,(+V.value||100)/100); apply(); });
    sw.addEventListener("click",function(e){ var b=e.target.closest("[data-acc]"); if(!b) return; A.set(b.getAttribute("data-acc")); fromHex(A.hex); ui(false); });
    window.addEventListener("t3accent",function(){ if(A.hex.toLowerCase()!==cur().toLowerCase()) fromHex(A.hex); ui(false); });
    draw(); fromHex(A.hex); ui(false);
    // the wheel is measured once it is visible
    new MutationObserver(function(){ ui(false); }).observe(el.closest(".sheet")||document.body,{attributes:true,attributeFilter:["class"]});
    window.addEventListener("resize",function(){ ui(false); });
  }
  window.T3AccentPicker={mount:mount};
})();
