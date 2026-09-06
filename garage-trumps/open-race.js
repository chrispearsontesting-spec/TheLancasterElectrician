setTimeout(function(){
  var q=location.search||"";
  if(/open=race/.test(q)){
    var b=document.getElementById("btnRace");
    if(b) b.click();
  }
  if(/open=jobs/.test(q)){
    var j=document.getElementById("btnJobsDiy");
    if(j) j.click();
  }
},400);
