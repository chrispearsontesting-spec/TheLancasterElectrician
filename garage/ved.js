/* UK VED from 1 Apr 2026. Annual rate for a car already on the road. */
window.vedAnnual=function(car){
  var year=+(car&&car.year||0);
  var fuel=String(car&&car.fuel||"").toLowerCase();
  var co2=car&&car.co2!=null?+car.co2:null;
  var ev=fuel.indexOf("electric")>=0||fuel==="ev"||co2===0;
  var hybrid=/hybrid|phev|afv/.test(fuel);
  if(!year && car && car.plate && window.plateYear) year=window.plateYear(car.plate)||0;
  if(year>=2017){
    return {ok:true, amount:200, label:"£200 / year", note:"Standard rate from year 2 (from April 2026). Extra £440/year for 5 years if the list price was over £40k (£50k for some EVs)."};
  }
  if(year>=2001){
    if(ev) return {ok:true, amount:20, label:"£20 / year", note:"Zero-emission cars first registered 2001–2017."};
    if(co2==null){
      return {ok:false, amount:null, label:"CO₂ band", note:"Cars registered 2001–2016 are taxed on CO₂. Typical family cars are about £180–£295/year. Exact figure arrives with DVLA."};
    }
    var t=[
      [100,20],[110,30],[120,35],[130,165],[140,195],[150,215],
      [165,265],[175,315],[185,355],[200,400],[225,450],[255,620],[9999,670]
    ];
    var i,amt=670;
    for(i=0;i<t.length;i++) if(co2<=t[i][0]){amt=t[i][1];break;}
    if(hybrid && amt>0) amt=Math.max(10,amt-10);
    return {ok:true, amount:amt, label:"£"+amt+" / year", note:"Pre-2017 CO₂ band."};
  }
  if(year>0){
    return {ok:false, amount:null, label:"Engine-size band", note:"Cars first registered before March 2001 are taxed on engine size (under/over 1549cc), not CO₂."};
  }
  return {ok:false, amount:null, label:"Need year", note:"Add the plate or year and we can estimate tax."};
};
