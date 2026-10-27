/* Driv3 speech-to-text helpers for the mechanic note.
   Android Chrome/Brave often return the whole phrase so far in every result ("the", "the front", "the front desks"),
   so we never append blindly: the box is rebuilt each event from (text before dictation) + deduped finals + interim. */
(function(root){
  function norm(t){ return String(t||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim(); }
  // Merge transcript pieces: a piece that extends the previous one replaces it; a repeat/prefix of it is dropped.
  function mergeSegments(list){
    var out=[];
    for(var i=0;i<list.length;i++){
      var t=String(list[i]||"").replace(/\s+/g," ").trim(); if(!t) continue;
      var last=out.length?out[out.length-1]:null, nt=norm(t), nl=last!=null?norm(last):"";
      if(last!=null && nt===nl){ if(t.length>last.length) out[out.length-1]=t; }
      else if(last!=null && nt.indexOf(nl)===0) out[out.length-1]=t;
      else if(last!=null && nl.indexOf(nt)===0) continue;
      else out.push(t);
    }
    return out;
  }
  // results: SpeechRecognitionResultList-like. Returns {finals:[...], interim:"..."} for one recognition session.
  function readResults(results){
    var finals=[], interim=[];
    for(var i=0;i<results.length;i++){
      var r=results[i], t=r&&r[0]?r[0].transcript:"";
      if(r.isFinal) finals.push(t); else interim.push(t);
    }
    return {finals:mergeSegments(finals), interim:mergeSegments(interim).join(" ")};
  }
  function compose(base, committed, session){
    var segs=mergeSegments(committed.concat(session.finals, session.interim?[session.interim]:[]));
    var said=segs.join(" ");
    if(!said) return base;
    var b=base&&!/\s$/.test(base)?base+" ":(base||"");
    return b+said;
  }
  var api={mergeSegments:mergeSegments,readResults:readResults,compose:compose};
  if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.Driv3Speech=api;
})(this);
