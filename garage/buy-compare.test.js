import test from 'node:test';
import assert from 'node:assert/strict';
const mem = {};
globalThis.localStorage = { getItem:k => (k in mem ? mem[k] : null), setItem:(k,v) => { mem[k]=String(v); }, removeItem:k => { delete mem[k]; } };
await import('./outlook.js');
await import('./buy-compare.js');
const C = globalThis.T3Compare;
const Y = new Date().getFullYear();
globalThis.T3_MOTNORMS = { year:2025, uk:{c:[1,0.72],b:[1,0.80]}, make:{'FORD|D|c':[900,0.66,0.07]}, model:{'TOYOTA|YARIS|H|b':[41250,0.83,0.045],'FORD|FOCUS|D|c':[91028,0.68,0.068]},
  faults:{'FORD|FOCUS':[['Suspension',0.105]]}, ukFaults:{Suspension:0.09} };
globalThis.T3_RECALLS = [['FORD','FOCUS',2014,2015,'R/2018/053',2018,'engine','Oil sump may crack'],['FORD','FOCUS',2016,2018,'R/2018/351',2019,'gearbox','Clutch pressure plate fracture'],['FORD','FIESTA',2014,2018,'R/2019/001',2019,'brakes','x'],['TOYOTA','GR YARIS',2020,2024,'R/2023/001',2023,'engine','x']];
globalThis.T3_SPECS = [['FORD','FOCUS','1.5L TDCi (120 HP)',2014,2018,'D',1499,118,270,10,121],['TOYOTA','YARIS','1.5 Hybrid',2017,2020,'H',1497,98,111,11.8,103]];
const monthCost = (mpg) => 1000/mpg*4.546*1.75;
function car(plate, make, model, fuel, year, extra={}) {
  return { plate, name:`${make} ${model}`, fuel: /diesel/i.test(fuel)?'diesel':'petrol', mpg: extra.mpg||50,
    info:{ make, model, fuel, year, engine: extra.cc||1497, name:`${make} ${model}`, raw:{ hasOutstandingRecall: extra.recall||'Unknown', firstUsedDate:`${year}-06-01` },
      tests: extra.tests||[{testResult:'PASSED',completedDate:`${Y}-03-01`,odometerValue:extra.miles||40000,defects:[]},{testResult:'PASSED',completedDate:`${Y-1}-03-01`,odometerValue:(extra.miles||40000)-9000,defects:[]}] } };
}
const yaris = car('AB18YAR','TOYOTA','YARIS','Hybrid Electric (Clean)',Y-8,{mpg:60,recall:'No',miles:42000});
const focus = car('CD16FOC','FORD','FOCUS','Diesel',Y-10,{mpg:48,cc:1499,recall:'Yes',miles:89000,
  tests:[{testResult:'FAILED',completedDate:`${Y}-02-01`,odometerValue:89000,defects:[{type:'MAJOR',text:'Brake pipe corroded'}]},{testResult:'PASSED',completedDate:`${Y}-02-03`,odometerValue:89010,defects:[]},{testResult:'PASSED',completedDate:`${Y-1}-02-01`,odometerValue:80000,defects:[{type:'ADVISORY',text:'Corrosion on subframe'}]}]});

test('norm lookup: model, then make, then UK', () => {
  assert.equal(C.normFor('Toyota','Yaris','Hybrid Electric (Clean)',7).level, 'model');
  assert.equal(C.normFor('Ford','Mondeo','Diesel',10).level, 'make');
  assert.equal(C.normFor('Lada','Riva','Diesel',10).level, 'uk');
});
test('recalls match model word and build years, not GR Yaris or Fiesta', () => {
  assert.deepEqual(C.recallsFor('FORD','FOCUS',2017).map(r=>r.no), ['R/2018/351']);
  assert.equal(C.recallsFor('FORD','FOCUS',2016).length, 2, 'registered a year after build still matches');
  assert.equal(C.recallsFor('Toyota','Yaris',2021).length, 0);
});
test('specs give official power for a single matching engine', () => {
  const s = C.specsFor('FORD','FOCUS',2016,'Diesel',1499);
  assert.equal(s.bhp, 118); assert.equal(s.s060, 10);
  assert.equal(C.specsFor('FORD','FOCUS',2010,'Diesel',1499), null);
});
test('the same rules give the cleaner, cheaper car the higher score', () => {
  const A = C.prep(yaris), B = C.prep(focus);
  assert.equal(A.status, 'No'); assert.equal(B.status, 'Yes'); assert.equal(B.conf, 'High');
  const r = C.compare(A, B, { miles:10000, monthCost });
  assert.ok(r.scoreA > r.scoreB, `${r.scoreA} vs ${r.scoreB}`);
  assert.ok(r.cons.b.includes('Open recall on this car'));
  assert.ok(r.pros.a.length <= 3 && r.cons.b.length <= 3);
  assert.match(r.verdict, /Yaris looks the safer buy/);
  assert.match(r.verdict, /open recall/);
  const w = r.parts.reduce((s,p)=>s+p.w,0);
  assert.equal(w, r.weightTotal);
  assert.ok(!r.parts.some(p => p.id === 'price'), 'price left out when not typed');
  assert.ok(r.parts.some(p => p.id === 'perf'), 'performance counts when both have specs');
  assert.equal(r.parts.find(p => p.id === 'wear').w, 15);
});
test('typed prices switch the price share on; swapping sides mirrors the scores', () => {
  C.setUser('AB18YAR','price',9495); C.setUser('CD16FOC','price',7250);
  const r1 = C.compare(C.prep(Object.assign({}, yaris, {user:C.userFor('AB18YAR')})), C.prep(Object.assign({}, focus, {user:C.userFor('CD16FOC')})), {miles:10000, monthCost});
  const r2 = C.compare(C.prep(Object.assign({}, focus, {user:C.userFor('CD16FOC')})), C.prep(Object.assign({}, yaris, {user:C.userFor('AB18YAR')})), {miles:10000, monthCost});
  assert.ok(r1.parts.some(p => p.id === 'price'));
  assert.equal(r1.scoreA, r2.scoreB); assert.equal(r1.scoreB, r2.scoreA);
  assert.ok(r1.pros.b.some(t => /cheaper to buy/.test(t)));
});
test('owner fault logs move the beyond-MOT score and stay per plate', () => {
  const before = C.prep(yaris).beyond;
  const e = C.addLog({ plate:'ab18 yar', cat:'Gearbox', fixed:false, cost:0 });
  const open = C.prep(yaris);
  assert.equal(open.beyond, before - 8); assert.equal(open.conf, 'High');
  assert.equal(C.prep(focus).logs.length, 0);
  C.removeLog(e.id);
  C.addLog({ plate:'AB18YAR', cat:'DPF', fixed:true, cost:900 });
  assert.equal(C.prep(yaris).beyond, Math.min(100, before + 4));
});
test('close scores are called close', () => {
  const A = C.prep(yaris), r = C.compare(A, C.prep(yaris), { miles:10000, monthCost });
  assert.match(r.verdict, /Too close to call/);
});
test('html escapes names and shows credits; the share toggle is off', () => {
  const evil = car('ZZ11ZZZ','TOYOTA','<b>X</b>','Petrol',Y-5);
  const r = C.compare(C.prep(evil), C.prep(yaris), { miles:10000, monthCost });
  const h = C.html(r);
  assert.doesNotMatch(h, /<b>X<\/b>/);
  assert.match(h, /Open Government Licence v3\.0/);
  assert.match(h, /cardata\.wiki, available under CC BY 4\.0/);
  assert.match(C.logHtml('AB18YAR','Toyota Yaris'), /aria-disabled='true'/);
  assert.match(C.howHtml(r), /How we score/);
});
test('recall variants that are a different car or fuel are skipped', () => {
  const save = globalThis.T3_RECALLS;
  globalThis.T3_RECALLS = [['TOYOTA','YARIS CROSS',2020,2024,'R/1',2022,'x','x'],['TOYOTA','YARIS HEV',2020,2024,'R/2',2022,'x','x'],['TOYOTA','YARIS',2020,2024,'R/3',2022,'x','x'],['VAUXHALL','CORSA ELECTRIC',2020,2024,'R/4',2022,'x','x']];
  assert.deepEqual(C.recallsFor('TOYOTA','YARIS',2021,'Petrol').map(r=>r.no), ['R/3']);
  assert.deepEqual(C.recallsFor('TOYOTA','YARIS',2021,'Hybrid Electric (Clean)').map(r=>r.no).sort(), ['R/2','R/3']);
  assert.deepEqual(C.recallsFor('TOYOTA','YARIS CROSS',2021,'Petrol').map(r=>r.no).sort(), ['R/1','R/3']);
  assert.equal(C.recallsFor('VAUXHALL','CORSA',2021,'Petrol').length, 0);
  globalThis.T3_RECALLS = save;
});
