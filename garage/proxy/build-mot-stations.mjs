// Build garage/data/mot/*.json from the DVSA Active MOT test stations CSV (OGL v3).
// Run quarterly:  node garage/proxy/build-mot-stations.mjs [path/to/active-mot-stations.csv]
// With no path it finds the CSV link on https://www.gov.uk/government/publications/active-mot-test-stations
// Output: data/mot/<2-char prefix>.json  (each station listed under every word's first 2 chars)
//         data/mot/outcodes.json         (postcode district -> [lat,lon] from postcodes.io, OGL)
import fs from "node:fs"; import path from "node:path"; import {fileURLToPath} from "node:url";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "mot");
async function getCsv(p){
  if(p) return fs.readFileSync(p,"utf8");
  const page = await (await fetch("https://www.gov.uk/government/publications/active-mot-test-stations")).text();
  const m = page.match(/https:\/\/assets\.publishing\.service\.gov\.uk\/[^"']+\.csv/);
  if(!m) throw new Error("CSV link not found on GOV.UK page");
  console.log("Downloading", m[0]); return await (await fetch(m[0])).text();
}
function parseCsv(t){const rows=[];let r=[],f="",q=false;for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
  else if(c=='"')q=true;else if(c==','){r.push(f);f=""}else if(c=='\n'){r.push(f);rows.push(r);r=[];f=""}else if(c!='\r')f+=c}
  if(f||r.length){r.push(f);rows.push(r)}return rows}
const UP=new Set("MOT ATS UK GB BMW VW HGV LGV PSV 4X4 4WD MG DVSA RAC AA KTM TVR BP CB DJ JB JD JR JT RS SJ ST TJ UPVC".split(" "));
const LOW=new Set("and of the at in on for by".split(" "));
function tidy(s){s=(s||"").trim().replace(/\s+/g," ");return s.split(" ").map((w,i)=>{
  if(UP.has(w.replace(/[^A-Z0-9]/g,""))&&w.replace(/[^A-Z0-9]/g,"").length===w.replace(/[^A-Za-z0-9]/g,"").length)return w;
  const lw=w.toLowerCase(); if(i>0&&LOW.has(lw))return lw;
  if(lw==="ltd"||lw==="ltd.")return "Ltd"; if(lw==="plc")return "plc"; if(lw==="llp")return "LLP";
  if(/^\(?[a-z]\)?$/.test(lw)&&i>0)return w; // single initials stay caps
  return lw.replace(/(^|[\s\-\/\(&'.])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/'S\b/g,"'s").replace(/\bMc([a-z])/g,(m,a)=>"Mc"+a.toUpperCase());
}).join(" ")}
function phone(p){let d=(p||"").replace(/\D/g,"");if(d.startsWith("44"))d="0"+d.slice(2);if(d.length===10&&d[0]!=="0")d="0"+d;
  if(!/^0\d{9,10}$/.test(d))return (p||"").trim();
  if(/^0(20|23|24|28|29)/.test(d))return d.slice(0,3)+" "+d.slice(3,7)+" "+d.slice(7);
  if(/^0(7|800|808|3|8|9)/.test(d)&&d.length===11)return d.slice(0,5)+" "+d.slice(5);
  if(/^01\d1|^011/.test(d))return d.slice(0,4)+" "+d.slice(4,7)+" "+d.slice(7);
  return d.slice(0,5)+" "+d.slice(5)}
// Common words: only indexed when first in the name. Keep in sync with STOP in mot-garages.js
const STOP=new Set("mot mots motor motors ltd limited garage garages services service centre center car cars auto autos and the of tyre tyres repairs repair co uk vehicle vehicles test testing station engineering commercial commercials".split(" "));
const norm=s=>s.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const rows=parseCsv(await getCsv(process.argv[2])); const H=rows.shift();const ix=n=>H.indexOf(n);
const shards={}, outs=new Set(); let n=0;
for(const r of rows){ if(r.length<8||!r[ix("Trading_Name")])continue; n++;
  const pc=(r[ix("Postcode")]||"").toUpperCase().trim(); const oc=pc.split(" ")[0]; if(oc)outs.add(oc);
  const addr=[r[ix("Address1")],r[ix("Address2")],r[ix("Address3")]].filter(Boolean).map(tidy).join(", ");
  const rec=[tidy(r[ix("Trading_Name")]).replace(/([A-Za-z]) - ([A-Za-z])/g,"$1-$2"),addr,tidy(r[ix("Town")]),pc,phone(r[ix("Phone")])];
  const ws=norm(rec[0]).split(" ").filter(w=>w.length>=2);
  const keys=new Set(ws.filter((w,i)=>i===0||!STOP.has(w)).map(w=>w.slice(0,2)));
  const joined=norm(rec[0]).replace(/ /g,""); if(joined.length>=2)keys.add(joined.slice(0,2));
  for(const k of keys)(shards[k]=shards[k]||[]).push(rec);
}
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
for(const k in shards)fs.writeFileSync(path.join(OUT,k+".json"),JSON.stringify(shards[k]));
// outcode centroids
const oc={}; const list=[...outs];
for(let i=0;i<list.length;i+=20){await Promise.all(list.slice(i,i+20).map(async o=>{
  try{const j=await (await fetch("https://api.postcodes.io/outcodes/"+encodeURIComponent(o))).json();
    if(j&&j.result&&j.result.latitude)oc[o]=[+j.result.latitude.toFixed(3),+j.result.longitude.toFixed(3)]}catch(e){}}))}
fs.writeFileSync(path.join(OUT,"outcodes.json"),JSON.stringify(oc));
fs.writeFileSync(path.join(OUT,"meta.json"),JSON.stringify({stations:n,shards:Object.keys(shards).length,outcodes:Object.keys(oc).length,built:new Date().toISOString().slice(0,10),source:"https://www.gov.uk/government/publications/active-mot-test-stations",licence:"OGL v3.0"}));
console.log("stations",n,"shards",Object.keys(shards).length,"outcodes",Object.keys(oc).length,"/",list.length);
