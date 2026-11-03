/* Driv3 car scope: which car is selected, and does a saved entry belong to it.
   Entries saved before plates were stored (no plate) belong to one "legacy" car, fixed the first time this runs
   (the car selected then), so they never show under every car. Stored in localStorage "gt.legacyPlate". */
(function(root){
  function vrn(p){ return String(p||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
  function garage(){ try{ var g=JSON.parse(localStorage.getItem("gt.garage")||"null"); if(g&&g.cars) return g; }catch(e){} return {i:0,cars:[]}; }
  function cur(){ var g=garage(); return g.cars[g.i]||g.cars[0]||null; }
  function curIndex(){ var g=garage(); return g.cars[g.i]?g.i:0; }
  function curVrn(){ return vrn((cur()||{}).plate); }
  function legacy(){
    var g=garage(), plates=g.cars.map(function(c){return vrn(c.plate)}).filter(Boolean), L="";
    try{ L=localStorage.getItem("gt.legacyPlate")||""; }catch(e){}
    if(!L&&plates.length){ L=curVrn()||plates[0]; try{ localStorage.setItem("gt.legacyPlate",L); }catch(e){} }
    return plates.indexOf(L)>=0?L:(plates[0]||""); // legacy car sold/removed: fall back to the first car
  }
  /* true if an entry with this plate belongs to the selected car (or to car `forVrn`) */
  function owns(plate,forVrn){
    var me=forVrn!=null?vrn(forVrn):curVrn(), v=vrn(plate);
    if(!me) return true;          // no plate on the selected car: nothing to compare
    return v?v===me:legacy()===me;
  }
  root.D3Car={vrn:vrn,garage:garage,cur:cur,curIndex:curIndex,curVrn:curVrn,legacy:legacy,owns:owns};
})(typeof self!=="undefined"?self:this);
