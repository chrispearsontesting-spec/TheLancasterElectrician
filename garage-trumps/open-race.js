setTimeout(function(){
  if(/open=race/.test(location.search)){
    var b=document.getElementById("btnRace");
    if(b) b.click();
  }
},400);
