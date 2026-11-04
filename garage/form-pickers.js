/* Driv3 add/edit car form: type-ahead for Insurer (bundled list) and Garage (OpenStreetMap via Photon + Overpass). No keys, nothing stored off the phone. */
(function(){
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return "&#"+c.charCodeAt(0)+";"})}
  function attach(input,onPick){
    var wrap=document.createElement("div");wrap.className="suggest";
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    var list=document.createElement("div");list.className="suggest-list hide";wrap.appendChild(list);
    var api={hide:function(){list.className="suggest-list hide";list.innerHTML="";list._hits=null},
      show:function(hits,render){if(!hits.length||document.activeElement!==input){api.hide();return}
        list._hits=hits;list.className="suggest-list";
        list.innerHTML=hits.map(function(h,i){return "<button type='button' class='suggest-hit' data-i='"+i+"'>"+render(h)+"</button>"}).join("")}};
    list.addEventListener("mousedown",function(e){var b=e.target.closest(".suggest-hit");if(!b||!list._hits)return;e.preventDefault();
      var h=list._hits[+b.getAttribute("data-i")];api.hide();if(h)onPick(h)});
    input.addEventListener("blur",function(){setTimeout(api.hide,180)});
    input.addEventListener("keydown",function(e){if(e.key==="Escape")api.hide()});
    return api;
  }
  /* Insurer */
  var ins=$("fInsName"),web=$("fInsWeb");
  if(ins&&window.D3_INSURERS){
    var ia=attach(ins,function(h){ins.value=h[0];if(web)web.value=h[1]});
    ins.addEventListener("input",function(){
      var q=ins.value.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
      if(!q){ia.hide();return}
      var hits=D3_INSURERS.filter(function(r){return r[0].toLowerCase().replace(/[^a-z0-9]/g,"").indexOf(q)>-1})
        .sort(function(a,b){var x=a[0].toLowerCase().replace(/[^a-z0-9]/g,"").indexOf(q),y=b[0].toLowerCase().replace(/[^a-z0-9]/g,"").indexOf(q);return x-y||a[0].localeCompare(b[0])}).slice(0,8);
      ia.show(hits,function(r){return "<b>"+esc(r[0])+"</b><small>"+esc(r[1].replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,""))+"</small>"});
    });
  }
  /* Garage */
  var g=$("fGarage"),ph=$("fPhone"),em=$("fEmail"),hint=$("phoneHint"),webHint=$("webHint");
  if(!g)return;
  var t=null,seq=0;
  var ga=attach(g,pickGarage);
  function place(p){return [p.street?((p.housenumber?p.housenumber+" ":"")+p.street):"",p.city||p.town||p.village||p.district||p.county,p.postcode].filter(Boolean).join(", ")}
  function photon(q,tag){
    return fetch("https://photon.komoot.io/api/?q="+encodeURIComponent(q)+"&limit=8&lang=en&lat=54.0&lon=-2.5&osm_tag="+tag)
      .then(function(r){return r.json()}).then(function(d){return d.features||[]}).catch(function(){return []});
  }
  g.addEventListener("input",function(){
    if(hint)hint.hidden=true;if(webHint)webHint.hidden=true;delete g.dataset.web;
    var q=g.value.trim();clearTimeout(t);
    if(q.length<3){ga.hide();return}
    t=setTimeout(function(){
      var n=++seq;
      Promise.all(["shop:car_repair","shop:tyres","shop:car"].map(function(tag){return photon(q,tag)})).then(function(res){
        if(n!==seq)return;
        var seen={},hits=[];
        res.forEach(function(fs){fs.forEach(function(f){var p=f.properties||{};
          if(!p.name||p.countrycode&&p.countrycode!=="GB")return;
          var k=p.osm_type+p.osm_id;if(seen[k])return;seen[k]=1;hits.push(f)})});
        ga.show(hits.slice(0,8),function(f){var p=f.properties;return "<b>"+esc(p.name)+"</b><small>"+esc(place(p))+"</small>"});
      });
    },250);
  });
  function pickGarage(f){
    var p=f.properties||{};g.value=p.name||g.value;
    var ty={N:"node",W:"way",R:"relation"}[p.osm_type];
    if(!ty||!p.osm_id)return;
    var q="[out:json][timeout:15];"+ty+"("+p.osm_id+");out tags;";
    function tags(d){return (d&&d.elements&&d.elements[0]&&d.elements[0].tags)||null}
    function osmApi(){return fetch("https://api.openstreetmap.org/api/0.6/"+ty+"/"+p.osm_id+".json").then(function(r){return r.json()}).then(tags)}
    var ctl=window.AbortController?new AbortController():null;var to=setTimeout(function(){if(ctl)ctl.abort()},6000);
    fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"},signal:ctl?ctl.signal:undefined})
      .then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){var t=tags(d);if(!t)throw 0;return t})
      .catch(osmApi)
      .then(function(tg){
        clearTimeout(to);tg=tg||{};
        var phone=(tg.phone||tg["contact:phone"]||"").split(";")[0].trim();
        var mail=(tg.email||tg["contact:email"]||"").split(";")[0].trim();
        if(ph&&!ph.value.trim()&&phone)ph.value=phone;
        if(em&&!em.value.trim()&&mail)em.value=mail;
        if(hint)hint.hidden=!!(ph&&ph.value.trim());
        var site=(tg.website||tg["contact:website"]||tg.url||"").split(";")[0].trim();
        if(site){g.dataset.web=site;g.dataset.webFor=g.value}
        var proxy=(window.MOT_PROXY||"").replace(/\/$/,"");
        if(!site||!proxy||(ph&&ph.value.trim()&&(!em||em.value.trim())))return;
        var name=g.value;
        return fetch(proxy+"/?contact="+encodeURIComponent(site)).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(w){
          if(!w||g.value!==name)return;
          var did=false;
          if(ph&&!ph.value.trim()&&w.phone){ph.value=w.phone;did=true}
          if(em&&!em.value.trim()&&w.email){em.value=w.email;did=true}
          if(hint)hint.hidden=!!(ph&&ph.value.trim());
          if(webHint)webHint.hidden=!did;
        });
      }).catch(function(){});
  }
})();
