/* Trac3 petrol station brand filter: normalises the brand text in the fuel data ("SAINSBURYS", "ASDA EXPRESS", "Shell Express"...)
   to one of: shell, bp, esso, texaco, jet, tesco, asda, sainsburys, morrisons, others. Selection is saved in gt.fuelBrands (JSON array; none = All). */
(function(root){
  var GROUPS=[
    {id:"shell",label:"Shell",re:/\bshell\b/},{id:"bp",label:"BP",re:/\bbp\b/},{id:"esso",label:"Esso",re:/\besso\b/},{id:"texaco",label:"Texaco",re:/\btexaco\b/},{id:"jet",label:"Jet",re:/\bjet\b/},
    {id:"tesco",label:"Tesco",re:/\btesco\b/,sm:1},{id:"asda",label:"Asda",re:/\basda\b/,sm:1},{id:"sainsburys",label:"Sainsbury's",re:/\bsainsbur/,sm:1},{id:"morrisons",label:"Morrisons",re:/\bmorrison/,sm:1}
  ];
  var SUPER=GROUPS.filter(function(g){return g.sm}).map(function(g){return g.id});
  var KEY="gt.fuelBrands";
  function clean(b){ return " "+String(b==null?"":b).toLowerCase().replace(/[\u2018\u2019'`]/g,"").replace(/[^a-z0-9]+/g," ").trim()+" "; }
  function group(b){ var s=clean(b); for(var i=0;i<GROUPS.length;i++) if(GROUPS[i].re.test(s)) return GROUPS[i].id; return "others"; }
  function ids(){ return GROUPS.map(function(g){return g.id}).concat(["others"]); }
  function sanitize(a){ var ok=ids(); return (Array.isArray(a)?a:[]).filter(function(x,i,s){ return ok.indexOf(x)>=0&&s.indexOf(x)===i; }); }
  function matches(brand,sel){ sel=sanitize(sel); return !sel.length||sel.indexOf(group(brand))>=0; }
  function load(){ try{ return sanitize(JSON.parse(localStorage.getItem(KEY)||"[]")); }catch(e){ return []; } }
  function save(sel){ sel=sanitize(sel); try{ if(sel.length) localStorage.setItem(KEY,JSON.stringify(sel)); else localStorage.removeItem(KEY); }catch(e){} return sel; }
  function label(sel){ sel=sanitize(sel); if(!sel.length) return "All";
    var all=SUPER.every(function(x){return sel.indexOf(x)>=0}), rest=sel.filter(function(x){return !(all&&SUPER.indexOf(x)>=0)}), names=rest.map(function(x){ return x==="others"?"Others":GROUPS.filter(function(g){return g.id===x})[0].label; });
    if(all) names.push("Supermarkets"); return names.length>3?names.slice(0,2).join(", ")+" +"+(names.length-2):names.join(", "); }
  var api={GROUPS:GROUPS,SUPER:SUPER,KEY:KEY,group:group,matches:matches,sanitize:sanitize,load:load,save:save,label:label};
  if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.D3FuelBrands=api;
})(typeof window!=="undefined"?window:this);
