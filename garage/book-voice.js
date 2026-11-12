/* Garage booking dictation: Web Speech API, continuous until the user taps the mic again. */
(function(root){
  "use strict";
  function norm(s){ return String(s||"").replace(/\s+/g," ").trim().toLowerCase(); }
  function joinSaid(base,said){
    said=String(said||"").replace(/\s+/g," ").trim();
    base=String(base||"");
    if(!said) return base;
    if(!base.trim()) return said;
    if(/\n$/.test(base)) return base+said;
    var b=base.replace(/[ \t]+$/,"");
    if(/^[.,!?;:]/.test(said)){
      if(/[.!?]$/.test(b)&&/^[.!?]/.test(said)) return b+" "+said.replace(/^[.,!?;:\s]+/,"");
      return b+said;
    }
    if(/[.!?]$/.test(b)) return b+" "+said.charAt(0).toUpperCase()+said.slice(1);
    return b+" "+said;
  }
  function withInterim(base,interim){
    interim=String(interim||"").replace(/\s+/g," ").trim();
    if(!interim) return String(base||"");
    var b=String(base||"");
    if(!b.trim()) return interim;
    if(/[ \t\n]$/.test(b)) return b+interim;
    if(/^[.,!?;:]/.test(interim)) return b+interim;
    return b+" "+interim;
  }
  function applyFinal(base,said,last){
    said=String(said||"").replace(/\s+/g," ").trim();
    base=String(base||"");
    last=String(last||"");
    if(!said) return {base:base,last:last,changed:false};
    var n=norm(said),b=norm(base),l=norm(last);
    if(b.endsWith(n)) return {base:base,last:said,changed:false};
    if(l&&n===l) return {base:base,last:last,changed:false};
    if(l&&n.indexOf(l)===0&&b.endsWith(l)){
      var extra=said.replace(/\s+/g," ").trim();
      // Keep only the part that extends the last final.
      var rest=extra.slice(l.length).replace(/^\s+/,"");
      if(!rest) return {base:base,last:said,changed:false};
      var joined=base.replace(/[ \t]+$/,"")+" "+rest;
      return {base:joined,last:said,changed:true};
    }
    if(l&&l.indexOf(n)===0) return {base:base,last:last,changed:false};
    return {base:joinSaid(base,said),last:said,changed:true};
  }
  function esc(s){ return String(s||"").replace(/[&<>"']/g,function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]; }); }

  function attach(o){
    function SpeechCtor(){ return o.Speech||root.SpeechRecognition||root.webkitSpeechRecognition; }
    var mic=o.mic, hint=o.hint, box=o.box, live=o.live, wrap=o.wrap, micText=o.micText;
    var want=false, rec=null, failed=false, restartT=null, base="", lastFinal="", starting=false, finished=false;

    if(!SpeechCtor()){
      if(mic) mic.disabled=true;
      if(hint) hint.textContent="Use the microphone on your keyboard to speak, or type your comments. This phone does not support the separate mic button.";
      return {listening:function(){return false}};
    }

    function setUI(on){
      if(!mic) return;
      mic.setAttribute("aria-pressed",on?"true":"false");
      mic.setAttribute("aria-label",on?"Stop listening":"Dictate other work or questions");
      if(micText) micText.textContent=on?"Listening… tap to stop":"Speak your comments";
      if(hint&&on) hint.textContent="Listening… tap to stop";
      if(wrap) wrap.classList.toggle("is-listening",on);
    }
    function showLive(interim){
      if(!live) return;
      var text=withInterim(base,interim);
      var extra=text.slice(String(base||"").length);
      live.innerHTML=esc(base)+(extra?'<span class="interim">'+esc(extra)+"</span>":"");
      live.hidden=!want;
      if(box&&live) live.scrollTop=box.scrollTop;
    }
    function commit(){
      var max=o.max||4000;
      if(base.length>max) base=base.slice(0,max);
      if(box) box.value=base;
      if(o.onCommit) o.onCommit();
    }
    function clearRestart(){ if(restartT){ clearTimeout(restartT); restartT=null; } }
    function hook(r){
      r.lang="en-GB";
      r.interimResults=true;
      r.continuous=true;
      try{ r.maxAlternatives=1; }catch(e){}
      r.onstart=function(){ starting=false; if(want) setUI(true); };
      r.onresult=function(e){
        if(!want) return;
        var interim="";
        for(var i=e.resultIndex;i<e.results.length;i++){
          var alt=e.results[i][0];
          var t=(alt&&alt.transcript)||"";
          if(e.results[i].isFinal){
            var next=applyFinal(base,t,lastFinal);
            base=next.base;
            if(next.last) lastFinal=next.last;
            if(next.changed) commit();
          }else interim+=t;
        }
        showLive(interim);
      };
      r.onerror=function(ev){
        var err=(ev&&ev.error)||"";
        if(err==="no-speech"||err==="aborted") return;
        if(err==="not-allowed"||err==="service-not-allowed"){
          failed=true; want=false; finish("Could not use voice typing. Type instead, or use the microphone on your keyboard.");
        }
      };
      r.onend=function(){
        rec=null; starting=false;
        if(want&&!failed&&!(root.document&&root.document.hidden)){
          clearRestart();
          restartT=setTimeout(function(){ restartT=null; if(want&&!failed) begin(); },280);
        }else finish();
      };
    }
    function begin(){
      if(!want||starting) return;
      var Ctor=SpeechCtor();
      if(!Ctor) return;
      try{ if(rec){ rec.onend=null; rec.stop(); } }catch(e){}
      rec=new Ctor();
      hook(rec);
      starting=true;
      try{ rec.start(); }
      catch(e){
        starting=false;
        clearRestart();
        restartT=setTimeout(function(){ restartT=null; if(want&&!failed) begin(); },400);
      }
    }
    function finish(msg){
      if(finished&&!want) return;
      finished=true;
      clearRestart();
      want=false; starting=false;
      if(rec){
        var r=rec; rec=null;
        try{ r.onstart=r.onresult=r.onerror=r.onend=null; r.stop(); }catch(e){}
      }
      if(box){ box.value=base; box.readOnly=false; }
      if(live) live.hidden=true;
      setUI(false);
      if(hint) hint.textContent=msg||"Check your comments before sending. You can also use the microphone on your keyboard.";
      if(o.onCommit) o.onCommit();
    }
    function startListen(){
      failed=false; finished=false; want=true;
      base=box?box.value:"";
      lastFinal="";
      if(box) box.readOnly=true;
      setUI(true);
      showLive("");
      begin();
    }
    function stopListen(){
      want=false;
      if(rec){ try{ rec.stop(); }catch(e){} }
      else finish();
      setTimeout(function(){ if(!want) finish(); },600);
    }

    if(mic) mic.onclick=function(){ if(want) stopListen(); else startListen(); };
    if(root.document) root.document.addEventListener("visibilitychange",function(){
      if(root.document.hidden&&want) stopListen();
    });
    if(box&&live) box.addEventListener("scroll",function(){ live.scrollTop=box.scrollTop; });

    return {
      listening:function(){return want},
      start:startListen,
      stop:stopListen,
      getBase:function(){return base},
      applyFinal:applyFinal
    };
  }

  var api={norm:norm,joinSaid:joinSaid,withInterim:withInterim,applyFinal:applyFinal,attach:attach};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else root.D3BookVoice=api;
})(typeof window!=="undefined"?window:typeof global!=="undefined"?global:this);
