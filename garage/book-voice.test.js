// node garage/book-voice.test.js
const assert=require("assert");
const V=require("./book-voice.js");

assert.equal(V.joinSaid("","  please book an MOT "),"please book an MOT");
assert.equal(V.joinSaid("Please check the brakes.","also the tyres"),"Please check the brakes. Also the tyres");
assert.equal(V.joinSaid("Please check the brakes","and the tyres"),"Please check the brakes and the tyres");
assert.equal(V.joinSaid("Ready,","please"),"Ready, please");
assert.equal(V.joinSaid("Hello.",". more"),"Hello. more"); // leading punct, no extra space
assert.equal(V.joinSaid("Line\n","next"),"Line\nnext");
assert.equal(V.joinSaid("Keep","   "),"Keep");

assert.equal(V.withInterim("Please check","the brakes"),"Please check the brakes");
assert.equal(V.withInterim("Please check ","the brakes"),"Please check the brakes");
assert.equal(V.withInterim("","hello"),"hello");

function ok(base,said,last,expectBase,changed){
  const r=V.applyFinal(base,said,last);
  assert.equal(r.base,expectBase, "applyFinal("+JSON.stringify(base)+","+JSON.stringify(said)+","+JSON.stringify(last)+") => "+JSON.stringify(r.base));
  if(changed!=null) assert.equal(r.changed,changed);
}

// new chunk
ok("Please check the brakes.","also the tyres","","Please check the brakes. Also the tyres",true);
// Android exact repeat of last final
ok("Please check the brakes. Also the tyres","also the tyres","also the tyres","Please check the brakes. Also the tyres",false);
// already at end of base
ok("please book an MOT","please book an MOT","","please book an MOT",false);
// extension of last final after a restart
ok("please book an MOT","please book an MOT for Tuesday","please book an MOT","please book an MOT for Tuesday",true);
// shorter echo of last final
ok("please book an MOT for Tuesday","please book an MOT","please book an MOT for Tuesday","please book an MOT for Tuesday",false);
// empty
ok("Hello","","x","Hello",false);

// Mock SpeechRecognition attach: continuous listening, interim, auto-restart, dedupe
function MockSpeech(){ this.lang=""; this.interimResults=false; this.continuous=false; this.starts=0; MockSpeech.last=this; }
MockSpeech.starts=0;
MockSpeech.prototype.start=function(){ MockSpeech.starts++; this.starts++; const self=this; setImmediate(function(){ if(self.onstart) self.onstart(); }); };
MockSpeech.prototype.stop=function(){ const self=this; setImmediate(function(){ if(self.onend) self.onend(); }); };

function el(props){
  const o=Object.assign({
    disabled:false, value:"", textContent:"", hidden:true, innerHTML:"",
    className:"", readOnly:false, scrollTop:0,
    attributes:{}, classList:{_s:new Set(), toggle:function(n,on){ if(on) this._s.add(n); else this._s.delete(n); }, contains:function(n){return this._s.has(n)}},
    setAttribute:function(k,v){ this.attributes[k]=v; },
    addEventListener:function(){},
    onclick:null
  }, props||{});
  return o;
}

const mic=el(), micText=el(), hint=el(), box=el({value:"Please check the brakes."}), live=el(), wrap=el();
const api=V.attach({
  Speech:MockSpeech, mic:mic, micText:micText, hint:hint, box:box, live:live, wrap:wrap, max:4000
});

assert.equal(typeof mic.onclick,"function");
mic.onclick();
assert.equal(api.listening(),true);
assert.equal(mic.attributes["aria-pressed"],"true");
assert.equal(micText.textContent,"Listening… tap to stop");
assert.match(hint.textContent,/Listening/);

function flush(){ return new Promise(r=>setImmediate(r)); }

(async()=>{
  await flush(); await flush();
  const rec=MockSpeech.last;
  assert.equal(rec.lang,"en-GB");
  assert.equal(rec.interimResults,true);
  assert.equal(rec.continuous,true);
  rec.onresult({
    resultIndex:0,
    results:[{isFinal:false,0:{transcript:"also the"}}]
  });
  assert.match(live.innerHTML,/interim/);
  assert.match(live.innerHTML,/also the/);
  assert.equal(box.value,"Please check the brakes."); // committed text unchanged during interim

  rec.onresult({
    resultIndex:0,
    results:[{isFinal:true,0:{transcript:"also the tyres"}}]
  });
  assert.equal(box.value,"Please check the brakes. Also the tyres");

  const startsBefore=MockSpeech.starts;
  rec.onerror({error:"no-speech"});
  rec.onend();
  await flush(); await flush(); await new Promise(r=>setTimeout(r,350));
  assert.ok(MockSpeech.starts>startsBefore, "should auto-restart after no-speech/end");
  assert.equal(api.listening(),true);
  assert.equal(mic.attributes["aria-pressed"],"true");

  // duplicate final after restart
  MockSpeech.last.onresult({
    resultIndex:0,
    results:[{isFinal:true,0:{transcript:"also the tyres"}}]
  });
  assert.equal(box.value,"Please check the brakes. Also the tyres");

  mic.onclick();
  await flush(); await flush(); await new Promise(r=>setTimeout(r,50));
  assert.equal(api.listening(),false);
  assert.equal(box.value,"Please check the brakes. Also the tyres");
  assert.equal(mic.attributes["aria-pressed"],"false");
  assert.equal(box.readOnly,false);

  console.log("book-voice tests passed");
})().catch(err=>{ console.error(err); process.exit(1); });
