/* Driv3 live fuel price for journeys. Source: prices.json (UK daily average, refreshed by the
   update-fuel-prices GitHub workflow - same file Route costs uses). Fuel type from the selected car. */
(function(root){
  var BASE=function(){ return root.DRIV3_PUBLIC_BASE||""; };
  function car(){ try{ var s=JSON.parse(localStorage.getItem("gt.garage")||"null"); return s&&s.cars&&(s.cars[s.i]||s.cars[0])||{}; }catch(e){ return {}; } }
  /* diesel | petrol | hybrid | electric  (+ known:false when we had to guess) */
  function fuelOf(c){
    c=c||car();
    var f=String(c.fuel||c.fuelType||"").toLowerCase();
    var hay=f+" "+String(c.engine||"")+" "+String(c.name||"")+" "+String(c.nick||"");
    hay=hay.toLowerCase();
    if(/electric|\bev\b|bev/.test(f)&&!/hybrid/.test(f)) return {fuel:"electric",known:true};
    if(/hybrid|phev/.test(f)) return {fuel:"hybrid",known:true};
    if(/diesel|heavy oil/.test(f)) return {fuel:"diesel",known:true};
    if(/petrol/.test(f)) return {fuel:"petrol",known:true};
    if(/hybrid|phev/.test(hay)) return {fuel:"hybrid",known:false};
    if(/electric|\bev\b/.test(hay)) return {fuel:"electric",known:false};
    if(/diesel|tdi|cdti|hdi|dci|crdi|\bd\d|\bd\b|tdci|bluehdi|multijet/.test(hay)) return {fuel:"diesel",known:false};
    return {fuel:"petrol",known:false};
  }
  var LABEL={diesel:"Diesel",petrol:"Petrol",hybrid:"Hybrid (petrol)",electric:"Electric"};
  /* Resolves {fuel,label,known,electric,price,unit,date,checked}. price = p/litre, or p/kWh for electric. */
  function live(c){
    var fo=fuelOf(c);
    return fetch(BASE()+"prices.json?t="+Date.now(),{cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(p){
      var el=fo.fuel==="electric", price=el?+p.electric_pkwh:(fo.fuel==="diesel"?+p.diesel_ppl:+p.petrol_ppl);
      var out={fuel:fo.fuel,label:LABEL[fo.fuel],known:fo.known,electric:el,price:price,unit:el?"p/kWh":"p/L",date:p.date||"",checked:Date.now()};
      try{ localStorage.setItem("gt.livePrice",JSON.stringify(out)); }catch(e){}
      return out;
    }).catch(function(){
      var last=null; try{ last=JSON.parse(localStorage.getItem("gt.livePrice")||"null"); }catch(e){}
      if(last&&last.fuel===fo.fuel){ last.stale=true; return last; }
      return null;
    });
  }
  /* Native TrackService costs as miles/mpg*4.54609*ppl/100; for electric pass an equivalent so that = miles/(mi per kWh)*p/kWh/100. */
  function nativeRate(eff,price,electric){ return electric?{mpg:(+eff||3.5)*4.54609,ppl:+price}:{mpg:+eff||38,ppl:+price}; }
  root.D3Fuel={fuelOf:fuelOf,live:live,nativeRate:nativeRate,LABEL:LABEL};
})(this);
