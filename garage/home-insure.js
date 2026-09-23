(function(){
  function vrnOf(c){return String((c&&c.plate)||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
  function spaced(v){
    if(!v) return "";
    if(v.length>4) return v.slice(0,-3)+" "+v.slice(-3);
    return v;
  }
  function compareUrl(c){
    var v=vrnOf(c);
    var base="https://www.gocompare.com/journeys/car/vehicle";
    if(!v) return base;
    return base+"?registration="+encodeURIComponent(v)+"&vrn="+encodeURIComponent(v)+"&reg="+encodeURIComponent(v)+"&registrationNumber="+encodeURIComponent(v);
  }
  function toast(msg){
    var t=document.getElementById("plateToast");
    if(!t){
      t=document.createElement("div");
      t.id="plateToast";
      t.style.cssText="position:fixed;left:12px;right:12px;bottom:16px;z-index:40;background:#16120e;color:#f3efe6;border:1px solid #6b7280;border-radius:14px;padding:12px 14px;font-weight:700;text-align:center";
      document.body.appendChild(t);
    }
    t.textContent=msg;
    t.style.display="block";
    setTimeout(function(){t.style.display="none"},3500);
  }
  var _paint=window.paint;
  if(typeof _paint==="function"){
    window.paint=function(){
      _paint();
      var items=document.querySelectorAll("#dues .item");
      for(var i=0;i<items.length;i++){
        var h=items[i].querySelector("h3");
        if(!h||h.textContent!=="Insurance") continue;
        if(items[i].querySelector("[data-compare]")) return;
        var acts=items[i].querySelector(".acts")||items[i];
        var b=document.createElement("button");
        b.className="btn";
        b.type="button";
        b.setAttribute("data-compare","1");
        b.textContent="Compare";
        acts.appendChild(b);
      }
    };
    window.paint();
  }
  document.getElementById("dues").addEventListener("click",function(e){
    var b=e.target.closest("[data-compare]");
    if(!b)return;
    var c=car();
    var v=vrnOf(c);
    try{if(v&&navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(v)}catch(x){}
    if(v) toast(spaced(v)+" copied — paste it on GoCompare if the box is empty");
    window.open(compareUrl(c),"_blank","noopener");
  });
})();
