/* Driv3 mechanic voice note: record with MediaRecorder, transcribe on our Worker (Workers AI Whisper).
   Pure helpers are exported for node tests; Driv3Voice.attach() wires up the page. */
(function(root){
  var MAX_MS=60000;
  var TYPES=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4;codecs=mp4a.40.2","audio/mp4","audio/aac"];
  // Best mimeType this browser can record (Chrome/Brave: webm/opus, Firefox: ogg, iOS Safari: mp4). "" = browser default.
  function pickMime(MR){
    if(!MR||typeof MR.isTypeSupported!=="function") return "";
    for(var i=0;i<TYPES.length;i++){ try{ if(MR.isTypeSupported(TYPES[i])) return TYPES[i]; }catch(e){} }
    return "";
  }
  // Append dictated text to what's already in the box with sensible spacing.
  function appendText(base,said,max){
    said=String(said||"").replace(/\s+/g," ").trim(); base=String(base||"");
    var out;
    if(!said) out=base;
    else if(!base.trim()) out=said;
    else if(/\n$/.test(base)) out=base+said;
    else { var b=base.replace(/[ \t]+$/,""); out=b+(/[.!?]$/.test(b)?" ":(/[,;:]$/.test(b)?" ":". "))+said; }
    return max?out.slice(0,max):out;
  }
  function fmt(ms){ var s=Math.max(0,Math.floor(ms/1000)); return Math.floor(s/60)+":"+("0"+(s%60)).slice(-2); }
  // Turn an error into the message shown under the note box.
  function errorText(kind,status){
    var kb=" You can also tap the 🎤 on your keyboard.";
    if(kind==="denied") return "Microphone blocked. Allow the mic for this site in your browser settings and try again."+kb;
    if(kind==="nomic") return "No microphone found."+kb;
    if(kind==="unsupported") return "Voice notes don't work in this browser."+kb;
    if(kind==="network") return "No connection, so the voice note couldn't be turned into text."+kb;
    if(kind==="empty") return "Didn't catch anything. Tap the mic and speak a little closer.";
    if(status===429) return "Too many voice notes in a minute. Wait a moment and try again."+kb;
    if(status===413) return "That voice note was too long (60 seconds max).";
    return "Couldn't turn that into text."+kb;
  }
  var api={pickMime:pickMime,appendText:appendText,fmt:fmt,errorText:errorText,MAX_MS:MAX_MS};

  // opts: {btn, note, hint, url: function()->string, idleHint, max}
  api.attach=function(o){
    var w=root, nav=w.navigator||{}, MR=w.MediaRecorder;
    var btn=o.btn, hint=o.hint, state="idle", rec=null, stream=null, chunks=[], t0=0, timer=null, stopT=null, ac=null, raf=0, an=null;
    var bars=btn.querySelectorAll(".vb i"), tm=btn.parentNode.querySelector(".micTime");
    function setState(s){ state=s; btn.setAttribute("data-state",s); btn.parentNode.classList.toggle("recording",s==="rec"); btn.setAttribute("aria-pressed",s==="rec"?"true":"false");
      btn.setAttribute("aria-label",s==="rec"?"Stop and transcribe":(s==="busy"?"Transcribing":"Record a voice note")); btn.disabled=(s==="busy"); }
    function say(t,bad){ hint.textContent=t; hint.classList.toggle("bad",!!bad); }
    function cleanup(){
      clearInterval(timer); clearTimeout(stopT); cancelAnimationFrame(raf); raf=0;
      if(stream){ stream.getTracks().forEach(function(t){t.stop()}); stream=null; }
      if(ac){ try{ac.close()}catch(e){} ac=null; } an=null;
      for(var i=0;i<bars.length;i++) bars[i].style.transform="";
    }
    function draw(){
      if(!an) return;
      var d=new Uint8Array(an.fftSize); an.getByteTimeDomainData(d);
      var n=bars.length, seg=Math.floor(d.length/n);
      for(var i=0;i<n;i++){ var s=0; for(var k=i*seg;k<(i+1)*seg;k++){ var v=(d[k]-128)/128; s+=v*v; }
        var lvl=Math.min(1,Math.sqrt(s/seg)*3); bars[i].style.transform="scaleY("+(0.22+lvl*0.78).toFixed(3)+")"; }
      raf=requestAnimationFrame(draw);
    }
    async function start(){
      if(!MR||!nav.mediaDevices||!nav.mediaDevices.getUserMedia){ say(errorText("unsupported"),true); return; }
      try{ stream=await nav.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}}); }
      catch(e){ cleanup(); var n=e&&e.name; say(errorText(n==="NotAllowedError"||n==="SecurityError"?"denied":(n==="NotFoundError"||n==="OverconstrainedError"?"nomic":"unsupported")),true); return; }
      var mime=pickMime(MR);
      try{ rec=mime?new MR(stream,{mimeType:mime,audioBitsPerSecond:32000}):new MR(stream); }
      catch(e){ try{ rec=new MR(stream); }catch(e2){ cleanup(); say(errorText("unsupported"),true); return; } }
      chunks=[];
      rec.ondataavailable=function(ev){ if(ev.data&&ev.data.size) chunks.push(ev.data); };
      rec.onstop=function(){ var type=(rec&&rec.mimeType)||mime||"audio/webm"; cleanup(); send(new Blob(chunks,{type:type.split(";")[0]})); };
      try{ var AC=w.AudioContext||w.webkitAudioContext; if(AC){ ac=new AC(); var src=ac.createMediaStreamSource(stream); an=ac.createAnalyser(); an.fftSize=1024; src.connect(an); if(ac.state==="suspended") ac.resume(); draw(); } }catch(e){ an=null; }
      rec.start(1000); t0=Date.now(); setState("rec"); say("Listening… tap again to finish.");
      if(tm) tm.textContent="0:00";
      timer=setInterval(function(){ if(tm) tm.textContent=fmt(Date.now()-t0); },250);
      stopT=setTimeout(stop,MAX_MS);
    }
    function stop(){ if(state!=="rec") return; setState("busy"); say("Transcribing…"); try{ rec.stop(); }catch(e){ cleanup(); setState("idle"); } }
    async function send(blob){
      setState("busy"); say("Transcribing…");
      if(!blob.size||blob.size<200){ setState("idle"); say(errorText("empty"),true); return; }
      var r;
      try{ r=await fetch(o.url(),{method:"POST",headers:{"Content-Type":blob.type||"audio/webm"},body:blob}); }
      catch(e){ setState("idle"); say(errorText("network"),true); return; }
      var j={}; try{ j=await r.json(); }catch(e){}
      setState("idle");
      if(!r.ok){ say(r.status===404&&j.error?j.error:errorText("http",r.status),true); return; }
      if(!j.text){ say(errorText("empty"),true); return; }
      o.note.value=appendText(o.note.value,j.text,o.max||4000);
      o.note.dispatchEvent(new Event("input",{bubbles:true}));
      say(o.idleHint);
    }
    btn.onclick=function(){ if(state==="idle") start(); else if(state==="rec") stop(); };
    setState("idle"); btn.classList.remove("hide"); say(o.idleHint);
    if(!MR||!nav.mediaDevices) { say("Tip: tap the 🎤 on your keyboard to talk instead of typing."); btn.classList.add("hide"); }
    return {stop:stop};
  };
  if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.Driv3Voice=api;
})(this);
