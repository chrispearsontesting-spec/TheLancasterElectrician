/* Mechanic uploads Worker URL (no secrets). On localhost a test URL can be set in localStorage "gt.uploadsApi". */
window.UPLOADS_API = (function(){
  var live = "https://dipstick-uploads.chris-pearson-testing.workers.dev";
  try{
    if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem("gt.uploadsApi")) return localStorage.getItem("gt.uploadsApi");
  }catch(e){}
  return live;
})();
