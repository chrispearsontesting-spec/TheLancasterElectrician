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
