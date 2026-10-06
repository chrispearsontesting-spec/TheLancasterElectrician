window.trimFor=function(info){
  var list=window.MPG_UK||[];
  if(!list.length||!info) return null;
  var make=String(info.make||"").toLowerCase();
  var model=String(info.model||"").toLowerCase().replace(/\s+/g," ");
  var fuel=String(info.fuel||"").toLowerCase();
  var best=null, score=0, i;
  for(i=0;i<list.length;i++){
    var row=list[i];
    var rm=String(row[0]||"").toLowerCase();
    var rmodel=String(row[1]||"").toLowerCase();
    if(make && rm.indexOf(make.slice(0,4))<0 && make.indexOf(rm.slice(0,4))<0) continue;
    if(model && rmodel.indexOf(model)<0 && model.indexOf(rmodel)<0) continue;
    var pts=rmodel.length;
    var rf=String(row[3]||"").toLowerCase();
    if(fuel && rf.indexOf(fuel.slice(0,4))>=0) pts+=25;
    var desc=String(row[2]||"");
    if(/\b(D[2-6]|TDI|TSI|TFSI|CDI|CDTI|HDI|DCI|CRDI|ECOBOOST|T[5-8]|B[4-6])\b/i.test(desc)) pts+=12;
    if(pts>score){ best=row; score=pts; }
  }
  if(!best||score<10) return null;
  var desc=String(best[2]||"");
  var found=desc.match(/\b(D[2-6]|TDI|TSI|TFSI|CDI|CDTI|HDI|dCi|CRDi|EcoBoost|T[5-8]|B[4-6]|GTI|GTD|V6|V8)\b/i);
  var badge=found?found[0].toUpperCase():"";
  return {badge:badge, desc:desc, make:best[0], model:best[1], fuel:best[3], mpg:best[6], scheme:best[8]};
};
