window.ncapUrl=function(r){
  if(r&&r.k&&r.k.length){
    var make=encodeURIComponent(r.k[0]);
    var model=encodeURIComponent((r.k[1]||"").replace(/ /g,"-"));
    if(model) return "https://www.euroncap.com/en/results/"+make+"/"+model;
    return "https://www.euroncap.com/en";
  }
  return "https://www.euroncap.com/en";
};
