// node garage/speech-note.test.js — simulated Android-style SpeechRecognition event sequences.
const assert=require("assert"); const S=require("./speech-note.js");
const R=(t,f)=>Object.assign([{transcript:t}],{isFinal:!!f});
let n=0; const t=(name,fn)=>{fn();n++;console.log("ok -",name)};
function run(base,sessions){ // sessions: array of arrays of events (each event = array of results)
  let committed=[], text=base;
  for(const evs of sessions){ let last={finals:[],interim:""};
    for(const ev of evs){ last=S.readResults(ev); text=S.compose(base,committed,last); }
    committed=S.mergeSegments(committed.concat(last.finals, last.finals.length?[]:(last.interim?[last.interim]:[])));
  }
  return text;
}
t("Android cumulative interims then final (user's bug)",()=>{
  const words="the front desks were changed".split(" "); const evs=[];
  for(let i=1;i<=words.length;i++) evs.push([R(words.slice(0,i).join(" "),false)]);
  evs.push([R("the front desks were changed",true)]);
  assert.equal(run("",[evs]),"the front desks were changed");
});
t("Android cumulative finals in one results list",()=>{
  assert.equal(run("",[[[R("the",1),R("the front",1),R("the front discs",1),R("the front discs were changed",1)]]]),"the front discs were changed");
});
t("interim shown live, never duplicated",()=>{
  const S1=S.readResults([R("front pads",1),R("front pads replaced",0)]);
  assert.equal(S.compose("Note:",[],S1),"Note: front pads replaced");
});
t("desktop-style separate finals are appended",()=>{
  assert.equal(run("",[[[R("front pads replaced",1),R(" rear tyres at 3mm",1)]]]),"front pads replaced rear tyres at 3mm");
});
t("auto-restart sessions (continuous=false) keep earlier text",()=>{
  assert.equal(run("Checked car.",[
    [[R("brake",0)],[R("brake fluid",0)],[R("brake fluid changed",1)]],
    [[R("tyres",0)],[R("tyres ok",1)]],
  ]),"Checked car. brake fluid changed tyres ok");
});
t("repeated final of same phrase is dropped; case/punctuation-insensitive",()=>{
  assert.equal(run("",[[[R("Front desks were changed.",1),R("front desks were changed",1)]]]),"Front desks were changed.");
});
t("session ending without final keeps interim",()=>{
  assert.equal(run("",[[[R("oil",0)],[R("oil leak",0)]]]),"oil leak");
});
t("no speech leaves the base text untouched",()=>{ assert.equal(run("abc ",[[[]]]),"abc "); });
console.log(`\n${n} passed`);
