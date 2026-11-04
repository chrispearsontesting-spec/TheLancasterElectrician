/* Shared GOV.UK vehicle tax lookup (used by home-app.js and tax.html). */
(function(){
  var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function toIso(txt){ var x=/(\d{1,2}) (\w{3})\w* (\d{4})/.exec(txt||""); if(!x) return ""; var i=MON.indexOf(x[2].charAt(0).toUpperCase()+x[2].slice(1,3).toLowerCase()); return i<0?"":x[3]+"-"+("0"+(i+1)).slice(-2)+"-"+("0"+x[1]).slice(-2); }
  // Parse a proxy ?tax=1 response. Only trust a status the page really stated.
  function parseTax(d){
    d=d||{};
    var raw=String(d.raw||""), t=String(d.tax||"").trim();
    var trusted=!(/timed out|session/i.test(raw) || !/tax due|tax expired|untaxed|sorn/i.test(raw));
    if(!trusted) t="";
    var m=/tax due:?\s*(\d{1,2} \w+ \d{4})/i.exec(raw), due=m?toIso(m[1]):"";
    return {ok:trusted, status:t, due:due};
  }
  function fetchTax(plate){
    var proxy=(window.MOT_PROXY||"").replace(/\/$/,"");
    plate=String(plate||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!proxy||!plate) return Promise.resolve({ok:false,status:"",due:"",data:{}});
    return fetch(proxy+"/?plate="+plate+"&tax=1").then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .catch(function(){ return {}; })
      .then(function(d){ var p=parseTax(d); p.data=d; return p; });
  }
  window.D3Tax={toIso:toIso, parse:parseTax, fetch:fetchTax};
})();
