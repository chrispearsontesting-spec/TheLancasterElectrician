/* Trac3 dashcam clip storage setting, localStorage "gt.dashKeep" = {mode:"loop"|"save"|"forever", days:1|3|7|14|30}.
   loop    = keep the last 24 hours, older clips are overwritten (deleted) - the original behaviour and the default.
   save    = keep each day's clips, delete after `days` (default 1 week).
   forever = never delete automatically. Journeys (miles/cost) are always kept; only the video expires. */
(function(){
  var KEY="gt.dashKeep", DAYS=[1,3,7,14,30];
  function get(){ var o=null; try{ o=JSON.parse(localStorage.getItem(KEY)||"null"); }catch(e){}
    o=o&&typeof o==="object"?o:{}; var m=/^(loop|save|forever)$/.test(o.mode)?o.mode:"loop", d=DAYS.indexOf(+o.days)>=0?+o.days:7; return {mode:m,days:d}; }
  function set(o){ var c=Object.assign(get(),o||{}); localStorage.setItem(KEY,JSON.stringify(c)); return get(); }
  function days(){ var c=get(); return c.mode==="forever"?null:c.mode==="loop"?1:c.days; }
  function period(d){ return d===1?"1 day":d===7?"1 week":d===14?"2 weeks":d===30?"1 month":d+" days"; }
  function label(){ var c=get(); return c.mode==="loop"?"Loop · last 24 hours":c.mode==="save"?"Saved · deleted after "+period(c.days):"Kept until you delete them"; }
  function size(n){ n=+n||0; return n>=1e9?(n/1e9).toFixed(1)+" GB":n>=1e6?Math.round(n/1e6)+" MB":Math.round(n/1e3)+" KB"; }
  window.D3DashKeep={KEY:KEY,DAYS:DAYS,get:get,set:set,days:days,period:period,label:label,size:size};
})();
