/* Driv3 Show mode: strict link parsers shared by the editor and the public page (mirrors show-lib.js on the Worker). */
(function(){
  function url(u){ try{ return new URL(String(u||"").trim()); }catch(e){ return null; } }
  function youtubeId(u){
    var s=String(u||"").trim(); if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    var x=url(s); if(!x||(x.protocol!=="https:"&&x.protocol!=="http:")) return null;
    var host=x.hostname.toLowerCase().replace(/^(www|m)\./,""), id=null;
    if(host==="youtu.be") id=x.pathname.split("/")[1];
    else if(host==="youtube.com"||host==="music.youtube.com"||host==="youtube-nocookie.com"){
      if(x.pathname==="/watch") id=x.searchParams.get("v");
      else { var m=x.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/); if(m) id=m[2]; }
    }
    return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
  }
  function playlist(u){
    var x=url(u); if(!x||x.protocol!=="https:") return null;
    var host=x.hostname.toLowerCase().replace(/^www\./,"");
    if(host==="open.spotify.com"){
      var m=x.pathname.replace(/^\/intl-[a-z]{2}(-[a-z]{2})?\//i,"/").match(/^\/(embed\/)?(playlist|album)\/([A-Za-z0-9]{22})$/);
      return m?{kind:"spotify",type:m[2],id:m[3]}:null;
    }
    if(host==="music.youtube.com"||host==="youtube.com"||host==="m.youtube.com"){
      var id=x.searchParams.get("list"); return id&&/^[A-Za-z0-9_-]{10,64}$/.test(id)?{kind:"ytmusic",id:id}:null;
    }
    return null;
  }
  function httpsImage(u){
    var x=url(u); if(!x||x.protocol!=="https:"||x.username||x.password||String(u).length>500) return null;
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x.hostname)?x.toString():null;
  }
  function insta(v){
    var s=String(v||"").trim(), x=url(s);
    if(x&&/(^|\.)instagram\.com$/i.test(x.hostname)) s=x.pathname.split("/")[1]||"";
    s=s.replace(/^@/,""); return /^[A-Za-z0-9._]{1,30}$/.test(s)?s:null;
  }
  window.Driv3Parse={youtubeId:youtubeId,playlist:playlist,httpsImage:httpsImage,insta:insta,
    showId:function(s){ s=String(s||""); return /^[A-Za-z0-9_-]{22}$/.test(s)?s:null; },
    fileName:function(n){ n=String(n||""); return /^(p[a-z0-9]{12}\.(jpg|png|webp)|c[a-z0-9]{12}\.(mp4|webm))$/.test(n)?n:null; }};
})();
