/* Driv3 add/edit car form: type-ahead for Insurer (bundled list) and Garage (DVSA Active MOT test stations list, OGL v3, plus OpenStreetMap via Photon + Overpass). No keys, nothing stored off the phone. */
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
  var g=$("fGarage"),ph=$("fPhone"),em=$("fEmail"),hint=$("phoneHint"),webHint=$("webHint"),addrHint=$("garageAddr");
  if(!g)return;
  var t=null,seq=0;
  var ga=attach(g,function(h){if(h.mot)pickMot(h.mot);else pickGarage(h)});
  function place(p){return [p.street?((p.housenumber?p.housenumber+" ":"")+p.street):"",p.city||p.town||p.village||p.district||p.county,p.postcode].filter(Boolean).join(", ")}
  function photon(q,tag){
    return fetch("https://photon.komoot.io/api/?q="+encodeURIComponent(q)+"&limit=8&lang=en&lat=54.0&lon=-2.5&osm_tag="+tag)
      .then(function(r){return r.json()}).then(function(d){return d.features||[]}).catch(function(){return []});
  }
  /* DVSA Active MOT test stations (OGL v3), static shards in data/mot/<2 chars>.json built by proxy/build-mot-stations.mjs */
  var STOP={};"mot mots motor motors ltd limited garage garages services service centre center car cars auto autos and the of tyre tyres repairs repair co uk vehicle vehicles test testing station engineering commercial commercials".split(" ").forEach(function(w){STOP[w]=1});
  var shardCache={},outcodes=null,here=null;
  function norm(s){return String(s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()}
  function getJson(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.json()})}
  function shard(k){if(!/^[a-z0-9]{2}$/.test(k))return Promise.resolve([]);
    return shardCache[k]||(shardCache[k]=getJson("./data/mot/"+k+".json?v=2026-11-05b").catch(function(){delete shardCache[k];return []}))}
  /* Only use location if the phone already allows it - never prompt here */
  try{if(navigator.permissions&&navigator.geolocation)navigator.permissions.query({name:"geolocation"}).then(function(st){
    if(st.state!=="granted")return;
    navigator.geolocation.getCurrentPosition(function(p){here=[p.coords.latitude,p.coords.longitude];
      getJson("./data/mot/outcodes.json?v=2026-11-05b").then(function(o){outcodes=o}).catch(function(){})},function(){},{maximumAge:600000,timeout:8000})}).catch(function(){})}catch(e){}
  function dist(pc){if(!here||!outcodes)return 1e9;var c=outcodes[String(pc).split(" ")[0]];if(!c)return 1e9;
    var dy=c[0]-here[0],dx=(c[1]-here[1])*Math.cos(here[0]*Math.PI/180);return dx*dx+dy*dy}
  function dvsa(q){
    var qn=norm(q),qw=qn.split(" ").filter(Boolean);if(!qw.length)return Promise.resolve([]);
    var key=qw.filter(function(w){return w.length>=2&&!STOP[w]})[0]||qw[0];
    if(key.length<2)return Promise.resolve([]);
    return shard(key.slice(0,2)).then(function(rows){
      var qj=qn.replace(/ /g,""),out=[];
      rows.forEach(function(r){
        var nn=norm(r[0]),nw=nn.split(" "),tw=norm(r[2]+" "+r[3]).split(" "),all=nw.concat(tw);
        var ok=qw.every(function(w){return all.some(function(x){return x.indexOf(w)===0})}),score;
        if(ok)score=(nn.indexOf(qn)===0?0:qw.every(function(w){return nw.some(function(x){return x.indexOf(w)===0})})?1:2);
        else if(nn.replace(/ /g,"").indexOf(qj)>-1)score=3;else return;
        out.push({r:r,s:score,d:dist(r[3])});
      });
      out.sort(function(a,b){return a.s-b.s||a.d-b.d||a.r[0].localeCompare(b.r[0])||a.r[2].localeCompare(b.r[2])});
      return out.slice(0,8).map(function(o){return {mot:o.r}});
    });
  }
  function render(h){
    if(h.mot){var r=h.mot;return "<b>"+esc(r[0])+"</b><small>"+esc([r[1].split(", ")[0],r[2],r[3]].filter(Boolean).join(", "))+(r[4]?" &middot; "+esc(r[4]):"")+"</small>"}
    var p=h.properties;return "<b>"+esc(p.name)+"</b><small>"+esc(place(p))+"</small>"}
  g.addEventListener("input",function(){
    if(hint)hint.hidden=true;if(webHint)webHint.hidden=true;if(addrHint)addrHint.hidden=true;delete g.dataset.web;
    var q=g.value.trim();clearTimeout(t);
    if(q.length<2){ga.hide();return}
    var n=++seq,mine=[];
    dvsa(q).then(function(h){if(n!==seq)return;mine=h;if(h.length)ga.show(h,render)});
    if(q.length<3)return;
    t=setTimeout(function(){
      Promise.all(["shop:car_repair","shop:tyres","shop:car"].map(function(tag){return photon(q,tag)})).then(function(res){
        if(n!==seq)return;
        var seen={},hits=[];
        res.forEach(function(fs){fs.forEach(function(f){var p=f.properties||{};
          if(!p.name||p.countrycode&&p.countrycode!=="GB")return;
          var k=p.osm_type+p.osm_id;if(seen[k])return;seen[k]=1;
          /* skip OSM places already in the MOT list (same name and postcode district) */
          var dup=mine.some(function(m){return norm(m.mot[0])===norm(p.name)&&(!p.postcode||m.mot[3].split(" ")[0]===String(p.postcode).toUpperCase().split(" ")[0])});
          if(!dup)hits.push(f)})});
        var all=mine.concat(hits).slice(0,10);
        if(all.length)ga.show(all,render);
      });
    },300);
  });
  function setIf(el,v){if(el&&v&&(!el.value.trim()||el.dataset.auto==="1")){el.value=v;el.dataset.auto="1"}}
  [ph,em].forEach(function(el){if(el)el.addEventListener("input",function(){el.dataset.auto=""})});
  function pickMot(r){
    g.value=r[0];g.dataset.addr=[r[1],r[2],r[3]].filter(Boolean).join(", ");
    if(addrHint){addrHint.textContent=g.dataset.addr;addrHint.hidden=false}
    if(em&&em.dataset.auto==="1"){em.value="";}
    setIf(ph,r[4]);
    if(hint)hint.hidden=!!(ph&&ph.value.trim());
    /* look for the same garage on OpenStreetMap to find its website, then email */
    var name=g.value,pcd=r[3].split(" ")[0];
    photon(r[0]+" "+r[2],"shop:car_repair").then(function(fs){
      if(g.value!==name)return;
      var w=norm(r[0]).split(" ").filter(function(x){return !STOP[x]})[0]||norm(r[0]);
      var f=fs.filter(function(f){var p=f.properties||{};return p.name&&norm(p.name).indexOf(w)>-1&&(!p.postcode||String(p.postcode).toUpperCase().split(" ")[0]===pcd)})[0];
      if(f)pickGarage(f,true);
    });
  }
  function pickGarage(f,keepName){
    var p=f.properties||{};if(!keepName){g.value=p.name||g.value;delete g.dataset.addr}
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
        if(!keepName)setIf(ph,phone);setIf(em,mail);
        if(hint)hint.hidden=!!(ph&&ph.value.trim());
        var site=(tg.website||tg["contact:website"]||tg.url||"").split(";")[0].trim();
        if(site){g.dataset.web=site;g.dataset.webFor=g.value}
        var proxy=(window.MOT_PROXY||"").replace(/\/$/,"");
        if(!site||!proxy||(ph&&ph.value.trim()&&(!em||em.value.trim())))return;
        var name=g.value;
        return fetch(proxy+"/?contact="+encodeURIComponent(site)).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(w){
          if(!w||g.value!==name)return;
          var did=false;
          if(ph&&!ph.value.trim()&&w.phone){setIf(ph,w.phone);did=true}
          if(em&&(!em.value.trim()||em.dataset.auto==="1")&&w.email){setIf(em,w.email);did=true}
          if(hint)hint.hidden=!!(ph&&ph.value.trim());
          if(webHint)webHint.hidden=!did;
        });
      }).catch(function(){});
  }
})();
