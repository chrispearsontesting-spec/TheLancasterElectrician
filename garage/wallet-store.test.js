var assert=require("assert");
var S=require("./wallet-store.js");

function iso(d){ return d; }
// Freeze "today" by passing ncbAt/ins relative to a known clock — ncbCurrent uses Date().
// We test the anniversary arithmetic by choosing dates relative to the real today.
var today=new Date(); today.setHours(12,0,0,0);
function ymd(offsetDays){
  var d=new Date(today.getTime()+offsetDays*86400000);
  var m=d.getMonth()+1, day=d.getDate();
  return d.getFullYear()+"-"+String(m).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}

// Recorded today, next renewal in the future → still the base years
assert.equal(S.ncbCurrent({ncbYears:5,ncbAt:ymd(0)}, {ins:ymd(100)}), 5);

// Recorded more than a year before a past anniversary
// Set anniversary = today (renewal month/day is today), ncbAt = 400 days ago, base 4
// Anniversaries landed: one or two depending on leap/alignment.
var past=ymd(-400);
var result=S.ncbCurrent({ncbYears:4,ncbAt:past},{ins:ymd(0)});
assert.ok(result===5||result===6, "expected 5 or 6 after ~400 days, got "+result);

// Future ncbAt (next renewal date stored as the counting-from date) does not bump yet
assert.equal(S.ncbCurrent({ncbYears:9,ncbAt:ymd(30)},{ins:ymd(30)}), 9);

// Zero years after a claim, future renewal stays 0
assert.equal(S.ncbCurrent({ncbYears:0,ncbAt:ymd(0)},{ins:ymd(200)}), 0);

// Next increase date is the next anniversary of car.ins
var next=S.ncbNextDate({ncbYears:5,ncbAt:ymd(0)},{ins:ymd(40)});
assert.equal(next, ymd(40));

console.log("wallet-store ncb tests ok");

// Insurance refs: blobs are not stored twice
var rec={docs:[{id:"w1",slot:"insurance",insId:"a1",ref:1,blob:{size:10}},{id:"w2",slot:"v5c",number:"84729103615"}]};
var out=S.stripRefs(rec);
assert.ok(!("blob" in out.docs[0]), "ref doc blob stripped");
assert.equal(rec.docs[0].blob.size,10, "in-memory record untouched");
var r2={docs:[]};
assert.ok(S.migrateInsurance(r2,[{id:"a1",name:"p.pdf",type:"application/pdf",blob:{size:1},at:5}]));
assert.equal(r2.docs.length,1); assert.equal(r2.docs[0].ref,1); assert.ok(!r2.docs[0].blob);
assert.ok(!S.migrateInsurance(r2,[{id:"a1",name:"p.pdf",blob:{size:1},at:5}]), "no duplicate on second run");
console.log("wallet-store ref tests ok");
