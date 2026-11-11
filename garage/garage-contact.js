/* Driv3 garage email finder. Fills a garage email only when none is saved (or the saved one was auto-filled).
   Order: car.motEmail -> remembered/auto lookup (?findcontact=, needs name + postcode) -> garage website (?contact=).
   Postcode comes from the car (motPostcode) or, for older cars, an exact name match in the local DVSA MOT list.
   Only the garage's business name/postcode/phone/website are sent, never the user's details. */
(function(root){
  "use strict";
  var STOP={};"mot mots motor motors ltd limited garage garages services service centre center car cars auto autos and the of tyre tyres repairs repair co uk vehicle vehicles test testing station engineering commercial commercials".split(" ").forEach(function(w){STOP[w]=1});
  var MAIL=/^[^@\s?&#]+@[^@\s?&#]+\.[a-z]{2,24}$/i;
  function norm(s){return String(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()}
  function digits(s){return String(s||"").replace(/\D/g,"").replace(/^44/,"0")}
  function base(){return String(root.MOT_PROXY||"").replace(/\/$/,"")}
  function getJson(f,u){return f(u).then(function(r){if(!r||!r.ok)throw new Error("lookup failed");return r.json()})}
  /* Exact-name match in the static DVSA shard. Ambiguous names resolve only when the saved phone matches. */
  function station(name,phone,opts){
    var o=opts||{},f=o.fetch||root.fetch,w=norm(name).split(" ").filter(Boolean);
    var key=w.filter(function(x){return x.length>=2&&!STOP[x]})[0]||w[0];
    if(!key||key.length<2||!f)return Promise.resolve(null);
    return getJson(f,(o.dataBase||"./data/mot/")+key.slice(0,2)+".json?v=2026-11-05b").then(function(rows){
      var same=(rows||[]).filter(function(r){return norm(r[0])===norm(name)}),d=digits(phone);
      if(d.length>=9){var byPhone=same.filter(function(r){return digits(r[4]).slice(-10)===d.slice(-10)});if(byPhone.length===1)return byPhone[0]}
      return same.length===1?same[0]:null;
    }).catch(function(){return null});
  }
  function needs(car){var c=car||{};return !!(String(c.motName||"").trim()||c.motWeb)&&(!String(c.motEmail||"").trim()||c.motEmailAuto===true)}
  /* -> Promise<{email,source:"saved"|"user"|"auto"|"website"|"",postcode,town,website}> ; never rejects */
  function find(car,opts){
    var c=car||{},o=opts||{},f=o.fetch||root.fetch,proxy=o.proxy!=null?o.proxy:base(),saved=String(c.motEmail||"").trim();
    var empty={email:"",source:"",postcode:c.motPostcode||"",town:c.motTown||"",website:c.motWeb||""};
    if(saved&&c.motEmailAuto!==true)return Promise.resolve(Object.assign({},empty,{email:saved,source:"saved"}));
    if(!f||!proxy)return Promise.resolve(empty);
    var name=String(c.motName||"").trim();
    var pcP=c.motPostcode?Promise.resolve({pc:c.motPostcode,town:c.motTown||""}):name?station(name,c.motPhone,o).then(function(r){return r?{pc:r[3],town:r[2]}:null}):Promise.resolve(null);
    return pcP.then(function(loc){
      var out=Object.assign({},empty,loc?{postcode:loc.pc,town:loc.town}:{});
      var first=loc&&name?getJson(f,proxy+"/?findcontact="+encodeURIComponent(name)+"&postcode="+encodeURIComponent(loc.pc)+"&phone="+encodeURIComponent(c.motPhone||"")+"&town="+encodeURIComponent(loc.town||"")).catch(function(){return {}}):Promise.resolve({});
      return first.then(function(w){
        w=w||{};if(w.website&&!out.website)out.website=w.website;
        if(w.email&&MAIL.test(w.email))return Object.assign(out,{email:w.email,source:w.source==="user"?"user":"auto"});
        var site=out.website;if(!site)return out;
        return getJson(f,proxy+"/?contact="+encodeURIComponent(site)).then(function(x){
          if(x&&x.email&&MAIL.test(x.email))return Object.assign(out,{email:x.email,source:"website"});return out}).catch(function(){return out});
      });
    }).catch(function(){return empty});
  }
  function hint(source){return source==="user"?"Saved by other Trac3 users - please check":source==="website"?"Found on their website - please check":source==="auto"?"Found automatically - please check":""}
  /* Share a user-typed garage email so other Driv3 users get it pre-filled (garage business email only). */
  function remember(name,postcode,email,opts){
    var o=opts||{},f=o.fetch||root.fetch,proxy=o.proxy!=null?o.proxy:base();
    if(!f||!proxy||!name||!postcode||!MAIL.test(String(email||"").trim()))return false;
    try{f(proxy+"/?savecontact=1&name="+encodeURIComponent(name)+"&postcode="+encodeURIComponent(postcode)+"&email="+encodeURIComponent(String(email).trim().toLowerCase())).catch(function(){})}catch(e){return false}
    return true;
  }
  var api={find:find,needs:needs,station:station,hint:hint,remember:remember,norm:norm};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.D3GarageContact=api;
})(typeof self!=="undefined"?self:this);
