// node garage/tax-renew.test.js
const assert=require("assert");
const T=require("./tax-renew.js");

assert.equal(T.classify("1234 5678 9012 3456"),"v11");
assert.equal(T.classify("1234567890123456"),"v11");
assert.equal(T.classify("12345678901"),"v5c");
assert.equal(T.classify("12345"),"");
assert.equal(T.formatRef("v11","1234567890123456"),"1234 5678 9012 3456");
assert.equal(T.formatRef("v5c","12345678901"),"12345678901");
assert.equal(T.labelFor("v11"),"Reminder letter (V11)");
assert.equal(T.labelFor("v5c"),"Logbook (V5C)");

const v11=T.extractTaxRef("Vehicle tax reminder\nReference number\n1234 5678 9012 3456\nPlease keep this letter.");
assert.ok(v11); assert.equal(v11.type,"v11"); assert.equal(v11.digits,"1234567890123456");
assert.equal(v11.formatted,"1234 5678 9012 3456");

const packed=T.extractTaxRef("Ref: 1234567890123456");
assert.equal(packed.digits,"1234567890123456");

const messy=T.extractTaxRef("Reference\nl234 5678 9O12 3456");
assert.ok(messy,"should recover from O/l OCR swaps");
assert.equal(messy.type,"v11");
assert.equal(messy.digits,"1234567890123456");

const v5c=T.extractTaxRef("V5C Registration Certificate\nDocument reference 84729103615");
assert.ok(v5c); assert.equal(v5c.type,"v5c"); assert.equal(v5c.digits,"84729103615");

const both=T.extractTaxRef("Reminder 1234 5678 9012 3456 and document 84729103615");
assert.equal(both.type,"v11"); assert.equal(both.digits,"1234567890123456");

const phone=T.extractTaxRef("Call 07700 900123 for help");
assert.equal(phone,null,"UK mobile should not be read as a V5C");

assert.equal(T.extractTaxRef(""),null);
assert.equal(T.extractTaxRef("No numbers here"),null);
assert.equal(T.GOV,"https://www.gov.uk/vehicle-tax");
assert.equal(T.V5C_HELP,"https://www.gov.uk/vehicle-log-book");

console.log("tax-renew tests passed");
