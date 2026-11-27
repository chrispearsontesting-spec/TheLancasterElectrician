/* Remember live-camera rotation (gt.camFlip) per mode and facing.
   CSS transform on the preview <video> only — recordings and saved clips are unchanged. */
(function(root){
  var KEY="gt.camFlip";
  var DEF={dashcam:{environment:180,user:0},performance:{environment:0,user:0}};
  function mode(m){ return m==="performance"?"performance":"dashcam"; }
  function facing(f){ return f==="user"?"user":"environment"; }
  function rotOf(v){
    var n=Number(v);
    if(n===180) return 180;
    if(n===0) return 0;
    return null;
  }
  function read(){
    try{
      var o=JSON.parse(root.localStorage.getItem(KEY)||"null");
      return o&&typeof o==="object"?o:{};
    }catch(e){ return {}; }
  }
  function get(m,f){
    m=mode(m); f=facing(f);
    var o=read(), n=o[m]&&rotOf(o[m][f]);
    return n==null?DEF[m][f]:n;
  }
  function set(m,f,rot){
    m=mode(m); f=facing(f);
    var o=read();
    if(!o[m]||typeof o[m]!=="object") o[m]={};
    var n=rotOf(rot); o[m][f]=n==null?DEF[m][f]:n;
    try{ root.localStorage.setItem(KEY,JSON.stringify(o)); }catch(e){}
    return o[m][f];
  }
  function apply(el,rot){
    if(!el||!el.style) return;
    el.style.transform="rotate("+(rot||0)+"deg)";
  }
  function boot(m,f,el){
    var r=get(m,f);
    apply(el,r);
    return r;
  }
  function toggle(m,f,el){
    var r=(get(m,f)+180)%360;
    set(m,f,r);
    apply(el,r);
    return r;
  }
  root.D3CamFlip={key:KEY,get:get,set:set,apply:apply,boot:boot,toggle:toggle};
})(typeof window!=="undefined"?window:globalThis);
