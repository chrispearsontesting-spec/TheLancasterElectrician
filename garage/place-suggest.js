function bindPlaceSearch(input){
  if(!input) return;
  var wrap=document.createElement("div");
  wrap.className="suggest";
  input.parentNode.insertBefore(wrap,input);
  wrap.appendChild(input);
  var list=document.createElement("div");
  list.className="suggest-list hide";
  wrap.appendChild(list);
  var t=null, seq=0;
  function hide(){list.className="suggest-list hide";list.innerHTML=""}
  function label(f){
    var p=f.properties||{};
    return [p.name,p.street,p.postcode,p.city||p.town||p.village,p.county,p.state].filter(Boolean).filter(function(v,i,a){return a.indexOf(v)===i}).slice(0,4).join(", ");
  }
  function show(hits){
    if(!hits.length){hide();return}
    list.className="suggest-list";
    list.innerHTML=hits.map(function(f,i){
      return "<button type='button' class='suggest-hit' data-i='"+i+"'><b>"+label(f)+"</b></button>";
    }).join("");
    list._hits=hits;
  }
  input.addEventListener("input",function(){
    var q=input.value.trim();
    clearTimeout(t);
    if(q.length<2){hide();return}
    t=setTimeout(function(){
      var n=++seq;
      fetch("https://photon.komoot.io/api/?q="+encodeURIComponent(q+", United Kingdom")+"&limit=6&lang=en")
        .then(function(r){return r.json()})
        .then(function(data){
          if(n!==seq) return;
          show((data.features||[]).slice(0,6));
        }).catch(function(){});
    },220);
  });
  list.addEventListener("mousedown",function(e){
    var b=e.target.closest(".suggest-hit"); if(!b)return;
    e.preventDefault();
    var f=list._hits[+b.getAttribute("data-i")];
    if(!f)return;
    input.value=label(f);
    hide();
  });
  input.addEventListener("blur",function(){setTimeout(hide,180)});
}
bindPlaceSearch(document.getElementById("from"));
bindPlaceSearch(document.getElementById("to"));
