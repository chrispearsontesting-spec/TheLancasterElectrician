// node garage/voice-note.test.js
const assert=require("assert"); const V=require("./voice-note.js");
const MR=sup=>({isTypeSupported:t=>sup.includes(t)});
assert.equal(V.pickMime(MR(["audio/webm;codecs=opus","audio/mp4"])),"audio/webm;codecs=opus");
assert.equal(V.pickMime(MR(["audio/mp4"])),"audio/mp4"); // iOS Safari
assert.equal(V.pickMime(MR(["audio/ogg;codecs=opus"])),"audio/ogg;codecs=opus");
assert.equal(V.pickMime(MR([])),""); assert.equal(V.pickMime(undefined),"");
assert.equal(V.appendText("","  Front pads  done. "),"Front pads done.");
assert.equal(V.appendText("Oil changed","Pads done."),"Oil changed. Pads done.");
assert.equal(V.appendText("Oil changed.  ","Pads done."),"Oil changed. Pads done.");
assert.equal(V.appendText("Oil changed,","pads done"),"Oil changed, pads done");
assert.equal(V.appendText("Oil\n","Pads"),"Oil\nPads");
assert.equal(V.appendText("Keep","   "),"Keep");
assert.equal(V.appendText("ab","cdef",5),"ab. c");
assert.equal(V.fmt(0),"0:00"); assert.equal(V.fmt(61500),"1:01"); assert.equal(V.MAX_MS,60000);
assert.match(V.errorText("denied"),/blocked.*keyboard/s); assert.match(V.errorText("unsupported"),/keyboard 🎤|🎤 on your keyboard/);
assert.match(V.errorText("network"),/connection/); assert.match(V.errorText("http",429),/Too many/); assert.match(V.errorText("http",502),/keyboard/);
console.log("voice-note tests passed");
