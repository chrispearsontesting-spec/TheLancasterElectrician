import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// outlook.js attaches to globalThis
await import('./outlook.js');
const O = globalThis.T3Outlook;

const high = {
  year: 2022, fuel: 'petrol', make: 'Toyota', model: 'Yaris', name: 'Toyota Yaris',
  tests: [
    { testResult:'PASSED', completedDate:'2026-05-01', odometerValue:28000, odometerUnit:'mi', defects:[
      {type:'ADVISORY', text:'Timing belt replaced at this mileage'}
    ]},
    { testResult:'FAILED', completedDate:'2025-04-28', odometerValue:19100, odometerUnit:'mi', defects:[
      {type:'MAJOR', text:'Nearside front tyre tread below limit'}
    ]},
    { testResult:'PASSED', completedDate:'2025-04-28', odometerValue:19100, odometerUnit:'mi', defects:[]},
    { testResult:'PASSED', completedDate:'2024-04-20', odometerValue:10200, odometerUnit:'mi', defects:[]}
  ]
};

const low = {
  year: 2009, fuel: 'diesel', make: 'Land Rover', model: 'Freelander', name: 'Land Rover Freelander',
  tests: [
    { testResult:'FAILED', completedDate:'2026-06-01', odometerValue:132000, odometerUnit:'mi', defects:[
      {type:'MAJOR', text:'Brake pads worn close to the limit'},
      {type:'ADVISORY', text:'Corrosion on rear subframe'},
      {type:'ADVISORY', text:'Sill corroded, prescribed area'}
    ]},
    { testResult:'PASSED', completedDate:'2025-05-20', odometerValue:168000, odometerUnit:'mi', defects:[
      {type:'ADVISORY', text:'Corrosion on rear subframe'},
      {type:'ADVISORY', text:'Front tyre close to legal limit'}
    ]},
    { testResult:'FAILED', completedDate:'2024-05-18', odometerValue:156000, odometerUnit:'mi', defects:[
      {type:'MAJOR', text:'Exhaust system insecure'}
    ]},
    { testResult:'PASSED', completedDate:'2024-05-19', odometerValue:156100, odometerUnit:'mi', defects:[
      {type:'ADVISORY', text:'Corrosion on rear subframe'}
    ]},
    { testResult:'PASSED', completedDate:'2023-05-10', odometerValue:145000, odometerUnit:'mi', defects:[
      {type:'ADVISORY', text:'Corrosion on rear subframe'}
    ]}
  ]
};

test('high-scoring young Toyota is well above mid-pack', () => {
  const r = O.score(high);
  assert.equal(r.score >= 75, true, 'score '+r.score);
  assert.equal(r.score <= 100, true);
  assert.match(r.summary, /early in its life|mid-life/i);
  assert.ok(r.done.some(j => j.id === 'belt' || j.id === 'tyres'));
  assert.ok(r.up.length >= 1);
  assert.match(O.cardHtml(r), /Estimate/);
  assert.match(O.cardHtml(r), /Work already done/);
});

test('low-scoring old high-mile car with clocking and rust is well below mid-pack', () => {
  const r = O.score(low);
  assert.equal(r.score <= 45, true, 'score '+r.score+' '+JSON.stringify(r.down));
  assert.ok(r.down.some(f => /mileage went down/i.test(f.lab)));
  assert.ok(r.down.some(f => /corrosion/i.test(f.lab)));
  assert.match(r.summary, /late-life|less appealing|high mileage/i);
  assert.match(r.summary, /Budget about £/);
});

test('score is clamped and labelled an estimate', () => {
  const r = O.score({year:1995, miles:300000, make:'Alfa', tests:[]});
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.match(O.cardHtml(r), /Estimate · out of 100/);
});

test('history marks are equal-size Pass/Fail circles in the markup', () => {
  const html = O.historyHtml(low.tests);
  assert.match(html, /motMark fail'>Fail/);
  assert.match(html, /motMark pass'>Pass/);
  assert.doesNotMatch(html, /PASSED ·/);
  assert.equal((html.match(/motMark/g)||[]).length, low.tests.length);
});

test('top factors are at most three each way', () => {
  const r = O.score(low);
  assert.ok(r.up.length <= 3);
  assert.ok(r.down.length <= 3);
});

test('escapes HTML in defect text', () => {
  const html = O.historyHtml([{testResult:'PASSED',completedDate:'2026-01-01',odometerValue:1,defects:[{type:'ADVISORY',text:'<script>x</script>'}]}]);
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /&lt;script&gt;/);
});

test('DVSA pass-rate norm replaces the make list when the model matches', () => {
  const save = globalThis.T3_MOTNORMS;
  globalThis.T3_MOTNORMS = { uk:{c:[1000,0.72]}, make:{}, model:{'VAUXHALL|CORSA|P|c':[5000,0.60,0.06], 'TOYOTA|YARIS|P|c':[5000,0.80,0.05]} };
  const bad = O.score({year:new Date().getFullYear()-10, make:'Vauxhall', model:'Corsa', fuel:'Petrol', tests:[]});
  const good = O.score({year:new Date().getFullYear()-10, make:'Toyota', model:'Yaris', fuel:'Petrol', tests:[]});
  assert.ok(bad.down.some(f => /fails its MOT more than most.*60% vs 72% UK/.test(f.lab)), JSON.stringify(bad.down));
  assert.ok(good.up.some(f => /passes its MOT first time more than most/.test(f.lab)));
  assert.ok(good.score > bad.score);
  globalThis.T3_MOTNORMS = save;
});

test('dangerous defects and repeat fixes-on-the-day count against the car', () => {
  const y = new Date().getFullYear();
  const base = { year:y-9, make:'Ford', model:'Focus', fuel:'Petrol' };
  const clean = O.score({...base, tests:[{testResult:'PASSED',completedDate:`${y}-01-10`,odometerValue:90000,defects:[]},{testResult:'PASSED',completedDate:`${y-1}-01-10`,odometerValue:80000,defects:[]}]});
  const risky = O.score({...base, tests:[
    {testResult:'PASSED',completedDate:`${y}-01-10`,odometerValue:90000,defects:[{type:'PRS',text:'Headlamp aim too high'}]},
    {testResult:'FAILED',completedDate:`${y-1}-01-10`,odometerValue:80000,defects:[{type:'DANGEROUS',text:'Tyre cord exposed',dangerous:true}]},
    {testResult:'PASSED',completedDate:`${y-1}-01-11`,odometerValue:80010,defects:[{type:'PRS',text:'Wiper blade torn'}]}]});
  assert.ok(risky.down.some(f => /dangerous defect/i.test(f.lab)), JSON.stringify(risky.down));
  assert.ok(risky.score < clean.score);
});

test('pass-rate factor also applies when a model fault pack matches', () => {
  const save = globalThis.T3_MOTNORMS, saveF = globalThis.FAULTS;
  globalThis.FAULTS = [{k:['ford','focus'], faults:[{s:'med',t:'x'}]}];
  globalThis.T3_MOTNORMS = { uk:{c:[1,0.72]}, make:{}, model:{'FORD|FOCUS|D|c':[9,0.62,0.07]} };
  const r = O.score({year:new Date().getFullYear()-10, make:'Ford', model:'Focus', fuel:'Diesel', tests:[]});
  assert.ok(r.down.some(f => /fails its MOT more than most/.test(f.lab)), JSON.stringify(r.down));
  globalThis.T3_MOTNORMS = save; globalThis.FAULTS = saveF;
});
