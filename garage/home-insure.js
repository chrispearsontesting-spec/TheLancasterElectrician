(function(){
  function vrnOf(c){return String((c&&c.plate)||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
  function compareUrl(c){
    var v=vrnOf(c);
    var base="https://www.gocompare.com/journeys/car/vehicle";
    return v?base+"?registration="+encodeURIComponent(v)+"&vrn="+encodeURIComponent(v):base;
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
    window.open(compareUrl(c),"_blank","noopener");
  });
})();
